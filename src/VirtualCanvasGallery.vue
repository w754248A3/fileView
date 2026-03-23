<template>
  <div
    ref="containerRef"
    class="virtual-gallery-container"
    @scroll="handleScroll"
  >
    <div class="page-close" @click="onClose">关闭</div>

    <div class="virtual-gallery-spacer" :style="{ height: `${Math.max(totalHeight, viewportHeight)}px` }">
      <canvas
        ref="canvasRef"
        class="virtual-gallery-canvas"
        :style="canvasStyle"
        @click="handleCanvasClick"
      ></canvas>
    </div>

    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-btn" @click="closeModal">×</button>
        <img :src="currentModalUrl" class="modal-image" alt="Full size" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  urls: string[]
}>()

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

interface ImageRect {
  url: string
  x: number
  y: number
  w: number
  h: number
}

interface ImageEntry {
  url: string
  width: number
  height: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  rect: ImageRect | null
}

const TARGET_COL_WIDTH = 280
const MIN_COL_WIDTH = 180
const GUTTER = 12
const OVERSCAN_PX = 600
const MAX_ACTIVE_BITMAPS = 18

const containerRef = shallowRef<HTMLDivElement | null>(null)
const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
const resizeObserver = shallowRef<ResizeObserver | null>(null)

const entries = ref<ImageEntry[]>(props.urls.map(url => ({
  url,
  width: 1,
  height: 1,
  status: 'idle',
  rect: null,
})))

const isModalOpen = ref(false)
const currentModalUrl = ref('')
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
const viewportWidth = ref(0)
const canvasHeight = ref(0)
const renderStartY = ref(0)
const renderEndY = ref(0)
const totalHeight = ref(0)
const cols = ref(1)
const colWidth = ref(MIN_COL_WIDTH)
const scrollTop = ref(0)

const bitmapCache = new Map<string, ImageBitmap>()
const inflightLoads = new Map<string, AbortController>()
const readyQueue: string[] = []
const imageRects: ImageRect[] = []

let rafId = 0
let metadataAbortController: AbortController | null = null

const canvasStyle = computed(() => ({
  width: `${viewportWidth.value}px`,
  height: `${canvasHeight.value}px`,
  transform: `translateY(${renderStartY.value}px)`,
}))

const onClose = () => emit('onClose')

const log = (message: string, ...args: unknown[]) => {
  console.log(`[VirtualCanvasGallery] ${message}`, ...args)
}

const calcScaledHeight = (entry: ImageEntry) => {
  const ratio = colWidth.value / Math.max(entry.width, 1)
  return Math.max(1, entry.height * ratio)
}

const recomputeLayout = () => {
  if (!viewportWidth.value) return

  const nextCols = Math.max(1, Math.floor((viewportWidth.value + GUTTER) / (TARGET_COL_WIDTH + GUTTER)))
  cols.value = nextCols
  colWidth.value = Math.max(
    MIN_COL_WIDTH,
    (viewportWidth.value - GUTTER * Math.max(0, cols.value - 1)) / cols.value,
  )

  const columnHeights = new Array(cols.value).fill(0)
  imageRects.length = entries.value.length

  for (let index = 0; index < entries.value.length; index += 1) {
    const entry = entries.value[index]
    let targetCol = 0

    for (let i = 1; i < columnHeights.length; i += 1) {
      if (columnHeights[i] < columnHeights[targetCol]) {
        targetCol = i
      }
    }

    const height = calcScaledHeight(entry)
    const x = targetCol * (colWidth.value + GUTTER)
    const y = columnHeights[targetCol]

    const rect: ImageRect = {
      url: entry.url,
      x,
      y,
      w: colWidth.value,
      h: height,
    }

    entry.rect = rect
    imageRects[index] = rect
    columnHeights[targetCol] += height + GUTTER
  }

  totalHeight.value = Math.max(0, ...columnHeights) - (entries.value.length ? GUTTER : 0)
  scheduleRender()
}

const ensureCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas || !viewportWidth.value || !viewportHeight.value) return null

  const nextCanvasHeight = Math.ceil(viewportHeight.value + OVERSCAN_PX * 2)
  canvasHeight.value = nextCanvasHeight

  const dpr = window.devicePixelRatio || 1
  const pixelWidth = Math.max(1, Math.floor(viewportWidth.value * dpr))
  const pixelHeight = Math.max(1, Math.floor(nextCanvasHeight * dpr))

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const evictBitmap = (url: string) => {
  const bitmap = bitmapCache.get(url)
  if (bitmap) {
    bitmap.close()
    bitmapCache.delete(url)
  }
}

const markBitmapRecentlyUsed = (url: string) => {
  const index = readyQueue.indexOf(url)
  if (index >= 0) readyQueue.splice(index, 1)
  readyQueue.push(url)

  while (readyQueue.length > MAX_ACTIVE_BITMAPS) {
    const expiredUrl = readyQueue.shift()
    if (expiredUrl) evictBitmap(expiredUrl)
  }
}

const fetchBitmap = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  return createImageBitmap(blob)
}

const fetchImageNaturalSize = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const size = {
    width: bitmap.width || 1,
    height: bitmap.height || 1,
  }
  bitmap.close()
  return size
}

const getVisibleIndexes = () => {
  const start = Math.max(0, scrollTop.value - OVERSCAN_PX)
  const end = scrollTop.value + viewportHeight.value + OVERSCAN_PX

  const indexes: number[] = []
  for (let i = 0; i < imageRects.length; i += 1) {
    const rect = imageRects[i]
    if (!rect) continue
    if (rect.y + rect.h < start) continue
    if (rect.y > end) continue
    indexes.push(i)
  }
  return indexes
}

const cleanupInvisibleBitmaps = (visibleSet: Set<string>) => {
  for (const url of [...bitmapCache.keys()]) {
    if (!visibleSet.has(url)) {
      evictBitmap(url)
      const queueIndex = readyQueue.indexOf(url)
      if (queueIndex >= 0) readyQueue.splice(queueIndex, 1)
    }
  }

  for (const [url, controller] of inflightLoads.entries()) {
    if (!visibleSet.has(url)) {
      controller.abort()
      inflightLoads.delete(url)
    }
  }
}

const requestBitmapForEntry = async (entry: ImageEntry) => {
  if (bitmapCache.has(entry.url) || inflightLoads.has(entry.url)) return

  const controller = new AbortController()
  inflightLoads.set(entry.url, controller)

  try {
    const bitmap = await fetchBitmap(entry.url, controller.signal)
    if (controller.signal.aborted) {
      bitmap.close()
      return
    }

    bitmapCache.set(entry.url, bitmap)
    markBitmapRecentlyUsed(entry.url)
    scheduleRender()
  } catch (error) {
    const err = error as Error
    if (err.name !== 'AbortError') {
      log(`位图加载失败: ${entry.url}`, err)
    }
  } finally {
    inflightLoads.delete(entry.url)
  }
}

const drawPlaceholder = (ctx: CanvasRenderingContext2D, rect: ImageRect, label: string) => {
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(rect.x, rect.y - renderStartY.value, rect.w, rect.h)
  ctx.strokeStyle = '#cbd5e1'
  ctx.strokeRect(rect.x + 0.5, rect.y - renderStartY.value + 0.5, rect.w - 1, rect.h - 1)
  ctx.fillStyle = '#64748b'
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, rect.x + rect.w / 2, rect.y - renderStartY.value + rect.h / 2)
}

const renderVisible = () => {
  rafId = 0

  const ctx = ensureCanvasSize()
  if (!ctx) return

  renderStartY.value = Math.max(0, scrollTop.value - OVERSCAN_PX)
  renderEndY.value = renderStartY.value + canvasHeight.value

  ctx.clearRect(0, 0, viewportWidth.value, canvasHeight.value)

  const visibleIndexes = getVisibleIndexes()
  const visibleSet = new Set<string>()

  for (const index of visibleIndexes) {
    const entry = entries.value[index]
    const rect = entry?.rect
    if (!entry || !rect) continue

    visibleSet.add(entry.url)
    const drawY = rect.y - renderStartY.value
    const bitmap = bitmapCache.get(entry.url)

    if (bitmap) {
      ctx.drawImage(bitmap, rect.x, drawY, rect.w, rect.h)
      markBitmapRecentlyUsed(entry.url)
      continue
    }

    requestBitmapForEntry(entry)
    drawPlaceholder(ctx, rect, entry.status === 'error' ? '加载失败' : '加载中')
  }

  cleanupInvisibleBitmaps(visibleSet)
}

const scheduleRender = () => {
  if (rafId) return
  rafId = window.requestAnimationFrame(renderVisible)
}

const loadMetadata = async () => {
  metadataAbortController?.abort()
  metadataAbortController = new AbortController()
  const signal = metadataAbortController.signal

  for (let index = 0; index < entries.value.length; index += 1) {
    const entry = entries.value[index]
    if (signal.aborted) break

    entry.status = 'loading'
    try {
      const size = await fetchImageNaturalSize(entry.url, signal)
      entry.width = size.width
      entry.height = size.height
      entry.status = 'ready'
      recomputeLayout()
    } catch (error) {
      const err = error as Error
      if (err.name === 'AbortError') {
        break
      }
      entry.status = 'error'
      entry.width = 1
      entry.height = 1
      recomputeLayout()
      log(`图片元数据获取失败: ${entry.url}`, err)
    }
  }
}

const updateViewport = () => {
  const container = containerRef.value
  if (!container) return

  viewportWidth.value = container.clientWidth
  viewportHeight.value = container.clientHeight
  scrollTop.value = container.scrollTop

  recomputeLayout()
}

const handleScroll = () => {
  const container = containerRef.value
  if (!container) return
  scrollTop.value = container.scrollTop
  scheduleRender()
}

const handleCanvasClick = (event: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const offsetX = ((event.clientX - rect.left) / rect.width) * viewportWidth.value
  const offsetY = ((event.clientY - rect.top) / rect.height) * canvasHeight.value
  const logicalY = renderStartY.value + offsetY

  const hit = imageRects.find(imageRect => (
    offsetX >= imageRect.x
    && offsetX <= imageRect.x + imageRect.w
    && logicalY >= imageRect.y
    && logicalY <= imageRect.y + imageRect.h
  ))

  if (hit) {
    currentModalUrl.value = hit.url
    isModalOpen.value = true
  }
}

const closeModal = () => {
  isModalOpen.value = false
  currentModalUrl.value = ''
}

watch(
  () => props.urls,
  nextUrls => {
    metadataAbortController?.abort()

    for (const controller of inflightLoads.values()) {
      controller.abort()
    }
    inflightLoads.clear()

    for (const bitmap of bitmapCache.values()) {
      bitmap.close()
    }
    bitmapCache.clear()
    readyQueue.length = 0

    entries.value = nextUrls.map(url => ({
      url,
      width: 1,
      height: 1,
      status: 'idle',
      rect: null,
    }))
    imageRects.length = 0
    totalHeight.value = 0
    scrollTop.value = 0
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
    recomputeLayout()
    loadMetadata()
    scheduleRender()
  },
)

onMounted(async () => {
  await nextTick()
  updateViewport()

  resizeObserver.value = new ResizeObserver(() => {
    updateViewport()
  })
  if (containerRef.value) {
    resizeObserver.value.observe(containerRef.value)
  }

  window.addEventListener('resize', updateViewport)
  loadMetadata()
  scheduleRender()
})

onUnmounted(() => {
  resizeObserver.value?.disconnect()
  window.removeEventListener('resize', updateViewport)

  metadataAbortController?.abort()
  for (const controller of inflightLoads.values()) {
    controller.abort()
  }
  inflightLoads.clear()

  for (const bitmap of bitmapCache.values()) {
    bitmap.close()
  }
  bitmapCache.clear()
  readyQueue.length = 0

  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
})
</script>

<style scoped>
.virtual-gallery-container {
  position: fixed;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: #f8fafc;
}

.virtual-gallery-spacer {
  position: relative;
  width: 100%;
}

.virtual-gallery-canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  cursor: pointer;
}

.page-close {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10001;
  cursor: pointer;
  color: #ef4444;
  font-size: 15px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  padding: 6px 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.85);
}

.modal-content {
  position: relative;
  display: flex;
  width: 90vw;
  height: 90vh;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.close-btn {
  position: absolute;
  top: -20px;
  right: -20px;
  z-index: 10000;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #ff4757;
  color: #fff;
  font-size: 24px;
  line-height: 40px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>

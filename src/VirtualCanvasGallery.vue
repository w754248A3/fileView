<template>
  <div
    ref="containerRef"
    class="virtual-gallery-container"
    tabindex="0"
    @click="focusContainer"
  >
    <div class="page-close" @click.stop="onClose">关闭</div>

    <canvas
      ref="canvasRef"
      class="virtual-gallery-canvas"
      @click="handleCanvasClick"
    ></canvas>

    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-btn" @click="closeModal">×</button>
        <img :src="currentModalUrl" class="modal-image" alt="Full size" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

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
const RENDER_OVERSCAN_PX = 400
const LAYOUT_PREFETCH_PX = 1400
const WHEEL_STEP_RATIO = 1

const containerRef = shallowRef<HTMLDivElement | null>(null)
const canvasRef = shallowRef<HTMLCanvasElement | null>(null)

const entries = ref<ImageEntry[]>([])
const imageRects: ImageRect[] = []
const bitmapCache = new Map<string, ImageBitmap>()
const inflightBitmapLoads = new Map<string, AbortController>()

const isModalOpen = ref(false)
const currentModalUrl = ref('')
const viewportWidth = ref(0)
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
const colWidth = ref(MIN_COL_WIDTH)
const cols = ref(1)
const totalHeight = ref(0)
const scrollTop = ref(0)

let rafId = 0
let layoutAbortController: AbortController | null = null
let isLayoutLoading = false
let nextLayoutIndex = 0
let columnHeights: number[] = [0]
let touchStartY = 0
let touchStartScrollTop = 0

const onClose = () => emit('onClose')

const log = (message: string, ...args: unknown[]) => {
  console.log(`[VirtualCanvasGallery] ${message}`, ...args)
}

const clampScrollTop = (value: number) => {
  const maxScrollTop = Math.max(0, totalHeight.value - viewportHeight.value)
  return Math.min(Math.max(0, value), maxScrollTop)
}

const calcScaledHeight = (entry: ImageEntry) => {
  const ratio = colWidth.value / Math.max(entry.width, 1)
  return Math.max(1, entry.height * ratio)
}

const updateColumns = () => {
  const nextCols = Math.max(1, Math.floor((viewportWidth.value + GUTTER) / (TARGET_COL_WIDTH + GUTTER)))
  cols.value = nextCols
  colWidth.value = Math.max(
    MIN_COL_WIDTH,
    (viewportWidth.value - GUTTER * Math.max(0, cols.value - 1)) / cols.value,
  )
  columnHeights = new Array(cols.value).fill(0)
}

const resetBitmaps = () => {
  for (const controller of inflightBitmapLoads.values()) {
    controller.abort()
  }
  inflightBitmapLoads.clear()

  for (const bitmap of bitmapCache.values()) {
    bitmap.close()
  }
  bitmapCache.clear()
}

const resetLayoutState = (keepScrollTop = false) => {
  layoutAbortController?.abort()
  layoutAbortController = null
  isLayoutLoading = false
  nextLayoutIndex = 0
  imageRects.length = 0

  updateColumns()

  for (const entry of entries.value) {
    entry.width = 1
    entry.height = 1
    entry.status = 'idle'
    entry.rect = null
  }

  totalHeight.value = 0
  if (!keepScrollTop) {
    scrollTop.value = 0
  } else {
    scrollTop.value = clampScrollTop(scrollTop.value)
  }

  resetBitmaps()
  scheduleRender()
}

const focusContainer = () => {
  containerRef.value?.focus()
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

const fetchBitmap = async (entry: ImageEntry, signal: AbortSignal) => {
  const response = await fetch(entry.url, { signal, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const rect = entry.rect
  if (!rect) {
    return createImageBitmap(blob)
  }

  const dpr = window.devicePixelRatio || 1
  const targetWidth = Math.max(1, Math.round(rect.w * dpr))
  const targetHeight = Math.max(1, Math.round(rect.h * dpr))
  const naturalWidth = Math.max(1, Math.round(entry.width))
  const naturalHeight = Math.max(1, Math.round(entry.height))
  const shouldResize = naturalWidth > targetWidth || naturalHeight > targetHeight

  if (shouldResize) {
    return createImageBitmap(blob, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: 'high',
    })
  }

  return createImageBitmap(blob)
}

const appendLayoutForEntry = async (entry: ImageEntry, signal: AbortSignal) => {
  entry.status = 'loading'
  const size = await fetchImageNaturalSize(entry.url, signal)

  if (signal.aborted) return

  entry.width = size.width
  entry.height = size.height
  entry.status = 'ready'

  let targetCol = 0
  for (let i = 1; i < columnHeights.length; i += 1) {
    if (columnHeights[i] < columnHeights[targetCol]) {
      targetCol = i
    }
  }

  const height = calcScaledHeight(entry)
  const rect: ImageRect = {
    url: entry.url,
    x: targetCol * (colWidth.value + GUTTER),
    y: columnHeights[targetCol],
    w: colWidth.value,
    h: height,
  }

  entry.rect = rect
  imageRects.push(rect)
  columnHeights[targetCol] += height + GUTTER
  totalHeight.value = Math.max(0, ...columnHeights) - GUTTER
}

const ensureLayoutAhead = async () => {
  if (isLayoutLoading || nextLayoutIndex >= entries.value.length) return
  if (viewportHeight.value <= 0 || viewportWidth.value <= 0) return

  const needHeight = scrollTop.value + viewportHeight.value + LAYOUT_PREFETCH_PX
  if (totalHeight.value >= needHeight && nextLayoutIndex > 0) return

  isLayoutLoading = true
  layoutAbortController?.abort()
  layoutAbortController = new AbortController()
  const signal = layoutAbortController.signal

  try {
    while (
      !signal.aborted
      && nextLayoutIndex < entries.value.length
      && (totalHeight.value < needHeight || nextLayoutIndex === 0)
    ) {
      const entry = entries.value[nextLayoutIndex]
      await appendLayoutForEntry(entry, signal)
      nextLayoutIndex += 1
      scheduleRender()
    }
  } catch (error) {
    const err = error as Error
    if (err.name !== 'AbortError') {
      log('布局阶段图片元数据获取失败', err)
      const entry = entries.value[nextLayoutIndex]
      if (entry) {
        entry.status = 'error'
        entry.width = 1
        entry.height = 1
        entry.rect = {
          url: entry.url,
          x: 0,
          y: totalHeight.value,
          w: colWidth.value,
          h: colWidth.value,
        }
        imageRects.push(entry.rect)
        nextLayoutIndex += 1
        totalHeight.value += colWidth.value + GUTTER
        scheduleRender()
      }
    }
  } finally {
    isLayoutLoading = false

    const stillNeedHeight = scrollTop.value + viewportHeight.value + LAYOUT_PREFETCH_PX
    if (!signal.aborted && nextLayoutIndex < entries.value.length && totalHeight.value < stillNeedHeight) {
      ensureLayoutAhead()
    }
  }
}

const ensureCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas || !viewportWidth.value || !viewportHeight.value) return null

  const dpr = window.devicePixelRatio || 1
  const pixelWidth = Math.max(1, Math.floor(viewportWidth.value * dpr))
  const pixelHeight = Math.max(1, Math.floor(viewportHeight.value * dpr))

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  canvas.style.width = `${viewportWidth.value}px`
  canvas.style.height = `${viewportHeight.value}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const getVisibleIndexes = () => {
  const start = Math.max(0, scrollTop.value - RENDER_OVERSCAN_PX)
  const end = scrollTop.value + viewportHeight.value + RENDER_OVERSCAN_PX
  const indexes: number[] = []

  for (let i = 0; i < entries.value.length; i += 1) {
    const rect = entries.value[i].rect
    if (!rect) continue
    if (rect.y + rect.h < start) continue
    if (rect.y > end) continue
    indexes.push(i)
  }

  return indexes
}

const evictBitmap = (url: string) => {
  const bitmap = bitmapCache.get(url)
  if (bitmap) {
    bitmap.close()
    bitmapCache.delete(url)
  }
}

const cleanupInvisibleBitmaps = (visibleSet: Set<string>) => {
  for (const url of [...bitmapCache.keys()]) {
    if (!visibleSet.has(url)) {
      evictBitmap(url)
    }
  }

  for (const [url, controller] of inflightBitmapLoads.entries()) {
    if (!visibleSet.has(url)) {
      controller.abort()
      inflightBitmapLoads.delete(url)
    }
  }
}

const requestBitmapForEntry = async (entry: ImageEntry) => {
  if (bitmapCache.has(entry.url) || inflightBitmapLoads.has(entry.url)) return
  if (!entry.rect) return

  const controller = new AbortController()
  inflightBitmapLoads.set(entry.url, controller)

  try {
    const bitmap = await fetchBitmap(entry, controller.signal)
    if (controller.signal.aborted) {
      bitmap.close()
      return
    }

    bitmapCache.set(entry.url, bitmap)
    scheduleRender()
  } catch (error) {
    const err = error as Error
    if (err.name !== 'AbortError') {
      log(`位图加载失败: ${entry.url}`, err)
    }
  } finally {
    inflightBitmapLoads.delete(entry.url)
  }
}

const drawPlaceholder = (ctx: CanvasRenderingContext2D, rect: ImageRect, label: string) => {
  const drawY = rect.y - scrollTop.value
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(rect.x, drawY, rect.w, rect.h)
  ctx.strokeStyle = '#cbd5e1'
  ctx.strokeRect(rect.x + 0.5, drawY + 0.5, rect.w - 1, rect.h - 1)
  ctx.fillStyle = '#64748b'
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, rect.x + rect.w / 2, drawY + rect.h / 2)
}

const renderVisible = () => {
  rafId = 0

  const ctx = ensureCanvasSize()
  if (!ctx) return

  ctx.clearRect(0, 0, viewportWidth.value, viewportHeight.value)

  const visibleIndexes = getVisibleIndexes()
  const visibleSet = new Set<string>()

  for (const index of visibleIndexes) {
    const entry = entries.value[index]
    const rect = entry.rect
    if (!rect) continue

    visibleSet.add(entry.url)
    const drawY = rect.y - scrollTop.value
    const bitmap = bitmapCache.get(entry.url)

    if (bitmap) {
      ctx.drawImage(bitmap, rect.x, drawY, rect.w, rect.h)
      continue
    }

    requestBitmapForEntry(entry)
    drawPlaceholder(ctx, rect, entry.status === 'error' ? '加载失败' : '加载中')
  }

  cleanupInvisibleBitmaps(visibleSet)
  ensureLayoutAhead()
}

const scheduleRender = () => {
  if (rafId) return
  rafId = window.requestAnimationFrame(renderVisible)
}

const applyWheelScroll = (deltaY: number) => {
  const nextScrollTop = clampScrollTop(scrollTop.value + deltaY * WHEEL_STEP_RATIO)
  if (nextScrollTop === scrollTop.value) {
    ensureLayoutAhead()
    return
  }

  scrollTop.value = nextScrollTop
  scheduleRender()
  ensureLayoutAhead()
}

const handleWheel = (event: WheelEvent) => {
  if (isModalOpen.value) return
  event.preventDefault()
  applyWheelScroll(event.deltaY)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (isModalOpen.value) return

  const pageStep = Math.max(120, viewportHeight.value * 0.9)

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    applyWheelScroll(120)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    applyWheelScroll(-120)
  } else if (event.key === 'PageDown' || event.key === ' ') {
    event.preventDefault()
    applyWheelScroll(pageStep)
  } else if (event.key === 'PageUp') {
    event.preventDefault()
    applyWheelScroll(-pageStep)
  } else if (event.key === 'Home') {
    event.preventDefault()
    scrollTop.value = 0
    scheduleRender()
    ensureLayoutAhead()
  }
}

const handleTouchStart = (event: TouchEvent) => {
  if (!event.touches.length || isModalOpen.value) return
  touchStartY = event.touches[0].clientY
  touchStartScrollTop = scrollTop.value
}

const handleTouchMove = (event: TouchEvent) => {
  if (!event.touches.length || isModalOpen.value) return
  event.preventDefault()
  const deltaY = touchStartY - event.touches[0].clientY
  scrollTop.value = clampScrollTop(touchStartScrollTop + deltaY)
  scheduleRender()
  ensureLayoutAhead()
}

const handleCanvasClick = (event: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const offsetX = ((event.clientX - rect.left) / rect.width) * viewportWidth.value
  const offsetY = ((event.clientY - rect.top) / rect.height) * viewportHeight.value
  const logicalY = scrollTop.value + offsetY

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

const updateViewport = () => {
  const container = containerRef.value
  if (!container) return

  viewportWidth.value = container.clientWidth
  viewportHeight.value = container.clientHeight
  resetLayoutState(true)
  ensureLayoutAhead()
}

watch(
  () => props.urls,
  nextUrls => {
    entries.value = nextUrls.map(url => ({
      url,
      width: 1,
      height: 1,
      status: 'idle',
      rect: null,
    }))
    resetLayoutState(false)
    ensureLayoutAhead()
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  updateViewport()
  focusContainer()

  const container = containerRef.value
  container?.addEventListener('wheel', handleWheel, { passive: false })
  container?.addEventListener('keydown', handleKeydown)
  container?.addEventListener('touchstart', handleTouchStart, { passive: true })
  container?.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('resize', updateViewport)
  scheduleRender()
})

onUnmounted(() => {
  layoutAbortController?.abort()
  resetBitmaps()

  const container = containerRef.value
  container?.removeEventListener('wheel', handleWheel)
  container?.removeEventListener('keydown', handleKeydown)
  container?.removeEventListener('touchstart', handleTouchStart)
  container?.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('resize', updateViewport)

  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
})
</script>

<style scoped>
.virtual-gallery-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #f8fafc;
  touch-action: none;
  outline: none;
}

.virtual-gallery-canvas {
  display: block;
  width: 100%;
  height: 100%;
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

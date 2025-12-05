<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  url: string
  urls: string[]
}>()

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const listItemRefs = ref<Array<HTMLElement | null>>([])
const viewUrl = ref(props.url)
const selectedIndex = ref(
  Math.max(props.urls.findIndex(item => item === viewUrl.value), 0)
)
const isCollapsed = ref(false)

const setFileListElement = (el: Element | null | { $el?: Element }, index: number) => {
  const dom = (el && '$el' in el ? (el as any).$el : el) as Element | null
  listItemRefs.value[index] = dom as HTMLElement | null
}

const onClose = () => emit('onClose')

const getIndexByUrl = (target: string) =>
  Math.max(props.urls.findIndex(item => item === target), 0)

const scrollToSelected = (index: number) => {
  const target = listItemRefs.value[index]
  target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const navigate = (step: number) => {
  if (!props.urls.length) return
  const nextIndex =
    (selectedIndex.value + step + props.urls.length) % props.urls.length
  viewUrl.value = props.urls[nextIndex]
  selectedIndex.value = nextIndex
}

const viewNext = () => navigate(1)
const viewPrev = () => navigate(-1)

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

watch(selectedIndex, newIndex => scrollToSelected(newIndex))

watch(
  () => props.url,
  newUrl => {
    viewUrl.value = newUrl
    selectedIndex.value = getIndexByUrl(newUrl)
  }
)

onMounted(() => scrollToSelected(selectedIndex.value))
</script>

<template>
  <div class="viewvideo-root" :class="{ collapsed: isCollapsed }" @click.stop>
    <div class="viewvideo-left">
      <div class="viewvideo-left-header">
        <div class="viewvideo-close" @click="onClose">关闭</div>
        <button class="viewvideo-toggle" @click="toggleCollapse">
          {{ isCollapsed ? '展开列表' : '折叠列表' }}
        </button>
      </div>
      <div class="viewvideo-filelisttree">
        <ul>
          <li
            v-for="(item, index) in urls"
            :key="index"
            :class="{ selected: selectedIndex === index }"
            class="viewvideo-filelisttree-item"
            @click="
              viewUrl = item;
              selectedIndex = index
            "
            :ref="el => setFileListElement(el, index)"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
    <div class="viewvideo-right">
      <video
        class="viewvideo-player"
        ref="videoRef"
        :src="viewUrl"
        controls
        preload="metadata"
      />
      <div class="viewvideo-controls">
        <button @click="viewPrev">上一段</button>
        <button @click="viewNext">下一段</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewvideo-root {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0c0c0c;
  display: grid;
  grid-template-columns: 320px 1fr;
  align-items: stretch;
  z-index: 9999;
  overflow: hidden;
  color: #e8ecf1;
}

.viewvideo-left {
  background: rgba(255, 255, 255, 0.06);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.viewvideo-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.viewvideo-close {
  cursor: pointer;
  color: #ff6b6b;
  font-size: 15px;
  font-weight: 600;
}

.viewvideo-toggle {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.12);
  color: #e8ecf1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.viewvideo-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
}

.viewvideo-filelisttree {
  flex: 1;
  max-height: 80vh;
  overflow-y: auto;
}

.viewvideo-filelisttree ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.viewvideo-filelisttree-item {
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.viewvideo-filelisttree-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.selected {
  background: #144a76;
  font-weight: 600;
}

.viewvideo-right {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 20px;
  box-sizing: border-box;
  min-height: 0;
}

.viewvideo-player {
  flex: 1;
  max-width: 94%;
  max-height: calc(100% - 90px);
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  background: #111;
}

.viewvideo-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 8px;
  width: 100%;
  flex-shrink: 0;
}

.viewvideo-controls button {
  padding: 8px 14px;
  min-width: 96px;
  background-color: #2d7be4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.viewvideo-controls button:hover {
  background-color: #1f5fb3;
}

.viewvideo-controls button:active {
  transform: translateY(1px);
}

.viewvideo-root.collapsed {
  grid-template-columns: 68px 1fr;
}

.viewvideo-root.collapsed .viewvideo-left {
  padding: 12px 10px;
}

.viewvideo-root.collapsed .viewvideo-filelisttree {
  display: none;
}

.viewvideo-root.collapsed .viewvideo-toggle {
  width: 100%;
  text-align: center;
}
</style>


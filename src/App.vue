<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ViewImg from './ViewImg.vue'
import ViewVideo2 from './ViewVideo2.vue'
import type { FileListJSONData, ViewListData, ZIPListJSONData } from './types'

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif']
const VIDEO_EXTS = ['.mp4', '.webm', '.ogg']
const ARCHIVE_EXTS = ['.zip', '.rar', '.7z']

const list = ref<ViewListData>({ folder: [], file: [] })
const upClickItem = ref<string | null>(null)
const itemRefs = ref<Map<string, HTMLAnchorElement>>(new Map())
const errorMessage = ref('')
const isLoading = ref(false)

// 判断扩展名是否匹配指定列表
const matchExt = (url: string, exts: string[]) =>
  exts.some(ext => url.toLowerCase().endsWith(ext))

const isImage = (url: string) => matchExt(url, IMAGE_EXTS)
const isVideo = (url: string) => matchExt(url, VIDEO_EXTS)
const isArchive = (url: string) => matchExt(url, ARCHIVE_EXTS)
const isSupportedFile = (url: string) => isImage(url) || isVideo(url) || isArchive(url)

// 记录当前路径层级，便于回退和定位上一次点击的位置
const pageStack = (() => {
  const dataList = [{ path: '/', upClickItem: null as string | null }]

  const getPath = () => dataList.map(v => v.path).join('')
  const push = (path: string) => dataList.push({ path, upClickItem: null })
  const pop = () => {
    if (dataList.length > 1) return dataList.pop() ?? null
    return null
  }
  const getCurrentData = () => dataList[dataList.length - 1]

  return { getPath, push, pop, getCurrentData }
})()

const setItemRef = (path: string, el: HTMLElement | null) => {
  if (el) {
    itemRefs.value.set(path, el as HTMLAnchorElement)
  } else {
    itemRefs.value.delete(path)
  }
}

const scrollToVisited = () => {
  const target = upClickItem.value ? itemRefs.value.get(upClickItem.value) : null
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch(upClickItem, () => nextTick(scrollToVisited))

const onUpPageButtonClick = async () => {
  if (isLoading.value) return

  const removed = pageStack.pop()
  if (!removed) return

  const target = pageStack.getCurrentData()
  upClickItem.value = target.upClickItem

  const success = await loadData(pageStack.getPath())
  if (!success) {
    // 回滚到原栈与状态
    pageStack.push(removed.path)
    const current = pageStack.getCurrentData()
    current.upClickItem = removed.upClickItem
    upClickItem.value = removed.upClickItem
  }
}

// 提取字符串中的数字并求和，用于排序
const sumNum = (str: string) => {
  const matches = str.match(/\d+/g)
  if (!matches) return 0
  return matches.reduce((acc, cur) => acc + Number.parseInt(cur), 0)
}

const loadData = async (url: string) => {
  if (isLoading.value) return false
  isLoading.value = true
  errorMessage.value = ''

  const isZipFile = (v: ZIPListJSONData): v is ZIPListJSONData =>
    Boolean(v?.index && v?.path)
  const isFileList = (v: FileListJSONData): v is FileListJSONData =>
    Boolean('isfolder' in v && 'name' in v)

  const requestUrl = new URL(window.location.origin + url)
  requestUrl.searchParams.append('json', '1')

  try {
    const response = await fetch(requestUrl.href)
    const type = response.headers.get('Content-Type')
    if (!response.ok || type !== 'application/json') {
      throw new Error('响应异常或类型错误')
    }

    const json = await response.json()
    const currentPath = pageStack.getPath()

    if (isFileList(json[0])) {
      const dataList = json as FileListJSONData[]
      const nextFolder = dataList
        .filter(v => v.isfolder)
        .map(v => ({ path: `${v.name}/`, name: v.name }))

      const nextFile = dataList
        .filter(v => !v.isfolder)
        .filter(v => isSupportedFile(v.name))
        .map(v => ({
          path: v.name,
          name: v.name,
          imgPath: currentPath + v.name,
          isView: false,
        }))

      nextFile.sort((a, b) => sumNum(a.name) - sumNum(b.name))
      list.value = { folder: nextFolder, file: nextFile }
    } else if (isZipFile(json[0])) {
      const dataList = json as ZIPListJSONData[]
      const nextFile = dataList
        .filter(v => isSupportedFile(v.path))
        .map(v => ({
          path: `?Index=${v.index}`,
          name: v.path,
          imgPath: currentPath + `?Index=${v.index}`,
          isView: false,
        }))

      nextFile.sort((a, b) => sumNum(a.name) - sumNum(b.name))
      list.value = { folder: [], file: nextFile }
    } else {
      throw new Error('未知的 json 数据格式')
    }

    nextTick(scrollToVisited)
    return true
  } catch (error) {
    console.error('加载数据失败', error)
    errorMessage.value = '数据加载失败，请稍后重试'
    // 保持现有 list 与状态不变，避免破坏返回和点击记录
    return false
  } finally {
    isLoading.value = false
  }
}

const handleItemClick = async (e: MouseEvent, path: string, isFolder: boolean) => {
  e.preventDefault()
  if (isLoading.value) return

  const current = pageStack.getCurrentData()
  current.upClickItem = path

  if (isFolder || isArchive(path)) {
    pageStack.push(encodeURIComponent(path))
    const success = await loadData(pageStack.getPath())
    if (!success) {
      // 加载失败回滚栈与点击标记
      const removed = pageStack.pop()
      if (removed) {
        const cur = pageStack.getCurrentData()
        cur.upClickItem = current.upClickItem
        upClickItem.value = current.upClickItem
      }
    }
  } else {
    upClickItem.value = path
  }
}

const togglePreview = (item: typeof list.value.file[0]) => {
  if (isLoading.value) return
  if (!isImage(item.name) && !isVideo(item.name)) return
  item.isView = !item.isView
}

const isVisited = (path: string) => upClickItem.value === path

// 首次加载数据并在离开前提示
onMounted(() => {
  loadData(pageStack.getPath())
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault()
  event.returnValue = ''
}
</script>

<template>
  <div id="fileTree-root" :class="{ loading: isLoading }">
    <header id="fileTree-header">
      <button @click="onUpPageButtonClick" :disabled="isLoading">
        返回上一级
      </button>
      <span v-if="errorMessage" class="error-message">{{ errorMessage }}</span>
    </header>

    <main id="fileTree-content">
      <section>
        <h2>文件夹</h2>
        <ul v-if="list?.folder?.length">
          <li v-for="item in list.folder" :key="item.path">
            <a
              :href="item.path"
              :class="{ visited: isVisited(item.path) }"
              :ref="el => setItemRef(item.path, el as HTMLAnchorElement)"
              @click="e => handleItemClick(e, item.path, true)"
            >
              {{ item.name }}
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>文件</h2>
        <ul v-if="list?.file?.length">
          <li v-for="item in list.file" :key="item.path">
            <a
              :href="item.path"
              :class="{ visited: isVisited(item.path) }"
              :ref="el => setItemRef(item.path, el as HTMLAnchorElement)"
              @click="e => { handleItemClick(e, item.path, false); togglePreview(item) }"
            >
              {{ item.name }}
            </a>

            <div v-if="item.isView && isVideo(item.name)">
              <ViewVideo2
                v-if="item.isView"
                :url="item.imgPath"
                :urls="list.file.filter(v => isVideo(v.name)).map(v => v.imgPath)"
                @on-close="item.isView = false"
              />
            </div>

            <div v-if="item.isView && isImage(item.name)">
              <ViewImg
                v-if="item.isView"
                :url="item.imgPath"
                :urls="list.file.filter(v => isImage(v.name)).map(v => v.imgPath)"
                @on-close="item.isView = false"
              />
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style>
#fileTree-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

#fileTree-header {
  flex-shrink: 0;
}

#fileTree-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

/* 添加 visited 样式 */
a.visited {
  color: #007bff;
  font-weight: bold;
  background-color: #e7f3ff;
  padding: 2px 4px;
  border-radius: 3px;
}

.error-message {
  margin-left: 12px;
  color: #d93025;
  font-size: 14px;
}

.loading #fileTree-content {
  pointer-events: none;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}
</style>
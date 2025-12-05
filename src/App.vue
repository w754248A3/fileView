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
    if (dataList.length > 1) dataList.pop()
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

const onUpPageButtonClick = () => {
  pageStack.pop()
  const data = pageStack.getCurrentData()
  upClickItem.value = data.upClickItem
  loadData(pageStack.getPath())
}

// 提取字符串中的数字并求和，用于排序
const sumNum = (str: string) => {
  const matches = str.match(/\d+/g)
  if (!matches) return 0
  return matches.reduce((acc, cur) => acc + Number.parseInt(cur), 0)
}

const loadData = async (url: string) => {
  const isZipFile = (v: ZIPListJSONData): v is ZIPListJSONData =>
    Boolean(v?.index && v?.path)
  const isFileList = (v: FileListJSONData): v is FileListJSONData =>
    Boolean('isfolder' in v && 'name' in v)

  const requestUrl = new URL(window.location.origin + url)
  requestUrl.searchParams.append('json', '1')

  const response = await fetch(requestUrl.href)
  const type = response.headers.get('Content-Type')
  if (!response.ok || type !== 'application/json') return

  const json = await response.json()
  const currentPath = pageStack.getPath()

  if (isFileList(json[0])) {
    const dataList = json as FileListJSONData[]
    list.value.folder = dataList
      .filter(v => v.isfolder)
      .map(v => ({ path: `${v.name}/`, name: v.name }))

    list.value.file = dataList
      .filter(v => !v.isfolder)
      .filter(v => isSupportedFile(v.name))
      .map(v => ({
        path: v.name,
        name: v.name,
        imgPath: currentPath + v.name,
        isView: false,
      }))
  } else if (isZipFile(json[0])) {
    const dataList = json as ZIPListJSONData[]
    list.value.folder = []
    list.value.file = dataList
      .filter(v => isSupportedFile(v.path))
      .map(v => ({
        path: `?Index=${v.index}`,
        name: v.path,
        imgPath: currentPath + `?Index=${v.index}`,
        isView: false,
      }))
  } else {
    console.error('未知的json数据格式')
  }

  list.value.file.sort((a, b) => sumNum(a.name) - sumNum(b.name))
  nextTick(scrollToVisited)
}

const handleItemClick = (e: MouseEvent, path: string, isFolder: boolean) => {
  e.preventDefault()
  const current = pageStack.getCurrentData()
  current.upClickItem = path

  if (isFolder || isArchive(path)) {
    pageStack.push(encodeURIComponent(path))
    loadData(pageStack.getPath())
  } else {
    upClickItem.value = path
  }
}

const togglePreview = (item: typeof list.value.file[0]) => {
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
  <div id="fileTree-root">
    <header id="fileTree-header">
      <button @click="onUpPageButtonClick">返回上一级</button>
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
</style>
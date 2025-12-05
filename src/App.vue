<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import ViewImg from './ViewImg.vue';
import ViewVideo from './ViewVideo.vue';
import ViewVideo2 from './ViewVideo2.vue';
import type { FileListJSONData, ViewListData, ZIPListJSONData } from './types';
import { stringifyQuery } from 'vue-router';
const list = ref<ViewListData>({ folder: [], file: [] });


const isCanViewImage = (() => {

  const imgExts = [".jpg", ".jpeg", ".png", ".gif"];
  return (url: string) => {
    return imgExts.some(ext => url.toLowerCase().endsWith(ext));
  };

})();


const isCanViewVideo = (() => {

  const videoExts = [".mp4", ".webm", ".ogg"];
  return (url: string) => {
    return videoExts.some(ext => url.toLowerCase().endsWith(ext));
  };

})();


const isCanOpenFile = (() => {

  const fileExts = [".zip", ".rar", ".7z"];
  return (url: string) => {
    return fileExts.some(ext => url.toLowerCase().endsWith(ext));
  };

})();


const isNameCanView = (() => {

  return (url: string) => {
    return isCanViewImage(url) || isCanViewVideo(url) || isCanOpenFile(url);
  };
})();



const currentPageData = (() => {

  const dataList = [{
    path: "/",
    upClickItem: null as string | null,
  }];

  const getPath = () => {
    return dataList.map(v => v.path).join("");
  };

  const push = (path: string) => {
    dataList.push({ path: path, upClickItem: null });
  };

  const pop = () => {
    if (dataList.length > 1) {
      dataList.pop();
    }
  };

  const getCurrentData = () => {
    return dataList[dataList.length - 1];
  };

  return {
    getPath,
    push,
    pop,
    getCurrentData,
  }
})();



const upClickItem = ref<string | null>(null);
const itemRefs = ref<Map<string, HTMLAnchorElement>>(new Map());

const setItemRef = (path: string, el: HTMLElement | null) => {
  if (el) {
    itemRefs.value.set(path, el as HTMLAnchorElement);
  } else {
    itemRefs.value.delete(path);
  }
};

const scrollToVisited = () => {
  const key = upClickItem.value;
  if (!key) {
    return;
  }
  const target = itemRefs.value.get(key);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

watch(upClickItem, () => {
  nextTick(scrollToVisited);
});


const onUpPageButtonClick = () => {





  currentPageData.pop();


  const data = currentPageData.getCurrentData();

  upClickItem.value = data.upClickItem;

  loadData(currentPageData.getPath());

};

window.addEventListener('beforeunload', (event) => {
  // Cancel the event as stated by the standard.
  event.preventDefault();
  // Chrome requires returnValue to be set.
  event.returnValue = '';
});

//方法提取出字符串中所有的数字并相加, 返回相加的结果
function sumNum(str: string) {
  let reg = /\d+/g;
  let result = 0;
  let arr = str.match(reg);
  if (arr) {
    arr.forEach(v => {
      result += parseInt(v);
    });
  }
  return result;
}


const loadData = async (url: string) => {

  function isZipFile(v: ZIPListJSONData): ZIPListJSONData | null {
    if (v.index && v.path) {
      return v;
    }
    else {
      return null;
    }
  }

  function isNotZipFile(v: FileListJSONData): FileListJSONData | null {
    if (v.isfolder && v.name) {
      return v;
    }
    else {
      return null;
    }
  }


  console.log("url", url);
  const url2 = new URL(window.location.origin + url);

  url2.searchParams.append("json", "1");
  url = url2.href;

  console.log("url2", url2.href);


  const response = await fetch(url);
  const type = response.headers.get("Content-Type");
  console.log(type);
  if (!response.ok || type !== "application/json") {
    return;
  }

  const json = await response.json();


  if (isNotZipFile(json[0])) {
    const datalist = json as FileListJSONData[];
    let baseUrl = currentPageData.getPath();

    list.value.folder = datalist.filter(v => v.isfolder)
      .map(v => { return { path: v.name + "/", name: v.name }; });

    list.value.file = datalist.filter(v => !v.isfolder)
      .filter(v => isNameCanView(v.name))
      .map(v => { return { path: v.name, name: v.name, imgPath: baseUrl + v.name, isView: false }; });


    list.value.file.sort((a, b) => {
      let aNum = sumNum(a.name);
      let bNum = sumNum(b.name);
      return aNum - bNum;
    });

  }
  else if (isZipFile(json[0])) {
    const datalist = json as ZIPListJSONData[];
    let baseUrl = currentPageData.getPath();
    list.value.folder = [];

    list.value.file = datalist.filter(v => isNameCanView(v.path))
      .map(v => {

        const path = `?Index=${v.index}`;

        return { path: path, name: v.path, imgPath: baseUrl + path, isView: false };


      });
    list.value.file.sort((a, b) => {
      let aNum = sumNum(a.name);
      let bNum = sumNum(b.name);
      return aNum - bNum;
    });

  }
  else {
    console.error("未知的json数据格式");
  }

  nextTick(scrollToVisited);
};





function cf(e: MouseEvent, path: string, isFolder: boolean) {
  e.preventDefault();

  const data = currentPageData.getCurrentData();

  data.upClickItem = path;

  if (isFolder || path.endsWith(".zip") || path.endsWith(".rar") || path.endsWith("7z")) {


    currentPageData.push(encodeURIComponent(path));

    loadData(currentPageData.getPath());

  }
  else {
    upClickItem.value = path;
  }

}

loadData(currentPageData.getPath());
function isImg(url: string) {
  return isCanViewImage(url);
}

function isVideo(url: string) {
  url = url.toLowerCase();

  return url.includes(".mp4");
}

function setView(data: typeof list.value.file[0]) {
  if (isImg(data.name) || isVideo(data.name)) {
    console.log("run");
    data.isView = !data.isView;
  }
}
const isVisited = (path: string) => {
  console.log("----", upClickItem.value, path);
  return upClickItem.value === path;
};
</script>

<template>
  <div id="fileTree-root">
    <div id="fileTree-header">
      <button @click="onUpPageButtonClick">返回上一级</button>
    </div>
    <div id="fileTree-content">
      <div>
        <h2>文件夹</h2>
        <ul v-if="list && list.folder && true">
          <li v-for="item of list.folder" :key="item.path">
            <a v-bind:href="item.path" :class="{ visited: isVisited(item.path) }"
              :ref="el => setItemRef(item.path, el as HTMLAnchorElement)"
              @click="(e) => cf(e, item.path, true)">{{ item.name }}</a>
          </li>
        </ul>
      </div>
      <div>
        <h2>文件</h2>
        <ul v-if="list && list.file && true">
          <li v-for="item of list.file" :key="item.path">
            <a v-bind:href="item.path" :class="{ visited: isVisited(item.path) }"
              :ref="el => setItemRef(item.path, el as HTMLAnchorElement)"
              @click="(e) => { cf(e, item.path, false); setView(item) }">{{ item.name }}</a>

            <div v-if="item.isView && isVideo(item.name)">


              <ViewVideo2 v-if="item.isView" :url="item.imgPath" @on-close="item.isView = false"
                :urls="list.file.filter(v => isVideo(v.name)).map(v => v.imgPath)"></ViewVideo2>
            </div>
            <div v-if="item.isView && isImg(item.name)">
              <ViewImg @on-close="item.isView = false" v-if="item.isView" :url="item.imgPath"
                :urls="list.file.filter(v => isImg(v.name)).map(v => v.imgPath)"></ViewImg>
            </div>

          </li>
        </ul>
      </div>
    </div>
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
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import VirtualCanvasGallery from './VirtualCanvasGallery.vue';

const props = defineProps<{
  url: string
  urls: string[]
}>()

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

const ref_canvas=ref<HTMLCanvasElement>();

const ref_canvas_box=ref<HTMLDivElement>();


const viewContainerRef = ref<HTMLElement | null>(null)
const listItemRefs = ref<Array<HTMLElement | null>>([])
const viewUrl = ref(props.url)
const selectedIndex = ref(
  Math.max(props.urls.findIndex(item => item === viewUrl.value), 0)
)
const isAutoPlay = ref(false)
const isCollapsed = ref(false)
let autoPlayTimer: ReturnType<typeof setTimeout> | null = null

const setFileListElement = (el: Element | null | { $el?: Element }, index: number) => {
  // 兼容 Vue 传入的组件实例与真实 DOM
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

const requestFullscreen = () => {
  const target = viewContainerRef.value
  target?.requestFullscreen?.().catch(() => {
    /* 忽略全屏失败 */
  })
}

const postDleteName = async ()=>{

  const path = viewUrl.value;

  const url = new URL(path, window.location.origin);

  
  url.searchParams.append("set", "1");



  console.log(path, url.toString());

  const res = await fetch(url, {
    method:"POST"
  });

  const json = await res.json();
  if(json.resultCode){
    window.alert("成功");
  }
  else{
    window.alert("失败");
  }
};


const downloadJSON =(jsonString:string)=>{


const blob = new Blob([jsonString], {
  type: "application/json"
});

const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "data.json";

document.body.appendChild(a);
a.click();

setTimeout(()=>{
  
document.body.removeChild(a);
URL.revokeObjectURL(url);

},3000);

};

const downloadDeleteNameList =async()=>{

  
  const path = viewUrl.value;

  const url = new URL(path, window.location.origin);

  
  url.searchParams.append("get", "1");



  console.log(path, url.toString());

  const res = await fetch(url, {
    method:"POST"
  });

  const json = await res.json();
  if(json.resultCode){
    
    const s = JSON.stringify(json, null, 2);

    downloadJSON(s);
  }
  else{
    window.alert("失败");
  }
};

const toggleAutoPlay = () => {
  isAutoPlay.value = !isAutoPlay.value
  if (isAutoPlay.value) {
    scheduleAutoPlay()
  } else {
    clearAutoPlay()
  }
}

const clearAutoPlay = () => {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer)
    autoPlayTimer = null
  }
}

const scheduleAutoPlay = () => {
  clearAutoPlay()
  autoPlayTimer = setTimeout(() => {
    if (isAutoPlay.value) {
      viewNext()
      scheduleAutoPlay()
    }
  }, 3000)
}

const handleWindowClick = (e: MouseEvent) => {
  // 将屏幕分为左右两半进行快速翻页
  if (e.clientX > window.innerWidth / 2) {
    viewNext()
  } else {
    viewPrev()
  }
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}


const compressImage= (file:Blob, maxWidth = 250, quality = 0.8)=> {
  return new Promise<Blob>(async (resolve, reject) => {

    const  img = await createImageBitmap(file);
    const scalingRatio = (maxWidth/img.width);

      // 计算缩放比例（保持原比例）
      let width = img.width*scalingRatio;
      let height = img.height*scalingRatio;
      

      // 创建 canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if(!ctx){

        reject(Error("canvas.getContext is null"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
    
      // 导出压缩后的 Blob（推荐用于上传）
      canvas.toBlob((blob) => {

        if(!blob){
          reject(Error("canvas.toBlob is null"));
          return;
        }

        resolve(blob); // blob 就是压缩后的图片文件
      }, 'image/jpeg', quality); // 改成 'image/webp' 也可以
    
    
  });
}

const awaitTimeSpan= (n:number)=>{
  return new Promise<void>((resolve)=>{

    setTimeout(resolve,n);
  });
}

const awaitIsLoop=async(iscanncel:()=> boolean)=>{

  while(true){
    if(iscanncel()){
      return;
    }

    if(isViewGrid.value=== false){
      return;
    }

    await awaitTimeSpan(1000);
  }

};


const startLoad=async(url_vs:string[], iscanncel:()=> boolean, func:(id:number, blob:Blob)=>void)=>{

  const maxCount =4;
  
  const vs = url_vs.map((v,i)=> {return{v,i, isover:false, blob:(null as any)};});
  
  let index=0;

  let count=0;

  let cursor=0;

  const start=()=>{

    for (let index = cursor; index < vs.length && iscanncel()===false; index++) {
      const element = vs[index];

      if(element.isover){
        const id = element.i;
        const b = element.blob;
        element.blob=null;
        setTimeout(()=> func(id,b));
        
      }
      else{
        cursor=index;


        while(count < maxCount){
          count++;
          setTimeout(()=> addload());
         
          
        }

        return;
      }
      
    }
  };

  const addload=async ()=>{

    await awaitIsLoop(iscanncel);

    if(index >= vs.length || iscanncel()){
      return;
    }

    const v = vs[index];
    index++;

    if(!v){
      return;
    }

    try{
      
      const res = await fetch(v.v);

      const b = await res.blob();
      v.blob=b;

    }
    finally{
      count--;
      v.isover=true;
      setTimeout(()=> start());
    }
  };

  
  setTimeout(()=> start());
};


const resetCanvas = (canvas:HTMLCanvasElement, newheight:number)=>{

  const ctx = canvas.getContext("2d");

  if(!ctx){
    return;
  }


  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  const tempCtx = tempCanvas.getContext("2d");

  if(! tempCtx){
    return;
  }

  tempCtx.drawImage(canvas, 0, 0);

  const oldHeight = canvas.height;
  canvas.height = oldHeight + newheight;

  ctx.drawImage(tempCanvas, 0, 0);
};

const imgCoordinates:{id:number, top:number, but:number}[] =[];

let isUnmount = false;

const getCompressedImage = async ()=>{

  const canvas = ref_canvas.value;
  const ctx = canvas?.getContext("2d");

  let height_count =0;
  if(!canvas || !ctx){
    console.log("canvas is null");
    return;
  }


  startLoad(props.urls, ()=> isUnmount, async(id, b)=>{

    if(!b){
      return;
    }

    const img = await createImageBitmap(b);

    let w = img.width;

    let h = img.height;

    const s = canvas.width/w;

    w*=s;

    h*=s;

    w = Math.floor(w);

    h = Math.floor(h);

    if(height_count+h>= canvas.height){
      
      resetCanvas(canvas, h*2);

    }

    ctx.drawImage(img,0,height_count , w,h);
    const top = height_count;
    height_count+=h;

    const but = height_count;

    imgCoordinates.push({id:id, top, but});


  });

};

watch(selectedIndex, newIndex => scrollToSelected(newIndex))

watch(
  () => props.url,
  newUrl => {
    viewUrl.value = newUrl
    selectedIndex.value = getIndexByUrl(newUrl)
  }
)


const onSetCanvasWidth =(canvas:HTMLCanvasElement)=>{
  
  let isTimeout = false;

  let isCall =false;
  let newwidth:number|null = null;
  

  setTimeout(()=> {

    isTimeout=true;

    if(!isCall && newwidth){
      isCall=true;
      canvas.width=newwidth;
      getCompressedImage();
    }


  }, 1000);
  return (width:number)=>{
    newwidth=width;

    if(isTimeout&& !isCall){
      isCall=true;
      canvas.width=newwidth;
      getCompressedImage();
    }
  }


};

const onCanvasClick = (e:MouseEvent) => {

  const canvas = ref_canvas.value;
  if(!canvas){
    return;
  }

  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
 
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;



  for (const v of imgCoordinates) {
   
    if(v.top<= y&& v.but>= y){

      viewUrl.value = props.urls[v.id];
      selectedIndex.value = v.id;
      return;
    }
  }
};


let observer:ResizeObserver;
onMounted(() => {
  window.addEventListener('click', handleWindowClick)
  
  if(ref_canvas_box.value && ref_canvas.value){
    
    const canvas= ref_canvas.value;
    const setwidth = onSetCanvasWidth(canvas);
    observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
     
      setwidth(Math.floor(rect.width));
    });

    observer.observe(ref_canvas_box.value);
  }
  else{
    console.log("ref_canvas is null");
  }
})

onBeforeUnmount(() => {
  isUnmount=true;
  window.removeEventListener('click', handleWindowClick)
  clearAutoPlay()
  observer?.disconnect();
})


const isViewGrid = ref(false);

</script>

<template>
  <div class="viewimage-root" :class="{ collapsed: isCollapsed }" @click.stop>
    <div class="viewimage-left">
      <div class="viewimage-left-header">
        <div class="viewimage-close" @click="onClose">关闭</div>
        <div class="viewimage-close" @click="isViewGrid=true">grid</div>
        <button class="viewimage-toggle" @click="toggleCollapse">
          {{ isCollapsed ? '展开列表' : '折叠列表' }}
        </button>
      </div>
      <div class="viewimage-filelisttree">
        <ul>
          <li
            v-for="(item, index) in urls"
            :key="index"
            :class="{ selected: selectedIndex === index }"
            class="viewimage-filelisttree-item"
            @click="viewUrl = item,selectedIndex = index"
            :ref="el => setFileListElement(el, index)"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
<!--     <div class="viewimage-middle" ref="ref_canvas_box">
      <canvas height="4096" ref="ref_canvas" @click="onCanvasClick"></canvas>
    </div> -->
    <div class="viewimage-right">
      <img class="viewimage-image" ref="viewContainerRef" :src="viewUrl" />

      <div class="viewimage-controls">
        <button @click="viewPrev">上一张</button>
        <button @click="viewNext">下一张</button>
        <button @click="requestFullscreen">全屏</button>
        <button @click="toggleAutoPlay">
          {{ isAutoPlay ? '暂停自动播放' : '切换自动播放' }}
        </button>
        <button @click="postDleteName">标记为待删除</button>
        <button @click="downloadDeleteNameList">下载待删除列表</button>
      </div>
    </div>
    <div v-if="isViewGrid">
      <VirtualCanvasGallery :urls="urls.map(v=>v)" @on-close="isViewGrid=false" ></VirtualCanvasGallery>
    </div>
  </div>
</template>

<style scoped>
.viewimage-root {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0c0c0c;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  z-index: 9998;
  overflow: hidden;
  color: #e8ecf1;
}

.viewimage-left {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.viewimage-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.viewimage-close {
  cursor: pointer;
  color: #ff6b6b;
  font-size: 15px;
  font-weight: 600;
}

.viewimage-toggle {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.12);
  color: #e8ecf1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.viewimage-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
}

.viewimage-filelisttree {
  flex: 1;
  max-height: 80vh;
  overflow-y: auto;
}

.viewimage-filelisttree ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.viewimage-filelisttree-item {
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.viewimage-filelisttree-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.selected {
  background: #144a76;
  font-weight: 600;
}



.viewimage-middle{
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  max-width: 94%;
  max-height: 94%;
  min-width: 0;
}


.viewimage-right {
  flex: 5;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 20px;
  box-sizing: border-box;
  min-height: 0; /* 允许子元素在纵向收缩，避免溢出 */
}

.viewimage-image {
  flex: 1;
  max-width: 94%;
  max-height: calc(100% - 90px); /* 预留底部按钮区域 */
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  background: #111;
}

.viewimage-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 8px;
  width: 100%;
  flex-shrink: 0; /* 确保按钮区域不被压缩并可见 */
}

.viewimage-controls button {
  padding: 8px 14px;
  min-width: 96px;
  background-color: #2d7be4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.viewimage-controls button:hover {
  background-color: #1f5fb3;
}

.viewimage-controls button:active {
  transform: translateY(1px);
}

.viewimage-root.collapsed {
  grid-template-columns: 68px 1fr;
}

.viewimage-root.collapsed .viewimage-left {
  padding: 12px 10px;
}

.viewimage-root.collapsed .viewimage-filelisttree {
  display: none;
}

.viewimage-root.collapsed .viewimage-toggle {
  width: 100%;
  text-align: center;
}
</style>


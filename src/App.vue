
<script setup lang="ts">
import { ref } from 'vue'
import ViewImg from './ViewImg.vue';
import ViewVideo from './ViewVideo.vue';
import type { FileListJSONData, ViewListData, ZIPListJSONData } from './types';
const list = ref<ViewListData>({folder: [], file: []});

const isViewCom = ref(false);

const pathlist = ["/"];

window.addEventListener('popstate', function(event) {
  console.log(event.state);
  if(pathlist.length > 1){ 
    pathlist.pop();
  }
  loadData(pathlist.join(""));

  
});

window.addEventListener('beforeunload', (event) => {
  // Cancel the event as stated by the standard.
  event.preventDefault();
  // Chrome requires returnValue to be set.
  event.returnValue = '';
});

//方法提取出字符串中所有的数字并相加, 返回相加的结果
function sumNum(str:string){
  let reg = /\d+/g;
  let result = 0;
  let arr = str.match(reg);
  if(arr){
    arr.forEach(v=>{
      result += parseInt(v);
    });
  }
  return result;
}


const loadData = async (url:string) => {

  function isZipFile(v:ZIPListJSONData):ZIPListJSONData | null{
    if(v.index && v.path){
      return v;
    }
    else{
      return null;
    }
  }

  function isNotZipFile(v:FileListJSONData):FileListJSONData | null{
    if(v.isfolder && v.name){
      return v;
    }
    else{
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
  if(!response.ok || type !== "application/json"){
    return;
  }

  const json = await response.json();

    
    if(isNotZipFile(json[0])){
      const datalist = json as FileListJSONData[];
      let baseUrl = pathlist.join("");
      list.value.folder = datalist.filter(v=> v.isfolder).map(v=> {return {path: v.name+"/", name: v.name};});

      list.value.file = datalist.filter(v=> !v.isfolder).map(v=> {return {path: v.name, name: v.name, imgPath:baseUrl+v.name, isView:false};});
        list.value.file.sort((a,b)=>{
          let aNum = sumNum(a.name);
          let bNum = sumNum(b.name);
          return aNum - bNum;
        });

        history.pushState({ page: 1 }, "");
    }
    else if(isZipFile(json[0])){
      const datalist = json as ZIPListJSONData[];
      let baseUrl = pathlist.join("");
      list.value.folder = [];

      list.value.file = datalist.map(v=> {

        const path = `?Index=${v.index}`;

        return {path: path, name: v.path, imgPath:baseUrl+path, isView:false};


      });
        list.value.file.sort((a,b)=>{
          let aNum = sumNum(a.name);
          let bNum = sumNum(b.name);
          return aNum - bNum;
        });

        history.pushState({ page: 1 }, "");
    }
    else{
      console.error("未知的json数据格式");
    }

    
    
};





function loadData2(url:string){
 
fetch(url).then(e=>{
 
  let type = e.headers.get("Content-Type");
  console.log(type);
  if(!e.ok || !(type&& type.includes("text/html"))){
    return;
  }
 

  e.text().then(e=>{
    let doc = document.implementation.createHTMLDocument("text");
    doc.open();
    doc.write(e);
    doc.close();
   
    let ls = doc.getElementsByTagName("a");

    let folder: typeof list.value.folder = [];
  
    let file: typeof list.value.file =[];
    let baseUrl = pathlist.join("");
    Array.from(ls).forEach(v=>{
      let href = v.href;
      let name = v.innerText;
  
    
      if(href.endsWith("/")){
        folder.push({
          path:href,
          name:name
        });
      }
      else{
        file.push({
          path: href,
          name:name,
          imgPath:baseUrl+href,
          isView:false

        });
      }
    });

    file.sort((a,b)=>{
      let aNum = sumNum(a.name);
      let bNum = sumNum(b.name);
      return aNum - bNum;
    });

    list.value.file = file;
    list.value.folder=folder;

    history.pushState({ page: 1 }, "");

  }).catch(e=> console.log(e));
}).catch(e=> console.log(e));


}


function cf(e:MouseEvent, path:string, isFolder:boolean){
  e.preventDefault();

  if(isFolder || path.endsWith(".zip")||path.endsWith(".rar") || path.endsWith("7z")){
    pathlist.push(encodeURIComponent(path));
 
   
    loadData(pathlist.join(""));

  }
 
}

loadData(pathlist.join(""));
function isImg(url:string){
  return url.includes(".jpg") || url.includes(".png") || url.includes(".jpeg") || url.includes(".gif");
}

function isVideo(url:string){
  url = url.toLowerCase();

  return  url.includes(".mp4") ;
}

function setView(data:typeof list.value.file[0]){
  if(isImg(data.name) || isVideo(data.name)){
    console.log("run");
    data.isView=!data.isView;
  }
}

</script>

<template>
  <div>
    <h2>设置</h2>
    <button @click=" isViewCom = !isViewCom">isViewCom</button>
    <label >isViewCom {{ isViewCom }}</label>
  </div>
  <div>
    <h2>文件夹</h2>
    <ul v-if="list && list.folder && true">
      <li v-for="item of list.folder">
        <a v-bind:href="item.path"  @click="(e)=> cf(e, item.path, true)">{{ item.name }}</a>
      </li>
    </ul>
  </div>
  <div>
    <h2>文件</h2>
    <ul v-if="list && list.file && true">
      <li v-for="item of list.file">
        <a v-bind:href="item.path" @click="(e)=> {cf(e, item.path, false); setView(item)}">{{ item.name }}</a>
        
        <div v-if="item.isView&& isVideo(item.name)">
          
          
          <ViewVideo v-if="item.isView && isViewCom" :url="item.imgPath"></ViewVideo>
        </div>
        <div v-if="item.isView&& isImg(item.name)">
          
          <img v-if="item.isView && !isViewCom" v-bind:src="item.imgPath"  height="500" ></img>
          <ViewImg v-if="item.isView && isViewCom" :url="item.imgPath" :urls="list.file.filter(v=> isImg(v.name)).map(v=> v.imgPath)"></ViewImg>
        </div>
        
      </li>
    </ul>
  </div>
</template>

<style>



</style>
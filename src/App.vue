
<script setup lang="ts">
import { ref } from 'vue'
import ViewImg from './ViewImg.vue';

const list = ref({
  folder:[{path:"", name:""}],
  file:[{path:"", name:"", imgPath:"", isView:false}]
});

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

function loadData(url:string){
 
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

    list.value.file = file;
    list.value.folder=folder;

    history.pushState({ page: 1 }, "");

  }).catch(e=> console.log(e));
}).catch(e=> console.log(e));


}


function cf(e:MouseEvent, path:string, isFolder:boolean){
  e.preventDefault();

  if(isFolder || path.endsWith(".zip")){
    pathlist.push(path);
 
   
    loadData(pathlist.join(""));

  }
 
}

loadData(pathlist.join(""));

function setView(data:typeof list.value.file[0]){
  if(data.name.includes(".jpg") || data.name.includes(".png") || data.name.includes(".gif")){
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
        <div v-if="item.isView">
          
          <img v-if="item.isView && !isViewCom" v-bind:src="item.imgPath"  height="500" ></img>
          <ViewImg v-if="item.isView && isViewCom" :url="item.imgPath" :urls="list.file.map(v=> v.imgPath)"></ViewImg>
        </div>
        
      </li>
    </ul>
  </div>
</template>

<style>



</style>
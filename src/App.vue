
<script setup lang="ts">
import { ref } from 'vue'
import ViewImg from './ViewImg.vue';

const list = ref([
  {
    "hash_value":"",
    "isAllView":false,
    'count':0,

    "files":[
      {
        "name":"",

        "size":0,
      }
      
    ]
  }
]);

const page = ref(0);




list.value= [];

let key = "";

let changepageloadfunc = changekey;

function changepage(is_up:boolean){

  if(is_up){
    page.value-=1;
    changepageloadfunc();
  }
  else{
    page.value+=1;
    changepageloadfunc();
  }
}

function changekey(){
  page.value=0;
  console.log("select", key);

  changepageloadfunc = ()=> load(`/?key=${key}&page=${page.value}`);

  changepageloadfunc();
}

function selectNew(){
  page.value=0;

  changepageloadfunc = ()=> load(`/?new=1&page=${page.value}`);

  changepageloadfunc();
}


function selectHot(){
  page.value=0;

  changepageloadfunc = ()=> load(`/?hot=1&page=${page.value}`);

  changepageloadfunc();
}

function load(url:string){
  list.value=[];
 
  fetch(url).then(e=>{

  e.json().then((json)=> {


    console.log(json);
    const obj = <typeof list.value>json;
    obj.forEach(v=> {
      v.files.sort((a,b)=> -(a.size- b.size));

      v.isAllView=false;

      if(v.count){

      }
      else{
        v.count=0;
      }

    });
    list.value= json;

  });
  });


}

function tosizestring(n:number){

  const N = 1024;


  const byte = n;

  if(byte < N){
    return byte+":bytes";
  }

  const kb = Math.floor(byte/N);

  if(kb< N){
    return kb+":kb";


  }

  const mb = Math.floor(kb/N);

  if(mb< N){
    return mb+":mb";
    

  }

  const gb = Math.floor(mb/N);

  if(gb< N){
    return gb+":gb";
    

  }

  return "big";
}


function changevalue(v:HTMLInputElement){
  key = v.value;
}


</script>

<template>
  <div>
    <input type="text" v-on:input="(e)=> changevalue(<any>e.target)">
    <button type="button" v-on:click="(e)=> changekey()">搜索</button>
    <button type="button" v-on:click="(e)=> selectNew()">新的</button>
    <button type="button" v-on:click="(e)=> selectHot()">Hot</button>
  </div>
  <div>
    <button v-if="page > 0" type="button" v-on:click="(e)=> changepage(true)">上一页</button>
    <label v-if="list.length!=0 && true">第{{page}}页</label>
    <button v-if="list.length!=0 && true" type="button" v-on:click="(e)=>changepage(false)">下一页</button>
  </div>
  <div>
    <ul v-if="list && true">
      <li v-for="item of list">
        <label v-if="item.count ===0">hash: {{ item.hash_value }}    count:{{ item.files.length }}</label>
        <label v-if="item.count !==0">hash: {{ item.hash_value }}  hot:{{ item.count }}   count:{{ item.files.length }}</label>
        <button v-if="item.files && item.files.length>=4" type="button" v-on:click="()=>item.isAllView= !item.isAllView">切换</button>
        <ul v-if="item.files && true">
          
          <li v-for="file of (item.isAllView ? item.files: item.files.filter((v, n, vs)=> n < 4))">
            <p>          size:{{ tosizestring(file.size) }}   {{file.name}}</p>
          </li>

        </ul>

      </li>
     
    </ul>
    
   </div> 
   <div>
    <button v-if="page > 0" type="button" v-on:click="(e)=> changepage(true)">上一页</button>
    <label v-if="list.length!=0 && true">第{{page}}页</label>
    <button v-if="list.length!=0 && true" type="button" v-on:click="(e)=>changepage(false)">下一页</button>
  </div>
</template>

<style>



</style>
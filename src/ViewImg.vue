<script setup lang="ts">
import { ref, useTemplateRef, onMounted } from 'vue'
   const {url,urls } = defineProps<{
  url?: string
  urls?: string[]
}>();

    console.log(url, urls);
    const view_div = useTemplateRef("view_div");
    const viewUrl = ref(url);

    

    function f全屏(){
       
        if(view_div.value){
          
            view_div.value.requestFullscreen();
         
        }
        else{
            console.log("view_div is null");
        }
        
    }

    function view_next(){
        if(urls && urls.length !=0){
            let a = urls.shift();
            if(a){
                urls.push(a);
                viewUrl.value=a;
            }          
        }
    }

    function view_pre(){
        if(urls && urls.length !=0){
            let a = urls.pop();
            if(a){
                urls.unshift(a);
                viewUrl.value=a;
            }          
        }
    }

    //将浏览器可视窗口分为左右两个部位, 检测鼠标左键的单击, 假如在屏幕右侧单击, 调用函数1, 假如在屏幕左侧单击, 调用函数2
    window.addEventListener("click", function(e){
        if(e.clientX > window.innerWidth/2){
            console.log("right");
            view_next();
        }
        else{
            console.log("left");
            view_pre();
        }
    });


    function f自动播放(){
        
        view_next();
        setTimeout(f自动播放, 3000);
    }

</script>



<template>
    <button @click="f全屏()" >全屏</button>
    <button @click="f自动播放()" >自动播放</button>
    <div  >
        <img ref="view_div" v-bind:src="viewUrl" >
    </div>

</template>

<script setup lang="ts">
import { ref, useTemplateRef, onMounted } from 'vue'
   const {url,urls } = defineProps<{
  url?: string
  urls?: string[]
}>();

    console.log(url, urls);
    const view_div = useTemplateRef("view_div");
    const viewUrl = ref(url);

    const emit = defineEmits<{
        onClose: []
    }>();

    const onClose = () => {
        emit("onClose");
    };

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
    <div class="viewimage-root" @click.stop>
        <div class="viewimage-left">
            <div class="viewimage-close" @click="onClose">关闭</div>
            <div class="viewimage-filelisttree">
            <ul>
                <li v-for="(item, index) in urls" :key="index">
                    <span @click="viewUrl = item">{{ item }}</span>
                </li>
            </ul>
        </div>
        </div>
        <div class="viewimage-right">
            <img class="viewimage-image" ref="view_div" v-bind:src="viewUrl" >
            
            <div class="viewimage-controls">
                <button @click="view_pre()">上一张</button>
                <button @click="view_next()">下一张</button>
                <button @click="f全屏()" >全屏</button>
                <button @click="f自动播放()" >自动播放</button>
            </div>
        </div>    
    </div>
</template>


<style scoped>

.viewimage-root {
    position: fixed;

    top: 0; left: 0; right: 0; bottom: 0;
    background: black;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    overflow: hidden;
}

.viewimage-left {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 10px;
    overflow-y: auto;

    display: flex;
    flex-direction: column;

}

.viewimage-close {
    flex: 1;
    cursor: pointer;
    color: red;
    font-size: larger;
    margin-bottom: 10px;
}
.viewimage-filelisttree {
    flex: 9;
    max-height: 80vh;
    overflow-y: auto;
}


.viewimage-right {
    flex: 9;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    align-items: center;
    justify-content: center;
}

.viewimage-image {
    flex: 9;
    margin-top: 20px;
    max-width: 90%;
    max-height: 90%;
}



.viewimage-controls {
    flex: 1;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    margin-top: 10px;
}

.viewimage-controls button {
    margin: 0 5px;
    padding: 5px 10px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.viewimage-controls button:hover {
    background-color: #0056b3;
}




</style>

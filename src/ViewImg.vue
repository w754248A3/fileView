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
            floop();
        }
        else{
            console.log("view_div is null");
        }
        
    }

    function floop(){

        if(urls && urls.length !=0){
            let a = urls.shift();
            if(a){
                urls.push(a);


                viewUrl.value=a;


                setTimeout(()=> floop(), 3000);
            }
            



            
        }

        


    }

</script>



<template>
    <button @click="f全屏()" >全屏</button>
    <div  >
        <img ref="view_div" v-bind:src="viewUrl" >
    </div>

</template>

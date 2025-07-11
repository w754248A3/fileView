<script setup lang="ts">
import { ref, useTemplateRef, onMounted } from 'vue'
   const {url} = defineProps<{
  url?: string
}>();

    console.log(url);
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


</script>



<template>
    <button @click="f全屏()" >全屏</button>
   
    <div  >
        <video ref="view_div" v-bind:src="viewUrl"></video>
        
    </div>

</template>

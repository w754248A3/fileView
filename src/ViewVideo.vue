<script setup lang="ts">
import { ref, useTemplateRef, onMounted } from 'vue'
   const {url} = defineProps<{
  url?: string
}>();

    const emit = defineEmits<{
        onClose: []
    }>();


    const onClose = () => {
        emit("onClose");
    };
</script>



<template>
    <div class="view-video" @click.stop>
        <div class="close-e" @click="onClose">关闭</div>
        <video class="video-e" ref="view_div" v-bind:src="url" controls></video>     
    </div>
</template>


<style scoped>

.view-video {

    position: fixed;

    top: 0; left: 0; right: 0; bottom: 0;
    background: black;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    overflow: hidden;

}

.close-e{
    flex: 0 0 auto;

    background: red;
    
    
    font-size: larger;

    position: absolute;

    top: 20px;
    left:20px;


}

.video-e {
    flex: 1;
    max-width: 80%;
    max-height: 80%;
    
}

</style>

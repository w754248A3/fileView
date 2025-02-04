<script setup lang="ts">
   const {url,urls } = defineProps<{
  url?: string
  urls?: string[]
}>();

    console.log(url, urls);

</script>



<template>
    <div>
        <img v-bind:src="url" height="500">
    </div>

</template>

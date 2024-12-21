<script setup lang="ts">
    defineProps(['url']);



</script>



<template>
    <div>
        <img v-bind:src="url" height="500">
    </div>

</template>

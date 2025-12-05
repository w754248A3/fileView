<script setup lang="ts">
import { ref } from 'vue'
import App from './App.vue'

// C 部分的选择框数据
const selectedValue = ref('')
const options = ref([
  { value: 'option1', label: '选项 1' },
  { value: 'option2', label: '选项 2' },
  { value: 'option3', label: '选项 3' },
  { value: 'option4', label: '选项 4' },
  { value: 'option5', label: '选项 5' }
])

// 选择框变化事件处理
const handleSelectChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  selectedValue.value = target.value
  // 事件处理程序可以留空，后续可以在这里添加逻辑
  console.log('选择的值:', selectedValue.value)
}
</script>

<template>
  <div id="new-app-root">
    <!-- C 部分：选择框 -->
    <div id="new-app-section-c">
      <select 
        :value="selectedValue" 
        @change="handleSelectChange"
        id="new-app-select"
      >
        <option value="">请选择...</option>
        <option 
          v-for="option in options" 
          :key="option.value" 
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
    
    <!-- A 和 B 容器 -->
    <div id="new-app-content-container">
      <!-- A 部分 -->
      <div id="new-app-section-a">
        <App />
      </div>
      
      <!-- B 部分 -->
      <div id="new-app-section-b">
        <App />
      </div>
    </div>
  </div>
</template>

<style scoped>
#new-app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

#new-app-section-c {
  flex-shrink: 0;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

#new-app-select {
  width: 100%;
  max-width: 300px;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

#new-app-content-container {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

#new-app-section-a,
#new-app-section-b {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  border-right: 1px solid #e0e0e0;
}

#new-app-section-b {
  border-right: none;
}
</style>

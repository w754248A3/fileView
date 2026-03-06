<template>
  <div class="gallery-container" ref="containerRef">
    <div class="page-close" @click="onClose">关闭</div>
    <!-- 主 Canvas 用于绘制所有图片 -->
    <canvas 
      ref="canvasRef" 
      @click="handleCanvasClick"
      class="gallery-canvas"
    ></canvas>

    <!-- 模态窗口 -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-btn" @click="closeModal">×</button>
        <!-- 图片通过 URL 重新从服务器获取 -->
        <img :src="currentModalUrl" class="modal-image" alt="Full size" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';

// 定义 Props
const props = defineProps<{
  urls: string[];
}>();

const emit = defineEmits<{
  (e: 'onClose'): void
}>()


const onClose = () => emit('onClose');

// 自定义控制台输出函数
const log = (message: string, ...args: any[]) => {
  console.log(`[CanvasGallery] ${message}`, ...args);
};
const logError = (message: string, ...args: any[]) => {
  console.error(`[CanvasGallery Error] ${message}`, ...args);
};

// --- 类型定义 ---
interface ImageRect {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- 状态与 DOM 引用 ---
const containerRef = shallowRef<HTMLDivElement | null>(null);
const canvasRef = shallowRef<HTMLCanvasElement | null>(null);

const isModalOpen = ref(false);
const currentModalUrl = ref('');

// 内部状态
const imageRects: ImageRect[] = []; // 保存图片的坐标范围
let abortController: AbortController | null = null; // 用于页面卸载时取消网络请求

// 布局相关变量
const TARGET_COL_WIDTH = 300; // 期望的列宽（用来计算一行放几张）
let cols = 1;
let colWidth = 0;
let currentY = 0; // 当前行的起始 Y 坐标
let currentRowMaxHeight = 0; // 当前行最高的图片高度
let canvasWidth = 0; // 挂载后固定的 Canvas 宽度

// --- 核心方法 ---

/**
 * 初始化 Canvas 尺寸与网格参数
 */
const initCanvas = () => {
  if (!containerRef.value || !canvasRef.value) return;
  
  const container = containerRef.value;
  const canvas = canvasRef.value;

  // 获取挂载瞬间的容器宽度，并作为 canvas 固定宽度
  canvasWidth = container.clientWidth;
  
  // 初始化高度，后续动态扩容
  const initialHeight = window.innerHeight;

  canvas.width = canvasWidth;
  canvas.height = initialHeight;

  // 计算一行显示几列 (至少 1 列)
  cols = Math.max(1, Math.floor(canvasWidth / TARGET_COL_WIDTH));
  colWidth = canvasWidth / cols;

  log(`Canvas初始化完成. 宽度: ${canvasWidth}px, 列数: ${cols}, 每列宽度: ${colWidth.toFixed(2)}px`);
};

/**
 * 动态扩容 Canvas 并保留原有像素数据
 */
const ensureCanvasHeight = (requiredHeight: number) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  if (canvas.height >= requiredHeight) return;

  // 每次扩容额外增加 1000 像素作为缓冲，避免频繁扩容
  const newHeight = requiredHeight + 1000;
  log(`触发Canvas扩容: 原高度 ${canvas.height}px -> 新高度 ${newHeight}px`);

  // 1. 创建离屏不可见的 Canvas，临时保存当前画面
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  
  if (offscreenCtx) {
    offscreenCtx.drawImage(canvas, 0, 0);
  } else {
    logError('无法获取离屏 Canvas 的 2D 上下文');
  }

  // 2. 修改主 Canvas 的高度 (这会导致主 Canvas 被清空)
  canvas.height = newHeight;

  // 3. 将离屏 Canvas 的内容复制回主 Canvas
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(offscreenCanvas, 0, 0);
  }
  
  // 离屏 Canvas 失去引用后将被垃圾回收
};

/**
 * 异步获取图片并转为 ImageBitmap
 */
const fetchImageBitmap = async (url: string, signal: AbortSignal): Promise<ImageBitmap> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP 异常: ${response.status}`);
  }
  // 获取 Blob
  const blob = await response.blob();
  // 使用 createImageBitmap 是最高效的绘制准备方式，非常适合 Canvas
  const bitmap = await createImageBitmap(blob);
  return bitmap;
};

/**
 * 按顺序加载和绘制所有的图片
 */
const loadAndDrawImages = async () => {
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;

  abortController = new AbortController();
  const signal = abortController.signal;

  log(`开始加载并绘制图片，共计 ${props.urls.length} 张`);

  for (let i = 0; i < props.urls.length; i++) {
    // 检查是否已被卸载中止
    if (signal.aborted) {
      log('图片加载任务已被中止');
      break;
    }

    const url = props.urls[i];
    
    try {
      log(`正在拉取第 ${i + 1} 张图片...`);
      const bitmap = await fetchImageBitmap(url, signal);

      // 计算绘制尺寸
      const scaleRatio = colWidth / bitmap.width;
      const scaledHeight = bitmap.height * scaleRatio;

      // 计算坐标
      const colIndex = i % cols;
      
      // 如果是新的一行，更新 currentY，并重置当前行最大高度
      if (colIndex === 0 && i > 0) {
        currentY += currentRowMaxHeight;
        currentRowMaxHeight = 0;
      }

      const x = colIndex * colWidth;
      const y = currentY;

      // 更新当前行的最大高度
      currentRowMaxHeight = Math.max(currentRowMaxHeight, scaledHeight);

      // 检查是否需要扩容 Canvas 高度
      const requiredHeight = y + scaledHeight;
      ensureCanvasHeight(requiredHeight);

      // 绘制到 Canvas 上
      ctx.drawImage(bitmap, x, y, colWidth, scaledHeight);

      // 记录图片坐标信息
      imageRects.push({
        url,
        x,
        y,
        w: colWidth,
        h: scaledHeight
      });

      // 【关键】绘制完毕后立刻释放内存，丢弃 Blob 和 Bitmap
      bitmap.close();
      log(`第 ${i + 1} 张图片绘制完毕并已释放内存. 坐标: [x:${x.toFixed(0)}, y:${y.toFixed(0)}]`);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        log('网络请求被取消');
      } else {
        logError(`第 ${i + 1} 张图片加载或绘制失败 (${url})`, error);
      }
    }
  }

  log('所有图片处理流程结束.');
};

/**
 * 处理 Canvas 的点击事件
 */
const handleCanvasClick = (event: MouseEvent) => {
  if (!canvasRef.value) return;

  // 获取 Canvas 的 CSS 尺寸和位置
  const rect = canvasRef.value.getBoundingClientRect();
  
  // 计算鼠标在 Canvas 内部的真实坐标 (应对 CSS 缩放与实际像素的差异)
  const scaleX = canvasRef.value.width / rect.width;
  const scaleY = canvasRef.value.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  log(`点击 Canvas, 坐标: [X: ${clickX.toFixed(0)}, Y: ${clickY.toFixed(0)}]`);

  // 遍历寻找点击落在哪个图片的范围内
  const clickedImage = imageRects.find(img => 
    clickX >= img.x && clickX <= img.x + img.w &&
    clickY >= img.y && clickY <= img.y + img.h
  );

  if (clickedImage) {
    log(`命中图片! URL: ${clickedImage.url}`);
    openModal(clickedImage.url);
  } else {
    log('点击在空白处');
  }
};

/**
 * 模态框控制
 */
const openModal = (url: string) => {
  currentModalUrl.value = url;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  currentModalUrl.value = '';
};

// --- 生命周期 ---
onMounted(() => {
  initCanvas();
  loadAndDrawImages();
});

onUnmounted(() => {
  // 组件卸载时，终止尚未完成的网络请求，释放资源
  if (abortController) {
    abortController.abort();
    log('组件卸载，已清理未完成的网络请求');
  }
});

</script>

<style scoped>
/* 容器：铺满视口，垂直滚动，禁止水平滚动 */
.gallery-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: #f0f0f0;
}

.page-close{
    position: fixed;
    top: 0;
    left: 0;
    cursor: pointer;
    color: #ff6b6b;
    font-size: 15px;
    font-weight: 600;
    z-index: 10001;
}

/* Canvas：块级元素 */
.gallery-canvas {
  display: block;
  cursor: pointer;
  /* 确保 Canvas 的 CSS 宽度 100% 匹配内部像素 */
  width: 100%;
}

/* 半透明模态背景 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* 模态内容容器 */
.modal-content {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 90vw;
  height: 90vh;
}

/* 大图显示，不超出边界，保持比例 */
.modal-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: -20px;
  right: -20px;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 24px;
  line-height: 40px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  transition: transform 0.2s;
}

.close-btn:hover {
  transform: scale(1.1);
}
</style>
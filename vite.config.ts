import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import http from "node:http"

const keepAliveAgent = new http.Agent({
  keepAlive: true
})
// https://vite.dev/config/
export default defineConfig({
  base:"/app",
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  server:{
    proxy:{
      '^/(?!app)': {
        target: 'http://localhost:80',
        changeOrigin: true,
        agent: keepAliveAgent
      }
    }
  },
  
})

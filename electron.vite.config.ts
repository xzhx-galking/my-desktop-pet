import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          pet: resolve('src/renderer/pet-overlay.html')
        }
      }
    }
  }
})

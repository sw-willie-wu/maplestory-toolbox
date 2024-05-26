import { defineConfig, loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'　 
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // 環境變數
  return {
    plugins: [
      Vue() // .vue
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src') // @
      }
    },
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV) // 環境變數
    }
  }
})
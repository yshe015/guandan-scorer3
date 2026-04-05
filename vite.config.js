import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SHOW_THEME_BUTTON': JSON.stringify(env.VITE_SHOW_THEME_BUTTON || 'true'),
      'import.meta.env.VITE_SHOW_RESET_BUTTON': JSON.stringify(env.VITE_SHOW_RESET_BUTTON || 'true')
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
})

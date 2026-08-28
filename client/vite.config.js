import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // Override with API_TARGET when the backend runs on another port.
        target: process.env.API_TARGET || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})


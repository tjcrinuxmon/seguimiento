import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El módulo vive bajo /seguimiento/ detrás del gateway de SiCoDEAJ, que además
// reescribe /api/seg/* → /api/* hacia este servidor (puerto 3009).
export default defineConfig({
  plugins: [react()],
  base: '/seguimiento/',
  server: {
    host: '0.0.0.0',
    port: 5176,
    proxy: {
      '/api/seg': {
        target: 'http://localhost:3009',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/seg/, '/api'),
      },
    },
  },
})

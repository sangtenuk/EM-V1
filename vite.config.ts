import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // 🔥 Import path untuk alias

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // ✅ Tambah alias @ ke folder src
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: '.',
  plugins: [react()],
  server: { port: 4175, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4175, strictPort: true, host: '127.0.0.1' },
  build: { outDir: 'dist/gui', sourcemap: true, target: 'es2023', emptyOutDir: true },
})

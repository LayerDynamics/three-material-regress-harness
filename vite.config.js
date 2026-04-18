import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SHIM = resolve(ROOT, 'src/gui-shim/empty.js')

// Every Node-only API that Node-side modules in this package reference.
// In the browser they resolve to a shim whose functions throw with a clear
// "node-only" error — they are only reachable along code paths never
// exercised in the browser bundle (runner/*, recorder/params.js disk branch).
const NODE_SHIMS = new Set([
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:url',
  'node:os',
  'node:child_process',
  'node:buffer',
  'node:zlib',
  'node:crypto',
  'playwright',
  'playwright-core',
  '@playwright/test',
  'chokidar',
  'commander',
  'pngjs',
  'sharp',
  'kmp-three-suite',
])

/** Vite plugin: redirect Node-only imports to the browser shim. */
const nodeShimPlugin = {
  name: 'evth-node-shim',
  enforce: 'pre',
  resolveId(id) {
    if (NODE_SHIMS.has(id)) return SHIM
    return null
  },
}

export default defineConfig({
  root: '.',
  plugins: [nodeShimPlugin, react()],
  server: { port: 4175, strictPort: true, host: '127.0.0.1', fs: { strict: false } },
  preview: { port: 4175, strictPort: true, host: '127.0.0.1' },
  build: {
    outDir: 'dist/gui',
    sourcemap: true,
    target: 'es2023',
    emptyOutDir: true,
    rollupOptions: { external: [...NODE_SHIMS] },
  },
  optimizeDeps: { exclude: [...NODE_SHIMS] },
})

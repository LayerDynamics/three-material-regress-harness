import { nodeResolve } from '@rollup/plugin-node-resolve'

// Strip `/** … */` blocks so public JSDoc (kept for IDE hover and plain-JS
// consumers) does not bloat the browser bundle. Newlines inside each stripped
// block are preserved so the emitted sourcemap still lines up with src/.
const stripJsDoc = {
  name: 'strip-jsdoc',
  transform(code) {
    if (!code.includes('/**')) return null
    const stripped = code.replace(/\/\*\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    return { code: stripped, map: null }
  },
}

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/extern-material-three-visual-test-harness.mjs',
    format: 'esm',
    sourcemap: true,
  },
  external: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    'zustand',
    'zustand/middleware',
    'kmp-three-suite',
    'playwright',
    'commander',
    'pngjs',
    'pixelmatch',
    'image-ssim',
    'chokidar',
    'sharp',
    'fflate',
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:url',
    'node:os',
    'node:child_process',
    'node:buffer',
    'node:zlib',
    'node:crypto',
    /^three\//,
  ],
  plugins: [stripJsDoc, nodeResolve({ preferBuiltins: true })],
  treeshake: { moduleSideEffects: ['./src/components/App.jsx'] },
}

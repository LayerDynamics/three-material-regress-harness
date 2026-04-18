import { nodeResolve } from '@rollup/plugin-node-resolve'
import { transform } from 'esbuild'

// Strip `/** … */` blocks so public JSDoc does not bloat the browser bundle.
const stripJsDoc = {
  name: 'strip-jsdoc',
  transform(code) {
    if (!code.includes('/**')) return null
    const stripped = code.replace(/\/\*\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    return { code: stripped, map: null }
  },
}

// Transpile .jsx files via esbuild.
const jsxTransform = {
  name: 'tmrh-jsx',
  async transform(code, id) {
    if (!id.endsWith('.jsx')) return null
    const result = await transform(code, {
      loader: 'jsx',
      jsx: 'automatic',
      jsxImportSource: 'react',
      sourcemap: true,
      sourcefile: id,
      target: 'es2023',
    })
    return { code: result.code, map: result.map }
  },
}

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/three-material-regress-harness.mjs',
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
  plugins: [jsxTransform, stripJsDoc, nodeResolve({ preferBuiltins: true })],
  treeshake: { moduleSideEffects: false },
}

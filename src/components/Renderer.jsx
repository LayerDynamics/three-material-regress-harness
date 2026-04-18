// Renderer — R3F <Canvas> wrapper. Full implementation lands in milestone M2 (T18).
// This milestone exports the component so src/index.js contract is satisfied.

import { Canvas } from '@react-three/fiber'
import { useRendererStore } from '../stores/rendererStore.js'

export function Renderer({ children }) {
  const width = useRendererStore((s) => s.width)
  const height = useRendererStore((s) => s.height)
  const dpr = useRendererStore((s) => s.dpr)
  const camera = useRendererStore((s) => s.camera)

  return (
    <div style={{ width, height }}>
      <Canvas
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
        camera={{
          position: camera.position,
          up: camera.up,
          fov: camera.fov,
          near: 0.1,
          far: 100,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </Canvas>
    </div>
  )
}

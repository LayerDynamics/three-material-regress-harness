import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useRendererStore } from '../../stores/rendererStore.js'
import { useRegressionStore } from '../../stores/regressionStore.js'
import { useTestStore } from '../../stores/testStore.js'
import { useHarnessStore } from '../../stores/harnessStore.js'
import { Material } from '../Material.jsx'
import { SceneGeometry } from './SceneGeometry.jsx'
import { makeDiffPng } from '../../recorder/diff.js'

export function ViewPort({ candidatePixels, referencePixels }) {
  const camera = useRendererStore((s) => s.camera)
  const definition = useRendererStore((s) => s.materialDefinition)
  const geometryKind = useRendererStore((s) => s.geometryKind)
  const environment = useRendererStore((s) => s.environment)
  const activeTestId = useHarnessStore((s) => s.activeTestId)
  const current = useRegressionStore((s) => s.current)
  const activeTest = useTestStore((s) => s.manifest.find((t) => t.id === activeTestId) ?? null)

  const diffImageUrl = useMemo(() => {
    if (!candidatePixels || !referencePixels) return null
    if (candidatePixels.width !== referencePixels.width || candidatePixels.height !== referencePixels.height) return null
    const W = candidatePixels.width
    const H = candidatePixels.height
    const composite = makeDiffPng(candidatePixels.pixels, referencePixels.pixels, { width: W, height: H })
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(composite.width, composite.height)
      : document.createElement('canvas')
    canvas.width = composite.width
    canvas.height = composite.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const img = new ImageData(
      new Uint8ClampedArray(composite.pixels.buffer, composite.pixels.byteOffset, composite.pixels.byteLength),
      composite.width, composite.height,
    )
    ctx.putImageData(img, 0, 0)
    if (canvas instanceof HTMLCanvasElement) return canvas.toDataURL('image/png')
    // OffscreenCanvas path — convert via a temp HTMLCanvasElement.
    const temp = document.createElement('canvas')
    temp.width = composite.width
    temp.height = composite.height
    temp.getContext('2d')?.putImageData(img, 0, 0)
    return temp.toDataURL('image/png')
  }, [candidatePixels, referencePixels])

  return (
    <main className="tmrh-viewport">
      <div className="tmrh-pane">
        <div className="label">Candidate (Three.js, live)</div>
        <div className="body" style={{ background: '#000' }}>
          <Canvas
            dpr={1}
            flat
            linear
            gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
            camera={{ position: camera.position, up: camera.up, fov: camera.fov, near: 0.1, far: 100 }}
          >
            <ambientLight intensity={0.5} color={0x404040} />
            <directionalLight position={[2, 3, 4]} intensity={1.5} color={0xffffff} />
            {environment && (
              <Environment
                files={typeof environment === 'string' ? `/hdri/${environment}.hdr` : environment.hdri}
                environmentIntensity={1.0}
              />
            )}
            <SceneGeometry kind={geometryKind}>
              {definition && <Material definition={definition} />}
            </SceneGeometry>
            <OrbitControls enablePan enableZoom />
          </Canvas>
        </div>
      </div>
      <div className="tmrh-pane">
        <div className="label">Reference (External)</div>
        <div className="body">
          {activeTest?.referenceImagePath
            ? <img src={activeTest.referenceImagePath} alt="reference" />
            : <span style={{ color: 'var(--muted)' }}>no active test</span>}
        </div>
      </div>
      <div className="tmrh-pane">
        <div className="label">
          Diff
          {current && <span style={{ color: current.verdict === 'pass' ? 'var(--pass)' : 'var(--fail)', marginLeft: 6 }}>
            rmse {current.rmse.toFixed(3)} · ssim {current.ssim.toFixed(4)}
          </span>}
        </div>
        <div className="body">
          {diffImageUrl
            ? <img src={diffImageUrl} alt="diff composite" />
            : <span style={{ color: 'var(--muted)' }}>capture to compute diff</span>}
        </div>
      </div>
    </main>
  )
}

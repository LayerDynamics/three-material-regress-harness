import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useRendererStore } from '../../stores/rendererStore.js'
import { useRecordingStore } from '../../stores/recordingStore.js'
import { useRegressionStore } from '../../stores/regressionStore.js'
import { Material } from '../Material.jsx'
import { SceneGeometry } from './SceneGeometry.jsx'

export function ViewPort() {
  const camera = useRendererStore((s) => s.camera)
  const definition = useRendererStore((s) => s.materialDefinition)
  const geometryKind = useRendererStore((s) => s.geometryKind)
  const environment = useRendererStore((s) => s.environment)
  const current = useRegressionStore((s) => s.current)
  const candidateBlob = useRecordingStore((s) => current ? s.completed.get(current.id) : null)

  return (
    <main className="evth-viewport">
      <div className="evth-pane">
        <div className="label">Candidate (Three.js)</div>
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
      <div className="evth-pane">
        <div className="label">Reference (External)</div>
        <div className="body">
          {current?.referencePath
            ? <img src={current.referencePath} alt="reference" />
            : <span style={{ color: 'var(--muted)' }}>no active test</span>}
        </div>
      </div>
      <div className="evth-pane">
        <div className="label">Diff</div>
        <div className="body">
          {candidateBlob && typeof candidateBlob !== 'string'
            ? <img src={URL.createObjectURL(candidateBlob)} alt="diff" />
            : <span style={{ color: 'var(--muted)' }}>run a capture</span>}
        </div>
      </div>
    </main>
  )
}

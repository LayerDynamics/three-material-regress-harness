import { useCallback, useState } from 'react'
import { useRendererStore } from '../../stores/rendererStore.js'
import { useHarnessStore } from '../../stores/harnessStore.js'
import { minimizeCmaEs } from '../../harness/solver.js'
import { Harness } from '../../harness/harness.js'
import { diffImages } from '../../recorder/diff.js'
import { setNested, getNested } from '../../harness/sweep.js'

const DEFAULT_BOUNDS = [
  { path: 'roughness', min: 0, max: 1 },
  { path: 'metalness', min: 0, max: 1 },
  { path: 'clearcoat', min: 0, max: 1 },
]

export function SolverPanel({ referencePixels, referenceSize }) {
  const [bounds, setBounds] = useState(DEFAULT_BOUNDS)
  const [maxIter, setMaxIter] = useState(20)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(null)
  const [history, setHistory] = useState([])

  const def = useRendererStore((s) => s.materialDefinition)
  const camera = useRendererStore((s) => s.camera)
  const environment = useRendererStore((s) => s.environment)
  const geometryKind = useRendererStore((s) => s.geometryKind)
  const setDefinition = useRendererStore((s) => s.setMaterialDefinition)
  const pushEvent = useHarnessStore((s) => s.pushEvent)

  const onRun = useCallback(async () => {
    if (!def || !referencePixels) return
    setRunning(true)
    setBest(null)
    setHistory([])
    try {
      pushEvent({ name: 'solver.start', payload: { bounds, maxIter } })
      const result = await minimizeCmaEs({
        bounds,
        maxIter,
        seed: 0x5eed2026,
        objective: async (x) => {
          const candidate = structuredClone(def)
          for (let i = 0; i < bounds.length; i++) {
            setNested(candidate, bounds[i].path, x[i])
          }
          const harness = new Harness({
            materialDefinition: candidate,
            geometry: { type: geometryKind, radius: 1, widthSegments: 48, heightSegments: 48 },
            pose: {
              cameraPosition: camera.position,
              cameraTarget: camera.target,
              cameraUp: camera.up,
              cameraFov: camera.fov,
              imageWidth: referenceSize?.width ?? 256,
              imageHeight: referenceSize?.height ?? 256,
            },
            environment,
            testId: 'solver',
          })
          try {
            const capture = await harness.capture({ timeoutMs: 5_000 })
            const d = diffImages(capture.pixels, referencePixels, {
              width: capture.width, height: capture.height, silhouetteOnly: true,
            })
            return d.rmse
          } finally {
            harness.dispose()
          }
        },
        onGeneration: (gen, bestSoFar) => {
          setHistory((prev) => [...prev, { gen, f: bestSoFar.f }])
        },
      })
      setBest(result.best)
      pushEvent({ name: 'solver.done', payload: { bestF: result.best.f, iterations: result.iterations } })
    } catch (err) {
      pushEvent({ name: 'solver.error', payload: { error: err?.message ?? String(err) } })
    } finally {
      setRunning(false)
    }
  }, [def, bounds, maxIter, camera, environment, geometryKind, referencePixels, referenceSize, pushEvent])

  const onApply = useCallback(() => {
    if (!best || !def) return
    const next = structuredClone(def)
    for (let i = 0; i < bounds.length; i++) setNested(next, bounds[i].path, best.x[i])
    setDefinition(next)
    pushEvent({ name: 'solver.apply', payload: { values: best.x } })
  }, [best, bounds, def, setDefinition, pushEvent])

  const patchBound = (idx, key, val) => {
    setBounds((bs) => bs.map((b, i) => (i === idx ? { ...b, [key]: val } : b)))
  }

  const addBound = () => setBounds((bs) => [...bs, { path: 'ior', min: 1, max: 2.5 }])
  const removeBound = (idx) => setBounds((bs) => bs.filter((_, i) => i !== idx))

  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 4 }}>
      <h2>CMA-ES Solver</h2>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        Minimise RMSE vs reference by tuning the fields below.
      </div>
      {bounds.map((b, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 40px 24px', gap: 4, marginBottom: 4 }}>
          <input
            type="text" value={b.path}
            onChange={(e) => patchBound(idx, 'path', e.target.value)}
          />
          <input
            type="number" step="0.01" value={b.min}
            onChange={(e) => patchBound(idx, 'min', Number(e.target.value))}
          />
          <input
            type="number" step="0.01" value={b.max}
            onChange={(e) => patchBound(idx, 'max', Number(e.target.value))}
          />
          <code style={{ fontSize: 10, alignSelf: 'center' }}>
            {def ? (getNested(def, b.path) ?? '—') : '—'}
          </code>
          <button className="secondary" onClick={() => removeBound(idx)}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button className="secondary" onClick={addBound}>+ field</button>
        <span className="k" style={{ alignSelf: 'center' }}>max iter</span>
        <input
          type="number" min="4" max="100" value={maxIter}
          onChange={(e) => setMaxIter(Number(e.target.value))}
          style={{ width: 70 }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button onClick={onRun} disabled={running || !def || !referencePixels}>
          {running ? 'Searching…' : 'Run solver'}
        </button>
        {best && (
          <>
            <span>best RMSE: <b>{best.f.toFixed(4)}</b></span>
            <button onClick={onApply}>Apply best</button>
          </>
        )}
      </div>
      {best && (
        <div style={{ fontSize: 11, marginTop: 6 }}>
          {bounds.map((b, i) => (
            <div key={b.path}>{b.path} → <code>{best.x[i].toFixed(4)}</code></div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
          gen {history.length}: {history.map((h) => h.f.toFixed(2)).slice(-10).join(' ')}
        </div>
      )}
    </div>
  )
}

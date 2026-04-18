import { useCallback, useState } from 'react'
import { useRendererStore } from '../../stores/rendererStore.js'
import { useHarnessStore } from '../../stores/harnessStore.js'
import { sweep, getNested } from '../../harness/sweep.js'

const COMMON_FIELDS = [
  { path: 'roughness',                 min: 0,    max: 1,    steps: 9 },
  { path: 'metalness',                 min: 0,    max: 1,    steps: 9 },
  { path: 'clearcoat',                 min: 0,    max: 1,    steps: 9 },
  { path: 'clearcoatRoughness',        min: 0,    max: 1,    steps: 9 },
  { path: 'ior',                       min: 1,    max: 2.5,  steps: 9 },
  { path: 'transmission',              min: 0,    max: 1,    steps: 9 },
  { path: 'sheen',                     min: 0,    max: 1,    steps: 9 },
  { path: 'anisotropy',                min: 0,    max: 1,    steps: 9 },
  { path: 'iridescence',               min: 0,    max: 1,    steps: 9 },
  { path: 'envMapIntensity',           min: 0,    max: 4,    steps: 9 },
  { path: 'toonParams.shadowMultiplier', min: 0,  max: 1,    steps: 9 },
  { path: 'carpaintParams.metalCoverage', min: 0, max: 2,    steps: 9 },
  { path: 'carpaintParams.metalFlakeVisibility', min: 0, max: 1, steps: 9 },
  { path: 'sssParams.diffuseWeight',   min: 0,    max: 2,    steps: 9 },
]

export function SweepPanel({ referencePixels }) {
  const [field, setField] = useState(COMMON_FIELDS[0].path)
  const [min, setMin] = useState(COMMON_FIELDS[0].min)
  const [max, setMax] = useState(COMMON_FIELDS[0].max)
  const [steps, setSteps] = useState(COMMON_FIELDS[0].steps)
  const [sheetUrl, setSheetUrl] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [bestValue, setBestValue] = useState(null)
  const [running, setRunning] = useState(false)

  const def = useRendererStore((s) => s.materialDefinition)
  const camera = useRendererStore((s) => s.camera)
  const width = useRendererStore((s) => s.width)
  const height = useRendererStore((s) => s.height)
  const environment = useRendererStore((s) => s.environment)
  const geometryKind = useRendererStore((s) => s.geometryKind)
  const pushEvent = useHarnessStore((s) => s.pushEvent)

  const onPreset = useCallback((ev) => {
    const next = COMMON_FIELDS.find((f) => f.path === ev.target.value)
    if (!next) return
    setField(next.path)
    setMin(next.min)
    setMax(next.max)
    setSteps(next.steps)
  }, [])

  const onRun = useCallback(async () => {
    if (!def) return
    setRunning(true)
    try {
      pushEvent({ name: 'sweep.start', payload: { field, min, max, steps } })
      const result = await sweep({
        baseDefinition: def,
        field,
        min,
        max,
        steps,
        geometry: { type: geometryKind, radius: 1, widthSegments: 64, heightSegments: 64 },
        pose: {
          cameraPosition: camera.position,
          cameraTarget: camera.target,
          cameraUp: camera.up,
          cameraFov: camera.fov,
          imageWidth: Math.min(width, 256),
          imageHeight: Math.min(height, 256),
        },
        environment,
        referencePixels,
      })
      const blob = new Blob([result.contactSheetPng], { type: 'image/png' })
      setSheetUrl(URL.createObjectURL(blob))
      setMetrics(result.metrics)
      setBestValue(result.bestValue)
      pushEvent({ name: 'sweep.done', payload: { field, bestValue: result.bestValue } })
    } catch (err) {
      pushEvent({ name: 'sweep.error', payload: { error: err?.message ?? String(err) } })
    } finally {
      setRunning(false)
    }
  }, [def, field, min, max, steps, camera, width, height, environment, geometryKind, pushEvent, referencePixels])

  const currentValue = def ? getNested(def, field) : null

  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 4 }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Sweep</h2>
      <div className="evth-params">
        <span className="k">field</span>
        <select value={field} onChange={onPreset} style={{ width: '100%' }}>
          {COMMON_FIELDS.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
        </select>
        <span className="k">min</span>
        <input type="number" value={min} step="0.01" onChange={(e) => setMin(Number(e.target.value))} />
        <span className="k">max</span>
        <input type="number" value={max} step="0.01" onChange={(e) => setMax(Number(e.target.value))} />
        <span className="k">steps</span>
        <input type="number" value={steps} min="2" max="32" onChange={(e) => setSteps(Number(e.target.value))} />
        <span className="k">current</span>
        <code>{currentValue ?? '—'}</code>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button onClick={onRun} disabled={running || !def}>{running ? 'Running…' : 'Run sweep'}</button>
        {bestValue != null && <span>best: <b>{bestValue.toFixed(4)}</b></span>}
      </div>
      {sheetUrl && (
        <div style={{ marginTop: '0.5rem' }}>
          <img src={sheetUrl} style={{ width: '100%', imageRendering: 'pixelated', border: '1px solid var(--border)' }} alt="sweep contact sheet" />
          {metrics && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              RMSE per step: {metrics.map((m) => m == null ? '—' : m.toFixed(2)).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

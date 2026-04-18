import { useRendererStore } from '../../stores/rendererStore.js'
import { useRegressionStore } from '../../stores/regressionStore.js'
import { SweepPanel } from './SweepPanel.jsx'
import { SolverPanel } from './SolverPanel.jsx'

const NUMERIC_FIELDS = [
  { key: 'metalness', min: 0, max: 1, step: 0.01 },
  { key: 'roughness', min: 0, max: 1, step: 0.01 },
  { key: 'ior', min: 1, max: 2.5, step: 0.01 },
  { key: 'transmission', min: 0, max: 1, step: 0.01 },
  { key: 'opacity', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoat', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoatRoughness', min: 0, max: 1, step: 0.01 },
  { key: 'sheen', min: 0, max: 1, step: 0.01 },
  { key: 'sheenRoughness', min: 0, max: 1, step: 0.01 },
  { key: 'iridescence', min: 0, max: 1, step: 0.01 },
  { key: 'iridescenceIOR', min: 1, max: 2.5, step: 0.01 },
  { key: 'anisotropy', min: 0, max: 1, step: 0.01 },
  { key: 'anisotropyRotation', min: 0, max: Math.PI * 2, step: 0.01 },
  { key: 'envMapIntensity', min: 0, max: 4, step: 0.05 },
  { key: 'thickness', min: 0, max: 5, step: 0.01 },
  { key: 'attenuationDistance', min: 0, max: 20, step: 0.1 },
  { key: 'emissiveIntensity', min: 0, max: 10, step: 0.05 },
  { key: 'dispersion', min: 0, max: 1, step: 0.01 },
]

const COLOR_FIELDS = ['color', 'emissive', 'sheenColor', 'attenuationColor', 'specularColor']

const BOOL_FIELDS = ['transparent', 'wireframe']

function formatNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toFixed(3)
}

export function ParameterPanel() {
  const def = useRendererStore((s) => s.materialDefinition)
  const setDef = useRendererStore((s) => s.setMaterialDefinition)
  const diff = useRegressionStore((s) => s.current)
  const tolerances = useRegressionStore((s) => s.tolerances)

  const patch = (field, value) => {
    setDef({ ...(def ?? {}), [field]: value })
  }

  return (
    <aside className="tmrh-panel">
      <h2>Metrics</h2>
      <div className="tmrh-metrics">
        {diff ? (
          <>
            <div className="row"><span className="k">Verdict</span><span className={`verdict-${diff.verdict}`}>{diff.verdict}</span></div>
            <div className="row"><span className="k">RMSE</span><span className="v">{formatNum(diff.rmse)} / {formatNum(tolerances.rmse)}</span></div>
            <div className="row"><span className="k">Mismatch %</span><span className="v">{formatNum(diff.pixelMismatchPct)} / {formatNum(tolerances.pixelMismatchPct)}</span></div>
            <div className="row"><span className="k">SSIM</span><span className="v">{formatNum(diff.ssim)}</span></div>
            <div className="row"><span className="k">Max Δ</span><span className="v">{diff.maxChannelDiff} / {tolerances.maxChannelDiff}</span></div>
          </>
        ) : (
          <div className="row"><span className="k" style={{ color: 'var(--muted)' }}>no active diff</span></div>
        )}
      </div>

      <h2>Material</h2>
      <div className="tmrh-params">
        {def ? (
          <>
            {COLOR_FIELDS.map((k) => (
              <div key={k} style={{ display: 'contents' }}>
                <span className="k">{k}</span>
                <input
                  type="text"
                  value={def[k] ?? ''}
                  onChange={(e) => patch(k, e.target.value)}
                  placeholder="#rrggbb"
                />
              </div>
            ))}
            {NUMERIC_FIELDS.map(({ key, min, max, step }) => (
              <div key={key} style={{ display: 'contents' }}>
                <span className="k">{key}</span>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={Number.isFinite(def[key]) ? def[key] : min}
                    onChange={(e) => patch(key, Number(e.target.value))}
                  />
                  <input
                    type="number"
                    step={step}
                    value={Number.isFinite(def[key]) ? def[key] : ''}
                    onChange={(e) => patch(key, Number(e.target.value))}
                    style={{ width: 72 }}
                  />
                </div>
              </div>
            ))}
            {BOOL_FIELDS.map((k) => (
              <div key={k} style={{ display: 'contents' }}>
                <span className="k">{k}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(def[k])}
                    onChange={(e) => patch(k, e.target.checked)}
                  />
                </label>
              </div>
            ))}
          </>
        ) : (
          <div style={{ gridColumn: '1 / span 2', color: 'var(--muted)', fontStyle: 'italic' }}>
            no MaterialDefinition loaded. Drop a .kmp or materialDefinition.json.
          </div>
        )}
      </div>

      <SweepPanel />
      <SolverPanel />
    </aside>
  )
}

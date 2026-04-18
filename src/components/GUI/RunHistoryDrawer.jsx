import { useCallback, useEffect, useState } from 'react'
import { listRunsBrowser, diffReports, deleteRunBrowser } from '../../harness/run-history.js'

export function RunHistoryDrawer({ open, onClose }) {
  const [runs, setRuns] = useState([])
  const [leftId, setLeftId] = useState(null)
  const [rightId, setRightId] = useState(null)
  const [rows, setRows] = useState([])

  const refresh = useCallback(async () => {
    try {
      const list = await listRunsBrowser()
      setRuns(list)
      if (list.length >= 2) {
        setLeftId((id) => id ?? `${list[1].startedAt}-${list[1].gitSha ?? 'nogit'}`)
        setRightId((id) => id ?? `${list[0].startedAt}-${list[0].gitSha ?? 'nogit'}`)
      }
    } catch {
      setRuns([])
    }
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!leftId || !rightId) { setRows([]); return }
    const left = runs.find((r) => `${r.startedAt}-${r.gitSha ?? 'nogit'}` === leftId)
    const right = runs.find((r) => `${r.startedAt}-${r.gitSha ?? 'nogit'}` === rightId)
    if (!left || !right) { setRows([]); return }
    setRows(diffReports(left, right))
  }, [leftId, rightId, runs])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Run history"
      style={{
        position: 'fixed', top: 60, right: 20, width: 560, maxHeight: '80vh', zIndex: 90,
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
        padding: '1rem', overflow: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Run history ({runs.length})</h2>
        <button className="secondary" onClick={refresh}>↻</button>
        <button className="secondary" onClick={onClose}>Close</button>
      </div>
      {runs.length < 2 && <div style={{ color: 'var(--muted)' }}>Need at least two saved runs to compare.</div>}
      {runs.length >= 2 && (
        <>
          <div className="tmrh-params" style={{ marginBottom: '0.5rem' }}>
            <span className="k">left (A)</span>
            <RunSelect runs={runs} value={leftId} onChange={setLeftId} />
            <span className="k">right (B)</span>
            <RunSelect runs={runs} value={rightId} onChange={setRightId} />
          </div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th align="left">Test</th>
                <th align="right">Δ RMSE</th>
                <th align="right">Δ SSIM</th>
                <th align="right">Δ %</th>
                <th align="left">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.testId}>
                  <td>{r.testId}</td>
                  <td align="right" style={{ color: r.deltaRmse > 0 ? 'var(--fail)' : 'var(--pass)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.deltaRmse.toFixed(3)}
                  </td>
                  <td align="right" style={{ color: r.deltaSsim < 0 ? 'var(--fail)' : 'var(--pass)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.deltaSsim.toFixed(4)}
                  </td>
                  <td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.deltaPixelMismatchPct.toFixed(2)}
                  </td>
                  <td style={{ color: r.verdictChange ? 'var(--warn)' : 'inherit' }}>
                    {r.verdictChange ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {runs.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h2>Stored runs</h2>
          {runs.map((r) => {
            const id = `${r.startedAt}-${r.gitSha ?? 'nogit'}`
            return (
              <div key={id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 2 }}>
                <code style={{ flex: 1, fontSize: 11 }}>{id}</code>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  pass {r.passCount}/{r.testCount}
                </span>
                <button
                  className="secondary"
                  onClick={async () => {
                    await deleteRunBrowser(id)
                    refresh()
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RunSelect({ runs, value, onChange }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }}>
      {runs.map((r) => {
        const id = `${r.startedAt}-${r.gitSha ?? 'nogit'}`
        return <option key={id} value={id}>{r.startedAt} · git {r.gitSha ?? 'nogit'} · pass {r.passCount}/{r.testCount}</option>
      })}
    </select>
  )
}

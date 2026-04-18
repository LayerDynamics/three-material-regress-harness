import { useState } from 'react'
import { probePair, rankSweepResponsiveness } from '../../harness/color-probe.js'

export function ColorInspector({ candidatePixels, referencePixels, width, height, sweeps }) {
  const [probe, setProbe] = useState(null)
  const [ranking, setRanking] = useState([])

  if (!candidatePixels || !referencePixels) {
    return (
      <div style={{ marginTop: '1rem', padding: '0.5rem', color: 'var(--muted)', fontSize: 12 }}>
        Colour inspector — capture a candidate and a reference to enable pixel probing.
      </div>
    )
  }

  const onClick = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * width)
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * height)
    try {
      const p = probePair(candidatePixels, referencePixels, width, height, x, y)
      setProbe({ ...p, x, y })
      if (sweeps && Object.keys(sweeps).length > 0) {
        setRanking(rankSweepResponsiveness({
          referencePixels, width, height, x, y, sweeps,
        }))
      } else {
        setRanking([])
      }
    } catch (err) {
      setProbe({ error: err?.message ?? String(err) })
    }
  }

  const swatch = (rgb) => (
    <span style={{
      display: 'inline-block', width: 12, height: 12, marginRight: 6,
      background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, border: '1px solid #333',
      verticalAlign: 'middle',
    }} />
  )

  return (
    <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}>
      <h2>Colour inspector</h2>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Click any pixel in the candidate:</div>
      <div
        role="img"
        aria-label="click to probe pixel"
        onClick={onClick}
        style={{ position: 'relative', cursor: 'crosshair', background: '#000' }}
      >
        <CandidateCanvas pixels={candidatePixels} width={width} height={height} />
      </div>
      {probe?.error && <div style={{ color: 'var(--fail)', fontSize: 11 }}>{probe.error}</div>}
      {probe && !probe.error && (
        <div style={{ fontSize: 11, marginTop: 4 }}>
          <div>(<code>{probe.x}</code>, <code>{probe.y}</code>)</div>
          <div>{swatch(probe.candidate)}candidate rgb({probe.candidate.r}, {probe.candidate.g}, {probe.candidate.b})</div>
          <div>{swatch(probe.reference)}reference rgb({probe.reference.r}, {probe.reference.g}, {probe.reference.b})</div>
          <div>Δ: ({probe.delta.r}, {probe.delta.g}, {probe.delta.b})</div>
        </div>
      )}
      {ranking.length > 0 && (
        <div style={{ fontSize: 11, marginTop: 6 }}>
          <div style={{ color: 'var(--muted)' }}>Most responsive fields at this pixel:</div>
          {ranking.slice(0, 5).map((r) => (
            <div key={r.field}>
              <b>{r.field}</b> ⇢ swing {r.responsiveness}
              {r.bestValue != null && <> · closest at <code>{r.bestValue.toFixed(3)}</code></>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateCanvas({ pixels, width, height }) {
  return (
    <canvas
      ref={(el) => {
        if (!el) return
        el.width = width
        el.height = height
        const ctx = el.getContext('2d')
        if (!ctx) return
        const img = new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength), width, height)
        ctx.putImageData(img, 0, 0)
      }}
      style={{ width: '100%', imageRendering: 'pixelated', display: 'block' }}
    />
  )
}

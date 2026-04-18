// HTML reporter — self-contained human-readable report.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, relative } from 'node:path'

const ESC = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const FMT = (n, d = 3) => (typeof n === 'number' && Number.isFinite(n)) ? n.toFixed(d) : String(n ?? '—')

export async function writeHtmlReport(report, path) {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })

  const rows = report.results.map((r) => {
    const cls = r.verdict === 'pass' ? 'pass' : r.verdict === 'warn' ? 'warn' : 'fail'
    const candidate = r.candidatePath ? relative(dir, r.candidatePath) : ''
    const reference = r.referencePath ? ESC(r.referencePath) : ''
    const diffImg = r.diffPath ? relative(dir, r.diffPath) : ''
    return `<tr class="${cls}">
      <td>${ESC(r.testId)}</td>
      <td><span class="v">${ESC(r.verdict)}</span></td>
      <td>${FMT(r.diff?.rmse)}</td>
      <td>${FMT(r.diff?.pixelMismatchPct, 2)}%</td>
      <td>${FMT(r.diff?.ssim, 4)}</td>
      <td>${r.diff?.maxChannelDiff ?? '—'}</td>
      <td>${FMT(r.durationMs, 0)} ms</td>
      <td>${candidate ? `<a href="${ESC(candidate)}"><img src="${ESC(candidate)}" class="thumb"></a>` : '—'}</td>
      <td>${reference ? `<a href="${ESC(reference)}"><img src="${ESC(reference)}" class="thumb"></a>` : '—'}</td>
      <td>${diffImg ? `<a href="${ESC(diffImg)}"><img src="${ESC(diffImg)}" class="thumb thumb-wide"></a>` : '—'}</td>
    </tr>`
  }).join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>tmrh run ${ESC(report.startedAt)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 1rem 2rem; }
    h1 { margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.3rem 0.5rem; text-align: left; vertical-align: middle; font-size: 0.85rem; }
    th { background: #f6f6f6; position: sticky; top: 0; }
    tr.pass .v { color: #0a7a2a; font-weight: 600; }
    tr.fail .v { color: #b51a1a; font-weight: 600; }
    tr.warn .v { color: #ad7a00; font-weight: 600; }
    tr.fail td { background: #fff5f5; }
    .thumb { max-width: 80px; max-height: 80px; border: 1px solid #ccc; }
    .thumb-wide { max-width: 240px; max-height: 80px; }
    .summary { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
    .summary > div { padding: 0.75rem 1rem; border: 1px solid #ddd; border-radius: 4px; min-width: 80px; }
    .summary .n { font-size: 1.4rem; font-weight: 700; }
  </style>
</head>
<body>
  <h1>three-material-regress-harness report</h1>
  <div class="meta">
    Started ${ESC(report.startedAt)} · Completed ${ESC(report.completedAt)} ·
    git ${ESC(report.gitSha)} · three ${ESC(report.three)} · r3f ${ESC(report.r3f)} · node ${ESC(report.node)}
  </div>
  <div class="summary">
    <div><div>Tests</div><div class="n">${report.testCount}</div></div>
    <div><div>Passed</div><div class="n" style="color:#0a7a2a">${report.passCount}</div></div>
    <div><div>Failed</div><div class="n" style="color:#b51a1a">${report.failCount}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Test</th><th>Verdict</th><th>RMSE</th><th>Mismatch %</th><th>SSIM</th><th>Max Δ</th><th>Time</th>
        <th>Candidate</th><th>Reference</th><th>Diff</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>
`
  await writeFile(path, html)
  return path
}

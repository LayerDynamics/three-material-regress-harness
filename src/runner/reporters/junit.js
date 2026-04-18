// JUnit XML reporter — Jenkins / GitLab / GitHub Actions compatible.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const ESC = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export async function writeJunitReport(report, path) {
  const secs = (ms) => (Number(ms ?? 0) / 1000).toFixed(3)
  const totalTime = secs(report.results.reduce((s, r) => s + (r.durationMs ?? 0), 0))

  const testCaseXml = report.results.map((r) => {
    const name = ESC(r.testId)
    const time = secs(r.durationMs)
    if (r.verdict === 'pass') {
      return `    <testcase classname="evth" name="${name}" time="${time}"/>`
    }
    const failMsg = ESC(
      `rmse=${r.diff?.rmse ?? 'n/a'} ssim=${r.diff?.ssim ?? 'n/a'} ` +
      `pixelMismatchPct=${r.diff?.pixelMismatchPct ?? 'n/a'} maxChannelDiff=${r.diff?.maxChannelDiff ?? 'n/a'} ` +
      (r.error ? `error=${r.error}` : ''),
    )
    return `    <testcase classname="evth" name="${name}" time="${time}">
      <failure message="tolerance exceeded" type="${r.verdict === 'warn' ? 'warn' : 'fail'}">${failMsg}</failure>
    </testcase>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="evth" tests="${report.testCount}" failures="${report.failCount}" time="${totalTime}">
  <testsuite name="extern-material-three-visual-test-harness" tests="${report.testCount}" failures="${report.failCount}" errors="0" time="${totalTime}" timestamp="${ESC(report.startedAt)}">
${testCaseXml}
  </testsuite>
</testsuites>
`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, xml)
  return path
}

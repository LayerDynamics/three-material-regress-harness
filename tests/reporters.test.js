import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { writeJsonReport } from '../src/runner/reporters/json.js'
import { writeJunitReport } from '../src/runner/reporters/junit.js'
import { writeHtmlReport } from '../src/runner/reporters/html.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const REPORT = {
  startedAt: '2026-04-18T12:00:00.000Z',
  completedAt: '2026-04-18T12:01:00.000Z',
  gitSha: 'abc1234',
  three: '0.184.0',
  r3f: '9.6.0',
  node: 'v20.11.0',
  gpu: 'SwiftShader',
  testCount: 2,
  passCount: 1,
  failCount: 1,
  results: [
    {
      testId: 'toon-a',
      verdict: 'pass',
      diff: { id: 'd1', testId: 'toon-a', rmse: 0.1, pixelMismatchPct: 0.05, ssim: 0.999, maxChannelDiff: 2, ssimPerTile: [[1]], verdict: 'pass' },
      durationMs: 420,
      candidatePath: '/tmp/captures/toon-a.png',
      referencePath: 'baselines/Toon/A/ref.png',
    },
    {
      testId: 'gold-a',
      verdict: 'fail',
      diff: { id: 'd2', testId: 'gold-a', rmse: 4.1, pixelMismatchPct: 12.5, ssim: 0.88, maxChannelDiff: 55, ssimPerTile: [[0.88]], verdict: 'fail' },
      durationMs: 530,
      candidatePath: '/tmp/captures/gold-a.png',
      referencePath: 'baselines/Gold/A/ref.png',
      diffPath: '/tmp/diffs/gold-a.diff.png',
      error: null,
    },
  ],
  meta: { configUsed: {}, tolerances: {}, corpusHash: '000', baselineHash: '000' },
}

let dir

describe('reporters', () => {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tmrh-rep-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('JSON: round-trips through JSON.parse', async () => {
    const p = await writeJsonReport(REPORT, join(dir, 'report.json'))
    const parsed = JSON.parse(await readFile(p, 'utf8'))
    expect(parsed.testCount).toBe(2)
    expect(parsed.results[0].verdict).toBe('pass')
  })

  it('JUnit: well-formed XML with correct testcase/failure tags', async () => {
    const p = await writeJunitReport(REPORT, join(dir, 'junit.xml'))
    const xml = await readFile(p, 'utf8')
    expect(xml).toMatch(/<\?xml version="1.0"/)
    expect(xml).toMatch(/testsuites.*tests="2".*failures="1"/s)
    expect(xml).toMatch(/name="toon-a".*\/>/s)
    expect(xml).toMatch(/name="gold-a"/)
    expect(xml).toMatch(/<failure[^>]+>.*rmse=4.1/s)
  })

  it('HTML: contains pass/fail rows + summary + thumbnails for failing test', async () => {
    const p = await writeHtmlReport(REPORT, join(dir, 'report.html'))
    const html = await readFile(p, 'utf8')
    expect(html).toMatch(/<h1>three-material-regress-harness report<\/h1>/)
    expect(html).toMatch(/Passed.*1/s)
    expect(html).toMatch(/Failed.*1/s)
    expect(html).toMatch(/tr class="pass"/)
    expect(html).toMatch(/tr class="fail"/)
    expect(html).toMatch(/toon-a/)
    expect(html).toMatch(/gold-a/)
  })

  it('HTML: escapes special characters', async () => {
    const injected = { ...REPORT, gitSha: 'x<script>y' }
    const p = await writeHtmlReport(injected, join(dir, 'report-injected.html'))
    const html = await readFile(p, 'utf8')
    expect(html).not.toMatch(/<script>y/)
    expect(html).toMatch(/x&lt;script&gt;y/)
  })

  it('JUnit: escapes special characters in error messages', async () => {
    const injected = {
      ...REPORT,
      results: [{
        ...REPORT.results[1],
        error: 'problem with "quotes" & <tags>',
      }],
      testCount: 1,
      passCount: 0,
      failCount: 1,
    }
    const p = await writeJunitReport(injected, join(dir, 'junit-injected.xml'))
    const xml = await readFile(p, 'utf8')
    expect(xml).not.toMatch(/<tags>/)
    expect(xml).toMatch(/&quot;quotes&quot;/)
    expect(xml).toMatch(/&amp;/)
    expect(xml).toMatch(/&lt;tags&gt;/)
  })
})

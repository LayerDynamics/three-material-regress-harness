import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { diffReports, listRunsNode } from '../src/harness/run-history.js'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('diffReports', () => {
  const A = {
    startedAt: '2026-04-16T10:00:00Z',
    results: [
      { testId: 't1', verdict: 'pass', diff: { rmse: 0.2, ssim: 0.998, pixelMismatchPct: 0.1 } },
      { testId: 't2', verdict: 'fail', diff: { rmse: 2.5, ssim: 0.90, pixelMismatchPct: 3.0 } },
    ],
  }
  const B = {
    startedAt: '2026-04-18T10:00:00Z',
    results: [
      { testId: 't1', verdict: 'pass', diff: { rmse: 0.4, ssim: 0.996, pixelMismatchPct: 0.15 } },
      { testId: 't2', verdict: 'pass', diff: { rmse: 0.3, ssim: 0.995, pixelMismatchPct: 0.2 } },
      { testId: 't3', verdict: 'fail', diff: { rmse: 5.0, ssim: 0.80, pixelMismatchPct: 10.0 } },
    ],
  }

  it('computes per-test deltas and surfaces verdict changes', () => {
    const rows = diffReports(A, B)
    expect(rows).toHaveLength(3)
    const t1 = rows.find((r) => r.testId === 't1')
    expect(t1.deltaRmse).toBeCloseTo(0.2, 5)
    expect(t1.verdictChange).toBeNull()
    const t2 = rows.find((r) => r.testId === 't2')
    expect(t2.deltaRmse).toBeCloseTo(-2.2, 5)
    expect(t2.verdictChange).toBe('fail → pass')
    const t3 = rows.find((r) => r.testId === 't3')
    expect(t3.a).toBeNull()
    expect(t3.b).toBeDefined()
  })

  it('sorts rows by |deltaRmse| descending so the largest regressions surface first', () => {
    const rows = diffReports(A, B)
    for (let i = 1; i < rows.length; i++) {
      expect(Math.abs(rows[i - 1].deltaRmse)).toBeGreaterThanOrEqual(Math.abs(rows[i].deltaRmse))
    }
  })
})

describe('listRunsNode', () => {
  let dir
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'evth-rh-'))
    await mkdir(join(dir, '2026-04-16T10-00-00-abc'), { recursive: true })
    await writeFile(join(dir, '2026-04-16T10-00-00-abc', 'report.json'), JSON.stringify({ startedAt: '2026-04-16T10:00:00Z', results: [] }))
    await mkdir(join(dir, '2026-04-18T10-00-00-def'), { recursive: true })
    await writeFile(join(dir, '2026-04-18T10-00-00-def', 'report.json'), JSON.stringify({ startedAt: '2026-04-18T10:00:00Z', results: [] }))
    await mkdir(join(dir, 'not-a-run'), { recursive: true })
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns reports newest-first and skips dirs without report.json', async () => {
    const runs = await listRunsNode(dir)
    expect(runs).toHaveLength(2)
    expect(runs[0].startedAt).toBe('2026-04-18T10:00:00Z')
    expect(runs[1].startedAt).toBe('2026-04-16T10:00:00Z')
  })
})

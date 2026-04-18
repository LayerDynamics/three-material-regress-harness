import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadTolerances } from '../src/recorder/params.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(tmpdir(), 'tmrh-tolerances-test')

describe('loadTolerances', () => {
  beforeAll(async () => {
    await mkdir(join(ROOT, 'Toon', 'A'), { recursive: true })
    await writeFile(join(ROOT, 'tolerances.json'), JSON.stringify({ rmse: 1.0 }))
    await writeFile(join(ROOT, 'Toon', 'tolerances.json'), JSON.stringify({ pixelMismatchPct: 2.0 }))
    await writeFile(join(ROOT, 'Toon', 'A', 'tolerances.json'), JSON.stringify({ maxChannelDiff: 30 }))
  })

  afterAll(async () => {
    await rm(ROOT, { recursive: true, force: true })
  })

  it('falls back to defaults when nothing exists', async () => {
    const t = await loadTolerances(ROOT, 'Ghost', 'Z')
    expect(t.rmse).toBe(1.0)
    expect(t.maxChannelDiff).toBe(10)
  })

  it('applies global override', async () => {
    const t = await loadTolerances(ROOT, 'Ghost', 'Z')
    expect(t.rmse).toBe(1.0)
  })

  it('applies variant override on top of global', async () => {
    const t = await loadTolerances(ROOT, 'Toon', 'Z')
    expect(t.rmse).toBe(1.0)
    expect(t.pixelMismatchPct).toBe(2.0)
  })

  it('applies test-specific override on top of variant', async () => {
    const t = await loadTolerances(ROOT, 'Toon', 'A')
    expect(t.rmse).toBe(1.0)
    expect(t.pixelMismatchPct).toBe(2.0)
    expect(t.maxChannelDiff).toBe(30)
  })

  it('programmatic override wins over disk', async () => {
    const t = await loadTolerances(ROOT, 'Toon', 'A', { rmse: 5.0 })
    expect(t.rmse).toBe(5.0)
    expect(t.maxChannelDiff).toBe(30)
  })
})

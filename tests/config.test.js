import { describe, it, expect } from 'vitest'
import { loadConfig, DEFAULTS } from '../src/harness/config.js'
import { HarnessConfigError } from '../src/harness/exceptions.js'

describe('loadConfig', () => {
  it('returns defaults with no argv/env', async () => {
    const cfg = await loadConfig([], {})
    expect(cfg.corpus).toBe(DEFAULTS.corpus)
    expect(cfg.baseline).toBe(DEFAULTS.baseline)
    expect(cfg.workers).toBe(DEFAULTS.workers)
    expect(cfg.report).toEqual(DEFAULTS.report)
    expect(cfg.filter).toBeNull()
    expect(cfg.updateBaselines).toBe(false)
    expect(cfg.tolerances).toEqual(DEFAULTS.tolerances)
  })

  it('CLI flags override defaults', async () => {
    const cfg = await loadConfig(
      ['--corpus', '/c', '--baseline', '/b', '--out', '/o', '--workers', '8', '--filter', 'Toon*'],
      {},
    )
    expect(cfg.corpus).toBe('/c')
    expect(cfg.baseline).toBe('/b')
    expect(cfg.out).toBe('/o')
    expect(cfg.workers).toBe(8)
    expect(cfg.filter).toBe('Toon*')
  })

  it('env fills gaps when CLI is silent', async () => {
    const cfg = await loadConfig([], { TMRH_CORPUS: '/envcorpus', TMRH_WORKERS: '2', TMRH_UPDATE_BASELINES: '1' })
    expect(cfg.corpus).toBe('/envcorpus')
    expect(cfg.workers).toBe(2)
    expect(cfg.updateBaselines).toBe(true)
  })

  it('--report all expands to html,json,junit', async () => {
    const cfg = await loadConfig(['--report', 'all'], {})
    expect(cfg.report).toEqual(['html', 'json', 'junit'])
  })

  it('--report junit selects only junit', async () => {
    const cfg = await loadConfig(['--report', 'junit'], {})
    expect(cfg.report).toEqual(['junit'])
  })

  it('--threshold rewrites tolerances.rmse', async () => {
    const cfg = await loadConfig(['--threshold', '2.5'], {})
    expect(cfg.tolerances.rmse).toBe(2.5)
  })

  it('rejects invalid workers', async () => {
    await expect(loadConfig(['--workers', '0'], {})).rejects.toThrow(HarnessConfigError)
    await expect(loadConfig(['--workers', '99'], {})).rejects.toThrow(HarnessConfigError)
    await expect(loadConfig(['--workers', 'abc'], {})).rejects.toThrow(HarnessConfigError)
  })

  it('rejects unknown report format', async () => {
    await expect(loadConfig(['--report', 'pdf'], {})).rejects.toThrow(HarnessConfigError)
  })

  it('rejects negative threshold', async () => {
    await expect(loadConfig(['--threshold', '-1'], {})).rejects.toThrow(HarnessConfigError)
  })
})

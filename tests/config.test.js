import { describe, it, expect } from 'vitest'
import { loadConfig, DEFAULTS } from '../src/harness/config.js'
import { HarnessConfigError } from '../src/harness/exceptions.js'

describe('loadConfig', () => {
  it('returns defaults with no argv/env', () => {
    const cfg = loadConfig([], {})
    expect(cfg.corpus).toBe(DEFAULTS.corpus)
    expect(cfg.baseline).toBe(DEFAULTS.baseline)
    expect(cfg.workers).toBe(DEFAULTS.workers)
    expect(cfg.report).toEqual(DEFAULTS.report)
    expect(cfg.filter).toBeNull()
    expect(cfg.updateBaselines).toBe(false)
    expect(cfg.tolerances).toEqual(DEFAULTS.tolerances)
  })

  it('CLI flags override defaults', () => {
    const cfg = loadConfig(
      ['--corpus', '/c', '--baseline', '/b', '--out', '/o', '--workers', '8', '--filter', 'Toon*'],
      {},
    )
    expect(cfg.corpus).toBe('/c')
    expect(cfg.baseline).toBe('/b')
    expect(cfg.out).toBe('/o')
    expect(cfg.workers).toBe(8)
    expect(cfg.filter).toBe('Toon*')
  })

  it('env fills gaps when CLI is silent', () => {
    const cfg = loadConfig([], { EVTH_CORPUS: '/envcorpus', EVTH_WORKERS: '2', EVTH_UPDATE_BASELINES: '1' })
    expect(cfg.corpus).toBe('/envcorpus')
    expect(cfg.workers).toBe(2)
    expect(cfg.updateBaselines).toBe(true)
  })

  it('--report all expands to html,json,junit', () => {
    const cfg = loadConfig(['--report', 'all'], {})
    expect(cfg.report).toEqual(['html', 'json', 'junit'])
  })

  it('--report junit selects only junit', () => {
    const cfg = loadConfig(['--report', 'junit'], {})
    expect(cfg.report).toEqual(['junit'])
  })

  it('--threshold rewrites tolerances.rmse', () => {
    const cfg = loadConfig(['--threshold', '2.5'], {})
    expect(cfg.tolerances.rmse).toBe(2.5)
  })

  it('rejects invalid workers', () => {
    expect(() => loadConfig(['--workers', '0'], {})).toThrow(HarnessConfigError)
    expect(() => loadConfig(['--workers', '99'], {})).toThrow(HarnessConfigError)
    expect(() => loadConfig(['--workers', 'abc'], {})).toThrow(HarnessConfigError)
  })

  it('rejects unknown report format', () => {
    expect(() => loadConfig(['--report', 'pdf'], {})).toThrow(HarnessConfigError)
  })

  it('rejects negative threshold', () => {
    expect(() => loadConfig(['--threshold', '-1'], {})).toThrow(HarnessConfigError)
  })
})

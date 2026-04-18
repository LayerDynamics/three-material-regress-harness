import { describe, it, expect } from 'vitest'
import { startTimer, stopTimer, summarise } from '../src/runner/duration.js'

describe('startTimer + stopTimer', () => {
  it('returns durationMs as a non-negative number', () => {
    const t = startTimer()
    const s = stopTimer(t)
    expect(s.stopMs).toBeGreaterThanOrEqual(s.startMs)
    expect(s.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('rejects invalid input', () => {
    expect(() => stopTimer(null)).toThrow(/startMs/)
    expect(() => stopTimer({})).toThrow(/startMs/)
  })
})

describe('summarise', () => {
  it('handles empty', () => {
    const s = summarise([])
    expect(s).toEqual({ n: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0 })
  })

  it('computes mean, min, max, p50, p95 correctly', () => {
    const durations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const s = summarise(durations)
    expect(s.n).toBe(10)
    expect(s.min).toBe(1)
    expect(s.max).toBe(10)
    expect(s.mean).toBe(5.5)
    expect(s.p50).toBe(6)
    expect(s.p95).toBe(10)
  })

  it('ignores NaN / Infinity', () => {
    const s = summarise([1, 2, NaN, Infinity, 3, 4])
    expect(s.n).toBe(4)
    expect(s.mean).toBe(2.5)
  })
})

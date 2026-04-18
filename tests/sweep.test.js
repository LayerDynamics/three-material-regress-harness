import { describe, it, expect } from 'vitest'
import { setNested, getNested } from '../src/harness/sweep.js'

describe('setNested / getNested', () => {
  it('gets top-level values', () => {
    expect(getNested({ a: 1 }, 'a')).toBe(1)
  })

  it('sets top-level values', () => {
    const o = {}
    setNested(o, 'x', 7)
    expect(o.x).toBe(7)
  })

  it('creates intermediate objects when the path is missing', () => {
    const o = {}
    setNested(o, 'toonParams.shadowMultiplier', 0.25)
    expect(o.toonParams.shadowMultiplier).toBe(0.25)
  })

  it('preserves siblings when mutating a deeply nested key', () => {
    const o = { carpaintParams: { metalCoverage: 1.0, metalRoughness: 0.3 } }
    setNested(o, 'carpaintParams.metalCoverage', 0.5)
    expect(o.carpaintParams.metalCoverage).toBe(0.5)
    expect(o.carpaintParams.metalRoughness).toBe(0.3)
  })

  it('getNested returns undefined for missing paths', () => {
    expect(getNested({}, 'a.b.c')).toBeUndefined()
  })
})

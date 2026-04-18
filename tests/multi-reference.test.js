import { describe, it, expect } from 'vitest'
import { averageReferenceBuffers } from '../src/recorder/multi-reference.js'

describe('averageReferenceBuffers', () => {
  it('averages three buffers pixel-by-pixel', () => {
    const a = new Uint8Array([10, 20, 30, 255])
    const b = new Uint8Array([20, 30, 40, 255])
    const c = new Uint8Array([30, 40, 50, 255])
    const avg = averageReferenceBuffers([a, b, c])
    expect(Array.from(avg)).toEqual([20, 30, 40, 255])
  })

  it('rounds half-integers', () => {
    const a = new Uint8Array([1, 2, 3, 255])
    const b = new Uint8Array([2, 3, 4, 255])
    const avg = averageReferenceBuffers([a, b])
    expect(Array.from(avg)).toEqual([2, 3, 4, 255]) // (1+2)/2=1.5→2, (2+3)/2=2.5→3 (round-half-to-even isn't required; Math.round)
  })

  it('rejects mismatched lengths', () => {
    const a = new Uint8Array(4)
    const b = new Uint8Array(8)
    expect(() => averageReferenceBuffers([a, b])).toThrow(/length mismatch/)
  })

  it('rejects empty input', () => {
    expect(() => averageReferenceBuffers([])).toThrow(/non-empty array/)
  })
})

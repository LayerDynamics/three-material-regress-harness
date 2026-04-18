import { describe, it, expect } from 'vitest'
import { probePixel, probePair, rankSweepResponsiveness } from '../src/harness/color-probe.js'

function solid(width, height, [r, g, b, a = 255]) {
  const buf = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = a
  }
  return buf
}

describe('probePixel', () => {
  it('returns RGBA at (x, y)', () => {
    const buf = solid(4, 4, [10, 20, 30, 200])
    expect(probePixel(buf, 4, 4, 2, 2)).toEqual({ r: 10, g: 20, b: 30, a: 200 })
  })

  it('rejects out-of-bounds', () => {
    const buf = solid(4, 4, [0, 0, 0])
    expect(() => probePixel(buf, 4, 4, 4, 0)).toThrow(/out of bounds/)
    expect(() => probePixel(buf, 4, 4, 0, -1)).toThrow(/out of bounds/)
  })
})

describe('probePair', () => {
  it('returns candidate, reference, and per-channel delta', () => {
    const cand = solid(2, 2, [100, 100, 100])
    const ref = solid(2, 2, [70, 120, 110])
    const p = probePair(cand, ref, 2, 2, 1, 1)
    expect(p.candidate).toEqual({ r: 100, g: 100, b: 100, a: 255 })
    expect(p.reference).toEqual({ r: 70, g: 120, b: 110, a: 255 })
    expect(p.delta).toEqual({ r: 30, g: -20, b: -10, a: 0 })
  })
})

describe('rankSweepResponsiveness', () => {
  it('ranks fields by max swing at the probed pixel', () => {
    const W = 2, H = 2
    const reference = solid(W, H, [100, 100, 100])
    // "alpha" is weakly responsive: values close together at this pixel.
    // "roughness" is strongly responsive: values spanning black to white.
    const sweeps = {
      alpha: [
        { value: 0.5, capturePixels: solid(W, H, [102, 102, 102]) },
        { value: 1.0, capturePixels: solid(W, H, [98, 98, 98]) },
      ],
      roughness: [
        { value: 0.0, capturePixels: solid(W, H, [10, 10, 10]) },
        { value: 1.0, capturePixels: solid(W, H, [250, 250, 250]) },
      ],
    }
    const ranking = rankSweepResponsiveness({
      referencePixels: reference, width: W, height: H, x: 0, y: 0, sweeps,
    })
    expect(ranking[0].field).toBe('roughness')
    expect(ranking[0].responsiveness).toBeGreaterThan(ranking[1].responsiveness)
    expect(ranking[1].field).toBe('alpha')
  })
})

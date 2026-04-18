import { describe, it, expect } from 'vitest'
import { diffImages, makeDiffPng } from '../src/recorder/diff.js'
import { computeSilhouette, inferBackgroundColor, silhouetteArea } from '../src/recorder/silhouette.js'
import { ssim as computeSsim } from '../src/recorder/ssim.js'

function fillSolid(width, height, [r, g, b]) {
  const buf = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = 255
  }
  return buf
}

function drawCircle(width, height, [r, g, b], [bgR, bgG, bgB] = [0, 0, 0], radius = null) {
  const buf = fillSolid(width, height, [bgR, bgG, bgB])
  const cx = width / 2
  const cy = height / 2
  const rad = radius ?? Math.min(width, height) * 0.35
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= rad * rad) {
        const i = (y * width + x) * 4
        buf[i] = r
        buf[i + 1] = g
        buf[i + 2] = b
      }
    }
  }
  return buf
}

describe('silhouette', () => {
  it('inferBackgroundColor picks the border color', () => {
    const circ = drawCircle(32, 32, [255, 255, 255], [10, 20, 30])
    const bg = inferBackgroundColor(circ, 32, 32)
    expect(bg).toEqual([10, 20, 30])
  })

  it('computeSilhouette isolates the circle', () => {
    const circ = drawCircle(32, 32, [255, 255, 255], [0, 0, 0])
    const mask = computeSilhouette(circ, 32, 32, { threshold: 10 })
    const area = silhouetteArea(mask)
    expect(area).toBeGreaterThan(0)
    expect(area).toBeLessThan(32 * 32)
  })
})

describe('ssim', () => {
  it('identical images → 1', () => {
    const a = drawCircle(32, 32, [255, 255, 255])
    const b = drawCircle(32, 32, [255, 255, 255])
    const { ssim } = computeSsim(a, b, 32, 32)
    expect(ssim).toBeCloseTo(1, 5)
  })

  it('black vs white → near 0', () => {
    const a = fillSolid(32, 32, [0, 0, 0])
    const b = fillSolid(32, 32, [255, 255, 255])
    const { ssim } = computeSsim(a, b, 32, 32)
    expect(ssim).toBeLessThan(0.05)
  })
})

describe('diffImages', () => {
  it('identical images → rmse 0, pass verdict', () => {
    const a = drawCircle(32, 32, [255, 0, 0])
    const b = drawCircle(32, 32, [255, 0, 0])
    const result = diffImages(a, b, { width: 32, height: 32 })
    expect(result.rmse).toBeCloseTo(0, 5)
    expect(result.pixelMismatchPct).toBe(0)
    expect(result.maxChannelDiff).toBe(0)
    expect(result.ssim).toBeCloseTo(1, 5)
    expect(result.verdict).toBe('pass')
  })

  it('small per-channel diff within caller-specified threshold → pass', () => {
    const a = drawCircle(64, 64, [128, 128, 128])
    const b = drawCircle(64, 64, [130, 128, 130]) // diff = 2 per channel (RMSE ≈ √(8/3) ≈ 1.63)
    const result = diffImages(a, b, { width: 64, height: 64, rmse: 5, pixelMismatchPct: 1, maxChannelDiff: 10 })
    expect(result.maxChannelDiff).toBeLessThanOrEqual(3)
    expect(result.rmse).toBeLessThan(5)
    expect(result.verdict).toBe('pass')
  })

  it('small per-channel diff breaching strict default tolerance → fail', () => {
    const a = drawCircle(64, 64, [128, 128, 128])
    const b = drawCircle(64, 64, [130, 128, 130])
    const result = diffImages(a, b, { width: 64, height: 64 })
    // Default rmse tolerance is 0.5; this diff produces RMSE ≈ 1.6 which must fail.
    expect(result.verdict).toBe('fail')
  })

  it('large per-channel diff → fail', () => {
    const a = drawCircle(64, 64, [0, 0, 0])
    const b = drawCircle(64, 64, [255, 255, 255])
    const result = diffImages(a, b, { width: 64, height: 64 })
    expect(result.rmse).toBeGreaterThan(1)
    expect(result.verdict).toBe('fail')
  })

  it('silhouetteOnly: true masks background noise', () => {
    const a = drawCircle(64, 64, [200, 200, 200], [10, 10, 10])
    // Inject huge diff in background that should be masked out.
    const b = drawCircle(64, 64, [200, 200, 200], [250, 10, 10])
    const noMask = diffImages(a, b, { width: 64, height: 64, silhouetteOnly: false })
    const withMask = diffImages(a, b, { width: 64, height: 64, silhouetteOnly: true })
    expect(noMask.pixelMismatchPct).toBeGreaterThan(withMask.pixelMismatchPct)
    expect(withMask.verdict).toBe('pass')
    expect(noMask.verdict).toBe('fail')
  })

  it('rejects length mismatch', () => {
    const a = new Uint8Array(16)
    const b = new Uint8Array(32)
    expect(() => diffImages(a, b, { width: 2, height: 2 })).toThrow(/length mismatch/)
  })

  it('infers square dimensions when width/height omitted', () => {
    const a = fillSolid(16, 16, [5, 5, 5])
    const b = fillSolid(16, 16, [5, 5, 5])
    const r = diffImages(a, b)
    expect(r.rmse).toBe(0)
  })
})

describe('makeDiffPng', () => {
  it('produces width*3 × height buffer', () => {
    const a = drawCircle(16, 16, [255, 255, 255])
    const b = drawCircle(16, 16, [0, 0, 255])
    const { pixels, width, height } = makeDiffPng(a, b, { width: 16, height: 16 })
    expect(width).toBe(48)
    expect(height).toBe(16)
    expect(pixels.length).toBe(48 * 16 * 4)
  })

  it('red-highlights differing pixels, dim-copies matching pixels', () => {
    const a = fillSolid(4, 4, [200, 200, 200])
    const b = fillSolid(4, 4, [50, 50, 50])
    const { pixels } = makeDiffPng(a, b, { width: 4, height: 4 })
    // Third pane (x offset 8..11 when outW=12): red channel should be high, green/blue 0.
    for (let y = 0; y < 4; y++) {
      for (let x = 8; x < 12; x++) {
        const i = (y * 12 + x) * 4
        expect(pixels[i]).toBeGreaterThan(128)
        expect(pixels[i + 1]).toBe(0)
        expect(pixels[i + 2]).toBe(0)
      }
    }
  })
})

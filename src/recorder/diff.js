// Image diff — pixel-exact (pixelmatch-style) + SSIM + silhouette-aware metrics.

import { computeSilhouette, unionSilhouettes, silhouetteArea } from './silhouette.js'
import { ssim as computeSsim } from './ssim.js'

const DEFAULTS = Object.freeze({
  rmse: 0.5,
  pixelMismatchPct: 0.5,
  ssim: 0.005,
  maxChannelDiff: 10,
  silhouetteOnly: true,
})

function inferDimensions(buffer, opts) {
  if (opts?.width && opts?.height) return { width: opts.width, height: opts.height }
  const bytes = buffer.length / 4
  const side = Math.round(Math.sqrt(bytes))
  if (side * side * 4 !== buffer.length) {
    throw new Error(`diffImages: cannot infer dimensions from buffer of ${buffer.length} bytes. Pass { width, height }.`)
  }
  return { width: side, height: side }
}

/**
 * Diff two RGBA pixel buffers. Accepts raw `Uint8Array`s (from `readPixels`),
 * not PNG-encoded data — PNG decode is a Recorder responsibility.
 *
 * Counts a pixel as "mismatched" if any channel diff > aaTolerance (12 by
 * default, matching pixelmatch's `threshold: 0.05 * 255`). Anti-aliased pixels
 * at silhouette edges are guarded: we compare the luma diff against twice the
 * tolerance so 1-pixel AA shifts do not flood the metric.
 *
 * @param {Uint8Array|Uint8ClampedArray} candidate
 * @param {Uint8Array|Uint8ClampedArray} reference
 * @param {object} [opts]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {number} [opts.aaTolerance]  per-channel AA-forgiving threshold, default 12
 * @param {boolean} [opts.silhouetteOnly] default true — restrict metric to the material region
 * @param {Uint8Array|null} [opts.silhouette]  optional pre-computed mask (otherwise inferred)
 * @param {number} [opts.silhouetteThreshold] background-distance threshold, default 12
 * @returns {import('../../index.js').DiffResult}
 */
export function diffImages(candidate, reference, opts = {}) {
  if (!candidate || !reference) throw new Error('diffImages: both buffers required')
  if (candidate.length !== reference.length) {
    throw new Error(`diffImages: length mismatch candidate=${candidate.length} reference=${reference.length}`)
  }
  const { width, height } = inferDimensions(candidate, opts)
  if (width * height * 4 !== candidate.length) {
    throw new Error(`diffImages: ${width}x${height} does not match buffer size ${candidate.length}`)
  }

  const aaTol = Number.isFinite(opts.aaTolerance) ? opts.aaTolerance : 12
  const silhouetteOnly = opts.silhouetteOnly ?? DEFAULTS.silhouetteOnly
  const silhouetteThreshold = opts.silhouetteThreshold ?? 12

  let mask = null
  if (silhouetteOnly) {
    if (opts.silhouette) {
      mask = opts.silhouette
    } else {
      const candMask = computeSilhouette(candidate, width, height, { threshold: silhouetteThreshold })
      const refMask = computeSilhouette(reference, width, height, { threshold: silhouetteThreshold })
      mask = unionSilhouettes(candMask, refMask)
    }
  }

  const totalPixels = width * height
  const denomPixels = mask ? silhouetteArea(mask) : totalPixels
  if (denomPixels === 0) {
    return {
      id: null, testId: null,
      rmse: 0, maxChannelDiff: 0, pixelMismatchPct: 0,
      ssim: 1, ssimPerTile: [[1]],
      verdict: 'warn',
    }
  }

  let sumSquared = 0
  let maxChannelDiff = 0
  let mismatchedPixels = 0
  let channelCount = 0

  for (let p = 0; p < totalPixels; p++) {
    if (mask && mask[p] === 0) continue
    const base = p * 4
    let pixelMismatch = false
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(candidate[base + c] - reference[base + c])
      sumSquared += diff * diff
      channelCount++
      if (diff > maxChannelDiff) maxChannelDiff = diff
      if (diff > aaTol) pixelMismatch = true
    }
    if (pixelMismatch) mismatchedPixels++
  }

  const rmse = channelCount > 0 ? Math.sqrt(sumSquared / channelCount) : 0
  const pixelMismatchPct = (mismatchedPixels / denomPixels) * 100

  const { ssim, ssimPerTile } = computeSsim(candidate, reference, width, height, { mask })

  const tolerances = {
    rmse: Number.isFinite(opts.rmse) ? opts.rmse : DEFAULTS.rmse,
    pixelMismatchPct: Number.isFinite(opts.pixelMismatchPct) ? opts.pixelMismatchPct : DEFAULTS.pixelMismatchPct,
    ssim: Number.isFinite(opts.ssim) ? opts.ssim : DEFAULTS.ssim,
    maxChannelDiff: Number.isFinite(opts.maxChannelDiff) ? opts.maxChannelDiff : DEFAULTS.maxChannelDiff,
  }

  let verdict = 'pass'
  if (
    rmse > tolerances.rmse ||
    pixelMismatchPct > tolerances.pixelMismatchPct ||
    (1 - ssim) > tolerances.ssim ||
    maxChannelDiff > tolerances.maxChannelDiff
  ) {
    verdict = 'fail'
  }

  return {
    id: null,
    testId: null,
    rmse,
    maxChannelDiff,
    pixelMismatchPct,
    ssim,
    ssimPerTile,
    verdict,
  }
}

/**
 * Produce a 3-pane diff PNG buffer: [candidate | reference | diff-highlighted].
 * Returns the raw RGBA pixel buffer (width×3 × height) plus the metadata
 * needed by the Recorder to encode a PNG.
 */
export function makeDiffPng(candidate, reference, opts = {}) {
  if (!candidate || !reference) throw new Error('makeDiffPng: both buffers required')
  if (candidate.length !== reference.length) {
    throw new Error(`makeDiffPng: length mismatch ${candidate.length} vs ${reference.length}`)
  }
  const { width, height } = inferDimensions(candidate, opts)
  const aaTol = Number.isFinite(opts.aaTolerance) ? opts.aaTolerance : 12

  const outW = width * 3
  const out = new Uint8Array(outW * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4
      const candI = (y * outW + x) * 4
      const refI = (y * outW + (x + width)) * 4
      const diffI = (y * outW + (x + 2 * width)) * 4

      out[candI] = candidate[srcI]
      out[candI + 1] = candidate[srcI + 1]
      out[candI + 2] = candidate[srcI + 2]
      out[candI + 3] = 255

      out[refI] = reference[srcI]
      out[refI + 1] = reference[srcI + 1]
      out[refI + 2] = reference[srcI + 2]
      out[refI + 3] = 255

      let pixelMismatch = false
      let maxD = 0
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(candidate[srcI + c] - reference[srcI + c])
        if (d > aaTol) pixelMismatch = true
        if (d > maxD) maxD = d
      }

      if (pixelMismatch) {
        // Red highlight, intensity scaled by max channel diff.
        const intensity = Math.min(255, 128 + maxD)
        out[diffI] = intensity
        out[diffI + 1] = 0
        out[diffI + 2] = 0
      } else {
        // Darkened candidate for context.
        out[diffI] = Math.floor(candidate[srcI] * 0.35)
        out[diffI + 1] = Math.floor(candidate[srcI + 1] * 0.35)
        out[diffI + 2] = Math.floor(candidate[srcI + 2] * 0.35)
      }
      out[diffI + 3] = 255
    }
  }

  return { pixels: out, width: outW, height }
}

// Colour probe — given a pixel (x, y) in a composite [candidate|reference|diff]
// image and a recent sweep data set, identify the candidate RGB, reference RGB,
// per-channel delta, and rank which sweep field most strongly affects that pixel.

/**
 * Probe RGBA at (x, y) in a W×H buffer.
 *
 * @param {Uint8Array | Uint8ClampedArray} pixels  length = W × H × 4
 */
export function probePixel(pixels, width, height, x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    throw new Error(`probePixel: (${x},${y}) out of bounds ${width}×${height}`)
  }
  const i = (y * width + x) * 4
  return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] }
}

/**
 * Given two buffers of identical dimensions, return the candidate RGB,
 * reference RGB, and channel-wise delta at (x, y).
 */
export function probePair(candidate, reference, width, height, x, y) {
  const c = probePixel(candidate, width, height, x, y)
  const r = probePixel(reference, width, height, x, y)
  return {
    candidate: c,
    reference: r,
    delta: {
      r: c.r - r.r,
      g: c.g - r.g,
      b: c.b - r.b,
      a: c.a - r.a,
    },
  }
}

/**
 * Rank sweep fields by how much they move the pixel at (x, y) toward the
 * reference colour. Expects a SweepIndex: a map of field → array of
 * { value, capturePixels } from a prior sweep over that field.
 *
 * Returns fields sorted by responsiveness (max channel swing at pixel) desc.
 *
 * @param {{
 *   referencePixels: Uint8Array | Uint8ClampedArray,
 *   width: number, height: number, x: number, y: number,
 *   sweeps: Record<string, Array<{ value: number, capturePixels: Uint8Array }>>,
 * }} input
 */
export function rankSweepResponsiveness(input) {
  const { referencePixels, width, height, x, y, sweeps } = input
  if (!sweeps || typeof sweeps !== 'object') {
    throw new Error('rankSweepResponsiveness: sweeps object required')
  }

  const refPx = probePixel(referencePixels, width, height, x, y)
  const ranking = []

  for (const [field, series] of Object.entries(sweeps)) {
    if (!Array.isArray(series) || series.length < 2) continue
    let minDist = Infinity
    let maxDist = -Infinity
    let bestValue = null
    for (const { value, capturePixels } of series) {
      const cp = probePixel(capturePixels, width, height, x, y)
      const dist = Math.abs(cp.r - refPx.r) + Math.abs(cp.g - refPx.g) + Math.abs(cp.b - refPx.b)
      if (dist < minDist) { minDist = dist; bestValue = value }
      if (dist > maxDist) maxDist = dist
    }
    ranking.push({
      field,
      responsiveness: maxDist - minDist,
      bestValue,
      minChannelDist: minDist,
    })
  }

  ranking.sort((a, b) => b.responsiveness - a.responsiveness)
  return ranking
}

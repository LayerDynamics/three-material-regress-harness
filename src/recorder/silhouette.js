// Silhouette extraction — isolate the material region from the background so
// the diff metric is not contaminated by the (arbitrary) backdrop pixels.

/**
 * Compute an 8-bit alpha mask (0 = background, 255 = object) from an RGBA pixel
 * buffer. The background colour is the dominant colour in the four 1-pixel-wide
 * border strips; any pixel whose channel-wise absolute distance from that
 * colour exceeds `threshold` is considered part of the object.
 *
 * @param {Uint8Array|Uint8ClampedArray} pixels  RGBA bytes, length = w*h*4
 * @param {number} width
 * @param {number} height
 * @param {{threshold?: number, bgRgb?: [number,number,number] | null}} [opts]
 * @returns {Uint8Array} mask — one byte per pixel, length = w*h
 */
export function computeSilhouette(pixels, width, height, opts = {}) {
  const threshold = opts.threshold ?? 12
  const bg = opts.bgRgb ?? inferBackgroundColor(pixels, width, height)
  const mask = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const dr = pixels[i] - bg[0]
      const dg = pixels[i + 1] - bg[1]
      const db = pixels[i + 2] - bg[2]
      const dist = Math.abs(dr) + Math.abs(dg) + Math.abs(db)
      mask[y * width + x] = dist > threshold ? 255 : 0
    }
  }
  return mask
}

/**
 * Infer a background RGB by taking the per-channel median of the four one-pixel
 * border strips. More robust than sampling a single corner.
 */
export function inferBackgroundColor(pixels, width, height) {
  const samples = []
  for (let x = 0; x < width; x++) {
    samples.push(rgbAt(pixels, x, 0, width))
    samples.push(rgbAt(pixels, x, height - 1, width))
  }
  for (let y = 1; y < height - 1; y++) {
    samples.push(rgbAt(pixels, 0, y, width))
    samples.push(rgbAt(pixels, width - 1, y, width))
  }
  const r = [], g = [], b = []
  for (const s of samples) { r.push(s[0]); g.push(s[1]); b.push(s[2]) }
  return [median(r), median(g), median(b)]
}

function rgbAt(pixels, x, y, width) {
  const i = (y * width + x) * 4
  return [pixels[i], pixels[i + 1], pixels[i + 2]]
}

function median(arr) {
  const a = [...arr].sort((x, y) => x - y)
  const n = a.length
  if (n === 0) return 0
  return n % 2 ? a[(n - 1) >> 1] : (a[(n >> 1) - 1] + a[n >> 1]) >> 1
}

/**
 * Union the two silhouettes so a diff restricted to "either image's object"
 * captures expansion / shrinkage regressions as well as colour regressions.
 */
export function unionSilhouettes(maskA, maskB) {
  if (maskA.length !== maskB.length) {
    throw new Error(`unionSilhouettes: mask length mismatch ${maskA.length} vs ${maskB.length}`)
  }
  const out = new Uint8Array(maskA.length)
  for (let i = 0; i < out.length; i++) {
    out[i] = (maskA[i] | maskB[i]) ? 255 : 0
  }
  return out
}

/** Count non-zero pixels in a mask. */
export function silhouetteArea(mask) {
  let c = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] !== 0) c++
  return c
}

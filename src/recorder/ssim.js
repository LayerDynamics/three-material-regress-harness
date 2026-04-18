// Structural Similarity Index (SSIM) — pure-JS implementation.
// Reference: Wang et al. "Image Quality Assessment: From Error Visibility to
// Structural Similarity" (IEEE Transactions on Image Processing, 2004).
//
// We operate on the luma channel (Rec.709) of each RGBA buffer and compute the
// mean SSIM over 8x8 tiles (matching scikit-image's structural_similarity
// with gaussian_weights=False default). Per-tile values are also returned so
// the GUI can render a heatmap.

const L = 255 // dynamic range for 8-bit
const K1 = 0.01
const K2 = 0.03
const C1 = (K1 * L) * (K1 * L)
const C2 = (K2 * L) * (K2 * L)

/**
 * Compute SSIM between two RGBA buffers of identical dimensions.
 *
 * @returns {{ssim: number, ssimPerTile: number[][]}}
 */
export function ssim(a, b, width, height, { tileSize = 8, mask = null } = {}) {
  if (a.length !== b.length) {
    throw new Error(`ssim: buffer length mismatch ${a.length} vs ${b.length}`)
  }
  if (a.length !== width * height * 4) {
    throw new Error(`ssim: expected ${width * height * 4} bytes, got ${a.length}`)
  }
  if (mask && mask.length !== width * height) {
    throw new Error(`ssim: mask length mismatch ${mask.length} vs ${width * height}`)
  }

  const lumA = luma(a, width, height)
  const lumB = luma(b, width, height)

  const tilesX = Math.ceil(width / tileSize)
  const tilesY = Math.ceil(height / tileSize)
  const perTile = Array.from({ length: tilesY }, () => new Array(tilesX).fill(1))

  let totalWeight = 0
  let weightedSum = 0

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileSize
      const y0 = ty * tileSize
      const x1 = Math.min(x0 + tileSize, width)
      const y1 = Math.min(y0 + tileSize, height)

      let count = 0
      let sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0, sumAB = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * width + x
          if (mask && mask[i] === 0) continue
          const va = lumA[i]
          const vb = lumB[i]
          sumA += va
          sumB += vb
          sumA2 += va * va
          sumB2 += vb * vb
          sumAB += va * vb
          count++
        }
      }
      if (count < 2) { perTile[ty][tx] = 1; continue }

      const meanA = sumA / count
      const meanB = sumB / count
      const varA = sumA2 / count - meanA * meanA
      const varB = sumB2 / count - meanB * meanB
      const covAB = sumAB / count - meanA * meanB

      const num = (2 * meanA * meanB + C1) * (2 * covAB + C2)
      const den = (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2)
      const tileSsim = den > 0 ? num / den : 1
      perTile[ty][tx] = tileSsim

      weightedSum += tileSsim * count
      totalWeight += count
    }
  }

  const mean = totalWeight > 0 ? weightedSum / totalWeight : 1
  // Clamp: numerical noise can push values a hair outside [0, 1].
  const clamped = Math.max(0, Math.min(1, mean))
  return { ssim: clamped, ssimPerTile: perTile }
}

function luma(pixels, width, height) {
  const out = new Float64Array(width * height)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    // Rec.709 luma.
    out[i] = 0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]
  }
  return out
}

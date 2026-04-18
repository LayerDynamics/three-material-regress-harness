// Multi-reference averaging — when a baseline has multiple photographs of
// the same pose, average them into one reference to reduce noise bias.

/**
 * Pixel-average N RGBA buffers of identical dimensions.
 *
 * @param {Array<Uint8Array|Uint8ClampedArray>} buffers
 * @returns {Uint8Array}
 */
export function averageReferenceBuffers(buffers) {
  if (!Array.isArray(buffers) || buffers.length === 0) {
    throw new Error('averageReferenceBuffers: non-empty array required')
  }
  const len = buffers[0].length
  for (const b of buffers) {
    if (b.length !== len) throw new Error(`averageReferenceBuffers: length mismatch (${b.length} vs ${len})`)
  }
  const out = new Uint8Array(len)
  const n = buffers.length
  for (let i = 0; i < len; i++) {
    let s = 0
    for (let k = 0; k < n; k++) s += buffers[k][i]
    out[i] = Math.round(s / n)
  }
  return out
}

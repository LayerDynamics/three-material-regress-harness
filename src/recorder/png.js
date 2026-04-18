// PNG encode/decode isomorphic wrapper. In Node, pngjs. In browser, Canvas2D.

/**
 * Encode an RGBA pixel buffer to a PNG byte array.
 *
 * @param {Uint8Array|Uint8ClampedArray} pixels  width*height*4 RGBA bytes
 * @param {number} width
 * @param {number} height
 * @param {{flipY?: boolean}} [opts]  flipY for WebGL readPixels outputs which are bottom-up
 * @returns {Promise<Uint8Array>}
 */
export async function encodePng(pixels, width, height, opts = {}) {
  if (!pixels || pixels.length !== width * height * 4) {
    throw new Error(`encodePng: expected ${width * height * 4} bytes, got ${pixels?.length}`)
  }
  const src = opts.flipY ? flipVertical(pixels, width, height) : pixels

  if (typeof process !== 'undefined' && process.versions?.node) {
    const { PNG } = await import('pngjs')
    const png = new PNG({ width, height })
    png.data = Buffer.from(src.buffer, src.byteOffset, src.byteLength)
    return new Uint8Array(PNG.sync.write(png, { colorType: 6, filterType: -1 }))
  }

  // Browser path — draw into a canvas and convert to PNG.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    const imageData = new ImageData(
      new Uint8ClampedArray(src.buffer, src.byteOffset, src.byteLength),
      width,
      height,
    )
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return new Uint8Array(await blob.arrayBuffer())
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('encodePng: no 2d context')
    const imageData = new ImageData(
      new Uint8ClampedArray(src.buffer, src.byteOffset, src.byteLength),
      width,
      height,
    )
    ctx.putImageData(imageData, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    const b64 = dataUrl.split(',')[1]
    const binary = atob(b64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }

  throw new Error('encodePng: no encode path available (no Node pngjs, no OffscreenCanvas, no document)')
}

/**
 * Decode a PNG byte array to an RGBA pixel buffer.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<{pixels: Uint8Array, width: number, height: number}>}
 */
export async function decodePng(bytes) {
  if (!bytes || bytes.length < 8) throw new Error('decodePng: empty input')

  if (typeof process !== 'undefined' && process.versions?.node) {
    const { PNG } = await import('pngjs')
    const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    return { pixels: new Uint8Array(png.data), width: png.width, height: png.height }
  }

  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    const blob = new Blob([bytes], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    return { pixels: new Uint8Array(img.data), width: bitmap.width, height: bitmap.height }
  }

  if (typeof document !== 'undefined') {
    const blob = new Blob([bytes], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      return { pixels: new Uint8Array(data.data), width: canvas.width, height: canvas.height }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  throw new Error('decodePng: no decode path available')
}

/** Flip an RGBA buffer vertically (for WebGL readPixels output). */
export function flipVertical(pixels, width, height) {
  const rowSize = width * 4
  const out = new Uint8Array(pixels.length)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * rowSize
    const dstRow = y * rowSize
    out.set(pixels.subarray(srcRow, srcRow + rowSize), dstRow)
  }
  return out
}

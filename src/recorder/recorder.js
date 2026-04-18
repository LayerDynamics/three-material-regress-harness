// Recorder — persist CaptureResult to disk (Node) or in-memory blob map (browser).

import { encodePng } from './png.js'

const blobMap = new Map() // id → Blob URL or Uint8Array
let objectUrlRegistry = new Map() // id → URL.createObjectURL result, for revocation

/**
 * Persist a capture. In Node, writes `<outDir>/<id>.png` and returns the path.
 * In the browser, stores a Blob in an in-memory map and returns a Blob URL.
 *
 * @param {import('../../index.js').CaptureResult} result
 * @param {{outDir?: string, flipY?: boolean}} [opts]
 * @returns {Promise<string>}
 */
export async function recordCapture(result, opts = {}) {
  if (!result || !result.pixels || !result.width || !result.height) {
    throw new Error('recordCapture: invalid CaptureResult (missing pixels/width/height)')
  }
  const flipY = opts.flipY ?? true
  const bytes = await encodePng(result.pixels, result.width, result.height, { flipY })

  if (typeof process !== 'undefined' && process.versions?.node) {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')
    const outDir = resolve(opts.outDir ?? './out/captures')
    await mkdir(outDir, { recursive: true })
    const fname = `${result.testId ?? result.id}.png`.replace(/[^\w.-]/g, '_')
    const abs = join(outDir, fname)
    await writeFile(abs, bytes)
    blobMap.set(result.id, abs)
    return abs
  }

  // Browser: stash as Blob + URL in the per-session map.
  const blob = new Blob([bytes], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  blobMap.set(result.id, blob)
  objectUrlRegistry.set(result.id, url)
  return url
}

/**
 * Retrieve a previously recorded capture. Returns:
 *   - Node: absolute filesystem path (string) of the PNG.
 *   - Browser: the stored Blob (or null if missing).
 */
export function getRecordingBlob(id) {
  return blobMap.get(id) ?? null
}

/** Release an Object URL (browser only). */
export function disposeRecording(id) {
  const url = objectUrlRegistry.get(id)
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
  blobMap.delete(id)
  objectUrlRegistry.delete(id)
}

/** Clear all in-memory records. */
export function clearRecordings() {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    for (const url of objectUrlRegistry.values()) URL.revokeObjectURL(url)
  }
  blobMap.clear()
  objectUrlRegistry.clear()
}

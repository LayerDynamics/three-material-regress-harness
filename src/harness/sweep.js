// Parameter sweep — render a frame per step across a numeric MaterialDefinition
// field, emit a per-step metric series and a contact-sheet PNG.

import { Harness } from './harness.js'
import { diffImages } from '../recorder/diff.js'
import { encodePng, decodePng } from '../recorder/png.js'

/**
 * Run a sweep over `field` of MaterialDefinition.
 *
 * @param {{
 *   baseDefinition: import('../../index.js').MaterialDefinition,
 *   field: string,             // supports 'roughness', 'toonParams.shadowMultiplier', etc
 *   min: number,
 *   max: number,
 *   steps: number,
 *   geometry: unknown,
 *   pose: import('../../index.js').PoseManifest,
 *   environment?: import('../../index.js').PoseManifest['environment'],
 *   referencePixels?: Uint8Array | null,
 *   onStep?: (idx: number, value: number, captureBytes: Uint8Array, metric: number | null) => void,
 * }} opts
 * @returns {Promise<{
 *   values: number[],
 *   metrics: Array<number | null>,
 *   capturePngs: Uint8Array[],
 *   contactSheetPng: Uint8Array,
 *   bestValue: number | null,
 * }>}
 */
export async function sweep(opts) {
  if (!opts?.baseDefinition) throw new Error('sweep: baseDefinition required')
  if (!opts?.field) throw new Error('sweep: field required')
  if (!Number.isFinite(opts.min) || !Number.isFinite(opts.max) || opts.max < opts.min) {
    throw new Error(`sweep: invalid range [${opts.min}, ${opts.max}]`)
  }
  if (!Number.isInteger(opts.steps) || opts.steps < 2) throw new Error('sweep: steps must be integer ≥ 2')

  const values = []
  for (let i = 0; i < opts.steps; i++) {
    values.push(opts.min + (i * (opts.max - opts.min)) / (opts.steps - 1))
  }

  const capturePngs = []
  const metrics = []
  const capturePixels = []

  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    const def = structuredClone(opts.baseDefinition)
    setNested(def, opts.field, v)
    const harness = new Harness({
      materialDefinition: def,
      geometry: opts.geometry,
      pose: opts.pose,
      environment: opts.environment ?? null,
      testId: `sweep-${i}`,
    })
    let capture
    try {
      capture = await harness.capture({ timeoutMs: 10_000 })
    } finally {
      harness.dispose()
    }
    capturePixels.push(capture)

    const pngBytes = await encodePng(capture.pixels, capture.width, capture.height, { flipY: true })
    capturePngs.push(pngBytes)

    let metric = null
    if (opts.referencePixels) {
      const diff = diffImages(capture.pixels, opts.referencePixels, {
        width: capture.width, height: capture.height, silhouetteOnly: true,
      })
      metric = diff.rmse
      metrics.push(metric)
    } else {
      metrics.push(null)
    }

    opts.onStep?.(i, v, pngBytes, metric)
  }

  const contactSheetPng = await buildContactSheet(capturePixels, values, metrics)

  let bestValue = null
  if (metrics.every((m) => m != null)) {
    let bestIdx = 0
    for (let i = 1; i < metrics.length; i++) {
      if (metrics[i] < metrics[bestIdx]) bestIdx = i
    }
    bestValue = values[bestIdx]
  }

  return { values, metrics, capturePngs, contactSheetPng, bestValue }
}

/**
 * Read and write nested keys via 'a.b.c' dotted path.
 */
export function setNested(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}

export function getNested(obj, path) {
  const parts = path.split('.')
  let cur = obj
  for (const k of parts) {
    if (cur == null) return undefined
    cur = cur[k]
  }
  return cur
}

/**
 * Build a W*N × H contact sheet from N captures arranged horizontally, with a
 * thin dark band annotating the value and metric at the bottom of each tile.
 */
async function buildContactSheet(captures, values, metrics) {
  if (captures.length === 0) throw new Error('buildContactSheet: no captures')
  const W = captures[0].width
  const H = captures[0].height
  const N = captures.length
  const BAND_H = Math.min(24, Math.max(16, Math.round(H * 0.05)))
  const SHEET_W = W * N
  const SHEET_H = H + BAND_H
  const sheet = new Uint8Array(SHEET_W * SHEET_H * 4)

  // Fill with near-black background.
  for (let i = 0; i < sheet.length; i += 4) {
    sheet[i] = 15; sheet[i + 1] = 17; sheet[i + 2] = 21; sheet[i + 3] = 255
  }

  // Copy captures flipped vertically (readPixels is bottom-up).
  for (let n = 0; n < N; n++) {
    const src = captures[n].pixels
    const xOff = n * W
    for (let y = 0; y < H; y++) {
      const srcY = H - 1 - y
      for (let x = 0; x < W; x++) {
        const s = (srcY * W + x) * 4
        const d = (y * SHEET_W + (x + xOff)) * 4
        sheet[d] = src[s]
        sheet[d + 1] = src[s + 1]
        sheet[d + 2] = src[s + 2]
        sheet[d + 3] = 255
      }
    }
    // Annotate: draw a metric bar in the band at the tile bottom. Bar length
    // is metric-normalised; 0 → 0 length, 20 → full width.
    const m = metrics[n]
    if (m != null) {
      const t = Math.max(0, Math.min(1, m / 20))
      const barLen = Math.round(W * t)
      const bandTop = H
      for (let y = bandTop + 2; y < bandTop + BAND_H - 2; y++) {
        for (let x = 0; x < barLen; x++) {
          const d = (y * SHEET_W + (x + xOff)) * 4
          sheet[d] = 255
          sheet[d + 1] = Math.round(255 * (1 - t))
          sheet[d + 2] = Math.round(80 * (1 - t))
        }
      }
    }
  }

  return encodePng(sheet, SHEET_W, SHEET_H, { flipY: false })
}

/** Decode the candidate bytes back into a pixel buffer (useful for tests). */
export async function decodeSweepCapture(bytes) {
  return decodePng(bytes)
}

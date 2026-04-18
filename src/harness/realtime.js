// Realtime diff loop — subscribes to MaterialDefinition changes, debounces,
// drives Harness.capture() + diffImages(), streams results into
// regressionStore.current so the GUI metrics panel updates live.
//
// Browser-only. The loop is a pure function factory so consumers can start
// and stop it deterministically (e.g. when the active test changes).

import { Harness } from './harness.js'
import { diffImages } from '../recorder/diff.js'
import { decodePng } from '../recorder/png.js'
import { useHarnessStore } from '../stores/harnessStore.js'
import { useRegressionStore } from '../stores/regressionStore.js'
import { useRendererStore } from '../stores/rendererStore.js'
import { useTestStore } from '../stores/testStore.js'

const DEFAULT_DEBOUNCE_MS = 120
const DEFAULT_MIN_INTERVAL_MS = 120 // caps the loop to ≤ ~8 Hz regardless of noisy event streams

/**
 * Start a realtime diff loop. Returns a `stop()` function. Idempotent —
 * start() while running is a no-op. The loop is driven by zustand
 * subscriptions + a debounced microtask so burst changes coalesce.
 *
 * @param {{
 *   debounceMs?: number,
 *   minIntervalMs?: number,
 *   loadReferencePixels: (testId: string) => Promise<{pixels: Uint8Array, width: number, height: number} | null>,
 *   onDiff?: (diff: import('../../index.js').DiffResult) => void,
 *   geometryFor: () => unknown,
 * }} opts
 */
export function startRealtimeDiff(opts) {
  if (!opts?.loadReferencePixels) throw new Error('startRealtimeDiff: loadReferencePixels required')
  if (!opts?.geometryFor) throw new Error('startRealtimeDiff: geometryFor required')

  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS

  let pending = null
  let lastRunAt = 0
  let running = false
  let stopped = false
  let emittedCount = 0
  let cachedReference = { testId: null, pixels: null, width: 0, height: 0 }

  const materialUnsub = useRendererStore.subscribe(
    (s) => s.materialDefinition,
    () => kick(),
  )
  const cameraUnsub = useRendererStore.subscribe(
    (s) => [s.camera, s.environment, s.toneMapping, s.exposure, s.geometryKind, s.geometryUrl],
    () => kick(),
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  )
  const activeTestUnsub = useHarnessStore.subscribe(
    (s) => s.activeTestId,
    (id) => {
      cachedReference = { testId: null, pixels: null, width: 0, height: 0 }
      if (id) kick()
    },
  )

  const kick = () => {
    if (stopped) return
    clearTimeout(pending)
    pending = setTimeout(runOnce, debounceMs)
  }

  const runOnce = async () => {
    if (running || stopped) return
    const now = performance.now()
    if (now - lastRunAt < minIntervalMs) {
      pending = setTimeout(runOnce, minIntervalMs - (now - lastRunAt))
      return
    }
    lastRunAt = now
    running = true

    try {
      const def = useRendererStore.getState().materialDefinition
      if (!def) return

      const activeTestId = useHarnessStore.getState().activeTestId
      const test = useTestStore.getState().manifest.find((t) => t.id === activeTestId) ?? null
      if (!test) return

      if (cachedReference.testId !== activeTestId) {
        const ref = await opts.loadReferencePixels(activeTestId)
        if (!ref) return
        cachedReference = { testId: activeTestId, ...ref }
      }

      const rs = useRendererStore.getState()
      const harness = new Harness({
        materialDefinition: def,
        geometry: opts.geometryFor(),
        pose: {
          cameraPosition: rs.camera.position,
          cameraTarget: rs.camera.target,
          cameraUp: rs.camera.up,
          cameraFov: rs.camera.fov,
          imageWidth: cachedReference.width,
          imageHeight: cachedReference.height,
          environment: rs.environment,
          toneMapping: rs.toneMapping,
          dpr: 1,
        },
        environment: rs.environment,
        testId: activeTestId,
      })

      try {
        const capture = await harness.capture({ timeoutMs: 5000 })
        const diff = diffImages(capture.pixels, cachedReference.pixels, {
          width: cachedReference.width,
          height: cachedReference.height,
          silhouetteOnly: true,
        })
        diff.testId = activeTestId
        diff.id = `rt-${activeTestId}-${emittedCount++}`
        useRegressionStore.getState().setCurrent(diff)
        useHarnessStore.getState().pushEvent({
          name: 'harness.realtime.diff',
          payload: { testId: activeTestId, rmse: diff.rmse, ssim: diff.ssim },
        })
        opts.onDiff?.(diff)
      } finally {
        harness.dispose()
      }
    } catch (err) {
      useHarnessStore.getState().pushEvent({
        name: 'harness.realtime.error',
        payload: { error: err?.message ?? String(err) },
      })
    } finally {
      running = false
    }
  }

  // Fire once at startup.
  kick()

  return () => {
    stopped = true
    clearTimeout(pending)
    materialUnsub()
    cameraUnsub()
    activeTestUnsub()
  }
}

/**
 * Decode a reference PNG supplied as either a URL string or raw bytes.
 * Returns { pixels, width, height } or null.
 */
export async function decodeReferenceUrl(url) {
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  const bytes = new Uint8Array(await res.arrayBuffer())
  return decodePng(bytes)
}

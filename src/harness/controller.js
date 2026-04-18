// HarnessController — serialises captures, retries on transient WebGL failures,
// and enforces a timeout per capture.

import { Harness } from './harness.js'
import { CaptureTimeoutError } from './exceptions.js'

export class HarnessController {
  constructor(opts = {}) {
    this._captureRetries = Number.isInteger(opts.captureRetries) ? opts.captureRetries : 2
    this._captureTimeoutMs = Number.isFinite(opts.captureTimeoutMs) ? opts.captureTimeoutMs : 15_000
    this._queue = []
    this._inFlight = null
    this._aborted = false
    this._drainingResolve = null
  }

  /**
   * Enqueue a capture. Resolves to a CaptureResult.
   *
   * @param {{
   *   materialDefinition: import('../../index.js').MaterialDefinition,
   *   pose: import('../../index.js').PoseManifest,
   *   testId?: string,
   *   geometry: unknown,
   *   environment?: import('../../index.js').PoseManifest['environment'],
   * }} spec
   */
  enqueue(spec) {
    if (this._aborted) return Promise.reject(new Error('HarnessController: aborted'))
    return new Promise((resolve, reject) => {
      this._queue.push({ spec, resolve, reject })
      this._pump()
    })
  }

  _pump() {
    if (this._inFlight) return
    const next = this._queue.shift()
    if (!next) {
      if (this._drainingResolve) {
        this._drainingResolve()
        this._drainingResolve = null
      }
      return
    }
    this._inFlight = next
    this._runWithRetry(next.spec)
      .then((result) => {
        next.resolve(result)
      })
      .catch((err) => {
        next.reject(err)
      })
      .finally(() => {
        this._inFlight = null
        if (!this._aborted) this._pump()
      })
  }

  async _runWithRetry(spec) {
    let lastError = null
    for (let attempt = 0; attempt <= this._captureRetries; attempt++) {
      const harness = new Harness({
        materialDefinition: spec.materialDefinition,
        geometry: spec.geometry,
        pose: spec.pose,
        environment: spec.environment,
        testId: spec.testId,
      })
      try {
        const result = await harness.capture({ timeoutMs: this._captureTimeoutMs })
        return result
      } catch (err) {
        lastError = err
        const transient =
          err instanceof CaptureTimeoutError ||
          String(err?.message ?? '').toLowerCase().includes('webgl_context_lost') ||
          String(err?.message ?? '').toLowerCase().includes('context lost')
        if (!transient || attempt === this._captureRetries) {
          throw err
        }
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      } finally {
        harness.dispose()
      }
    }
    throw lastError
  }

  flush() {
    if (!this._inFlight && this._queue.length === 0) return Promise.resolve()
    return new Promise((resolve) => {
      this._drainingResolve = resolve
    })
  }

  abort() {
    this._aborted = true
    const queued = this._queue.splice(0)
    for (const q of queued) {
      q.reject(new Error('HarnessController: aborted'))
    }
  }
}

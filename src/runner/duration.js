// Duration — monotonic timing helpers for the runner.

const hasPerf = typeof performance !== 'undefined' && typeof performance.now === 'function'

export function now() {
  return hasPerf ? performance.now() : Date.now()
}

export function startTimer() {
  return { startMs: now() }
}

export function stopTimer(t) {
  if (!t || typeof t.startMs !== 'number') throw new Error('stopTimer: expected { startMs }')
  const stopMs = now()
  return { startMs: t.startMs, stopMs, durationMs: stopMs - t.startMs }
}

export function summarise(durations) {
  const arr = Array.isArray(durations) ? durations.filter(Number.isFinite) : []
  if (arr.length === 0) return { n: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0 }
  const sorted = [...arr].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((s, x) => s + x, 0)
  const q = (p) => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(p * n)))
    return sorted[idx]
  }
  return {
    n,
    min: sorted[0],
    max: sorted[n - 1],
    mean: sum / n,
    p50: q(0.5),
    p95: q(0.95),
  }
}

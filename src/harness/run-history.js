// Run-history store — persists RegressionReports to IndexedDB (browser) and
// to disk (Node). Used by the GUI time-travel drawer to compare two prior runs.

const DB_NAME = 'tmrh_runs'
const DB_VERSION = 1
const STORE = 'runs'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function tx(mode, work) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    t.onerror = () => reject(t.error ?? new Error('tx failed'))
    t.onabort = () => reject(t.error ?? new Error('tx aborted'))
    const store = t.objectStore(STORE)
    const out = work(store)
    t.oncomplete = () => resolve(out)
  })
}

export async function saveRunBrowser(report) {
  if (!report?.startedAt) throw new Error('saveRun: report missing startedAt')
  const id = `${report.startedAt}-${report.gitSha ?? 'nogit'}`
  await tx('readwrite', (s) => s.put({ id, report }))
  return id
}

export async function listRunsBrowser() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const req = t.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(
      req.result
        .map((row) => row.report)
        .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '')),
    )
    req.onerror = () => reject(req.error)
  })
}

export async function loadRunBrowser(id) {
  return tx('readonly', (s) => new Promise((resolve) => {
    const req = s.get(id)
    req.onsuccess = () => resolve(req.result?.report ?? null)
  }))
}

export async function deleteRunBrowser(id) {
  await tx('readwrite', (s) => s.delete(id))
}

/**
 * Compute a delta-of-deltas summary between two reports — for each
 * test present in both, emit { testId, a, b, deltaRmse, deltaSsim, deltaPixelMismatchPct }.
 *
 * @param {import('../../index.js').RegressionReport} a
 * @param {import('../../index.js').RegressionReport} b
 */
export function diffReports(a, b) {
  const byId = new Map()
  for (const r of a.results ?? []) byId.set(r.testId, { a: r })
  for (const r of b.results ?? []) {
    const entry = byId.get(r.testId) ?? {}
    entry.b = r
    byId.set(r.testId, entry)
  }
  const rows = []
  for (const [testId, { a: ra, b: rb }] of byId.entries()) {
    rows.push({
      testId,
      a: ra ?? null,
      b: rb ?? null,
      deltaRmse: (rb?.diff?.rmse ?? 0) - (ra?.diff?.rmse ?? 0),
      deltaSsim: (rb?.diff?.ssim ?? 0) - (ra?.diff?.ssim ?? 0),
      deltaPixelMismatchPct: (rb?.diff?.pixelMismatchPct ?? 0) - (ra?.diff?.pixelMismatchPct ?? 0),
      verdictChange: ra?.verdict && rb?.verdict && ra.verdict !== rb.verdict
        ? `${ra.verdict} → ${rb.verdict}`
        : null,
    })
  }
  rows.sort((a1, b1) => Math.abs(b1.deltaRmse) - Math.abs(a1.deltaRmse))
  return rows
}

/** List runs from disk (Node). */
export async function listRunsNode(outDir) {
  const { readdir, readFile, stat } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const entries = await readdir(outDir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const reportPath = join(outDir, entry.name, 'report.json')
    try {
      await stat(reportPath)
      const raw = await readFile(reportPath, 'utf8')
      results.push(JSON.parse(raw))
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err
    }
  }
  return results.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
}

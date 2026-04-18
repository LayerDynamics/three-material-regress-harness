// CMA-ES — Covariance Matrix Adaptation Evolution Strategy (Hansen & Ostermeier).
// Gradient-free optimiser for the parameter solver (SPEC-10 FR-27).
// Pure-JS, no runtime deps, dimension-agnostic.
//
// The objective callback returns a scalar cost; the solver minimises it.
// Callers cap iterations or check convergence from the return value.

/** @typedef {{ x: number[], f: number }} Evaluation */

/**
 * Minimise an objective function over `bounds` using CMA-ES.
 *
 * @param {{
 *   bounds: Array<{ min: number, max: number, name?: string }>,
 *   objective: (x: number[]) => Promise<number> | number,
 *   mean?: number[],          // initial mean (defaults to midpoint of bounds)
 *   sigma?: number,           // initial step size (defaults to 0.3 of span)
 *   populationSize?: number,  // λ, default: 4 + floor(3 * ln(D))
 *   maxIter?: number,         // generation cap
 *   tolerance?: number,       // stop when best f improves by < tolerance between 5 consecutive gens
 *   seed?: number,
 *   onGeneration?: (gen: number, best: Evaluation, mean: number[], sigma: number) => void,
 * }} opts
 */
export async function minimizeCmaEs(opts) {
  if (!Array.isArray(opts?.bounds) || opts.bounds.length === 0) {
    throw new Error('minimizeCmaEs: bounds required (non-empty array)')
  }
  if (typeof opts.objective !== 'function') {
    throw new Error('minimizeCmaEs: objective function required')
  }
  for (const b of opts.bounds) {
    if (!Number.isFinite(b.min) || !Number.isFinite(b.max) || b.max <= b.min) {
      throw new Error(`minimizeCmaEs: invalid bound [${b.min}, ${b.max}]`)
    }
  }

  const N = opts.bounds.length
  const maxIter = opts.maxIter ?? 50
  const tolerance = opts.tolerance ?? 1e-4
  const rand = mulberry32(opts.seed ?? 0x5eed1234)

  const span = opts.bounds.map((b) => b.max - b.min)
  let mean = (opts.mean ?? opts.bounds.map((b) => (b.min + b.max) / 2)).slice()
  let sigma = opts.sigma ?? 0.3

  const lambda = opts.populationSize ?? Math.max(4, Math.floor(4 + 3 * Math.log(N)))
  const mu = Math.floor(lambda / 2)

  // Recombination weights (log-based, normalised).
  const rawWeights = []
  for (let i = 0; i < mu; i++) rawWeights.push(Math.log((lambda + 1) / 2) - Math.log(i + 1))
  const sumW = rawWeights.reduce((s, w) => s + w, 0)
  const weights = rawWeights.map((w) => w / sumW)
  const mueff = 1 / weights.reduce((s, w) => s + w * w, 0)

  // Strategy parameters.
  const cs = (mueff + 2) / (N + mueff + 5)
  const c1 = 2 / ((N + 1.3) ** 2 + mueff)
  const cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((N + 2) ** 2 + mueff))
  const cc = (4 + mueff / N) / (N + 4 + 2 * mueff / N)
  const damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (N + 1)) - 1) + cs
  const chiN = Math.sqrt(N) * (1 - 1 / (4 * N) + 1 / (21 * N * N))

  // Evolution paths and covariance matrix.
  let pc = new Array(N).fill(0)
  let ps = new Array(N).fill(0)
  let C = identity(N)

  let best = { x: mean.slice(), f: Infinity }
  const history = []

  for (let gen = 0; gen < maxIter; gen++) {
    // Build an eigendecomposition of C (symmetric NxN). Use power-iteration
    // for small N, which suffices up to ~20 dims; larger tasks would need
    // a QR-based approach. For N ≥ 1 we operate on diagonal-dominant C,
    // which power iteration resolves in a handful of sweeps.
    const { eigenvalues, eigenvectors } = symmetricEigendecomp(C)
    const D = eigenvalues.map((e) => Math.sqrt(Math.max(e, 1e-10)))
    const BD = matMul(eigenvectors, diag(D))

    // Sample λ offspring.
    const population = []
    for (let k = 0; k < lambda; k++) {
      const z = gaussianVector(N, rand)
      const y = matVec(BD, z)
      const x = new Array(N)
      for (let i = 0; i < N; i++) {
        x[i] = clamp(mean[i] + sigma * y[i], opts.bounds[i].min, opts.bounds[i].max)
      }
      const f = await opts.objective(x)
      population.push({ x, y, z, f })
    }
    population.sort((a, b) => a.f - b.f)

    const bestInGen = population[0]
    if (bestInGen.f < best.f) best = { x: bestInGen.x.slice(), f: bestInGen.f }

    // Recombine mean.
    const newMean = new Array(N).fill(0)
    const recombinedY = new Array(N).fill(0)
    for (let i = 0; i < mu; i++) {
      const w = weights[i]
      const xi = population[i].x
      const yi = population[i].y
      for (let d = 0; d < N; d++) {
        newMean[d] += w * xi[d]
        recombinedY[d] += w * yi[d]
      }
    }

    // Update evolution paths.
    const invSqrtC = matMul(eigenvectors, matMul(diag(D.map((d) => 1 / d)), transpose(eigenvectors)))
    const CinvRecombined = matVec(invSqrtC, recombinedY)
    const sqrtCsMu = Math.sqrt(cs * (2 - cs) * mueff)
    for (let i = 0; i < N; i++) {
      ps[i] = (1 - cs) * ps[i] + sqrtCsMu * CinvRecombined[i]
    }

    const psNorm = Math.sqrt(ps.reduce((s, v) => s + v * v, 0))
    const hs = psNorm / Math.sqrt(1 - Math.pow(1 - cs, 2 * (gen + 1))) < (1.4 + 2 / (N + 1)) * chiN ? 1 : 0

    for (let i = 0; i < N; i++) {
      pc[i] = (1 - cc) * pc[i] + hs * Math.sqrt(cc * (2 - cc) * mueff) * recombinedY[i]
    }

    // Rank-µ + rank-1 covariance update.
    const newC = scaleMat(C, 1 - c1 - cmu)
    addOuterProductInPlace(newC, pc, pc, c1)
    addOuterProductInPlace(newC, pc, pc, c1 * (1 - hs) * cc * (2 - cc))
    for (let i = 0; i < mu; i++) {
      addOuterProductInPlace(newC, population[i].y, population[i].y, cmu * weights[i])
    }
    C = newC

    // Step size update.
    sigma *= Math.exp((cs / damps) * (psNorm / chiN - 1))

    mean = newMean
    history.push({ gen, bestF: best.f, sigma })
    opts.onGeneration?.(gen, best, mean, sigma)

    if (history.length >= 5) {
      const recent = history.slice(-5).map((h) => h.bestF)
      const spread = Math.max(...recent) - Math.min(...recent)
      if (spread < tolerance) break
    }
  }

  return { best, mean, sigma, history, iterations: history.length }
}

// ── Math utilities ───────────────────────────────────────────────────────────

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }
function identity(n) { const m = zeros(n, n); for (let i = 0; i < n; i++) m[i][i] = 1; return m }
function zeros(rows, cols) { return Array.from({ length: rows }, () => new Array(cols).fill(0)) }
function diag(v) { const n = v.length; const m = zeros(n, n); for (let i = 0; i < n; i++) m[i][i] = v[i]; return m }
function transpose(m) { const r = m.length, c = m[0].length; const out = zeros(c, r); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = m[i][j]; return out }
function scaleMat(m, s) { return m.map((row) => row.map((v) => v * s)) }
function matMul(a, b) {
  const r = a.length, c = b[0].length, k = b.length
  const out = zeros(r, c)
  for (let i = 0; i < r; i++) {
    const ai = a[i]
    for (let j = 0; j < c; j++) {
      let sum = 0
      for (let p = 0; p < k; p++) sum += ai[p] * b[p][j]
      out[i][j] = sum
    }
  }
  return out
}
function matVec(m, v) {
  const r = m.length, c = v.length
  const out = new Array(r).fill(0)
  for (let i = 0; i < r; i++) {
    let sum = 0
    for (let j = 0; j < c; j++) sum += m[i][j] * v[j]
    out[i] = sum
  }
  return out
}
function addOuterProductInPlace(mat, u, v, k) {
  const n = mat.length
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) mat[i][j] += k * u[i] * v[j]
}

function mulberry32(a) {
  return function () {
    let t = (a = (a + 0x6D2B79F5) | 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussianVector(n, rand) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let u1 = 0, u2 = 0
    while (u1 < 1e-9) u1 = rand()
    u2 = rand()
    out[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  return out
}

/**
 * Symmetric eigendecomposition via Jacobi rotation. Stable on small (≤32)
 * symmetric matrices; good enough for the practical parameter dimensions
 * we'd pass to the solver (typically 3–10).
 */
export function symmetricEigendecomp(input) {
  const n = input.length
  // Copy (we mutate during sweeps).
  const A = input.map((row) => row.slice())
  const V = identity(n)
  const MAX_SWEEPS = 100
  const TOL = 1e-10

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let off = 0
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q]
    }
    if (Math.sqrt(off) < TOL) break

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q]
        if (Math.abs(apq) < TOL) continue
        const app = A[p][p]
        const aqq = A[q][q]
        const theta = (aqq - app) / (2 * apq)
        const t = theta >= 0
          ? 1 / (theta + Math.sqrt(1 + theta * theta))
          : 1 / (theta - Math.sqrt(1 + theta * theta))
        const c = 1 / Math.sqrt(1 + t * t)
        const s = t * c
        A[p][p] = app - t * apq
        A[q][q] = aqq + t * apq
        A[p][q] = 0
        A[q][p] = 0
        for (let r = 0; r < n; r++) {
          if (r !== p && r !== q) {
            const arp = A[r][p]
            const arq = A[r][q]
            A[r][p] = c * arp - s * arq
            A[p][r] = A[r][p]
            A[r][q] = s * arp + c * arq
            A[q][r] = A[r][q]
          }
          const vrp = V[r][p]
          const vrq = V[r][q]
          V[r][p] = c * vrp - s * vrq
          V[r][q] = s * vrp + c * vrq
        }
      }
    }
  }

  const eigenvalues = []
  for (let i = 0; i < n; i++) eigenvalues.push(A[i][i])
  return { eigenvalues, eigenvectors: V }
}

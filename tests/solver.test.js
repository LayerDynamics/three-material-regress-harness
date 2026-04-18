import { describe, it, expect } from 'vitest'
import { minimizeCmaEs, symmetricEigendecomp } from '../src/harness/solver.js'

describe('symmetricEigendecomp', () => {
  it('diagonalises a diagonal matrix', () => {
    const { eigenvalues } = symmetricEigendecomp([[2, 0], [0, 3]])
    const sorted = [...eigenvalues].sort()
    expect(sorted[0]).toBeCloseTo(2, 6)
    expect(sorted[1]).toBeCloseTo(3, 6)
  })

  it('recovers eigenvalues of a 2×2 symmetric matrix', () => {
    // Eigenvalues of [[4, 1], [1, 3]] are (7 ± √5) / 2 ≈ 4.618, 2.382
    const { eigenvalues } = symmetricEigendecomp([[4, 1], [1, 3]])
    const sorted = [...eigenvalues].sort()
    expect(sorted[0]).toBeCloseTo(2.381966, 4)
    expect(sorted[1]).toBeCloseTo(4.618034, 4)
  })
})

describe('minimizeCmaEs', () => {
  it('finds the minimum of a 2-D paraboloid (x1=0.7, x2=-0.3)', async () => {
    const target = [0.7, -0.3]
    const result = await minimizeCmaEs({
      bounds: [
        { min: -2, max: 2, name: 'a' },
        { min: -2, max: 2, name: 'b' },
      ],
      objective: (x) => (x[0] - target[0]) ** 2 + (x[1] - target[1]) ** 2,
      seed: 1234,
      maxIter: 40,
      tolerance: 1e-6,
    })
    expect(result.best.f).toBeLessThan(1e-2)
    expect(Math.abs(result.best.x[0] - target[0])).toBeLessThan(0.2)
    expect(Math.abs(result.best.x[1] - target[1])).toBeLessThan(0.2)
  })

  it('handles bound-constrained objectives (hits boundary)', async () => {
    // Minimum at x = -5, bounds [0, 2] → optimum on the boundary at x = 0.
    const result = await minimizeCmaEs({
      bounds: [{ min: 0, max: 2 }],
      objective: (x) => (x[0] + 5) ** 2,
      seed: 42,
      maxIter: 30,
    })
    expect(result.best.x[0]).toBeCloseTo(0, 1)
    expect(result.best.f).toBeCloseTo(25, 1)
  })

  it('rejects invalid bounds', async () => {
    await expect(minimizeCmaEs({ bounds: [{ min: 1, max: 0 }], objective: () => 0 }))
      .rejects.toThrow(/invalid bound/)
  })

  it('rejects missing objective', async () => {
    await expect(minimizeCmaEs({ bounds: [{ min: 0, max: 1 }] }))
      .rejects.toThrow(/objective function required/)
  })
})

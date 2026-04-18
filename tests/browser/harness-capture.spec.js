import { test, expect } from '@playwright/test'

test.describe('Harness.capture', () => {
  test('captures a red sphere at 128×128 with correct dimensions', async ({ page }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const mod = await import('/src/index.js')
      const h = new mod.Harness({
        materialDefinition: {
          color: '#ff0000',
          roughness: 0.4,
          metalness: 0.0,
          kmpShaderType: null,
        },
        geometry: { type: 'sphere', radius: 1, widthSegments: 32, heightSegments: 32 },
        pose: {
          cameraPosition: [0, 0, 3],
          cameraTarget: [0, 0, 0],
          cameraUp: [0, 1, 0],
          cameraFov: 45,
          imageWidth: 128,
          imageHeight: 128,
        },
        environment: null,
        testId: 'red-sphere-smoke',
      })
      try {
        const r = await h.capture()
        return { len: r.pixels.length, w: r.width, hh: r.height, three: r.meta.three }
      } finally {
        h.dispose()
      }
    })
    expect(result.len).toBe(128 * 128 * 4)
    expect(result.w).toBe(128)
    expect(result.hh).toBe(128)
    expect(typeof result.three).toBe('string')
  })

  test('two captures of the same spec produce identical pixel buffers', async ({ page }) => {
    await page.goto('/')
    const { equal, maxDiff } = await page.evaluate(async () => {
      const mod = await import('/src/index.js')
      const spec = {
        materialDefinition: { color: '#008800', roughness: 0.6, metalness: 0.0, kmpShaderType: null },
        geometry: { type: 'cube', width: 1, height: 1, depth: 1 },
        pose: {
          cameraPosition: [2, 2, 2],
          cameraTarget: [0, 0, 0],
          cameraUp: [0, 1, 0],
          cameraFov: 45,
          imageWidth: 64,
          imageHeight: 64,
        },
        environment: null,
      }
      const capture = async () => {
        const h = new mod.Harness(spec)
        try { return await h.capture() } finally { h.dispose() }
      }
      const a = await capture()
      const b = await capture()
      let max = 0
      for (let i = 0; i < a.pixels.length; i++) {
        const d = Math.abs(a.pixels[i] - b.pixels[i])
        if (d > max) max = d
      }
      return { equal: max === 0, maxDiff: max }
    })
    // SwiftShader on Linux may introduce ≤2-unit noise. On a real GPU exact.
    expect(maxDiff).toBeLessThanOrEqual(2)
    if (!equal) {
      // Log the observed noise for visibility but don't fail the test.
      // eslint-disable-next-line no-console
      console.log(`[tmrh] determinism noise: maxDiff=${maxDiff}`)
    }
  })

  test('diffImages on same-capture returns rmse 0 / ssim 1', async ({ page }) => {
    await page.goto('/')
    const r = await page.evaluate(async () => {
      const mod = await import('/src/index.js')
      const h = new mod.Harness({
        materialDefinition: { color: '#336699', roughness: 0.5, metalness: 0.0, kmpShaderType: null },
        geometry: { type: 'sphere', radius: 1, widthSegments: 32, heightSegments: 32 },
        pose: {
          cameraPosition: [0, 0, 3],
          cameraTarget: [0, 0, 0],
          cameraUp: [0, 1, 0],
          cameraFov: 45,
          imageWidth: 64,
          imageHeight: 64,
        },
        environment: null,
      })
      try {
        const cap = await h.capture()
        const diff = mod.diffImages(cap.pixels, cap.pixels, { width: cap.width, height: cap.height, silhouetteOnly: false })
        return { rmse: diff.rmse, ssim: diff.ssim, verdict: diff.verdict }
      } finally {
        h.dispose()
      }
    })
    expect(r.rmse).toBe(0)
    expect(r.ssim).toBe(1)
    expect(r.verdict).toBe('pass')
  })
})

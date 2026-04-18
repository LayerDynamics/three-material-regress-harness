import { test, expect } from '@playwright/test'

test.describe('GUI smoke', () => {
  test('app mounts with the expected title bar', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.tmrh-topbar .title')).toHaveText('tmrh')
    await expect(page.locator('.tmrh-topbar .sub').first()).toHaveText('three-material-regress-harness')
  })

  test('three-column layout is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.tmrh-app')).toBeVisible()
    await expect(page.locator('.tmrh-sidebar')).toBeVisible()
    await expect(page.locator('.tmrh-viewport')).toBeVisible()
    await expect(page.locator('.tmrh-panel')).toBeVisible()
    await expect(page.locator('.tmrh-console')).toBeVisible()
  })

  test('stores are exposed from the public API', async ({ page }) => {
    await page.goto('/')
    const exported = await page.evaluate(async () => {
      const mod = await import('/src/index.js')
      return {
        hasHarness: typeof mod.Harness,
        hasCreateHarness: typeof mod.createHarness,
        hasDiff: typeof mod.diffImages,
        hasRegistry: typeof mod.registerShaderType,
        hasStore: typeof mod.useHarnessStore,
      }
    })
    expect(exported.hasHarness).toBe('function')
    expect(exported.hasCreateHarness).toBe('function')
    expect(exported.hasDiff).toBe('function')
    expect(exported.hasRegistry).toBe('function')
    expect(exported.hasStore).toBe('function')
  })
})

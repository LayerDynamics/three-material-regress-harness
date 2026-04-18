import { test, expect } from '@playwright/test'

test.describe('GUI smoke', () => {
  test('app mounts with the expected title bar', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.evth-topbar .title')).toHaveText('evth')
    await expect(page.locator('.evth-topbar .sub').first()).toHaveText('extern-material-three-visual-test-harness')
  })

  test('three-column layout is present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.evth-app')).toBeVisible()
    await expect(page.locator('.evth-sidebar')).toBeVisible()
    await expect(page.locator('.evth-viewport')).toBeVisible()
    await expect(page.locator('.evth-panel')).toBeVisible()
    await expect(page.locator('.evth-console')).toBeVisible()
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

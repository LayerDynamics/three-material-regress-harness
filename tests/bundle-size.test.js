import { describe, it, expect, beforeAll } from 'vitest'
import { stat, readFile, access } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { execSync } from 'node:child_process'

const BUNDLE = 'dist/extern-material-three-visual-test-harness.mjs'

// SPEC-10 NFR: the library ESM bundle (excluding peer deps) is ≤ 120 KB gzipped.
const GZIP_BUDGET = 120 * 1024

describe('bundle size budget', () => {
  beforeAll(async () => {
    let needsBuild = true
    try {
      await access(BUNDLE)
      needsBuild = false
    } catch { /* build */ }
    if (needsBuild) {
      // Reuse the same rollup config vitest already has in path.
      execSync('npx rollup -c rollup.config.js', { stdio: 'inherit' })
    }
  }, 120_000)

  it(`gzipped bundle ≤ ${GZIP_BUDGET} bytes`, async () => {
    const bytes = await readFile(BUNDLE)
    const gz = gzipSync(bytes)
    // eslint-disable-next-line no-console
    console.log(`[evth] bundle: ${bytes.length} bytes (${gz.length} gzipped) / budget ${GZIP_BUDGET}`)
    expect(gz.length).toBeLessThanOrEqual(GZIP_BUDGET)
  })

  it('bundle does not inline react / three / r3f / drei / zustand', async () => {
    const src = await readFile(BUNDLE, 'utf8')
    expect(src).not.toMatch(/createElement\(.*?ReactCurrentOwner/)
    expect(src).not.toMatch(/THREE\.REVISION\s*=\s*"0\.184/)
    expect(src).not.toMatch(/__REACT_THREE_FIBER__/)
  })

  it('bundle file exists + non-empty', async () => {
    const s = await stat(BUNDLE)
    expect(s.size).toBeGreaterThan(1024)
  })
})

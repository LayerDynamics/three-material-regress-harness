// Tolerances loader — three-level merge: test-specific > variant > global default.

import { validateTolerances } from '../harness/params.js'
import { DEFAULTS } from '../harness/defaults.js'

/**
 * Load the effective Tolerances for a given test.
 *
 * Resolution order (later wins):
 *   1. DEFAULTS.tolerances
 *   2. <baselineRoot>/tolerances.json                       (global override)
 *   3. <baselineRoot>/<variant>/tolerances.json             (variant override)
 *   4. <baselineRoot>/<variant>/<view>/tolerances.json      (test override)
 *   5. overrideTolerances (programmatic override; CLI --threshold already lives here)
 *
 * @param {string} baselineRoot — absolute path (Node only). In browser we skip FS reads
 *                                and only merge programmatic overrides with defaults.
 * @param {string} variant
 * @param {string} view
 * @param {Partial<import('../../index.js').Tolerances>} [overrideTolerances]
 * @returns {Promise<import('../../index.js').Tolerances>}
 */
export async function loadTolerances(baselineRoot, variant, view, overrideTolerances = null) {
  let merged = { ...DEFAULTS.tolerances }

  if (typeof process !== 'undefined' && process.versions?.node && baselineRoot) {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const candidates = [
      join(baselineRoot, 'tolerances.json'),
      variant ? join(baselineRoot, variant, 'tolerances.json') : null,
      variant && view ? join(baselineRoot, variant, view, 'tolerances.json') : null,
    ].filter(Boolean)

    for (const p of candidates) {
      try {
        const raw = await readFile(p, 'utf8')
        const parsed = JSON.parse(raw)
        merged = { ...merged, ...parsed }
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err
      }
    }
  }

  if (overrideTolerances && typeof overrideTolerances === 'object') {
    merged = { ...merged, ...overrideTolerances }
  }

  return validateTolerances(merged)
}

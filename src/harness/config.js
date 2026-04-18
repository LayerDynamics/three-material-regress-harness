// Harness config — merges CLI argv, env, and defaults into a HarnessConfig.
// Node-only: loads commander lazily so browser-reachable callers never see it.

import { HarnessConfigError } from './exceptions.js'
import { validateTolerances } from './params.js'
import { DEFAULTS } from './defaults.js'

export { DEFAULTS }

const REPORT_FORMATS = new Set(['html', 'json', 'junit', 'all'])

function parseReportFormats(raw) {
  if (!raw) return [...DEFAULTS.report]
  const tokens = raw.split(',').map((s) => s.trim()).filter(Boolean)
  for (const t of tokens) {
    if (!REPORT_FORMATS.has(t)) {
      throw new HarnessConfigError(`--report: unknown format "${t}"; allowed: ${[...REPORT_FORMATS].join(',')}`)
    }
  }
  if (tokens.includes('all')) return ['html', 'json', 'junit']
  return tokens
}

function parseWorkers(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULTS.workers
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 64) {
    throw new HarnessConfigError(`--workers: expected integer 1..64, got ${JSON.stringify(raw)}`)
  }
  return n
}

function parseThreshold(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    throw new HarnessConfigError(`--threshold: expected non-negative number, got ${JSON.stringify(raw)}`)
  }
  return n
}

/**
 * Load a full HarnessConfig from (argv, env).
 *
 * @param {string[]} argv  argv[0] onward — excluding "node tmrh" header
 * @param {Record<string,string|undefined>} env
 * @returns {import('../../index.js').HarnessConfig}
 */
export async function loadConfig(argv = [], env = {}) {
  const { Command } = await import('commander')
  const cmd = new Command()
    .allowUnknownOption(true)
    .exitOverride()
    .option('--corpus <dir>')
    .option('--baseline <dir>')
    .option('--out <dir>')
    .option('--filter <glob>')
    .option('--workers <n>')
    .option('--threshold <n>')
    .option('--update-baselines', false)
    .option('--headed', false)
    .option('--report <formats>')
    .option('--verbose', false)
    .option('--watch', false)

  let opts = {}
  try {
    cmd.parse(['node', 'tmrh', ...argv])
    opts = cmd.opts()
  } catch (err) {
    throw new HarnessConfigError(`CLI parse error: ${err?.message ?? err}`, { cause: err })
  }

  const corpus = opts.corpus ?? env.TMRH_CORPUS ?? DEFAULTS.corpus
  const baseline = opts.baseline ?? env.TMRH_BASELINE ?? DEFAULTS.baseline
  const out = opts.out ?? env.TMRH_OUT ?? DEFAULTS.out
  const workers = parseWorkers(opts.workers ?? env.TMRH_WORKERS)
  const report = parseReportFormats(opts.report ?? env.TMRH_REPORT)
  const filter = opts.filter ?? env.TMRH_FILTER ?? DEFAULTS.filter

  const baseTolerances = { ...DEFAULTS.tolerances }
  const threshold = parseThreshold(opts.threshold ?? env.TMRH_THRESHOLD)
  if (threshold !== null) baseTolerances.rmse = threshold

  const tolerances = validateTolerances(baseTolerances)
  const updateBaselines = Boolean(opts.updateBaselines) || env.TMRH_UPDATE_BASELINES === '1'

  return {
    corpus: String(corpus),
    baseline: String(baseline),
    out: String(out),
    workers,
    report,
    filter: filter ? String(filter) : null,
    tolerances,
    updateBaselines,
    headed: Boolean(opts.headed) || env.TMRH_HEADED === '1',
    verbose: Boolean(opts.verbose) || env.TMRH_VERBOSE === '1',
    watch: Boolean(opts.watch) || env.TMRH_WATCH === '1',
  }
}

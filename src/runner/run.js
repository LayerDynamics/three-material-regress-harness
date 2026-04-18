// run() — orchestrates a regression pass. Node-only; uses Playwright to drive
// the browser app for actual captures. Captures are serialised across a pool
// of browser pages bounded by config.workers.

import { HarnessConfigError } from '../harness/exceptions.js'
import { validateTestManifest } from '../harness/params.js'
import { startTimer, stopTimer, summarise } from './duration.js'
import { runTest } from './test-runner.js'

/** Create a Harness-object façade that the CLI can keep alive across commands. */
export function createHarness(config) {
  if (!config) throw new HarnessConfigError('createHarness: config required')
  let stopped = false
  return {
    run: async () => {
      if (stopped) throw new HarnessConfigError('createHarness.run: already stopped')
      return run(config)
    },
    update: (patch) => {
      Object.assign(config, patch)
    },
    stop: async () => {
      stopped = true
    },
  }
}

/**
 * Node-side orchestrator.
 *
 * @param {import('../../index.js').HarnessConfig & { headed?: boolean, baseUrl?: string }} config
 */
export async function run(config) {
  const { chromium } = await import('playwright')
  const { readFile, mkdir, writeFile } = await import('node:fs/promises')
  const { resolve, join } = await import('node:path')

  const startedAt = new Date().toISOString()
  const overallTimer = startTimer()

  const corpusRoot = resolve(config.corpus)
  const baselineRoot = resolve(config.baseline)
  const runTag = `${startedAt.replace(/[:.]/g, '-')}-${await gitSha()}`
  const outRoot = resolve(config.out, runTag)

  const manifestPath = join(baselineRoot, 'manifest.json')
  let manifest
  try {
    const raw = await readFile(manifestPath, 'utf8')
    manifest = validateTestManifest(JSON.parse(raw))
  } catch (err) {
    throw new HarnessConfigError(
      `run: cannot read test manifest at ${manifestPath}: ${err?.message ?? err}`,
      { cause: err },
    )
  }

  const filter = config.filter ? new RegExp(globToRegex(config.filter)) : null
  const filtered = filter
    ? manifest.filter((t) => filter.test(t.id) || filter.test(t.variant) || filter.test(t.view))
    : manifest
  if (filtered.length === 0) {
    throw new HarnessConfigError(`run: no tests matched filter "${config.filter}"`)
  }

  await mkdir(join(outRoot, 'captures'), { recursive: true })
  await mkdir(join(outRoot, 'diffs'), { recursive: true })

  const browser = await chromium.launch({ headless: !config.headed })
  const baseUrl = config.baseUrl ?? process.env.EVTH_BASE_URL ?? 'http://127.0.0.1:4175'
  const workerLimit = Math.max(1, Math.min(config.workers ?? 4, 16))

  const pagePool = await Promise.all(
    Array.from({ length: workerLimit }, async () => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.goto(`${baseUrl}/`)
      return { ctx, page, busy: false }
    }),
  )

  const results = []
  const durations = []
  let passCount = 0
  let failCount = 0

  const claimPage = async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const free = pagePool.find((p) => !p.busy)
      if (free) {
        free.busy = true
        return free
      }
      await new Promise((r) => setTimeout(r, 25))
    }
  }

  const runOne = async (test) => {
    const entry = await claimPage()
    try {
      const controller = makePerPageController(entry.page)
      const deps = makeNodeDeps({ baselineRoot, corpusRoot, outRoot, tolerances: null })
      return await runTest(test, controller, deps)
    } finally {
      entry.busy = false
    }
  }

  try {
    const queue = [...filtered]
    const inFlight = new Set()

    const onSettled = (r) => {
      results.push(r)
      durations.push(r.durationMs ?? 0)
      if (r.verdict === 'pass') passCount++
      else failCount++
    }

    const spawn = () => {
      while (inFlight.size < workerLimit && queue.length > 0) {
        const t = queue.shift()
        const p = runOne(t)
          .then(onSettled)
          .catch((err) => onSettled({
            testId: t.id,
            verdict: 'fail',
            diff: {
              id: `diff-${t.id}`,
              testId: t.id,
              rmse: Infinity,
              maxChannelDiff: 255,
              pixelMismatchPct: 100,
              ssim: 0,
              ssimPerTile: [],
              verdict: 'fail',
            },
            durationMs: 0,
            candidatePath: '',
            referencePath: t.referenceImagePath,
            error: err?.message ?? String(err),
          }))
          .finally(() => {
            inFlight.delete(p)
            spawn()
          })
        inFlight.add(p)
      }
    }

    spawn()
    while (inFlight.size > 0) {
      await Promise.race(inFlight)
    }
  } finally {
    for (const { ctx } of pagePool) {
      try { await ctx.close() } catch { /* noop */ }
    }
    await browser.close()
  }

  const completedAt = new Date().toISOString()
  stopTimer(overallTimer)

  const report = {
    startedAt,
    completedAt,
    gitSha: await gitSha(),
    three: await readPeerVersion('three'),
    r3f: await readPeerVersion('@react-three/fiber'),
    node: process.version,
    gpu: 'browser',
    testCount: results.length,
    passCount,
    failCount,
    results,
    meta: {
      configUsed: config,
      tolerances: config.tolerances,
      corpusHash: await hashPath(corpusRoot),
      baselineHash: await hashPath(baselineRoot),
      durationSummary: summarise(durations),
    },
  }

  await writeFile(join(outRoot, 'report.json'), JSON.stringify(report, null, 2))
  return report
}

const makePerPageController = (page) => ({
  enqueue: async (spec) => {
    const captured = await page.evaluate(async (s) => {
      const mod = await import('/src/index.js')
      const h = new mod.Harness({
        materialDefinition: s.materialDefinition,
        geometry: s.geometry,
        pose: s.pose,
        environment: s.environment ?? null,
        testId: s.testId,
      })
      try {
        const r = await h.capture()
        return {
          id: r.id,
          testId: r.testId,
          width: r.width,
          height: r.height,
          pixels: Array.from(r.pixels),
          meta: r.meta,
        }
      } finally {
        h.dispose()
      }
    }, spec)
    return { ...captured, pixels: new Uint8Array(captured.pixels) }
  },
  flush: async () => {},
  abort: () => {},
})

const makeNodeDeps = ({ baselineRoot, corpusRoot, outRoot, tolerances }) => {
  const readPoseJson = async (test) => {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    return JSON.parse(await readFile(resolve(baselineRoot, test.posePath), 'utf8'))
  }

  const readReferenceBytes = async (test) => {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    return new Uint8Array(await readFile(resolve(baselineRoot, test.referenceImagePath)))
  }

  const resolveMaterial = async (test) => {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    if (test.materialDefinitionPath) {
      return JSON.parse(await readFile(resolve(corpusRoot, test.materialDefinitionPath), 'utf8'))
    }
    if (test.kmpPath) {
      let kmpSuite
      try { kmpSuite = await import('kmp-three-suite') } catch {
        throw new HarnessConfigError(
          `runTest(${test.id}): test.kmpPath set but kmp-three-suite peer dependency is not installed.`,
        )
      }
      const bytes = new Uint8Array(await readFile(resolve(corpusRoot, test.kmpPath)))
      const results = await kmpSuite.process(bytes, { includeHexDump: false, includeCoverage: false })
      if (!results.length) throw new HarnessConfigError(`runTest(${test.id}): kmp produced no materials`)
      return kmpSuite.toMaterialDefinitionOnly
        ? kmpSuite.toMaterialDefinitionOnly(results[0])
        : results[0].materialDefinition
    }
    throw new HarnessConfigError(`runTest(${test.id}): neither materialDefinitionPath nor kmpPath set`)
  }

  const resolveGeometry = async (test) => {
    if (test.geometryPath) return { kind: 'url', url: test.geometryPath }
    return { type: 'sphere', radius: 1, widthSegments: 64, heightSegments: 64 }
  }

  const writeCandidate = async (capture) => {
    const { writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { encodePng } = await import('../recorder/png.js')
    const bytes = await encodePng(capture.pixels, capture.width, capture.height, { flipY: true })
    const abs = join(outRoot, 'captures', `${capture.testId ?? capture.id}.png`.replace(/[^\w.-]/g, '_'))
    await writeFile(abs, bytes)
    return abs
  }

  const writeDiff = async (bytes, testId) => {
    const { writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const abs = join(outRoot, 'diffs', `${testId}.diff.png`.replace(/[^\w.-]/g, '_'))
    await writeFile(abs, bytes)
    return abs
  }

  return {
    baselineRoot,
    corpusRoot,
    outDir: outRoot,
    tolerances,
    resolveMaterial,
    resolveGeometry,
    readReferenceBytes,
    readPoseJson,
    writeCandidate,
    writeDiff,
  }
}

const gitSha = async () => {
  try {
    const { execSync } = await import('node:child_process')
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'no-git'
  }
}

const readPeerVersion = async (name) => {
  try {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const pkgPath = resolve(process.cwd(), 'node_modules', name, 'package.json')
    return JSON.parse(await readFile(pkgPath, 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const hashPath = async (path) => {
  try {
    const { createHash } = await import('node:crypto')
    const { stat } = await import('node:fs/promises')
    const s = await stat(path)
    return createHash('sha1').update(`${path}-${s.mtimeMs}-${s.size}`).digest('hex').slice(0, 12)
  } catch {
    return 'unknown'
  }
}

const globToRegex = (glob) =>
  '^' + glob.replace(/([.+^$|()\[\]{}])/g, '\\$1').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'

export { runTest }

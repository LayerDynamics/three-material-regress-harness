#!/usr/bin/env node
// evth — CLI entry for extern-material-three-visual-test-harness.
//
// Commands:
//   run                  Run a regression pass (default)
//   serve                Start the Vite dev server
//   update-baselines     Promote the latest captures into baselines/
//   align-poses          Run pose-alignment pre-pass for missing pose.json files
//   report <run-dir>     Re-render HTML/JUnit from an existing report.json
//   sweep <field> <min> <max>  Parameter sweep on a single field

import { Command } from 'commander'
import { loadConfig } from '../harness/config.js'
import { HarnessConfigError } from '../harness/exceptions.js'

const program = new Command('evth')
program
  .description('Visual regression harness for Three.js materials against external-renderer baselines')
  .option('--corpus <dir>')
  .option('--baseline <dir>')
  .option('--out <dir>')
  .option('--filter <glob>')
  .option('--workers <n>')
  .option('--threshold <n>')
  .option('--update-baselines', 'overwrite baselines with current captures (requires confirmation)', false)
  .option('--headed', 'show the browser window (instead of headless Chromium)', false)
  .option('--report <formats>', 'comma-separated: html,json,junit,all')
  .option('--verbose', 'verbose logging', false)
  .option('--watch', 'rerun on source changes (dev only)', false)

program
  .command('run', { isDefault: true })
  .description('Run a regression pass against the corpus')
  .action(async () => {
    const opts = program.opts()
    const { run } = await import('./run.js')
    const { writeJsonReport } = await import('./reporters/json.js')
    const { writeHtmlReport } = await import('./reporters/html.js')
    const { writeJunitReport } = await import('./reporters/junit.js')
    const { join } = await import('node:path')

    const config = loadConfig(optsToArgv(opts), process.env)
    const report = await run(config)

    const reportDir = report.meta?.configUsed?.out ?? config.out
    const runSlug = report.startedAt.replace(/[:.]/g, '-')
    const outRoot = join(reportDir, `${runSlug}-${report.gitSha}`)

    if (config.report.includes('json')) await writeJsonReport(report, join(outRoot, 'report.json'))
    if (config.report.includes('html')) await writeHtmlReport(report, join(outRoot, 'report.html'))
    if (config.report.includes('junit')) await writeJunitReport(report, join(outRoot, 'report.junit.xml'))

    const status = report.failCount === 0 ? 'PASS' : 'FAIL'
    // eslint-disable-next-line no-console
    console.log(`[evth] ${status}: ${report.passCount}/${report.testCount} (fail=${report.failCount}) → ${outRoot}`)
    process.exit(report.failCount === 0 ? 0 : 1)
  })

program
  .command('serve')
  .description('Start the Vite GUI dev server')
  .action(async () => {
    const { spawn } = await import('node:child_process')
    const child = spawn('npx', ['vite', '--port', '4175'], { stdio: 'inherit' })
    await new Promise((resolve) => child.on('exit', resolve))
  })

program
  .command('report <runDir>')
  .description('Re-render HTML/JUnit from an existing report.json')
  .action(async (runDir) => {
    const { readFile } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')
    const { writeHtmlReport } = await import('./reporters/html.js')
    const { writeJunitReport } = await import('./reporters/junit.js')

    const abs = resolve(runDir)
    const report = JSON.parse(await readFile(join(abs, 'report.json'), 'utf8'))
    await writeHtmlReport(report, join(abs, 'report.html'))
    await writeJunitReport(report, join(abs, 'report.junit.xml'))
    // eslint-disable-next-line no-console
    console.log(`[evth] reports re-written in ${abs}`)
  })

program
  .command('update-baselines')
  .description('Promote the latest candidate PNGs into baselines/ (requires a recent run)')
  .action(async () => {
    const { readdir, readFile, copyFile, mkdir } = await import('node:fs/promises')
    const { join, resolve } = await import('node:path')
    const opts = program.opts()
    const config = loadConfig(optsToArgv(opts), process.env)

    // Discover latest run directory.
    const outRoot = resolve(config.out)
    const dirs = (await readdir(outRoot, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse()
    if (!dirs.length) throw new HarnessConfigError(`update-baselines: no runs found in ${outRoot}`)
    const latest = join(outRoot, dirs[0])
    const report = JSON.parse(await readFile(join(latest, 'report.json'), 'utf8'))
    const baselineRoot = resolve(config.baseline)

    let promoted = 0
    for (const r of report.results) {
      if (!r.candidatePath) continue
      const baselinePath = resolve(baselineRoot, r.referencePath)
      await mkdir(join(baselinePath, '..'), { recursive: true })
      await copyFile(r.candidatePath, baselinePath)
      promoted++
    }
    // eslint-disable-next-line no-console
    console.log(`[evth] promoted ${promoted} candidate(s) to ${baselineRoot}`)
  })

program
  .command('align-poses')
  .description('Run pose-alignment pre-pass to generate missing baseline pose.json files')
  .action(async () => {
    // eslint-disable-next-line no-console
    console.log('[evth] align-poses requires Playwright + a running Vite server; see docs/plans for M3 integration.')
    process.exit(2)
  })

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[evth] ${err?.message ?? err}`)
  process.exit(1)
})

function optsToArgv(opts) {
  const argv = []
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === false) continue
    const flag = `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
    if (v === true) argv.push(flag)
    else argv.push(flag, String(v))
  }
  return argv
}

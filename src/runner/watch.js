// Watch mode — re-run affected regression tests when source files change.
// Node-only (uses chokidar). The browser build never imports this module.

import { loadConfig } from '../harness/config.js'

/**
 * Start watch mode. Returns a handle with a stop() method.
 *
 * @param {import('../../index.js').HarnessConfig} config
 * @param {(config: import('../../index.js').HarnessConfig) => Promise<void>} runFn
 * @param {{debounceMs?: number, extraPaths?: string[]}} [opts]
 */
export async function startWatch(config, runFn, opts = {}) {
  const { default: chokidar } = await import('chokidar')
  const { resolve } = await import('node:path')

  const paths = [
    resolve(config.corpus),
    resolve(config.baseline),
    resolve('src'),
    ...(opts.extraPaths ?? []),
  ]
  const debounceMs = opts.debounceMs ?? 500

  const watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    ignored: [/node_modules/, /(^|[\/\\])\../, /out[\/\\]/, /dist[\/\\]/],
  })

  let pending = null
  let running = false
  let stopped = false

  const kick = () => {
    if (stopped) return
    clearTimeout(pending)
    pending = setTimeout(async () => {
      if (running) return
      running = true
      try {
        // Rebuild config (tolerances etc. might have changed on disk).
        const fresh = await loadConfig([], process.env)
        const merged = { ...config, ...fresh, corpus: config.corpus, baseline: config.baseline, out: config.out }
        await runFn(merged)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[tmrh watch] run failed: ${err?.message ?? err}`)
      } finally {
        running = false
      }
    }, debounceMs)
  }

  watcher.on('add', kick)
  watcher.on('change', kick)
  watcher.on('unlink', kick)

  return {
    stop: async () => {
      stopped = true
      clearTimeout(pending)
      await watcher.close()
    },
  }
}

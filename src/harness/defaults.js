// Compile-time defaults — dependency-free so it's safe to import from browser code.

export const DEFAULTS = Object.freeze({
  corpus: './samples-to-match-identically-kmp-files',
  baseline: './baselines',
  out: './out/runs',
  workers: 4,
  report: ['json', 'html', 'junit'],
  tolerances: Object.freeze({
    rmse: 0.5,
    pixelMismatchPct: 0.5,
    ssim: 0.005,
    maxChannelDiff: 10,
    silhouetteOnly: true,
  }),
  updateBaselines: false,
  filter: null,
})

import { create } from 'zustand'

const defaultTolerances = () => ({
  rmse: 0.5,
  pixelMismatchPct: 0.5,
  ssim: 0.005,
  maxChannelDiff: 10,
  silhouetteOnly: true,
})

const initial = () => ({
  baselines: new Map(),
  tolerances: defaultTolerances(),
  current: null,
})

export const useRegressionStore = create((set) => ({
  ...initial(),
  setBaseline(testId, diff) {
    if (!testId) throw new Error('setBaseline: testId required')
    set((s) => {
      const next = new Map(s.baselines)
      next.set(testId, diff)
      return { baselines: next }
    })
  },
  getBaseline(testId) {
    return useRegressionStore.getState().baselines.get(testId) ?? null
  },
  setCurrent(diff) {
    set({ current: diff })
  },
  setTolerances(t) {
    if (!t || typeof t !== 'object') throw new Error('setTolerances: expected object')
    set((s) => ({ tolerances: { ...s.tolerances, ...t } }))
  },
  reset() {
    set(initial())
  },
}))

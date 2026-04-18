import { create } from 'zustand'

const MODES = new Set(['browser', 'headless'])

const initial = {
  mode: 'browser',
  activeTestId: null,
  runHistory: [],
  selectedBaseline: null,
  events: [],
}

export const useHarnessStore = create((set) => ({
  ...initial,
  setMode(m) {
    if (!MODES.has(m)) throw new Error(`invalid mode: ${m}`)
    set({ mode: m })
  },
  setActiveTest(id) {
    if (id !== null && typeof id !== 'string') throw new Error('activeTestId: expected string or null')
    set({ activeTestId: id })
  },
  pushRun(report) {
    if (!report || typeof report !== 'object') throw new Error('pushRun: expected RegressionReport')
    set((s) => ({ runHistory: [...s.runHistory, report] }))
  },
  pushEvent(event) {
    set((s) => ({ events: [...s.events, { ...event, ts: Date.now() }] }))
  },
  selectBaseline(path) {
    if (path !== null && typeof path !== 'string') throw new Error('selectedBaseline: expected string or null')
    set({ selectedBaseline: path })
  },
  reset() {
    set({ ...initial, runHistory: [], events: [] })
  },
}))

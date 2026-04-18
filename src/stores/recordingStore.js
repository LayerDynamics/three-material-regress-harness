import { create } from 'zustand'

const initial = () => ({
  queued: [],
  inFlight: null,
  completed: new Map(),
})

export const useRecordingStore = create((set) => ({
  ...initial(),
  enqueue(spec) {
    if (!spec?.testId) throw new Error('enqueue: spec.testId required')
    set((s) => ({ queued: [...s.queued, spec] }))
  },
  setInFlight(spec) {
    set({ inFlight: spec })
  },
  complete(id, blobUrl) {
    if (!id) throw new Error('complete: id required')
    set((s) => {
      const next = new Map(s.completed)
      next.set(id, blobUrl)
      const queued = s.queued.filter((q) => q.testId !== id)
      return { completed: next, queued, inFlight: s.inFlight?.testId === id ? null : s.inFlight }
    })
  },
  getBlob(id) {
    const s = useRecordingStore.getState()
    return s.completed.get(id) ?? null
  },
  clear() {
    set(initial())
  },
}))

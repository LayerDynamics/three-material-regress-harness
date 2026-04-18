import { create } from 'zustand'

const initial = () => ({
  pending: [],
  saved: [],
})

export const useScreenshotStore = create((set) => ({
  ...initial(),
  addPending(id) {
    if (!id) throw new Error('addPending: id required')
    set((s) => ({ pending: [...s.pending, id] }))
  },
  markSaved(id, path) {
    if (!id) throw new Error('markSaved: id required')
    if (typeof path !== 'string') throw new Error('markSaved: path required')
    set((s) => ({
      pending: s.pending.filter((p) => p !== id),
      saved: [...s.saved, { id, path }],
    }))
  },
  reset() {
    set(initial())
  },
}))

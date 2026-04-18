import { create } from 'zustand'
import { validateTestManifest } from '../harness/params.js'

const initial = () => ({
  corpusDir: null,
  manifest: [],
})

export const useTestStore = create((set) => ({
  ...initial(),
  setCorpus(dir, manifest) {
    if (typeof dir !== 'string') throw new Error('corpusDir: expected string')
    const validated = validateTestManifest(manifest)
    set({ corpusDir: dir, manifest: validated })
  },
  reset() {
    set(initial())
  },
}))

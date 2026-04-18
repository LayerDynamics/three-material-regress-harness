import { create } from 'zustand'

const TONE_MAPS = new Set([
  'NoToneMapping', 'LinearToneMapping', 'ReinhardToneMapping',
  'ACESFilmicToneMapping', 'CineonToneMapping', 'AgXToneMapping', 'NeutralToneMapping',
])

const initial = {
  width: 1024,
  height: 1024,
  dpr: 1,
  camera: {
    position: [0, 0, 3],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: 45,
  },
  environment: 'studio_small_2k',
  toneMapping: 'NeutralToneMapping',
  exposure: 1.0,
  envIntensity: 1.0,
  geometryUrl: null,
  geometryKind: 'sphere',
  materialDefinition: null,
}

function isFiniteNumber(x) { return typeof x === 'number' && Number.isFinite(x) }
function isVec3(v) { return Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber) }

export const useRendererStore = create((set) => ({
  ...initial,
  setSize(width, height, dpr) {
    if (!Number.isInteger(width) || width < 16 || width > 16384) throw new Error(`width out of range: ${width}`)
    if (!Number.isInteger(height) || height < 16 || height > 16384) throw new Error(`height out of range: ${height}`)
    const nextDpr = isFiniteNumber(dpr) ? dpr : 1
    if (nextDpr < 0.25 || nextDpr > 4) throw new Error(`dpr out of range: ${nextDpr}`)
    set({ width, height, dpr: nextDpr })
  },
  setCamera(next) {
    const merged = { ...initial.camera }
    if (next.position) {
      if (!isVec3(next.position)) throw new Error('camera.position: expected [x,y,z]')
      merged.position = [...next.position]
    }
    if (next.target) {
      if (!isVec3(next.target)) throw new Error('camera.target: expected [x,y,z]')
      merged.target = [...next.target]
    }
    if (next.up) {
      if (!isVec3(next.up)) throw new Error('camera.up: expected [x,y,z]')
      merged.up = [...next.up]
    }
    if (next.fov !== undefined) {
      if (!isFiniteNumber(next.fov) || next.fov < 1 || next.fov > 179) throw new Error(`camera.fov out of range: ${next.fov}`)
      merged.fov = next.fov
    }
    set({ camera: merged })
  },
  setEnvironment(env, { toneMapping, exposure, envIntensity } = {}) {
    const patch = { environment: env }
    if (toneMapping !== undefined) {
      if (!TONE_MAPS.has(toneMapping)) throw new Error(`toneMapping: unknown "${toneMapping}"`)
      patch.toneMapping = toneMapping
    }
    if (exposure !== undefined) {
      if (!isFiniteNumber(exposure)) throw new Error('exposure: expected number')
      patch.exposure = exposure
    }
    if (envIntensity !== undefined) {
      if (!isFiniteNumber(envIntensity)) throw new Error('envIntensity: expected number')
      patch.envIntensity = envIntensity
    }
    set(patch)
  },
  setGeometry(kind, url) {
    if (typeof kind !== 'string') throw new Error('geometryKind: expected string')
    if (url !== null && url !== undefined && typeof url !== 'string') throw new Error('geometryUrl: expected string or null')
    set({ geometryKind: kind, geometryUrl: url ?? null })
  },
  setMaterialDefinition(def) {
    if (def !== null && (typeof def !== 'object' || Array.isArray(def))) {
      throw new Error('materialDefinition: expected object or null')
    }
    set({ materialDefinition: def })
  },
  reset() {
    set({ ...initial })
  },
}))

// Pose + Test + Tolerance validators. Implemented in M1 (T09).

import { HarnessConfigError } from './exceptions.js'

function isFiniteNumber(x) { return typeof x === 'number' && Number.isFinite(x) }

function requireVec3(obj, key) {
  const v = obj[key]
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) {
    throw new HarnessConfigError(`${key}: expected [x, y, z] number tuple, got ${JSON.stringify(v)}`)
  }
  return [v[0], v[1], v[2]]
}

function requireInt(obj, key, { min = -Infinity, max = Infinity } = {}) {
  const v = obj[key]
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new HarnessConfigError(`${key}: expected integer in [${min}, ${max}], got ${JSON.stringify(v)}`)
  }
  return v
}

function requireNumber(obj, key, { min = -Infinity, max = Infinity } = {}) {
  const v = obj[key]
  if (!isFiniteNumber(v) || v < min || v > max) {
    throw new HarnessConfigError(`${key}: expected finite number in (${min}, ${max}), got ${JSON.stringify(v)}`)
  }
  return v
}

function optionalString(obj, key) {
  const v = obj[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') throw new HarnessConfigError(`${key}: expected string, got ${typeof v}`)
  return v
}

const TONE_MAPS = new Set([
  'NoToneMapping', 'LinearToneMapping', 'ReinhardToneMapping',
  'ACESFilmicToneMapping', 'CineonToneMapping', 'AgXToneMapping', 'NeutralToneMapping',
])

export function validatePoseManifest(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new HarnessConfigError('pose manifest must be an object')
  }
  const out = {
    cameraPosition: requireVec3(json, 'cameraPosition'),
    cameraTarget: requireVec3(json, 'cameraTarget'),
    cameraUp: requireVec3(json, 'cameraUp'),
    cameraFov: requireNumber(json, 'cameraFov', { min: 1, max: 179 }),
    imageWidth: requireInt(json, 'imageWidth', { min: 16, max: 16384 }),
    imageHeight: requireInt(json, 'imageHeight', { min: 16, max: 16384 }),
    dpr: isFiniteNumber(json.dpr) ? json.dpr : 1,
  }

  if (json.environment !== undefined && json.environment !== null) {
    if (typeof json.environment === 'string') {
      out.environment = json.environment
    } else if (typeof json.environment === 'object') {
      const hdri = optionalString(json.environment, 'hdri')
      if (!hdri) throw new HarnessConfigError('environment.hdri: required when environment is an object')
      const env = { hdri }
      if (isFiniteNumber(json.environment.exposure)) env.exposure = json.environment.exposure
      if (isFiniteNumber(json.environment.envIntensity)) env.envIntensity = json.environment.envIntensity
      out.environment = env
    } else {
      throw new HarnessConfigError(`environment: expected string or { hdri } object, got ${typeof json.environment}`)
    }
  }

  if (json.toneMapping !== undefined) {
    if (!TONE_MAPS.has(json.toneMapping)) {
      throw new HarnessConfigError(`toneMapping: unknown "${json.toneMapping}"; allowed: ${Array.from(TONE_MAPS).join(', ')}`)
    }
    out.toneMapping = json.toneMapping
  }

  const bg = optionalString(json, 'background')
  if (bg !== undefined) out.background = bg

  if (out.dpr < 0.25 || out.dpr > 4) {
    throw new HarnessConfigError(`dpr: expected 0.25..4, got ${out.dpr}`)
  }

  return out
}

export function validateTestManifest(json) {
  if (!Array.isArray(json)) {
    throw new HarnessConfigError('test manifest must be an array')
  }
  return json.map((t, idx) => {
    if (!t || typeof t !== 'object') {
      throw new HarnessConfigError(`test[${idx}]: expected object`)
    }
    const id = optionalString(t, 'id')
    if (!id) throw new HarnessConfigError(`test[${idx}].id: required string`)
    const variant = optionalString(t, 'variant')
    if (!variant) throw new HarnessConfigError(`test[${idx}].variant: required string`)
    const view = optionalString(t, 'view')
    if (!view) throw new HarnessConfigError(`test[${idx}].view: required string`)
    const posePath = optionalString(t, 'posePath')
    if (!posePath) throw new HarnessConfigError(`test[${idx}].posePath: required string`)
    const referenceImagePath = optionalString(t, 'referenceImagePath')
    if (!referenceImagePath) throw new HarnessConfigError(`test[${idx}].referenceImagePath: required string`)

    return {
      id,
      variant,
      view,
      posePath,
      referenceImagePath,
      kmpPath: optionalString(t, 'kmpPath'),
      materialDefinitionPath: optionalString(t, 'materialDefinitionPath'),
      geometryPath: optionalString(t, 'geometryPath'),
      tolerancesPath: optionalString(t, 'tolerancesPath'),
    }
  })
}

export function validateTolerances(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new HarnessConfigError('tolerances must be an object')
  }
  const out = {
    rmse: isFiniteNumber(json.rmse) ? json.rmse : 0.5,
    pixelMismatchPct: isFiniteNumber(json.pixelMismatchPct) ? json.pixelMismatchPct : 0.5,
    ssim: isFiniteNumber(json.ssim) ? json.ssim : 0.005,
    maxChannelDiff: Number.isInteger(json.maxChannelDiff) ? json.maxChannelDiff : 10,
    silhouetteOnly: typeof json.silhouetteOnly === 'boolean' ? json.silhouetteOnly : true,
  }
  if (out.rmse < 0) throw new HarnessConfigError(`tolerances.rmse: must be >= 0`)
  if (out.pixelMismatchPct < 0 || out.pixelMismatchPct > 100) {
    throw new HarnessConfigError(`tolerances.pixelMismatchPct: must be 0..100`)
  }
  if (out.ssim < 0 || out.ssim > 1) throw new HarnessConfigError(`tolerances.ssim: must be 0..1`)
  if (out.maxChannelDiff < 0 || out.maxChannelDiff > 255) {
    throw new HarnessConfigError(`tolerances.maxChannelDiff: must be 0..255`)
  }
  return out
}

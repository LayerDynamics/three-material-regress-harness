import { describe, it, expect } from 'vitest'
import { validatePoseManifest, validateTestManifest, validateTolerances } from '../src/harness/params.js'
import { HarnessConfigError } from '../src/harness/exceptions.js'

describe('validatePoseManifest', () => {
  const minimal = {
    cameraPosition: [0, 0, 3],
    cameraTarget: [0, 0, 0],
    cameraUp: [0, 1, 0],
    cameraFov: 45,
    imageWidth: 128,
    imageHeight: 128,
  }

  it('accepts minimal valid', () => {
    const p = validatePoseManifest(minimal)
    expect(p.dpr).toBe(1)
    expect(p.cameraPosition).toEqual([0, 0, 3])
  })

  it('rejects non-object', () => {
    expect(() => validatePoseManifest(null)).toThrow(HarnessConfigError)
    expect(() => validatePoseManifest([])).toThrow(HarnessConfigError)
  })

  it('rejects missing camera', () => {
    expect(() => validatePoseManifest({})).toThrow(/cameraPosition/)
  })

  it('rejects FOV out of range', () => {
    expect(() => validatePoseManifest({ ...minimal, cameraFov: 0 })).toThrow(/cameraFov/)
    expect(() => validatePoseManifest({ ...minimal, cameraFov: 200 })).toThrow(/cameraFov/)
  })

  it('rejects non-finite vector', () => {
    expect(() => validatePoseManifest({ ...minimal, cameraPosition: [0, NaN, 0] })).toThrow(/cameraPosition/)
  })

  it('accepts string environment', () => {
    const p = validatePoseManifest({ ...minimal, environment: 'studio_small_2k' })
    expect(p.environment).toBe('studio_small_2k')
  })

  it('accepts object environment with hdri', () => {
    const p = validatePoseManifest({ ...minimal, environment: { hdri: 'x.hdr', exposure: 2, envIntensity: 1.2 } })
    expect(p.environment.exposure).toBe(2)
  })

  it('rejects environment object without hdri', () => {
    expect(() => validatePoseManifest({ ...minimal, environment: { exposure: 1 } })).toThrow(/environment\.hdri/)
  })

  it('rejects unknown toneMapping', () => {
    expect(() => validatePoseManifest({ ...minimal, toneMapping: 'zzz' })).toThrow(/toneMapping/)
  })

  it('rejects dpr out of range', () => {
    expect(() => validatePoseManifest({ ...minimal, dpr: 0.1 })).toThrow(/dpr/)
    expect(() => validatePoseManifest({ ...minimal, dpr: 5 })).toThrow(/dpr/)
  })
})

describe('validateTestManifest', () => {
  const oneTest = {
    id: 't1', variant: 'Toon', view: 'A',
    posePath: 'baselines/Toon/A/pose.json',
    referenceImagePath: 'baselines/Toon/A/ref.png',
  }

  it('rejects non-array', () => {
    expect(() => validateTestManifest({})).toThrow(/array/)
  })

  it('accepts minimal', () => {
    const m = validateTestManifest([oneTest])
    expect(m[0].id).toBe('t1')
  })

  it('rejects missing id', () => {
    expect(() => validateTestManifest([{ ...oneTest, id: undefined }])).toThrow(/id/)
  })

  it('rejects missing referenceImagePath', () => {
    expect(() => validateTestManifest([{ ...oneTest, referenceImagePath: undefined }])).toThrow(/referenceImagePath/)
  })
})

describe('validateTolerances', () => {
  it('fills defaults for missing keys', () => {
    const t = validateTolerances({})
    expect(t.rmse).toBe(0.5)
    expect(t.ssim).toBe(0.005)
    expect(t.silhouetteOnly).toBe(true)
    expect(t.maxChannelDiff).toBe(10)
  })

  it('rejects invalid rmse', () => {
    expect(() => validateTolerances({ rmse: -1 })).toThrow(/rmse/)
  })

  it('rejects pixelMismatchPct out of range', () => {
    expect(() => validateTolerances({ pixelMismatchPct: 200 })).toThrow(/pixelMismatchPct/)
  })
})

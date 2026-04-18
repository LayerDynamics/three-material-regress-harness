import { describe, it, expect } from 'vitest'
import * as api from '../src/index.js'

const EXPECTED = [
  'createHarness', 'Harness', 'HarnessController',
  'recordCapture', 'getRecordingBlob',
  'diffImages', 'makeDiffPng',
  'runTest', 'run',
  'HarnessConfigError', 'PoseAlignmentError', 'CaptureTimeoutError',
  'BaselineMissingError', 'ToleranceExceededError', 'ShaderRegistrationError',
  'useHarnessStore', 'useRendererStore', 'useRecordingStore',
  'useRegressionStore', 'useScreenshotStore', 'useTestStore',
  'registerShaderType', 'getShaderTypeHandler', 'hasCustomShaderType',
  'getRegisteredShaderTypes', 'disposeAllShaderTypes',
  'App', 'Renderer', 'Material', 'Scene',
  'schema',
]

describe('public API surface', () => {
  for (const name of EXPECTED) {
    it(`exports ${name}`, () => {
      expect(api[name]).toBeDefined()
    })
  }

  it('schema exposes the three validators', () => {
    expect(typeof api.schema.validatePoseManifest).toBe('function')
    expect(typeof api.schema.validateTestManifest).toBe('function')
    expect(typeof api.schema.validateTolerances).toBe('function')
  })

  it('error classes extend Error and carry a code', () => {
    const samples = [
      new api.HarnessConfigError('x'),
      new api.PoseAlignmentError('x'),
      new api.CaptureTimeoutError('x'),
      new api.BaselineMissingError('x'),
      new api.ToleranceExceededError('x'),
      new api.ShaderRegistrationError('x'),
    ]
    for (const e of samples) {
      expect(e).toBeInstanceOf(Error)
      expect(typeof e.code).toBe('string')
      expect(e.code).toBe(e.name)
    }
  })
})

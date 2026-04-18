import { describe, it, expect } from 'vitest'
import {
  HarnessConfigError,
  PoseAlignmentError,
  CaptureTimeoutError,
  BaselineMissingError,
  ToleranceExceededError,
  ShaderRegistrationError,
} from '../src/harness/exceptions.js'

describe('typed errors', () => {
  const classes = [
    ['HarnessConfigError', HarnessConfigError],
    ['PoseAlignmentError', PoseAlignmentError],
    ['CaptureTimeoutError', CaptureTimeoutError],
    ['BaselineMissingError', BaselineMissingError],
    ['ToleranceExceededError', ToleranceExceededError],
    ['ShaderRegistrationError', ShaderRegistrationError],
  ]

  for (const [name, Cls] of classes) {
    it(`${name}: extends Error with code=${name}`, () => {
      const e = new Cls('boom')
      expect(e).toBeInstanceOf(Error)
      expect(e.name).toBe(name)
      expect(e.code).toBe(name)
      expect(e.message).toBe('boom')
    })

    it(`${name}: carries cause`, () => {
      const cause = new Error('root')
      const e = new Cls('wrapped', { cause })
      expect(e.cause).toBe(cause)
    })
  }
})

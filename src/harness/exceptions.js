// Typed errors for the harness. Fully implemented (not stubs).

class CodedError extends Error {
  constructor(code, message, options) {
    super(message, options)
    this.name = code
    this.code = code
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

export class HarnessConfigError extends CodedError {
  constructor(message, options) { super('HarnessConfigError', message, options) }
}

export class PoseAlignmentError extends CodedError {
  constructor(message, options) { super('PoseAlignmentError', message, options) }
}

export class CaptureTimeoutError extends CodedError {
  constructor(message, options) { super('CaptureTimeoutError', message, options) }
}

export class BaselineMissingError extends CodedError {
  constructor(message, options) { super('BaselineMissingError', message, options) }
}

export class ToleranceExceededError extends CodedError {
  constructor(message, options) { super('ToleranceExceededError', message, options) }
}

export class ShaderRegistrationError extends CodedError {
  constructor(message, options) { super('ShaderRegistrationError', message, options) }
}

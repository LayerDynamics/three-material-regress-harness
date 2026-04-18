// Harness — single-capture lifecycle wrapper. Implemented in M2 (T24).
// This module exports the Harness class; the runtime body is installed when
// T24 completes. Calling methods before that throws so it is impossible to
// silently observe wrong behaviour.

const NOT_READY = 'evth: Harness runtime is wired in milestone M2 (task T24). Call site must wait for the capture pipeline milestone.'

export class Harness {
  constructor(_opts) {
    throw new Error(NOT_READY)
  }
  capture() {
    throw new Error(NOT_READY)
  }
  dispose() {
    throw new Error(NOT_READY)
  }
}

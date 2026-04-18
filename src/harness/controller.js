// HarnessController — queued + retried captures. Implemented in M2 (T25).

const NOT_READY = 'evth: HarnessController runtime is wired in milestone M2 (task T25).'

export class HarnessController {
  constructor(_opts) {
    throw new Error(NOT_READY)
  }
  enqueue() { throw new Error(NOT_READY) }
  flush() { throw new Error(NOT_READY) }
  abort() { throw new Error(NOT_READY) }
}

// Recorder — PNG encode + blob storage. Implemented in M2 (T26).

const NOT_READY = 'evth: recorder runtime is wired in milestone M2 (task T26).'

export function recordCapture() {
  throw new Error(NOT_READY)
}

export function getRecordingBlob() {
  throw new Error(NOT_READY)
}

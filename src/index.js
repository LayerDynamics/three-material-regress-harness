// Public ESM surface for extern-material-three-visual-test-harness.
// Milestone 1 exports the contract shape. Internals are filled in per-milestone
// (see docs/plans/2026-04-18-extern-material-three-visual-test-harness-implementation.md).

// ── Harness lifecycle ────────────────────────────────────────────────────────
export { Harness } from './harness/harness.js'
export { HarnessController } from './harness/controller.js'

// ── Recorder + diff ──────────────────────────────────────────────────────────
export { recordCapture, getRecordingBlob } from './recorder/recorder.js'
export { diffImages, makeDiffPng } from './recorder/diff.js'

// ── Runner ───────────────────────────────────────────────────────────────────
export { runTest, run, createHarness } from './runner/index.js'

// ── Typed errors ─────────────────────────────────────────────────────────────
export {
  HarnessConfigError,
  PoseAlignmentError,
  CaptureTimeoutError,
  BaselineMissingError,
  ToleranceExceededError,
  ShaderRegistrationError,
} from './harness/exceptions.js'

// ── Zustand stores ───────────────────────────────────────────────────────────
export { useHarnessStore } from './stores/harnessStore.js'
export { useRendererStore } from './stores/rendererStore.js'
export { useRecordingStore } from './stores/recordingStore.js'
export { useRegressionStore } from './stores/regressionStore.js'
export { useScreenshotStore } from './stores/screenshotStore.js'
export { useTestStore } from './stores/testStore.js'

// ── Shader registry ──────────────────────────────────────────────────────────
export {
  registerShaderType,
  getShaderTypeHandler,
  hasCustomShaderType,
  getRegisteredShaderTypes,
  disposeAllShaderTypes,
} from './components/ShaderTypeRegistry.js'

// ── React components ─────────────────────────────────────────────────────────
export { App } from './components/App.jsx'
export { Renderer } from './components/Renderer.jsx'
export { Material } from './components/Material.jsx'
export { Scene } from './components/Scene.jsx'

// ── Schema validators ────────────────────────────────────────────────────────
export * as schema from './harness/params.js'

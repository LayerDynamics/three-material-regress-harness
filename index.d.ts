// extern-material-three-visual-test-harness — public surface.
// Hand-written, mirrors src/index.js. ESM only; no TypeScript compile step.

import type { FC, ReactNode } from 'react'

// ── Core types ───────────────────────────────────────────────────────────────

export type MaterialDefinition = Record<string, unknown> & {
  color?: string
  emissive?: string
  metalness?: number
  roughness?: number
  ior?: number
  transmission?: number
  opacity?: number
  transparent?: boolean
  side?: 'front' | 'back' | 'double'
  kmpShaderType?: string | null
  toonParams?: Record<string, unknown> | null
  carpaintParams?: Record<string, unknown> | null
  metalFlakeParams?: Record<string, unknown> | null
  sssParams?: Record<string, unknown> | null
}

export type ToneMapping =
  | 'NoToneMapping'
  | 'LinearToneMapping'
  | 'ReinhardToneMapping'
  | 'ACESFilmicToneMapping'
  | 'CineonToneMapping'
  | 'AgXToneMapping'
  | 'NeutralToneMapping'

export interface PoseManifest {
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  cameraUp: [number, number, number]
  cameraFov: number
  imageWidth: number
  imageHeight: number
  environment?: string | { hdri: string; exposure?: number; envIntensity?: number }
  toneMapping?: ToneMapping
  background?: string
  dpr?: number
}

export interface Test {
  id: string
  variant: string
  view: string
  kmpPath?: string
  materialDefinitionPath?: string
  geometryPath?: string
  posePath: string
  referenceImagePath: string
  tolerancesPath?: string
}

export type TestManifest = Test[]

export interface Tolerances {
  rmse: number
  pixelMismatchPct: number
  ssim: number
  maxChannelDiff: number
  silhouetteOnly: boolean
}

export interface HarnessConfig {
  corpus: string
  baseline: string
  out: string
  tolerances: Tolerances
  workers: number
  filter?: string | null
  updateBaselines: boolean
  report: Array<'html' | 'json' | 'junit'>
}

export interface CaptureResult {
  id: string
  testId: string
  pixels: Uint8Array
  width: number
  height: number
  meta: {
    materialDefinition: MaterialDefinition
    pose: PoseManifest
    geometryHash: string
    timestamp: string
    three: string
    r3f: string
    drei: string
    gpu: string
  }
}

export interface DiffResult {
  id: string
  testId: string
  rmse: number
  maxChannelDiff: number
  pixelMismatchPct: number
  ssim: number
  ssimPerTile: number[][]
  diffPngPath?: string
  verdict: 'pass' | 'fail' | 'warn'
  deltaVsBaseline?: DiffResult
}

export interface TestResult {
  testId: string
  verdict: 'pass' | 'fail' | 'warn'
  diff: DiffResult
  durationMs: number
  candidatePath: string
  referencePath: string
  diffPath?: string
}

export interface RegressionReport {
  startedAt: string
  completedAt: string
  gitSha: string
  three: string
  r3f: string
  node: string
  gpu: string
  testCount: number
  passCount: number
  failCount: number
  results: TestResult[]
  meta: {
    configUsed: HarnessConfig
    tolerances: Tolerances
    corpusHash: string
    baselineHash: string
  }
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class HarnessConfigError extends Error { readonly code: 'HarnessConfigError' }
export class PoseAlignmentError extends Error { readonly code: 'PoseAlignmentError' }
export class CaptureTimeoutError extends Error { readonly code: 'CaptureTimeoutError' }
export class BaselineMissingError extends Error { readonly code: 'BaselineMissingError' }
export class ToleranceExceededError extends Error { readonly code: 'ToleranceExceededError' }
export class ShaderRegistrationError extends Error { readonly code: 'ShaderRegistrationError' }

// ── Harness ──────────────────────────────────────────────────────────────────

export interface HarnessOptions {
  materialDefinition: MaterialDefinition
  geometry: unknown
  pose: PoseManifest
  environment?: PoseManifest['environment']
}

export class Harness {
  constructor(opts: HarnessOptions)
  capture(): Promise<CaptureResult>
  dispose(): void
}

export class HarnessController {
  constructor(opts?: { maxInFlight?: number; captureRetries?: number; captureTimeoutMs?: number })
  enqueue(spec: { materialDefinition: MaterialDefinition; pose: PoseManifest; testId: string; geometry?: unknown; environment?: PoseManifest['environment'] }): Promise<CaptureResult>
  flush(): Promise<void>
  abort(): void
}

export function createHarness(config: HarnessConfig): {
  run(): Promise<RegressionReport>
  update(config: Partial<HarnessConfig>): void
  stop(): Promise<void>
}

// ── Recorder + diff ──────────────────────────────────────────────────────────

export function recordCapture(result: CaptureResult, opts?: { outDir?: string }): Promise<string>
export function getRecordingBlob(id: string): Blob | null

export function diffImages(
  candidate: Uint8Array,
  reference: Uint8Array,
  opts?: Partial<Tolerances> & { width?: number; height?: number; silhouette?: Uint8Array | null },
): DiffResult

export function makeDiffPng(
  candidate: Uint8Array,
  reference: Uint8Array,
  opts?: { width?: number; height?: number },
): Uint8Array

// ── Runner ───────────────────────────────────────────────────────────────────

export function runTest(test: Test, controller: HarnessController, opts?: Partial<HarnessConfig>): Promise<TestResult>
export function run(config: HarnessConfig): Promise<RegressionReport>

// ── Stores ───────────────────────────────────────────────────────────────────

export function useHarnessStore<T = unknown>(selector?: (s: unknown) => T): T
export function useRendererStore<T = unknown>(selector?: (s: unknown) => T): T
export function useRecordingStore<T = unknown>(selector?: (s: unknown) => T): T
export function useRegressionStore<T = unknown>(selector?: (s: unknown) => T): T
export function useScreenshotStore<T = unknown>(selector?: (s: unknown) => T): T
export function useTestStore<T = unknown>(selector?: (s: unknown) => T): T

// ── Shader registry ──────────────────────────────────────────────────────────

export interface ShaderTypeHandler {
  createMaterial(def: MaterialDefinition, textures?: Map<string, unknown>): unknown
  updateMaterial(mat: unknown, def: MaterialDefinition, textures?: Map<string, unknown>): void
  dispose?(): void
}

export function registerShaderType(type: string, handler: ShaderTypeHandler): void
export function getShaderTypeHandler(type: string | null | undefined): ShaderTypeHandler | null
export function hasCustomShaderType(type: string | null | undefined): boolean
export function getRegisteredShaderTypes(): string[]
export function disposeAllShaderTypes(): void

// ── React components ─────────────────────────────────────────────────────────

export const App: FC
export const Renderer: FC<{ children?: ReactNode }>
export const Material: FC<{ definition: MaterialDefinition; textures?: Map<string, unknown> }>
export const Scene: FC<{
  environment?: PoseManifest['environment']
  toneMapping?: ToneMapping
  exposure?: number
  envIntensity?: number
  children?: ReactNode
}>

// ── Schema validators ────────────────────────────────────────────────────────

export namespace schema {
  export function validatePoseManifest(json: unknown): PoseManifest
  export function validateTestManifest(json: unknown): TestManifest
  export function validateTolerances(json: unknown): Tolerances
}

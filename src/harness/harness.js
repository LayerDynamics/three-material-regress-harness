// Harness — single-frame deterministic capture of a MaterialDefinition applied
// to a mesh. Runs in any WebGL2-capable environment: user browser, Playwright
// Chromium, or an Electron shell. NOT node-native — it assumes `THREE`'s
// WebGLRenderer has a GPU (or SwiftShader) available.

import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { getShaderTypeHandler } from '../components/ShaderTypeRegistry.js'
import { validatePoseManifest } from './params.js'
import { CaptureTimeoutError, HarnessConfigError } from './exceptions.js'

const SIDE_MAP = { front: THREE.FrontSide, back: THREE.BackSide, double: THREE.DoubleSide }

const TONE_MAP = {
  NoToneMapping: THREE.NoToneMapping,
  LinearToneMapping: THREE.LinearToneMapping,
  ReinhardToneMapping: THREE.ReinhardToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
  CineonToneMapping: THREE.CineonToneMapping,
  AgXToneMapping: THREE.AgXToneMapping,
  NeutralToneMapping: THREE.NeutralToneMapping,
}

let captureCounter = 0

export class Harness {
  /**
   * @param {{
   *   materialDefinition: import('../../index.js').MaterialDefinition,
   *   geometry: THREE.BufferGeometry | { type: string, [k:string]: unknown },
   *   pose: import('../../index.js').PoseManifest,
   *   environment?: import('../../index.js').PoseManifest['environment'],
   *   testId?: string,
   * }} opts
   */
  constructor(opts) {
    if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') {
      throw new HarnessConfigError('Harness requires a browser-like environment with WebGL2 (no DOM/OffscreenCanvas found).')
    }
    if (!opts || typeof opts !== 'object') {
      throw new HarnessConfigError('Harness(opts): opts object required.')
    }
    if (!opts.materialDefinition || typeof opts.materialDefinition !== 'object') {
      throw new HarnessConfigError('Harness(opts.materialDefinition): required object.')
    }
    if (!opts.geometry) {
      throw new HarnessConfigError('Harness(opts.geometry): required (BufferGeometry or descriptor).')
    }

    this._opts = opts
    this._pose = validatePoseManifest(opts.pose)
    this._testId = opts.testId ?? null
    this._captured = false
    this._disposed = false

    this._canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(this._pose.imageWidth, this._pose.imageHeight)
      : Object.assign(document.createElement('canvas'), {
          width: this._pose.imageWidth,
          height: this._pose.imageHeight,
        })

    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false,
    })
    this._renderer.setPixelRatio(this._pose.dpr ?? 1)
    this._renderer.setSize(this._pose.imageWidth, this._pose.imageHeight, false)
    this._renderer.outputColorSpace = THREE.SRGBColorSpace
    this._renderer.toneMapping = TONE_MAP[this._pose.toneMapping ?? 'NeutralToneMapping']
    this._renderer.toneMappingExposure = this._opts.exposure ?? 1.0

    this._scene = new THREE.Scene()
    const bgColor = this._pose.background ?? '#000000'
    this._scene.background = new THREE.Color(bgColor)

    this._ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    this._directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
    this._directionalLight.position.set(2, 3, 4)
    this._scene.add(this._ambientLight, this._directionalLight)

    this._geometry = resolveGeometry(opts.geometry)
    this._ownsGeometry = this._geometry !== opts.geometry
    this._material = buildMaterial(opts.materialDefinition)
    this._mesh = new THREE.Mesh(this._geometry, this._material)
    this._scene.add(this._mesh)

    this._camera = new THREE.PerspectiveCamera(
      this._pose.cameraFov,
      this._pose.imageWidth / this._pose.imageHeight,
      0.01,
      1000,
    )
    this._camera.position.set(...this._pose.cameraPosition)
    this._camera.up.set(...this._pose.cameraUp)
    this._camera.lookAt(...this._pose.cameraTarget)
    this._camera.updateProjectionMatrix()

    this._envMap = null
  }

  async _loadEnvironmentIfAny() {
    const env = this._opts.environment
    if (!env) return
    const hdriUrl = typeof env === 'string' ? env : env.hdri
    if (!hdriUrl) return
    const loader = new RGBELoader()
    const texture = await new Promise((resolve, reject) => {
      loader.load(hdriUrl, resolve, undefined, reject)
    })
    texture.mapping = THREE.EquirectangularReflectionMapping
    this._scene.environment = texture
    if (typeof env === 'object') {
      if (typeof env.envIntensity === 'number') this._scene.environmentIntensity = env.envIntensity
    }
    this._envMap = texture
  }

  /**
   * Render one frame and return the pixel buffer.
   *
   * @param {{ timeoutMs?: number }} [opts]
   * @returns {Promise<import('../../index.js').CaptureResult>}
   */
  async capture({ timeoutMs = 15_000 } = {}) {
    if (this._captured) throw new HarnessConfigError('Harness.capture: already captured; make a new instance.')
    if (this._disposed) throw new HarnessConfigError('Harness.capture: instance is disposed.')

    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new CaptureTimeoutError(`capture exceeded ${timeoutMs}ms`)), timeoutMs),
    )

    try {
      await Promise.race([this._loadEnvironmentIfAny(), timer])
      // Two passes — a warmup render (shader compile etc.) then the captured render.
      this._renderer.render(this._scene, this._camera)
      this._renderer.render(this._scene, this._camera)

      const gl = this._renderer.getContext()
      const pixels = new Uint8Array(this._pose.imageWidth * this._pose.imageHeight * 4)
      gl.readPixels(0, 0, this._pose.imageWidth, this._pose.imageHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

      this._captured = true
      captureCounter++

      const gpuInfo = readGpuInfo(this._renderer)
      return {
        id: `cap-${Date.now()}-${captureCounter}`,
        testId: this._testId,
        pixels,
        width: this._pose.imageWidth,
        height: this._pose.imageHeight,
        meta: {
          materialDefinition: this._opts.materialDefinition,
          pose: this._pose,
          geometryHash: geometryHash(this._geometry),
          timestamp: new Date().toISOString(),
          three: THREE.REVISION,
          r3f: typeof globalThis.__R3F_VERSION === 'string' ? globalThis.__R3F_VERSION : 'unknown',
          drei: typeof globalThis.__DREI_VERSION === 'string' ? globalThis.__DREI_VERSION : 'unknown',
          gpu: gpuInfo,
        },
      }
    } catch (err) {
      if (err instanceof CaptureTimeoutError) throw err
      throw new HarnessConfigError(`capture failed: ${err?.message ?? err}`, { cause: err })
    }
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    try { this._mesh.removeFromParent?.() } catch { /* noop */ }
    try { this._material.dispose?.() } catch { /* noop */ }
    if (this._ownsGeometry) {
      try { this._geometry.dispose?.() } catch { /* noop */ }
    }
    try { this._envMap?.dispose?.() } catch { /* noop */ }
    try { this._renderer.dispose() } catch { /* noop */ }
  }
}

function resolveGeometry(input) {
  if (input instanceof THREE.BufferGeometry) return input

  if (input && typeof input === 'object' && typeof input.type === 'string') {
    const t = input.type.toLowerCase()
    switch (t) {
      case 'sphere':
        return new THREE.SphereGeometry(input.radius ?? 1, input.widthSegments ?? 64, input.heightSegments ?? 64)
      case 'box':
      case 'cube':
        return new THREE.BoxGeometry(input.width ?? 1, input.height ?? 1, input.depth ?? 1)
      case 'cylinder':
        return new THREE.CylinderGeometry(
          input.radiusTop ?? 0.5,
          input.radiusBottom ?? 0.5,
          input.height ?? 1,
          input.radialSegments ?? 64,
          input.heightSegments ?? 1,
        )
      case 'torus':
        return new THREE.TorusGeometry(
          input.radius ?? 0.7,
          input.tube ?? 0.25,
          input.radialSegments ?? 32,
          input.tubularSegments ?? 64,
        )
      case 'plane':
        return new THREE.PlaneGeometry(input.width ?? 1, input.height ?? 1)
      default:
        throw new HarnessConfigError(`resolveGeometry: unknown primitive type "${input.type}"`)
    }
  }

  throw new HarnessConfigError('resolveGeometry: expected THREE.BufferGeometry or { type: "sphere" | "cube" | … } descriptor')
}

function buildMaterial(definition) {
  const handler = getShaderTypeHandler(definition.kmpShaderType)
  if (handler) return handler.createMaterial(definition, new Map())

  return new THREE.MeshPhysicalMaterial({
    color: definition.color ?? '#ffffff',
    metalness: definition.metalness ?? 0,
    roughness: definition.roughness ?? 0.5,
    ior: definition.ior ?? 1.5,
    transmission: definition.transmission ?? 0,
    opacity: definition.opacity ?? 1,
    transparent: Boolean(definition.transparent),
    side: SIDE_MAP[definition.side ?? 'front'],
    emissive: definition.emissive ?? '#000000',
    emissiveIntensity: definition.emissiveIntensity ?? 0,
    clearcoat: definition.clearcoat ?? 0,
    clearcoatRoughness: definition.clearcoatRoughness ?? 0,
    sheen: definition.sheen ?? 0,
    sheenColor: definition.sheenColor ?? '#000000',
    sheenRoughness: definition.sheenRoughness ?? 1,
    iridescence: definition.iridescence ?? 0,
    iridescenceIOR: definition.iridescenceIOR ?? 1.3,
    anisotropy: definition.anisotropy ?? 0,
    anisotropyRotation: definition.anisotropyRotation ?? 0,
    attenuationColor: definition.attenuationColor ?? '#ffffff',
    attenuationDistance: Number.isFinite(definition.attenuationDistance) ? definition.attenuationDistance : Infinity,
    thickness: definition.thickness ?? 0,
    envMapIntensity: definition.envMapIntensity ?? 1,
    dispersion: definition.dispersion ?? 0,
    wireframe: Boolean(definition.wireframe),
  })
}

function geometryHash(geometry) {
  const attr = geometry.getAttribute?.('position')
  if (!attr) return 'no-position'
  const a = attr.array
  let h = 2166136261
  for (let i = 0; i < Math.min(a.length, 256); i++) {
    h = Math.imul(h ^ Math.floor(a[i] * 1e6), 16777619) >>> 0
  }
  return `geom-${a.length}-${h.toString(16)}`
}

function readGpuInfo(renderer) {
  try {
    const gl = renderer.getContext()
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (!info) return 'unknown'
    const vendor = gl.getParameter(info.UNMASKED_VENDOR_WEBGL) || ''
    const rendererStr = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || ''
    return `${vendor} ${rendererStr}`.trim()
  } catch {
    return 'unknown'
  }
}

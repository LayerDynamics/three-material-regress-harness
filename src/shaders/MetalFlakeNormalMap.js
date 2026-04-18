// Ported from file-browser-client/app/components/MaterialCreatorStudio/procedural/MetalFlakeNormalMap.ts
// Procedural metal flake normal map. Used by CarpaintShader to scatter specular.

import * as THREE from 'three'

export function generateMetalFlakeNormalMap(params = {}) {
  const {
    resolution = 512,
    flakeSize = 2,
    flakeIntensity = 0.15,
    flakeDensity = 0.7,
    seed = 42,
  } = params

  const size = resolution
  const data = new Uint8Array(size * size * 4)

  let s = seed | 0
  const random = () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = 128
    data[i * 4 + 1] = 128
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = 255
  }

  const step = Math.max(1, Math.round(flakeSize))
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      if (random() > flakeDensity) continue
      const angle = random() * Math.PI * 2
      const tilt = random() * flakeIntensity
      const nx = Math.sin(angle) * tilt
      const ny = Math.cos(angle) * tilt
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const r = Math.round((nx * 0.5 + 0.5) * 255)
      const g = Math.round((ny * 0.5 + 0.5) * 255)
      const b = Math.round((nz * 0.5 + 0.5) * 255)
      for (let dy = 0; dy < step && (y + dy) < size; dy++) {
        for (let dx = 0; dx < step && (x + dx) < size; dx++) {
          const idx = ((y + dy) * size + (x + dx)) * 4
          data[idx + 0] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = 255
        }
      }
    }
  }

  const blurred = new Uint8Array(data.length)
  blurred.set(data)
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = (y * size + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c] * 4
        const left = data[idx - 4 + c]
        const right = data[idx + 4 + c]
        const top = data[((y - 1) * size + x) * 4 + c]
        const bottom = data[((y + 1) * size + x) * 4 + c]
        blurred[idx + c] = Math.round((center + left + right + top + bottom) / 8)
      }
    }
  }

  const texture = new THREE.DataTexture(blurred, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.LinearSRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function metalFlakeParamsFromKmp(metalCoverage, metalRoughness, flakeSize) {
  const density = Math.min(0.95, 0.4 + metalCoverage * 0.3)
  const intensity = 0.05 + Math.min(metalRoughness, 1.0) * 0.2
  return {
    resolution: 512,
    flakeSize: flakeSize ?? 2,
    flakeIntensity: intensity,
    flakeDensity: density,
    seed: 42,
  }
}

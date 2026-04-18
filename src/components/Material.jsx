// Material — dispatches MaterialDefinition through ShaderTypeRegistry.
// Full implementation lands in milestone M2 (T17).

import * as THREE from 'three'
import { useMemo } from 'react'
import { getShaderTypeHandler } from './ShaderTypeRegistry.js'

const SIDE_MAP = { front: THREE.FrontSide, back: THREE.BackSide, double: THREE.DoubleSide }

export function Material({ definition, textures }) {
  const material = useMemo(() => {
    if (!definition) return null
    const handler = getShaderTypeHandler(definition.kmpShaderType)
    if (handler) {
      return handler.createMaterial(definition, textures ?? new Map())
    }
    // Fallback to MeshPhysicalMaterial.
    const mat = new THREE.MeshPhysicalMaterial({
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
      attenuationDistance: definition.attenuationDistance ?? Infinity,
      thickness: definition.thickness ?? 0,
      envMapIntensity: definition.envMapIntensity ?? 1,
      dispersion: definition.dispersion ?? 0,
      wireframe: Boolean(definition.wireframe),
    })
    return mat
  }, [definition, textures])

  if (!material) return null
  return <primitive object={material} attach="material" />
}

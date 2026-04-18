// Ported from file-browser-client/app/lib/renderer/shaders/XRayFlatShader.ts.
// X-Ray (edge-bright, center-transparent) and Flat (unlit) shaders.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const xrayVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`

const xrayFragmentShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float NdotV = saturate(dot(N, V));
    float edgeFactor = pow(1.0 - NdotV, 2.0);
    vec4 baseColor = csm_DiffuseColor;
    float alpha = edgeFactor * baseColor.a;
    vec3 xrayColor = baseColor.rgb * (0.3 + edgeFactor * 0.7);
    csm_FragColor = vec4(xrayColor, alpha);
  }
`

const flatVertexShader = /* glsl */ `
  void main() { /* no varyings */ }
`

const flatFragmentShader = /* glsl */ `
  void main() { csm_FragColor = csm_DiffuseColor; }
`

export class XRayShaderHandler {
  createMaterial(def) {
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: xrayVertexShader,
      fragmentShader: xrayFragmentShader,
      uniforms: {},
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: def.opacity ?? 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }

  updateMaterial(mat, def) {
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.opacity = def.opacity ?? 1.0
    mat.needsUpdate = true
  }

  dispose() {}
}

export class FlatShaderHandler {
  createMaterial(def) {
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: flatVertexShader,
      fragmentShader: flatFragmentShader,
      uniforms: {},
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: 1.0,
      metalness: 0.0,
      emissive: new THREE.Color(def.emissive ?? '#000000'),
      emissiveIntensity: def.emissiveIntensity ?? 0,
    })
  }

  updateMaterial(mat, def) {
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.emissive = new THREE.Color(def.emissive ?? '#000000')
    mat.emissiveIntensity = def.emissiveIntensity ?? 0
    mat.needsUpdate = true
  }

  dispose() {}
}

const xrayHandler = new XRayShaderHandler()
registerShaderType('lux_xray', xrayHandler)
registerShaderType('xray', xrayHandler)
registerShaderType('x-ray', xrayHandler)

const flatHandler = new FlatShaderHandler()
registerShaderType('lux_flat', flatHandler)
registerShaderType('flat', flatHandler)

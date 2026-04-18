// Ported from file-browser-client/app/lib/renderer/shaders/GlassGemShader.ts.
// Glass (Beer-Lambert absorption + Schlick Fresnel) and Gem (dispersion + fire).

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const glassVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`

const glassFragmentShader = /* glsl */ `
  uniform vec3 u_absorptionColor;
  uniform float u_absorptionDistance;
  uniform float u_chromaticAberration;
  uniform float u_ior;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  float fresnelSchlick(float cosTheta, float ior) {
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return r0 + (1.0 - r0) * pow(1.0 - saturate(cosTheta), 5.0);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float NdotV = saturate(dot(N, V));
    float fresnel = fresnelSchlick(NdotV, u_ior);
    float thickness = 1.0 - NdotV;
    vec3 absorption = exp(-((vec3(1.0) - u_absorptionColor) * thickness) / max(u_absorptionDistance, 0.001));

    vec3 chromaticShift = vec3(1.0);
    if (u_chromaticAberration > 0.0) {
      float shift = u_chromaticAberration * 0.03;
      chromaticShift = vec3(1.0 + shift, 1.0, 1.0 - shift);
    }

    vec4 baseColor = csm_DiffuseColor;
    vec3 transmittedColor = baseColor.rgb * absorption * chromaticShift;
    vec3 reflectedColor = vec3(1.0) * fresnel;
    vec3 result = mix(transmittedColor, reflectedColor, fresnel * 0.5);
    csm_FragColor = vec4(result, baseColor.a);
  }
`

const gemFragmentShader = /* glsl */ `
  uniform vec3 u_absorptionColor;
  uniform float u_absorptionDistance;
  uniform float u_dispersionStrength;
  uniform float u_fireIntensity;
  uniform float u_brilliance;
  uniform float u_ior;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  float fresnelSchlick(float cosTheta, float ior) {
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return r0 + (1.0 - r0) * pow(1.0 - saturate(cosTheta), 5.0);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float NdotV = saturate(dot(N, V));
    float fresnel = fresnelSchlick(NdotV, u_ior);
    float internalReflection = pow(1.0 - NdotV, 3.0) * u_brilliance;
    float fireAngle = pow(1.0 - NdotV, 4.0);
    vec3 fire = vec3(0.0);
    if (u_fireIntensity > 0.0) {
      float dispShift = u_dispersionStrength * 0.1;
      fire = vec3(
        fireAngle * (1.0 + dispShift * 2.0),
        fireAngle * (1.0 + dispShift * 0.5),
        fireAngle * (1.0 - dispShift * 1.0)
      ) * u_fireIntensity;
    }
    float thickness = 1.0 - NdotV;
    vec3 absorption = exp(-((vec3(1.0) - u_absorptionColor) * thickness) / max(u_absorptionDistance, 0.001));
    vec4 baseColor = csm_DiffuseColor;
    vec3 transmitted = baseColor.rgb * absorption;
    vec3 reflected = vec3(1.0) * fresnel * u_brilliance;
    vec3 result = mix(transmitted, reflected, fresnel * 0.6) + fire + vec3(internalReflection * 0.1);
    csm_FragColor = vec4(result, baseColor.a);
  }
`

const DEFAULT_GLASS = { absorptionColor: [1.0, 1.0, 1.0], absorptionDistance: 0.5, chromaticAberration: 0.0 }
const DEFAULT_GEM = { dispersionStrength: 0.044, brilliance: 1.0, fireIntensity: 0.5 }

const getGlassParams = (def) => def.glassParams ?? DEFAULT_GLASS
const getGemParams = (def) => def.gemParams ?? DEFAULT_GEM

function buildGlassUniforms(def) {
  const g = getGlassParams(def)
  return {
    u_absorptionColor: { value: new THREE.Vector3(...g.absorptionColor) },
    u_absorptionDistance: { value: g.absorptionDistance },
    u_chromaticAberration: { value: g.chromaticAberration },
    u_ior: { value: def.ior ?? 1.5 },
  }
}

function buildGemUniforms(def) {
  const g = getGlassParams(def)
  const gem = getGemParams(def)
  return {
    u_absorptionColor: { value: new THREE.Vector3(...g.absorptionColor) },
    u_absorptionDistance: { value: g.absorptionDistance },
    u_dispersionStrength: { value: gem.dispersionStrength },
    u_fireIntensity: { value: gem.fireIntensity },
    u_brilliance: { value: gem.brilliance },
    u_ior: { value: def.ior ?? 2.4 },
  }
}

export class GlassShaderHandler {
  createMaterial(def) {
    const g = getGlassParams(def)
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: glassVertexShader,
      fragmentShader: glassFragmentShader,
      uniforms: buildGlassUniforms(def),
      transmission: def.transmission ?? 1.0,
      thickness: def.thickness ?? 0.5,
      ior: def.ior ?? 1.5,
      attenuationColor: new THREE.Color(...g.absorptionColor),
      attenuationDistance: Math.max(0.01, g.absorptionDistance),
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0,
      metalness: def.metalness ?? 0,
      transparent: true,
      side: THREE.DoubleSide,
      dispersion: def.dispersion ?? 0,
    })
  }

  updateMaterial(mat, def) {
    const g = getGlassParams(def)
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.roughness = def.roughness ?? 0
    mat.metalness = def.metalness ?? 0
    mat.transmission = def.transmission ?? 1.0
    mat.thickness = def.thickness ?? 0.5
    mat.ior = def.ior ?? 1.5
    mat.attenuationColor = new THREE.Color(...g.absorptionColor)
    mat.attenuationDistance = Math.max(0.01, g.absorptionDistance)
    mat.transparent = true
    mat.side = THREE.DoubleSide
    mat.dispersion = def.dispersion ?? 0
    const u = mat.uniforms
    if (u) {
      u.u_absorptionColor.value.set(...g.absorptionColor)
      u.u_absorptionDistance.value = g.absorptionDistance
      u.u_chromaticAberration.value = g.chromaticAberration
      u.u_ior.value = def.ior ?? 1.5
    }
  }

  dispose() {}
}

export class GemShaderHandler {
  createMaterial(def) {
    const g = getGlassParams(def)
    const gem = getGemParams(def)
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: glassVertexShader,
      fragmentShader: gemFragmentShader,
      uniforms: buildGemUniforms(def),
      transmission: def.transmission ?? 1.0,
      thickness: def.thickness ?? 0.5,
      ior: def.ior ?? 2.4,
      attenuationColor: new THREE.Color(...g.absorptionColor),
      attenuationDistance: Math.max(0.01, g.absorptionDistance),
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0,
      metalness: def.metalness ?? 0,
      transparent: true,
      side: THREE.DoubleSide,
      dispersion: gem.dispersionStrength,
    })
  }

  updateMaterial(mat, def) {
    const g = getGlassParams(def)
    const gem = getGemParams(def)
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.roughness = def.roughness ?? 0
    mat.metalness = def.metalness ?? 0
    mat.transmission = def.transmission ?? 1.0
    mat.thickness = def.thickness ?? 0.5
    mat.ior = def.ior ?? 2.4
    mat.attenuationColor = new THREE.Color(...g.absorptionColor)
    mat.attenuationDistance = Math.max(0.01, g.absorptionDistance)
    mat.transparent = true
    mat.side = THREE.DoubleSide
    mat.dispersion = gem.dispersionStrength
    const u = mat.uniforms
    if (u) {
      u.u_absorptionColor.value.set(...g.absorptionColor)
      u.u_absorptionDistance.value = g.absorptionDistance
      u.u_dispersionStrength.value = gem.dispersionStrength
      u.u_fireIntensity.value = gem.fireIntensity
      u.u_brilliance.value = gem.brilliance
      u.u_ior.value = def.ior ?? 2.4
    }
  }

  dispose() {}
}

const glassHandler = new GlassShaderHandler()
registerShaderType('lux_glass', glassHandler)
registerShaderType('glass', glassHandler)
registerShaderType('liquid', glassHandler)
registerShaderType('lux_liquid', glassHandler)
registerShaderType('lux_dielectric', glassHandler)
registerShaderType('dielectric', glassHandler)

const gemHandler = new GemShaderHandler()
registerShaderType('lux_gem', gemHandler)
registerShaderType('gem', gemHandler)
registerShaderType('diamond', gemHandler)
registerShaderType('lux_diamond', gemHandler)

// Ported from file-browser-client/app/lib/renderer/shaders/CarpaintShader.ts (SPEC-07).
// KeyShot metallic_paint — 3-layer BRDF (base + GGX flakes + clearcoat).
// Auto-registers on import.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'
import { generateMetalFlakeNormalMap, metalFlakeParamsFromKmp } from './MetalFlakeNormalMap.js'

const carpaintVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - vWorldPos);
  }
`

const carpaintFragmentShader = /* glsl */ `
  uniform vec3 u_baseColor;
  uniform float u_metalLayerVisibility;
  uniform float u_clearcoatIOR;
  uniform vec3 u_clearcoatAbsorptionColor;
  uniform float u_metalCoverage;
  uniform float u_metalRoughness;
  uniform float u_metalFlakeSize;
  uniform float u_metalFlakeVisibility;
  uniform sampler2D u_flakeNormalMap;
  uniform float u_flakeMapResolution;

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  float GGX_D(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * denom * denom + 0.0001);
  }

  float Smith_V_GGX(float NdotL, float NdotV, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float lambdaV = NdotL * sqrt(a2 + (1.0 - a2) * NdotV * NdotV);
    float lambdaL = NdotV * sqrt(a2 + (1.0 - a2) * NdotL * NdotL);
    return 0.5 / (lambdaV + lambdaL + 0.0001);
  }

  float fresnelSchlick(float cosTheta, float F0) {
    float t = 1.0 - cosTheta;
    float t2 = t * t;
    return F0 + (1.0 - F0) * t2 * t2 * t;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.001);

    vec3 baseCoat = u_baseColor;
    vec3 metalContrib = vec3(0.0);

    if (u_metalLayerVisibility > 0.001 && u_metalFlakeVisibility > 0.001) {
      vec2 flakeUV = vWorldPos.xy * u_metalFlakeSize;
      vec3 flakeNormalTS = texture2D(u_flakeNormalMap, flakeUV).rgb * 2.0 - 1.0;
      vec3 tangent = normalize(cross(N, vec3(0.0, 1.0, 0.001)));
      vec3 bitangent = cross(N, tangent);
      vec3 flakeNormal = normalize(
        tangent * flakeNormalTS.x + bitangent * flakeNormalTS.y + N * flakeNormalTS.z
      );

      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      #if NUM_DIR_LIGHTS > 0
        lightDir = normalize(directionalLights[0].direction);
      #endif
      vec3 H = normalize(V + lightDir);

      float FNdotH = max(dot(flakeNormal, H), 0.0);
      float FNdotV = max(dot(flakeNormal, V), 0.001);
      float FNdotL = max(dot(flakeNormal, lightDir), 0.0);

      float D = GGX_D(FNdotH, u_metalRoughness);
      float Vis = Smith_V_GGX(FNdotL, FNdotV, u_metalRoughness);
      float F = fresnelSchlick(FNdotH, 0.04);
      float spec = D * Vis * F;
      spec = min(spec, 16.0);

      vec3 R = reflect(-V, flakeNormal);
      float sparkle = clamp(
        pow(max(dot(R, lightDir), 0.0), 64.0) * u_metalFlakeVisibility,
        0.0, 1.0
      );

      float coverage = clamp(u_metalCoverage, 0.0, 2.0);
      metalContrib = u_baseColor * (spec * coverage + sparkle);
      metalContrib = min(metalContrib, vec3(4.0));
    }

    vec3 paintColor = mix(baseCoat, baseCoat + metalContrib, u_metalLayerVisibility);

    float F0_clearcoat = pow((u_clearcoatIOR - 1.0) / (u_clearcoatIOR + 1.0), 2.0);
    float clearcoatFresnel = fresnelSchlick(NdotV, F0_clearcoat);

    float pathLength = 1.0 / max(NdotV, 0.001);
    vec3 absorptionCoeff = -log(max(u_clearcoatAbsorptionColor, vec3(0.001)));
    vec3 absorption = exp(-absorptionCoeff * pathLength * 0.1);
    paintColor *= absorption;

    vec3 finalColor = mix(paintColor, vec3(1.0), clearcoatFresnel * 0.15);
    csm_FragColor = vec4(finalColor, 1.0);
  }
`

const DEFAULT_CARPAINT = {
  baseColor: [0.1, 0.1, 0.6],
  metalLayerVisibility: 0.5,
  clearcoatIOR: 1.5,
  clearcoatAbsorptionColor: [1.0, 1.0, 1.0],
  metalSamples: 4,
  metalCoverage: 1.0,
  metalRoughness: 0.3,
  metalFlakeSize: 10.0,
  metalFlakeVisibility: 0.5,
}

function getCarpaintParams(def) {
  const p = def.carpaintParams ?? {}
  return {
    baseColor: p.baseColor ?? DEFAULT_CARPAINT.baseColor,
    metalLayerVisibility: p.metalLayerVisibility ?? DEFAULT_CARPAINT.metalLayerVisibility,
    clearcoatIOR: p.clearcoatIOR ?? DEFAULT_CARPAINT.clearcoatIOR,
    clearcoatAbsorptionColor: p.clearcoatAbsorptionColor ?? DEFAULT_CARPAINT.clearcoatAbsorptionColor,
    metalSamples: p.metalSamples ?? DEFAULT_CARPAINT.metalSamples,
    metalCoverage: p.metalCoverage ?? DEFAULT_CARPAINT.metalCoverage,
    metalRoughness: p.metalRoughness ?? DEFAULT_CARPAINT.metalRoughness,
    metalFlakeSize: p.metalFlakeSize ?? DEFAULT_CARPAINT.metalFlakeSize,
    metalFlakeVisibility: p.metalFlakeVisibility ?? DEFAULT_CARPAINT.metalFlakeVisibility,
  }
}

function buildUniforms(params, flakeTexture) {
  return {
    u_baseColor: { value: new THREE.Color(...params.baseColor) },
    u_metalLayerVisibility: { value: params.metalLayerVisibility },
    u_clearcoatIOR: { value: params.clearcoatIOR },
    u_clearcoatAbsorptionColor: { value: new THREE.Color(...params.clearcoatAbsorptionColor) },
    u_metalCoverage: { value: params.metalCoverage },
    u_metalRoughness: { value: params.metalRoughness },
    u_metalFlakeSize: { value: params.metalFlakeSize },
    u_metalFlakeVisibility: { value: params.metalFlakeVisibility },
    u_flakeNormalMap: { value: flakeTexture ?? new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1) },
    u_flakeMapResolution: { value: 512 },
  }
}

export class CarpaintShaderHandler {
  constructor() {
    this.cachedFlakeTexture = null
    this.cachedFlakeParams = ''
  }

  _getFlakeTexture(params) {
    const flakeParams = metalFlakeParamsFromKmp(params.metalCoverage, params.metalRoughness, params.metalFlakeSize)
    flakeParams.resolution = 512
    const key = JSON.stringify(flakeParams)
    if (this.cachedFlakeTexture && this.cachedFlakeParams === key) return this.cachedFlakeTexture
    if (this.cachedFlakeTexture) {
      this.cachedFlakeTexture.dispose()
      this.cachedFlakeTexture = null
    }
    this.cachedFlakeTexture = generateMetalFlakeNormalMap(flakeParams)
    this.cachedFlakeParams = key
    return this.cachedFlakeTexture
  }

  createMaterial(def) {
    const params = getCarpaintParams(def)
    const flakeTexture = this._getFlakeTexture(params)
    const uniforms = buildUniforms(params, flakeTexture)
    const F0 = Math.pow((params.clearcoatIOR - 1.0) / (params.clearcoatIOR + 1.0), 2.0)
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: carpaintVertexShader,
      fragmentShader: carpaintFragmentShader,
      uniforms,
      color: new THREE.Color(...params.baseColor),
      metalness: params.metalLayerVisibility * 0.5,
      roughness: params.metalRoughness,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: F0,
    })
  }

  updateMaterial(mat, def) {
    const params = getCarpaintParams(def)
    const flakeTexture = this._getFlakeTexture(params)
    const uniforms = buildUniforms(params, flakeTexture)
    const F0 = Math.pow((params.clearcoatIOR - 1.0) / (params.clearcoatIOR + 1.0), 2.0)
    if (typeof mat.update === 'function') {
      mat.update({
        uniforms,
        fragmentShader: carpaintFragmentShader,
        color: new THREE.Color(...params.baseColor),
        metalness: params.metalLayerVisibility * 0.5,
        roughness: params.metalRoughness,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        reflectivity: F0,
      })
    }
  }

  dispose() {
    if (this.cachedFlakeTexture) {
      this.cachedFlakeTexture.dispose()
      this.cachedFlakeTexture = null
      this.cachedFlakeParams = ''
    }
  }
}

registerShaderType('metallic_paint', new CarpaintShaderHandler())

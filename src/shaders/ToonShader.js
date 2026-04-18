// Ported from file-browser-client/app/lib/renderer/shaders/ToonShader.ts (SPEC-07).
// KeyShot lux_toon cel-shading with Fresnel edge darkening + shadow bands.
// Auto-registers on import.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const vertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  uniform vec3 uFillColor;
  uniform vec3 uShadowColor;
  uniform float uShadowMultiplier;
  uniform vec3 uShadowStrength;
  uniform float uAlpha;
  uniform float uEnvironmentShadows;
  uniform float uLightSourceShadows;
  uniform float uFresnelFalloff;
  uniform float uFresnelMinFactor;

  void main() {
    vec3 N = normalize(vWorldNormal);

    float NdotL = 1.0;
    if (uLightSourceShadows > 0.5) {
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
      #if NUM_DIR_LIGHTS > 0
        lightDir = normalize(directionalLights[0].direction);
      #endif
      NdotL = dot(N, lightDir);
    }

    float envShadow = 1.0;
    if (uEnvironmentShadows > 0.5) {
      float upFactor = dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
      envShadow = mix(0.5, 1.0, upFactor);
    }

    vec3 threshold = vec3(0.5) * uShadowStrength - vec3(0.5) * (vec3(1.0) - uShadowStrength);
    float combinedLight = NdotL * envShadow;

    vec3 stepR = vec3(
      combinedLight > threshold.r ? 1.0 : 0.0,
      combinedLight > threshold.g ? 1.0 : 0.0,
      combinedLight > threshold.b ? 1.0 : 0.0
    );

    vec3 normShadowColor = uShadowColor;
    float maxC = max(max(normShadowColor.r, normShadowColor.g), normShadowColor.b);
    if (maxC > 1.0) normShadowColor /= maxC;
    vec3 shadowed = mix(uFillColor, normShadowColor, uShadowMultiplier);

    vec3 color = vec3(
      mix(shadowed.r, uFillColor.r, stepR.r),
      mix(shadowed.g, uFillColor.g, stepR.g),
      mix(shadowed.b, uFillColor.b, stepR.b)
    );

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnelT = pow(1.0 - abs(dot(N, viewDir)), uFresnelFalloff);
    color *= mix(1.0, uFresnelMinFactor, fresnelT);

    csm_FragColor = vec4(color, uAlpha);
  }
`

const DEFAULT_FILL = [0.8, 0.8, 0.8]
const DEFAULT_SHADOW = [0.2, 0.2, 0.2]
const DEFAULT_SHADOW_MULTIPLIER = 0.5
const DEFAULT_SHADOW_STRENGTH = [0.5, 0.5, 0.5]
const DEFAULT_FRESNEL_FALLOFF = 2.5
const DEFAULT_FRESNEL_MIN_FACTOR = 0.65

function buildUniforms(def) {
  const tp = def.toonParams
  return {
    uFillColor: { value: new THREE.Color().fromArray(tp?.fillColor ?? DEFAULT_FILL) },
    uShadowColor: { value: new THREE.Color().fromArray(tp?.shadowColor ?? DEFAULT_SHADOW) },
    uShadowMultiplier: { value: tp?.shadowMultiplier ?? DEFAULT_SHADOW_MULTIPLIER },
    uShadowStrength: { value: new THREE.Vector3().fromArray(tp?.shadowStrength ?? DEFAULT_SHADOW_STRENGTH) },
    uAlpha: { value: tp?.transparency ? (def.opacity ?? 1.0) : 1.0 },
    uEnvironmentShadows: { value: tp?.environmentShadows ? 1.0 : 0.0 },
    uLightSourceShadows: { value: tp?.lightSourceShadows ? 1.0 : 0.0 },
    uFresnelFalloff: { value: DEFAULT_FRESNEL_FALLOFF },
    uFresnelMinFactor: { value: DEFAULT_FRESNEL_MIN_FACTOR },
  }
}

export class ToonShaderHandler {
  createMaterial(def) {
    const uniforms = buildUniforms(def)
    const tp = def.toonParams
    const isTransparent = tp?.transparency ?? false
    const mat = new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader,
      fragmentShader,
      uniforms,
      patchMap: {
        '*': {
          '#include <envmap_physical_pars_fragment>': `
            #ifdef USE_ENVMAP
              vec3 getIBLIrradiance( const in vec3 normal ) { return vec3( 0.0 ); }
              vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) { return vec3( 0.0 ); }
              #ifdef USE_ANISOTROPY
                vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) { return vec3( 0.0 ); }
              #endif
            #endif
          `,
          '#include <lights_fragment_maps>': `/* stripped */`,
        },
      },
      color: new THREE.Color().fromArray(tp?.fillColor ?? DEFAULT_FILL),
      roughness: 1.0,
      metalness: 0.0,
      specularIntensity: 0.0,
      specularColor: new THREE.Color(0x000000),
      ior: 1.0,
      reflectivity: 0.0,
      envMapIntensity: 0,
      clearcoat: 0.0,
      clearcoatRoughness: 0.0,
      sheen: 0.0,
      sheenRoughness: 0.0,
      sheenColor: new THREE.Color(0x000000),
      iridescence: 0.0,
      toneMapped: false,
      depthWrite: !isTransparent,
      transparent: isTransparent,
      opacity: isTransparent ? (def.opacity ?? 1.0) : 1.0,
      side: THREE.DoubleSide,
    })
    return mat
  }

  updateMaterial(mat, def) {
    const csm = mat
    const tp = def.toonParams
    const isTransparent = tp?.transparency ?? false
    const u = csm.uniforms
    if (u) {
      u.uFillColor.value.fromArray(tp?.fillColor ?? DEFAULT_FILL)
      u.uShadowColor.value.fromArray(tp?.shadowColor ?? DEFAULT_SHADOW)
      u.uShadowMultiplier.value = tp?.shadowMultiplier ?? DEFAULT_SHADOW_MULTIPLIER
      u.uShadowStrength.value.fromArray(tp?.shadowStrength ?? DEFAULT_SHADOW_STRENGTH)
      u.uAlpha.value = isTransparent ? (def.opacity ?? 1.0) : 1.0
      u.uEnvironmentShadows.value = tp?.environmentShadows ? 1.0 : 0.0
      u.uLightSourceShadows.value = tp?.lightSourceShadows ? 1.0 : 0.0
      u.uFresnelFalloff.value = DEFAULT_FRESNEL_FALLOFF
      u.uFresnelMinFactor.value = DEFAULT_FRESNEL_MIN_FACTOR
    }
    const base = csm
    base.color.fromArray(tp?.fillColor ?? DEFAULT_FILL)
    base.roughness = 1.0
    base.metalness = 0.0
    base.specularIntensity = 0.0
    base.specularColor.setHex(0x000000)
    base.ior = 1.0
    base.reflectivity = 0.0
    base.envMapIntensity = 0
    base.clearcoat = 0.0
    base.clearcoatRoughness = 0.0
    base.sheen = 0.0
    base.sheenRoughness = 0.0
    base.sheenColor.setHex(0x000000)
    base.iridescence = 0.0
    base.toneMapped = false
    base.depthWrite = !isTransparent
    base.transparent = isTransparent
    base.opacity = isTransparent ? (def.opacity ?? 1.0) : 1.0
    base.side = THREE.DoubleSide
    csm.needsUpdate = true
  }

  dispose() {}
}

const toonHandler = new ToonShaderHandler()
registerShaderType('lux_toon', toonHandler)
registerShaderType('toon', toonHandler)

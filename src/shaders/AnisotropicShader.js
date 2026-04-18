// Ported from file-browser-client/app/lib/renderer/shaders/AnisotropicShader.ts.
// Ward anisotropic BRDF for brushed/directional metals.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const anisotropicVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vWorldTangent;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldTangent = normalize((modelMatrix * vec4(tangent.xyz, 0.0)).xyz);
  }
`

const anisotropicFragmentShader = /* glsl */ `
  uniform vec3 u_grainDirection;
  uniform float u_roughnessX;
  uniform float u_roughnessY;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vWorldTangent;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 T = normalize(vWorldTangent);
    vec3 B = normalize(cross(N, T));
    float NdotV = saturate(dot(N, V));
    vec3 anisContrib = vec3(0.0);

    #if NUM_DIR_LIGHTS > 0
      for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vec3 L = normalize(directionalLights[i].direction);
        vec3 lightColor = directionalLights[i].color;
        vec3 H = normalize(L + V);
        float NdotL = saturate(dot(N, L));
        float NdotH = saturate(dot(N, H));
        float TdotH = dot(T, H);
        float BdotH = dot(B, H);
        float exponent = -2.0 * (
          (TdotH * TdotH) / (u_roughnessX * u_roughnessX) +
          (BdotH * BdotH) / (u_roughnessY * u_roughnessY)
        ) / (1.0 + NdotH);
        float spec = exp(exponent) / (4.0 * 3.14159 * u_roughnessX * u_roughnessY *
          sqrt(max(NdotL * NdotV, 0.001)));
        anisContrib += (vec3(NdotL) + vec3(spec) * 0.5) * lightColor;
      }
    #endif

    float envAniso = pow(1.0 - NdotV, 1.5) * 0.3;
    vec3 envContrib = vec3(envAniso);
    vec4 baseColor = csm_DiffuseColor;
    vec3 result = baseColor.rgb * anisContrib + envContrib * baseColor.rgb;
    csm_FragColor = vec4(result, baseColor.a);
  }
`

const DEFAULT_ANISOTROPIC = {
  grainDirection: [1.0, 0.0, 0.0],
  roughnessX: 0.1,
  roughnessY: 0.4,
}

const getAnisoParams = (def) => def.anisotropicParams ?? DEFAULT_ANISOTROPIC

function buildUniforms(def) {
  const a = getAnisoParams(def)
  return {
    u_grainDirection: { value: new THREE.Vector3(...a.grainDirection) },
    u_roughnessX: { value: Math.max(0.01, a.roughnessX) },
    u_roughnessY: { value: Math.max(0.01, a.roughnessY) },
  }
}

export class AnisotropicShaderHandler {
  createMaterial(def) {
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: anisotropicVertexShader,
      fragmentShader: anisotropicFragmentShader,
      uniforms: buildUniforms(def),
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0.3,
      metalness: def.metalness ?? 1.0,
      anisotropy: def.anisotropy ?? 0.5,
      anisotropyRotation: def.anisotropyRotation ?? 0,
      envMapIntensity: def.envMapIntensity ?? 1,
    })
  }

  updateMaterial(mat, def) {
    const a = getAnisoParams(def)
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.roughness = def.roughness ?? 0.3
    mat.metalness = def.metalness ?? 1.0
    mat.anisotropy = def.anisotropy ?? 0.5
    mat.anisotropyRotation = def.anisotropyRotation ?? 0
    mat.envMapIntensity = def.envMapIntensity ?? 1
    const u = mat.uniforms
    if (u) {
      u.u_grainDirection.value.set(...a.grainDirection)
      u.u_roughnessX.value = Math.max(0.01, a.roughnessX)
      u.u_roughnessY.value = Math.max(0.01, a.roughnessY)
    }
  }

  dispose() {}
}

const anisoHandler = new AnisotropicShaderHandler()
registerShaderType('lux_anisotropic', anisoHandler)
registerShaderType('anisotropic', anisoHandler)
registerShaderType('brushed_metal', anisoHandler)
registerShaderType('lux_brushed_metal', anisoHandler)

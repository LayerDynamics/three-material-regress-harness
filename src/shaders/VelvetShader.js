// Ported from file-browser-client/app/lib/renderer/shaders/VelvetShader.ts (SPEC-07).
// Sheen-dominant grazing-angle velvet/fabric. Auto-registers on import.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const velvetVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`

const velvetFragmentShader = /* glsl */ `
  uniform vec3 u_sheenColor;
  uniform float u_sheenIntensity;
  uniform vec3 u_fiberDirection;
  uniform float u_fuzzAmount;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float NdotV = saturate(dot(N, V));
    vec3 fiberDir = normalize(u_fiberDirection);
    float fiberAlignment = abs(dot(N, fiberDir));
    float sheenFactor = pow(1.0 - NdotV, 2.0) * u_sheenIntensity;
    float fuzzFactor = (1.0 - NdotV) * u_fuzzAmount * 0.5;
    float fiberSheen = mix(sheenFactor, sheenFactor * 1.3, fiberAlignment);

    vec3 sheenContrib = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
      for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vec3 L = normalize(directionalLights[i].direction);
        vec3 lightColor = directionalLights[i].color;
        float NdotL = saturate(dot(N, L));
        vec3 H = normalize(L + V);
        float NdotH = saturate(dot(N, H));
        float sheenSpec = pow(1.0 - NdotH, 3.0) * u_sheenIntensity;
        float backScatter = saturate(dot(-L, V)) * u_fuzzAmount * 0.3;
        vec3 diffuse = vec3(NdotL);
        vec3 sheen = u_sheenColor * (sheenSpec + backScatter);
        sheenContrib += (diffuse + sheen) * lightColor;
      }
    #endif

    vec3 rimSheen = u_sheenColor * fiberSheen;
    vec4 baseColor = csm_DiffuseColor;
    vec3 result = baseColor.rgb * sheenContrib + rimSheen + baseColor.rgb * fuzzFactor;
    csm_FragColor = vec4(result, baseColor.a);
  }
`

const DEFAULT_VELVET = {
  sheenColor: [1.0, 1.0, 1.0],
  sheenIntensity: 1.0,
  fiberDirection: [0.0, 1.0, 0.0],
  fuzzAmount: 1.0,
}

const getVelvetParams = (def) => def.velvetParams ?? DEFAULT_VELVET

function buildUniforms(def) {
  const v = getVelvetParams(def)
  return {
    u_sheenColor: { value: new THREE.Vector3(...v.sheenColor) },
    u_sheenIntensity: { value: v.sheenIntensity },
    u_fiberDirection: { value: new THREE.Vector3(...v.fiberDirection) },
    u_fuzzAmount: { value: v.fuzzAmount },
  }
}

export class VelvetShaderHandler {
  createMaterial(def) {
    const v = getVelvetParams(def)
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: velvetVertexShader,
      fragmentShader: velvetFragmentShader,
      uniforms: buildUniforms(def),
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0.8,
      metalness: def.metalness ?? 0,
      sheen: def.sheen ?? 1.0,
      sheenColor: new THREE.Color(...v.sheenColor),
      sheenRoughness: def.sheenRoughness ?? 1.0,
    })
  }

  updateMaterial(mat, def) {
    const v = getVelvetParams(def)
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.roughness = def.roughness ?? 0.8
    mat.metalness = def.metalness ?? 0
    mat.sheen = def.sheen ?? 1.0
    mat.sheenColor = new THREE.Color(...v.sheenColor)
    mat.sheenRoughness = def.sheenRoughness ?? 1.0
    mat.side = THREE.FrontSide
    const u = mat.uniforms
    if (u) {
      u.u_sheenColor.value.set(...v.sheenColor)
      u.u_sheenIntensity.value = v.sheenIntensity
      u.u_fiberDirection.value.set(...v.fiberDirection)
      u.u_fuzzAmount.value = v.fuzzAmount
    }
  }

  dispose() {}
}

const velvetHandler = new VelvetShaderHandler()
registerShaderType('lux_velvet', velvetHandler)
registerShaderType('velvet', velvetHandler)
registerShaderType('fabric', velvetHandler)
registerShaderType('cloth', velvetHandler)
registerShaderType('realcloth', velvetHandler)

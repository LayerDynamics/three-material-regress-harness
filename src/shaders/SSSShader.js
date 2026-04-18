// Ported from file-browser-client/app/lib/renderer/shaders/SSSShader.ts (SPEC-07).
// KeyShot lux_translucent BSSRDF approximation. Auto-registers on import.

import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import * as THREE from 'three'
import { registerShaderType } from '../components/ShaderTypeRegistry.js'

const sssVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  }
`

const sssFragmentShader = /* glsl */ `
  uniform vec3 u_subsurfaceColor;
  uniform float u_subsurfaceRadius;
  uniform vec3 u_iorChannels;
  uniform float u_diffuseWeight;
  uniform vec3 u_transmissionColor;
  uniform vec3 u_specularColor;
  uniform vec3 u_specularity;
  uniform float u_dispersion;
  uniform float u_iorAvg;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  vec3 fresnelSchlickRGB(float cosTheta, vec3 ior) {
    vec3 r0 = pow((vec3(1.0) - ior) / (vec3(1.0) + ior), vec3(2.0));
    return r0 + (vec3(1.0) - r0) * pow(1.0 - saturate(cosTheta), 5.0);
  }

  float fresnelSchlick(float cosTheta, float ior) {
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return r0 + (1.0 - r0) * pow(1.0 - saturate(cosTheta), 5.0);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float NdotV = saturate(dot(N, V));
    float thickness = 1.0 - NdotV;
    float wrapFactor = saturate(u_subsurfaceRadius / (u_subsurfaceRadius + 1.0));

    float dispersionK = saturate(u_dispersion);
    vec3 effectiveIor = mix(vec3(u_iorAvg), u_iorChannels, dispersionK);
    vec3 dispersedFresnel = fresnelSchlickRGB(NdotV, effectiveIor);

    float mixWeight = saturate(u_diffuseWeight);
    float scatterIntensity = u_diffuseWeight;

    vec3 sssContrib = vec3(0.0);
    vec3 specContrib = vec3(0.0);

    #if NUM_DIR_LIGHTS > 0
      for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vec3 L = normalize(directionalLights[i].direction);
        vec3 lightColor = directionalLights[i].color;
        float NdotL = dot(N, L);
        float wrapDiffuse = saturate(NdotL * wrapFactor + (1.0 - wrapFactor));
        float backScatter = saturate(dot(-L, V)) * thickness * scatterIntensity;
        vec3 backScatterColor = u_subsurfaceColor * backScatter;
        float forwardScatter = saturate(-NdotL) * thickness * scatterIntensity * 0.5;
        vec3 forwardScatterColor = u_transmissionColor * forwardScatter;
        vec3 standardDiffuse = vec3(saturate(NdotL));
        vec3 sssDiffuse = min(
          u_transmissionColor * wrapDiffuse + backScatterColor + forwardScatterColor,
          vec3(2.0)
        );
        vec3 diffuse = mix(standardDiffuse, sssDiffuse, mixWeight);
        sssContrib += diffuse * lightColor;

        vec3 H = normalize(L + V);
        float NdotH = saturate(dot(N, H));
        float specBase = pow(NdotH, 64.0);
        vec3 specPower = specBase * u_specularity;
        specContrib += u_specularColor * specPower * lightColor * dispersedFresnel;
      }
    #endif

    vec3 rimTransmission = u_subsurfaceColor * dispersedFresnel * thickness * mixWeight * 0.5;
    specContrib = min(specContrib, vec3(4.0));
    rimTransmission = min(rimTransmission, vec3(1.0));

    vec4 baseColor = csm_DiffuseColor;
    vec3 sssResult = baseColor.rgb * sssContrib + specContrib + rimTransmission;
    csm_FragColor = vec4(sssResult, baseColor.a);
  }
`

const DEFAULT_SSS = {
  subsurfaceColor: [1.0, 0.2, 0.1],
  subsurfaceRadius: 0.5,
  iorChannels: [1.4, 1.44, 1.48],
  diffuseWeight: 0.5,
  transmissionColor: [1.0, 0.8, 0.6],
  specularColor: [1.0, 1.0, 1.0],
  specularity: [1.0, 1.0, 1.0],
  dispersion: 0.0,
}

const getSSSParams = (def) => def.sssParams ?? DEFAULT_SSS
const averageChannels = (c) => (c[0] + c[1] + c[2]) / 3.0

function buildUniforms(def) {
  const sss = getSSSParams(def)
  return {
    u_subsurfaceColor: { value: new THREE.Vector3(...sss.subsurfaceColor) },
    u_subsurfaceRadius: { value: sss.subsurfaceRadius },
    u_iorChannels: { value: new THREE.Vector3(...sss.iorChannels) },
    u_diffuseWeight: { value: sss.diffuseWeight },
    u_transmissionColor: { value: new THREE.Vector3(...sss.transmissionColor) },
    u_specularColor: { value: new THREE.Vector3(...sss.specularColor) },
    u_specularity: { value: new THREE.Vector3(...sss.specularity) },
    u_dispersion: { value: sss.dispersion },
    u_iorAvg: { value: averageChannels(sss.iorChannels) },
  }
}

export class SSSShaderHandler {
  createMaterial(def) {
    const sss = getSSSParams(def)
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshPhysicalMaterial,
      vertexShader: sssVertexShader,
      fragmentShader: sssFragmentShader,
      uniforms: buildUniforms(def),
      transmission: sss.diffuseWeight,
      attenuationColor: new THREE.Color(...sss.transmissionColor),
      attenuationDistance: Math.max(0.01, sss.subsurfaceRadius * 4.0),
      ior: averageChannels(sss.iorChannels),
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0.5,
      metalness: def.metalness ?? 0,
      transparent: true,
      side: THREE.DoubleSide,
    })
  }

  updateMaterial(mat, def) {
    const sss = getSSSParams(def)
    const iorAvg = averageChannels(sss.iorChannels)
    mat.color = new THREE.Color(def.color ?? '#ffffff')
    mat.roughness = def.roughness ?? 0.5
    mat.metalness = def.metalness ?? 0
    mat.transmission = sss.diffuseWeight
    mat.thickness = sss.subsurfaceRadius * 2.0
    mat.attenuationColor = new THREE.Color(...sss.transmissionColor)
    mat.attenuationDistance = Math.max(0.01, sss.subsurfaceRadius * 4.0)
    mat.ior = iorAvg
    mat.transparent = true
    mat.side = THREE.DoubleSide
    const u = mat.uniforms
    if (u) {
      u.u_subsurfaceColor.value.set(...sss.subsurfaceColor)
      u.u_subsurfaceRadius.value = sss.subsurfaceRadius
      u.u_iorChannels.value.set(...sss.iorChannels)
      u.u_diffuseWeight.value = sss.diffuseWeight
      u.u_transmissionColor.value.set(...sss.transmissionColor)
      u.u_specularColor.value.set(...sss.specularColor)
      u.u_specularity.value.set(...sss.specularity)
      u.u_dispersion.value = sss.dispersion
      u.u_iorAvg.value = iorAvg
    }
  }

  dispose() {}
}

const sssHandler = new SSSShaderHandler()
registerShaderType('lux_translucent', sssHandler)
registerShaderType('sss', sssHandler)

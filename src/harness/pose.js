// Pose math — translate a PoseManifest into Three.js camera state and back.

import { HarnessConfigError } from './exceptions.js'
import { validatePoseManifest } from './params.js'

function isFiniteNumber(x) { return typeof x === 'number' && Number.isFinite(x) }

/** Apply a validated PoseManifest to a THREE.PerspectiveCamera in-place. */
export function applyPose(camera, pose) {
  const p = validatePoseManifest(pose)
  camera.position.set(p.cameraPosition[0], p.cameraPosition[1], p.cameraPosition[2])
  camera.up.set(p.cameraUp[0], p.cameraUp[1], p.cameraUp[2])
  camera.fov = p.cameraFov
  camera.aspect = p.imageWidth / p.imageHeight
  camera.lookAt(p.cameraTarget[0], p.cameraTarget[1], p.cameraTarget[2])
  camera.updateProjectionMatrix()
  return camera
}

/** Extract a PoseManifest from a THREE.PerspectiveCamera + target point. */
export function poseFromCamera(camera, target, imageWidth, imageHeight) {
  if (!camera || !camera.position || !camera.up) {
    throw new HarnessConfigError('poseFromCamera: expected THREE.PerspectiveCamera-like')
  }
  if (!target || typeof target.x !== 'number') {
    throw new HarnessConfigError('poseFromCamera: target must be a Vector3-like with {x,y,z}')
  }
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight)) {
    throw new HarnessConfigError('poseFromCamera: imageWidth/imageHeight required integers')
  }
  return {
    cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
    cameraTarget: [target.x, target.y, target.z],
    cameraUp: [camera.up.x, camera.up.y, camera.up.z],
    cameraFov: camera.fov,
    imageWidth,
    imageHeight,
    dpr: 1,
  }
}

/** Convert vertical FoV (deg) + aspect → horizontal FoV (deg). */
export function horizontalFov(fovY, aspect) {
  if (!isFiniteNumber(fovY) || !isFiniteNumber(aspect) || aspect <= 0) {
    throw new HarnessConfigError(`horizontalFov: invalid inputs fovY=${fovY}, aspect=${aspect}`)
  }
  const fovYRad = (fovY * Math.PI) / 180
  const fovXRad = 2 * Math.atan(Math.tan(fovYRad / 2) * aspect)
  return (fovXRad * 180) / Math.PI
}

/** Convert horizontal FoV (deg) + aspect → vertical FoV (deg). */
export function verticalFov(fovX, aspect) {
  if (!isFiniteNumber(fovX) || !isFiniteNumber(aspect) || aspect <= 0) {
    throw new HarnessConfigError(`verticalFov: invalid inputs fovX=${fovX}, aspect=${aspect}`)
  }
  const fovXRad = (fovX * Math.PI) / 180
  const fovYRad = 2 * Math.atan(Math.tan(fovXRad / 2) / aspect)
  return (fovYRad * 180) / Math.PI
}

/** Enumerate a spherical camera grid for pose-alignment pre-pass. */
export function sphericalGrid({ radiusMin, radiusMax, radiusSteps, thetaSteps, phiSteps }) {
  if (!isFiniteNumber(radiusMin) || !isFiniteNumber(radiusMax) || radiusMin <= 0 || radiusMax < radiusMin) {
    throw new HarnessConfigError(`sphericalGrid: radius range invalid (${radiusMin}..${radiusMax})`)
  }
  if (!Number.isInteger(radiusSteps) || radiusSteps < 1) {
    throw new HarnessConfigError(`sphericalGrid: radiusSteps must be >=1, got ${radiusSteps}`)
  }
  if (!Number.isInteger(thetaSteps) || thetaSteps < 1) {
    throw new HarnessConfigError(`sphericalGrid: thetaSteps must be >=1, got ${thetaSteps}`)
  }
  if (!Number.isInteger(phiSteps) || phiSteps < 1) {
    throw new HarnessConfigError(`sphericalGrid: phiSteps must be >=1, got ${phiSteps}`)
  }

  const poses = []
  for (let ri = 0; ri < radiusSteps; ri++) {
    const r = radiusSteps === 1
      ? (radiusMin + radiusMax) / 2
      : radiusMin + (ri * (radiusMax - radiusMin)) / (radiusSteps - 1)
    for (let ti = 0; ti < thetaSteps; ti++) {
      const theta = (ti * 2 * Math.PI) / thetaSteps
      for (let pi = 0; pi < phiSteps; pi++) {
        // Phi from 0.1..pi-0.1 to avoid exact poles (degenerate up vector).
        const phi = 0.1 + (pi * (Math.PI - 0.2)) / Math.max(phiSteps - 1, 1)
        const x = r * Math.sin(phi) * Math.cos(theta)
        const y = r * Math.cos(phi)
        const z = r * Math.sin(phi) * Math.sin(theta)
        poses.push([x, y, z])
      }
    }
  }
  return poses
}

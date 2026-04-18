import { describe, it, expect } from 'vitest'
import { horizontalFov, verticalFov, sphericalGrid, poseFromCamera, applyPose } from '../src/harness/pose.js'
import { HarnessConfigError } from '../src/harness/exceptions.js'

describe('horizontalFov / verticalFov', () => {
  it('roundtrip identity for square aspect', () => {
    const h = horizontalFov(45, 1)
    expect(verticalFov(h, 1)).toBeCloseTo(45, 5)
  })

  it('wide aspect → hFov > vFov', () => {
    expect(horizontalFov(45, 2)).toBeGreaterThan(45)
  })

  it('tall aspect → hFov < vFov', () => {
    expect(horizontalFov(45, 0.5)).toBeLessThan(45)
  })

  it('rejects non-finite inputs', () => {
    expect(() => horizontalFov(NaN, 1)).toThrow(HarnessConfigError)
    expect(() => horizontalFov(45, 0)).toThrow(HarnessConfigError)
    expect(() => horizontalFov(45, -1)).toThrow(HarnessConfigError)
  })
})

describe('sphericalGrid', () => {
  it('returns radiusSteps × thetaSteps × phiSteps poses', () => {
    const grid = sphericalGrid({ radiusMin: 1, radiusMax: 3, radiusSteps: 2, thetaSteps: 6, phiSteps: 4 })
    expect(grid).toHaveLength(2 * 6 * 4)
  })

  it('each pose is a [x,y,z] tuple of finite numbers', () => {
    const grid = sphericalGrid({ radiusMin: 1, radiusMax: 1, radiusSteps: 1, thetaSteps: 4, phiSteps: 3 })
    for (const p of grid) {
      expect(p).toHaveLength(3)
      for (const c of p) expect(Number.isFinite(c)).toBe(true)
    }
  })

  it('rejects degenerate params', () => {
    expect(() => sphericalGrid({ radiusMin: -1, radiusMax: 1, radiusSteps: 1, thetaSteps: 1, phiSteps: 1 })).toThrow(HarnessConfigError)
    expect(() => sphericalGrid({ radiusMin: 1, radiusMax: 1, radiusSteps: 0, thetaSteps: 1, phiSteps: 1 })).toThrow(HarnessConfigError)
  })
})

describe('applyPose + poseFromCamera (no THREE dep via duck-typed stand-in)', () => {
  // Lightweight stand-in that mirrors THREE.PerspectiveCamera's mutating API.
  class FakeVec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
  }
  class FakeCamera {
    constructor() {
      this.position = new FakeVec3()
      this.up = new FakeVec3(0, 1, 0)
      this.fov = 50
      this.aspect = 1
      this.lookAtCalls = []
      this.updateProjectionMatrixCalls = 0
    }
    lookAt(x, y, z) { this.lookAtCalls.push([x, y, z]); return this }
    updateProjectionMatrix() { this.updateProjectionMatrixCalls++ }
  }

  const pose = {
    cameraPosition: [3, 2, 5],
    cameraTarget: [0, 1, 0],
    cameraUp: [0, 1, 0],
    cameraFov: 45,
    imageWidth: 512,
    imageHeight: 512,
  }

  it('applyPose writes position / up / fov / aspect and calls lookAt', () => {
    const cam = new FakeCamera()
    applyPose(cam, pose)
    expect([cam.position.x, cam.position.y, cam.position.z]).toEqual([3, 2, 5])
    expect(cam.fov).toBe(45)
    expect(cam.aspect).toBe(1)
    expect(cam.lookAtCalls).toEqual([[0, 1, 0]])
    expect(cam.updateProjectionMatrixCalls).toBe(1)
  })

  it('poseFromCamera round-trips the essential fields', () => {
    const cam = new FakeCamera()
    cam.position.set(3, 2, 5)
    cam.up.set(0, 1, 0)
    cam.fov = 45
    const got = poseFromCamera(cam, { x: 0, y: 1, z: 0 }, 512, 512)
    expect(got.cameraPosition).toEqual([3, 2, 5])
    expect(got.cameraTarget).toEqual([0, 1, 0])
    expect(got.cameraFov).toBe(45)
    expect(got.imageWidth).toBe(512)
  })
})

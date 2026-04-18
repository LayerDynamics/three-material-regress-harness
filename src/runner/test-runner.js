// Test runner — orchestrates one test: load pose → load reference → load
// material → enqueue capture → diff → apply tolerance → emit TestResult.

import { validatePoseManifest } from '../harness/params.js'
import { BaselineMissingError, HarnessConfigError } from '../harness/exceptions.js'
import { diffImages, makeDiffPng } from '../recorder/diff.js'
import { decodePng, encodePng } from '../recorder/png.js'
import { loadTolerances } from '../recorder/params.js'
import { startTimer, stopTimer } from './duration.js'

/**
 * Run a single Test. Returns a fully-assembled TestResult.
 *
 * @param {import('../../index.js').Test} test
 * @param {import('../harness/controller.js').HarnessController} controller
 * @param {{
 *   baselineRoot: string,
 *   corpusRoot: string,
 *   outDir?: string,
 *   tolerances?: Partial<import('../../index.js').Tolerances>,
 *   resolveMaterial: (test: import('../../index.js').Test) => Promise<import('../../index.js').MaterialDefinition>,
 *   resolveGeometry: (test: import('../../index.js').Test) => Promise<unknown>,
 *   readReferenceBytes: (test: import('../../index.js').Test) => Promise<Uint8Array>,
 *   readPoseJson: (test: import('../../index.js').Test) => Promise<unknown>,
 *   writeCandidate: (result: import('../../index.js').CaptureResult) => Promise<string>,
 *   writeDiff: (bytes: Uint8Array, testId: string) => Promise<string>,
 * }} deps
 */
export async function runTest(test, controller, deps) {
  if (!test || !test.id) throw new HarnessConfigError('runTest: test.id required')
  if (!controller) throw new HarnessConfigError('runTest: controller required')
  if (!deps) throw new HarnessConfigError('runTest: deps required')

  const timer = startTimer()

  const poseJson = await deps.readPoseJson(test)
  const pose = validatePoseManifest(poseJson)

  const [referenceBytes, materialDefinition, geometry] = await Promise.all([
    deps.readReferenceBytes(test).catch((err) => {
      throw new BaselineMissingError(`baseline image missing for ${test.id}: ${err?.message ?? err}`, { cause: err })
    }),
    deps.resolveMaterial(test),
    deps.resolveGeometry(test),
  ])

  const reference = await decodePng(referenceBytes)
  if (reference.width !== pose.imageWidth || reference.height !== pose.imageHeight) {
    throw new HarnessConfigError(
      `runTest(${test.id}): reference ${reference.width}x${reference.height} does not match pose ${pose.imageWidth}x${pose.imageHeight}`,
    )
  }

  const tolerances = await loadTolerances(
    deps.baselineRoot,
    test.variant,
    test.view,
    deps.tolerances ?? null,
  )

  const capture = await controller.enqueue({
    materialDefinition,
    pose,
    testId: test.id,
    geometry,
    environment: pose.environment ?? null,
  })

  const diff = diffImages(capture.pixels, reference.pixels, {
    width: pose.imageWidth,
    height: pose.imageHeight,
    rmse: tolerances.rmse,
    pixelMismatchPct: tolerances.pixelMismatchPct,
    ssim: tolerances.ssim,
    maxChannelDiff: tolerances.maxChannelDiff,
    silhouetteOnly: tolerances.silhouetteOnly,
  })
  diff.testId = test.id
  diff.id = `diff-${test.id}`

  const candidatePath = await deps.writeCandidate(capture)

  let diffPath
  if (diff.verdict === 'fail') {
    const diffComposite = makeDiffPng(capture.pixels, reference.pixels, {
      width: pose.imageWidth,
      height: pose.imageHeight,
    })
    const diffBytes = await encodePng(diffComposite.pixels, diffComposite.width, diffComposite.height, { flipY: false })
    diffPath = await deps.writeDiff(diffBytes, test.id)
    diff.diffPngPath = diffPath
  }

  const { durationMs } = stopTimer(timer)

  return {
    testId: test.id,
    verdict: diff.verdict,
    diff,
    durationMs,
    candidatePath,
    referencePath: test.referenceImagePath,
    diffPath,
  }
}

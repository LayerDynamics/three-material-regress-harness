import { describe, it, expect, afterEach } from 'vitest'
import { recordCapture, getRecordingBlob, clearRecordings } from '../src/recorder/recorder.js'
import { decodePng } from '../src/recorder/png.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function makeCapture(testId, width = 8, height = 8) {
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 10
    pixels[i + 1] = 20
    pixels[i + 2] = 30
    pixels[i + 3] = 255
  }
  return {
    id: `${testId}-cap`,
    testId,
    pixels,
    width,
    height,
    meta: { timestamp: new Date().toISOString() },
  }
}

describe('recordCapture (Node)', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    clearRecordings()
  })

  it('writes a PNG and returns an absolute path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'evth-rec-'))
    const cap = makeCapture('t1')
    const path = await recordCapture(cap, { outDir: tempDir, flipY: false })
    expect(path.startsWith(tempDir)).toBe(true)
    const bytes = await readFile(path)
    expect(bytes.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG magic
    expect(getRecordingBlob(cap.id)).toBe(path)
  })

  it('round-trips through encode + decode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'evth-rec-'))
    const cap = makeCapture('t2', 16, 16)
    const path = await recordCapture(cap, { outDir: tempDir, flipY: false })
    const bytes = new Uint8Array(await readFile(path))
    const { pixels, width, height } = await decodePng(bytes)
    expect(width).toBe(16)
    expect(height).toBe(16)
    expect(pixels[0]).toBe(10)
    expect(pixels[1]).toBe(20)
    expect(pixels[2]).toBe(30)
  })

  it('rejects invalid CaptureResult', async () => {
    await expect(recordCapture({})).rejects.toThrow(/invalid CaptureResult/)
  })
})

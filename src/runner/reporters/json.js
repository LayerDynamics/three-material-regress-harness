// JSON reporter — canonical report format.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function writeJsonReport(report, path) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(report, null, 2))
  return path
}

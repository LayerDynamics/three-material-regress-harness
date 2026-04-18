import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url))

export default {
  testDir: 'tests/regression',
  testMatch: /.*\.spec\.js/,
  timeout: 180_000,
  workers: Number(process.env.EVTH_WORKERS ?? 2),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['junit', { outputFile: 'out/regression-junit.xml' }]],
  use: { baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    command: `npx vite preview --port 4175 --host 127.0.0.1 --strictPort`,
    url: 'http://127.0.0.1:4175',
    cwd: ROOT,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
}

import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url))

export default {
  testDir: 'tests/browser',
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    command: `npx vite --port 4175 --host 127.0.0.1 --strictPort`,
    url: 'http://127.0.0.1:4175',
    cwd: ROOT,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
}

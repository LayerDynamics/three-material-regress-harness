// Browser shim — node:* module stubs used only when the GUI bundle is served.
// Any Node-only code path that reaches these is a runner-side function that
// the browser should never call; we expose the common symbols as no-ops so
// the static import graph resolves without erroring.

const unavailable = (name) => () => {
  throw new Error(`tmrh: ${name}() is not available in the browser bundle (node-only API).`)
}

export const readFile = unavailable('readFile')
export const writeFile = unavailable('writeFile')
export const mkdir = unavailable('mkdir')
export const rm = unavailable('rm')
export const stat = unavailable('stat')
export const readdir = unavailable('readdir')
export const copyFile = unavailable('copyFile')
export const mkdtemp = unavailable('mkdtemp')
export const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
export const resolve = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
export const dirname = (p) => String(p ?? '').replace(/\/[^/]*$/, '')
export const relative = (from, to) => String(to ?? '')
export const tmpdir = () => '/tmp'
export const execSync = unavailable('execSync')
export const fileURLToPath = (u) => String(u ?? '')
export const createHash = unavailable('createHash')
export const Buffer = { from: unavailable('Buffer.from') }
export default {}

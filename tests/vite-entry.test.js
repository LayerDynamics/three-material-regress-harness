import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('vite entry files', () => {
  it('index.html has #root', () => {
    expect(readFileSync('index.html', 'utf8')).toMatch(/id="root"/)
  })

  it('main.js mounts App via createRoot', () => {
    const src = readFileSync('src/main.js', 'utf8')
    expect(src).toMatch(/createRoot/)
    expect(src).toMatch(/App/)
  })

  it('vite.config.js exists', () => {
    expect(existsSync('vite.config.js')).toBe(true)
  })

  it('dev server is pinned to 4175', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toMatch(/port:\s*4175/)
  })
})

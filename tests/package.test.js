import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('package.json contract', () => {
  it('is ESM', () => {
    expect(pkg.type).toBe('module')
  })

  it('declares bin entry tmrh', () => {
    expect(pkg.bin.tmrh).toBe('./src/runner/cli.js')
  })

  it('package name is three-material-regress-harness', () => {
    expect(pkg.name).toBe('three-material-regress-harness')
  })

  it('declares public exports', () => {
    expect(pkg.exports['.'].import).toBe('./src/index.js')
    expect(pkg.exports['.'].types).toBe('./index.d.ts')
  })

  it('engines node >=20', () => {
    expect(pkg.engines.node).toBe('>=20')
  })

  it('no jest dependency', () => {
    const jestInRuntime = pkg.dependencies?.jest
    const jestInDev = pkg.devDependencies?.jest
    expect(jestInRuntime).toBeUndefined()
    expect(jestInDev).toBeUndefined()
  })

  it('has the four user-mandated runtime peers (three, r3f, zustand, playwright)', () => {
    const three = pkg.peerDependencies?.three || pkg.dependencies?.three
    const r3f = pkg.peerDependencies?.['@react-three/fiber'] || pkg.dependencies?.['@react-three/fiber']
    const zus = pkg.peerDependencies?.zustand || pkg.dependencies?.zustand
    const pw = pkg.peerDependencies?.playwright || pkg.dependencies?.playwright || pkg.devDependencies?.playwright
    expect(three).toBeTruthy()
    expect(r3f).toBeTruthy()
    expect(zus).toBeTruthy()
    expect(pw).toBeTruthy()
  })

  it('files array ships src/ and index.d.ts', () => {
    expect(pkg.files).toContain('src/')
    expect(pkg.files).toContain('index.d.ts')
  })

  it('kmp-three-suite is optional peer', () => {
    expect(pkg.peerDependencies?.['kmp-three-suite']).toBeTruthy()
    expect(pkg.peerDependenciesMeta?.['kmp-three-suite']?.optional).toBe(true)
  })
})

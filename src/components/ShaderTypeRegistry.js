// Shader type registry — dispatches kmpShaderType strings to handler implementations.
// Mirrors file-browser-client/app/lib/renderer/ShaderTypeRegistry.ts (SPEC-07).

import { ShaderRegistrationError } from '../harness/exceptions.js'

const registry = new Map()

export function registerShaderType(type, handler) {
  if (!type || typeof type !== 'string') {
    throw new ShaderRegistrationError('registerShaderType: type string required')
  }
  if (!handler || typeof handler !== 'object') {
    throw new ShaderRegistrationError('registerShaderType: handler object required')
  }
  if (typeof handler.createMaterial !== 'function') {
    throw new ShaderRegistrationError(`registerShaderType(${type}): handler.createMaterial must be a function`)
  }
  if (typeof handler.updateMaterial !== 'function') {
    throw new ShaderRegistrationError(`registerShaderType(${type}): handler.updateMaterial must be a function`)
  }
  registry.set(type.toLowerCase(), handler)
}

export function getShaderTypeHandler(type) {
  if (!type) return null
  return registry.get(type.toLowerCase()) ?? null
}

export function hasCustomShaderType(type) {
  if (!type) return false
  return registry.has(type.toLowerCase())
}

export function getRegisteredShaderTypes() {
  return Array.from(registry.keys())
}

export function disposeAllShaderTypes() {
  for (const h of registry.values()) {
    try { h.dispose?.() } catch { /* swallow during dispose */ }
  }
  registry.clear()
}

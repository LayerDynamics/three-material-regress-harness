// Side-effect imports that auto-register every SPEC-07 shader handler into
// the harness's ShaderTypeRegistry. Consumers import this module from either
// the Vite entry (main.jsx) or their own application:
//
//   import 'three-material-regress-harness/dist/shaders'
//
// After this import, getShaderTypeHandler('lux_toon'), ('metallic_paint'),
// ('lux_translucent'), ('lux_velvet'), ('lux_anisotropic'), ('lux_glass'),
// ('lux_gem'), ('lux_xray'), ('lux_flat') all resolve.

import './ToonShader.js'
import './CarpaintShader.js'
import './SSSShader.js'
import './VelvetShader.js'
import './AnisotropicShader.js'
import './GlassGemShader.js'
import './XRayFlatShader.js'

export { ToonShaderHandler } from './ToonShader.js'
export { CarpaintShaderHandler } from './CarpaintShader.js'
export { SSSShaderHandler } from './SSSShader.js'
export { VelvetShaderHandler } from './VelvetShader.js'
export { AnisotropicShaderHandler } from './AnisotropicShader.js'
export { GlassShaderHandler, GemShaderHandler } from './GlassGemShader.js'
export { XRayShaderHandler, FlatShaderHandler } from './XRayFlatShader.js'

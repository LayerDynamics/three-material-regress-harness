import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App.jsx'
import './components/GUI/styles.css'
// Side-effect: register every SPEC-07 shader handler so the live GUI can
// render lux_toon / metallic_paint / lux_translucent / lux_velvet /
// lux_anisotropic / lux_glass / lux_gem / lux_xray / lux_flat correctly.
import './shaders/index.js'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

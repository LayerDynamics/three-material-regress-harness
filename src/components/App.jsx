import { useHarnessStore } from '../stores/harnessStore.js'
import { useRendererStore } from '../stores/rendererStore.js'

export function App() {
  const mode = useHarnessStore((s) => s.mode)
  const envName = useRendererStore((s) => typeof s.environment === 'string' ? s.environment : s.environment?.hdri ?? 'none')
  const toneMapping = useRendererStore((s) => s.toneMapping)

  return (
    <div id="evth-app" data-mode={mode} style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0 }}>extern-material-three-visual-test-harness</h1>
      <p style={{ color: '#666', marginTop: '0.25rem' }}>
        Visual regression harness for Three.js materials against external-renderer baselines.
      </p>
      <dl style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem' }}>
        <dt>Mode</dt><dd><code>{mode}</code></dd>
        <dt>Environment</dt><dd><code>{envName}</code></dd>
        <dt>Tone mapping</dt><dd><code>{toneMapping}</code></dd>
      </dl>
      <p style={{ marginTop: '2rem', color: '#888', fontSize: '0.9rem' }}>
        Full GUI (test selector, canvas, reference, diff, parameter panel, metrics) lands in milestone M4.
        See <code>docs/plans/2026-04-18-extern-material-three-visual-test-harness-implementation.md</code>.
      </p>
    </div>
  )
}

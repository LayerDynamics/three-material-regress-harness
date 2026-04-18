import { useHarnessStore } from '../../stores/harnessStore.js'
import { useTestStore } from '../../stores/testStore.js'

export function Topbar({ onRun, onCapture, onToggleHistory }) {
  const mode = useHarnessStore((s) => s.mode)
  const setMode = useHarnessStore((s) => s.setMode)
  const activeTestId = useHarnessStore((s) => s.activeTestId)
  const corpusDir = useTestStore((s) => s.corpusDir)

  return (
    <header className="evth-topbar">
      <span className="title">evth</span>
      <span className="sub">extern-material-three-visual-test-harness</span>
      <span className="spacer" />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        style={{ background: '#11131a', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 3, padding: '0.25rem 0.4rem' }}
        aria-label="harness mode"
      >
        <option value="browser">browser</option>
        <option value="headless">headless</option>
      </select>
      {corpusDir && <span className="sub">corpus: <code>{corpusDir}</code></span>}
      {activeTestId && <span className="sub">active: <code>{activeTestId}</code></span>}
      <button className="secondary" onClick={onToggleHistory}>History</button>
      <button className="secondary" onClick={onCapture}>Capture</button>
      <button onClick={onRun}>Run All</button>
    </header>
  )
}

import { useHarnessStore } from '../../stores/harnessStore.js'
import { useTestStore } from '../../stores/testStore.js'

export function Topbar({ onRun, onCapture }) {
  const mode = useHarnessStore((s) => s.mode)
  const activeTestId = useHarnessStore((s) => s.activeTestId)
  const corpusDir = useTestStore((s) => s.corpusDir)

  return (
    <header className="evth-topbar">
      <span className="title">evth</span>
      <span className="sub">extern-material-three-visual-test-harness</span>
      <span className="spacer" />
      <span className="sub">mode: <b>{mode}</b></span>
      {corpusDir && <span className="sub">corpus: <code>{corpusDir}</code></span>}
      {activeTestId && <span className="sub">active: <code>{activeTestId}</code></span>}
      <button className="secondary" onClick={onCapture}>Capture</button>
      <button onClick={onRun}>Run All</button>
    </header>
  )
}

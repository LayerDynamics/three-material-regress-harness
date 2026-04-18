import { useCallback } from 'react'
// Note: CSS import lives in main.jsx (Vite entry) so the library bundle stays
// CSS-free. Library consumers should import './components/GUI/styles.css'.
import { Topbar } from './GUI/Topbar.jsx'
import { Sidebar } from './GUI/Sidebar.jsx'
import { ViewPort } from './GUI/ViewPort.jsx'
import { Console } from './GUI/Console.jsx'
import { ParameterPanel } from './GUI/ParameterPanel.jsx'
import { DropZone } from './GUI/DropZone.jsx'
import { useHarnessStore } from '../stores/harnessStore.js'

export function App() {
  const pushEvent = useHarnessStore((s) => s.pushEvent)

  const onCapture = useCallback(() => {
    pushEvent({ name: 'topbar.capture.clicked' })
  }, [pushEvent])

  const onRun = useCallback(() => {
    pushEvent({ name: 'topbar.run.clicked' })
  }, [pushEvent])

  return (
    <div className="evth-app">
      <Topbar onRun={onRun} onCapture={onCapture} />
      <Sidebar />
      <ViewPort />
      <Console />
      <ParameterPanel />
      <DropZone />
    </div>
  )
}

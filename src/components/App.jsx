import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// Note: CSS import lives in main.jsx (Vite entry) so the library bundle stays
// CSS-free. Library consumers should import './components/GUI/styles.css'.
import { Topbar } from './GUI/Topbar.jsx'
import { Sidebar } from './GUI/Sidebar.jsx'
import { ViewPort } from './GUI/ViewPort.jsx'
import { Console } from './GUI/Console.jsx'
import { ParameterPanel } from './GUI/ParameterPanel.jsx'
import { DropZone } from './GUI/DropZone.jsx'
import { RunHistoryDrawer } from './GUI/RunHistoryDrawer.jsx'
import { ColorInspector } from './GUI/ColorInspector.jsx'
import { useHarnessStore } from '../stores/harnessStore.js'
import { useRendererStore } from '../stores/rendererStore.js'
import { useTestStore } from '../stores/testStore.js'
import { useRegressionStore } from '../stores/regressionStore.js'
import { startRealtimeDiff, decodeReferenceUrl } from '../harness/realtime.js'
import { saveRunBrowser } from '../harness/run-history.js'
import { Harness } from '../harness/harness.js'
import { recordCapture } from '../recorder/recorder.js'
import { run as runRegression } from '../runner/run.js'

export function App() {
  const pushEvent = useHarnessStore((s) => s.pushEvent)
  const activeTestId = useHarnessStore((s) => s.activeTestId)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reference, setReference] = useState(null) // { pixels, width, height }
  const [lastCandidate, setLastCandidate] = useState(null)
  const sweepResultsRef = useRef({})

  const test = useTestStore((s) => s.manifest.find((t) => t.id === activeTestId) ?? null)
  const rs = useRendererStore.getState()

  // Load the reference PNG when the active test changes.
  useEffect(() => {
    let cancelled = false
    if (!test?.referenceImagePath) {
      setReference(null)
      return
    }
    ;(async () => {
      try {
        const r = await decodeReferenceUrl(test.referenceImagePath)
        if (cancelled) return
        setReference(r)
      } catch (err) {
        pushEvent({ name: 'reference.load.error', payload: { error: err?.message ?? String(err) } })
      }
    })()
    return () => { cancelled = true }
  }, [test?.referenceImagePath, pushEvent])

  // Start/stop the realtime diff loop.
  useEffect(() => {
    if (!activeTestId || !reference) return undefined
    const stop = startRealtimeDiff({
      debounceMs: 120,
      loadReferencePixels: async () => reference,
      geometryFor: () => ({
        type: useRendererStore.getState().geometryKind,
        radius: 1, widthSegments: 64, heightSegments: 64,
      }),
    })
    return () => stop()
  }, [activeTestId, reference])

  const onCapture = useCallback(async () => {
    const def = useRendererStore.getState().materialDefinition
    if (!def) {
      pushEvent({ name: 'topbar.capture.skipped', payload: { reason: 'no MaterialDefinition' } })
      return
    }
    const state = useRendererStore.getState()
    const harness = new Harness({
      materialDefinition: def,
      geometry: { type: state.geometryKind, radius: 1, widthSegments: 64, heightSegments: 64 },
      pose: {
        cameraPosition: state.camera.position,
        cameraTarget: state.camera.target,
        cameraUp: state.camera.up,
        cameraFov: state.camera.fov,
        imageWidth: reference?.width ?? state.width,
        imageHeight: reference?.height ?? state.height,
        environment: state.environment,
        toneMapping: state.toneMapping,
      },
      environment: state.environment,
      testId: activeTestId ?? 'adhoc',
    })
    try {
      const capture = await harness.capture({ timeoutMs: 10_000 })
      await recordCapture(capture).catch(() => null) // browser → Blob URL
      setLastCandidate({ pixels: capture.pixels, width: capture.width, height: capture.height })
      pushEvent({ name: 'topbar.capture.done', payload: { testId: activeTestId, bytes: capture.pixels.length } })
    } catch (err) {
      pushEvent({ name: 'topbar.capture.error', payload: { error: err?.message ?? String(err) } })
    } finally {
      harness.dispose()
    }
  }, [activeTestId, reference, pushEvent])

  const onRun = useCallback(async () => {
    pushEvent({ name: 'topbar.run.clicked' })
    const harnessState = useHarnessStore.getState()
    if (harnessState.mode !== 'headless') {
      pushEvent({ name: 'topbar.run.skipped', payload: { reason: 'browser mode — run via CLI' } })
      return
    }
    const cfg = {
      corpus: './samples-to-match-identically-kmp-files',
      baseline: './baselines',
      out: './out/runs',
      workers: 2,
      report: ['json', 'html', 'junit'],
      tolerances: useRegressionStore.getState().tolerances,
      updateBaselines: false,
    }
    try {
      const report = await runRegression(cfg)
      await saveRunBrowser(report).catch(() => null)
      useHarnessStore.getState().pushRun(report)
      pushEvent({ name: 'topbar.run.done', payload: { pass: report.passCount, fail: report.failCount } })
    } catch (err) {
      pushEvent({ name: 'topbar.run.error', payload: { error: err?.message ?? String(err) } })
    }
  }, [pushEvent])

  const probeSweeps = useMemo(() => sweepResultsRef.current, [])

  return (
    <div className="tmrh-app">
      <Topbar
        onRun={onRun}
        onCapture={onCapture}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
      />
      <Sidebar />
      <ViewPort candidatePixels={lastCandidate} referencePixels={reference} />
      <Console />
      <ParameterPanel
        referencePixels={reference?.pixels}
        referenceSize={reference ? { width: reference.width, height: reference.height } : null}
      />
      <DropZone />
      <RunHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {reference && lastCandidate && (
        <div style={{ position: 'fixed', bottom: 180, right: 20, width: 320, zIndex: 80 }}>
          <ColorInspector
            candidatePixels={lastCandidate.pixels}
            referencePixels={reference.pixels}
            width={reference.width}
            height={reference.height}
            sweeps={probeSweeps}
          />
        </div>
      )}
    </div>
  )
}

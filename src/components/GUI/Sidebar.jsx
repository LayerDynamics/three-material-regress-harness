import { useMemo } from 'react'
import { useTestStore } from '../../stores/testStore.js'
import { useHarnessStore } from '../../stores/harnessStore.js'

export function Sidebar() {
  const manifest = useTestStore((s) => s.manifest)
  const activeTestId = useHarnessStore((s) => s.activeTestId)
  const setActiveTest = useHarnessStore((s) => s.setActiveTest)

  const groups = useMemo(() => {
    const byVariant = new Map()
    for (const t of manifest) {
      if (!byVariant.has(t.variant)) byVariant.set(t.variant, [])
      byVariant.get(t.variant).push(t)
    }
    return Array.from(byVariant.entries()).map(([variant, tests]) => ({
      variant,
      tests: tests.slice().sort((a, b) => a.view.localeCompare(b.view)),
    }))
  }, [manifest])

  if (groups.length === 0) {
    return (
      <aside className="tmrh-sidebar">
        <h2>Tests</h2>
        <div className="empty">No corpus loaded. Drop a manifest.json or run `tmrh run`.</div>
      </aside>
    )
  }

  return (
    <aside className="tmrh-sidebar">
      <h2>Tests</h2>
      {groups.map(({ variant, tests }) => (
        <div className="group" key={variant}>
          <h2 style={{ marginTop: '0.75rem' }}>{variant}</h2>
          {tests.map((t) => (
            <div
              key={t.id}
              className={`item ${activeTestId === t.id ? 'active' : ''}`}
              onClick={() => setActiveTest(t.id)}
            >
              {t.view}
            </div>
          ))}
        </div>
      ))}
    </aside>
  )
}

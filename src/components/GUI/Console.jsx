import { useHarnessStore } from '../../stores/harnessStore.js'

export function Console() {
  const events = useHarnessStore((s) => s.events)
  const last = events.slice(-100)
  return (
    <section className="tmrh-console">
      {last.length === 0 && <div style={{ color: 'var(--muted)' }}>no harness events yet</div>}
      {last.map((e, i) => (
        <div className="row" key={i}>
          <span className="ts">{new Date(e.ts).toISOString().slice(11, 23)}</span>
          <span className="name">{e.name}</span>
          {e.payload && <span className="payload">{JSON.stringify(e.payload)}</span>}
        </div>
      ))}
    </section>
  )
}

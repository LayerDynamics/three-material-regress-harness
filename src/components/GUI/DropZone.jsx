import { useEffect, useState } from 'react'
import { useRendererStore } from '../../stores/rendererStore.js'
import { useHarnessStore } from '../../stores/harnessStore.js'

export function DropZone() {
  const [active, setActive] = useState(false)
  const setDefinition = useRendererStore((s) => s.setMaterialDefinition)
  const pushEvent = useHarnessStore((s) => s.pushEvent)

  useEffect(() => {
    const onDragEnter = (e) => { e.preventDefault(); setActive(true) }
    const onDragOver = (e) => { e.preventDefault() }
    const onDragLeave = (e) => {
      if (e.target === document.documentElement || e.target === document.body) setActive(false)
    }
    const onDrop = async (e) => {
      e.preventDefault()
      setActive(false)
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) {
        const lc = file.name.toLowerCase()
        if (lc.endsWith('.json')) {
          const text = await file.text()
          try {
            const def = JSON.parse(text)
            setDefinition(def)
            pushEvent({ name: 'dropzone.load.json', payload: { file: file.name } })
          } catch (err) {
            pushEvent({ name: 'dropzone.error', payload: { file: file.name, error: err?.message ?? String(err) } })
          }
        } else if (lc.endsWith('.kmp')) {
          try {
            const kmpSuite = await import(/* @vite-ignore */ 'kmp-three-suite')
            const bytes = new Uint8Array(await file.arrayBuffer())
            const results = await kmpSuite.process(bytes, { includeHexDump: false, includeCoverage: false })
            if (results.length > 0) {
              const def = kmpSuite.toMaterialDefinitionOnly
                ? kmpSuite.toMaterialDefinitionOnly(results[0])
                : results[0].materialDefinition
              setDefinition(def)
              pushEvent({ name: 'dropzone.load.kmp', payload: { file: file.name, shader: results[0].shaderType } })
            }
          } catch (err) {
            pushEvent({ name: 'dropzone.error', payload: { file: file.name, error: err?.message ?? String(err) } })
          }
        } else {
          pushEvent({ name: 'dropzone.skip', payload: { file: file.name, reason: 'unsupported file type' } })
        }
      }
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [setDefinition, pushEvent])

  return (
    <div className={`tmrh-dropzone ${active ? 'active' : ''}`}>
      <div className="hint">drop .kmp or materialDefinition.json</div>
    </div>
  )
}

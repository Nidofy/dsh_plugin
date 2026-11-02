import { useState } from 'react'
import { assembleProject, splitProject } from '../project.ts'
import { CodeEditor, type CodeEditorProps } from './CodeEditor.tsx'
import type { Exercise, LabApi } from '../types.ts'

export function ProjectEditor({
  exercise,
  siblings,
  api,
  ...editor
}: CodeEditorProps & { exercise: Exercise; siblings: Exercise[]; api: LabApi }) {
  const [selected, select] = useState('')
  const [preview, setPreview] = useState<{ name: string; code: string; from: string }>()
  const [error, setError] = useState('')
  let split
  try {
    split = splitProject(editor.value, exercise.components!)
  } catch {
    /* Full-source editing repairs missing markers. */
  }
  const part = split?.parts.find((p) => p.name === selected)
  const contract = exercise.components!.find((p) => p.name === selected)
  const apply = (name: string, value: string) => {
    const current = splitProject(editor.value, exercise.components!)
    editor.onChange(
      assembleProject(
        current.preamble,
        current.parts.map((p) =>
          p.name === name ? { ...p, code: value.endsWith('\n') ? value : value + '\n' } : p,
        ),
      ),
    )
  }
  return (
    <section>
      <label>
        PyTorch 可求导组件 / Project component
        <select
          value={selected}
          onChange={(e) => {
            select(e.target.value)
            setPreview(undefined)
          }}
          disabled={editor.readOnly}
        >
          <option value="">完整源码 / Full submission</option>
          {exercise.components!.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      {contract && (
        <p>
          v{contract.version} · 依赖 / Requires {contract.dependsOn.join(', ') || '—'}
        </p>
      )}
      {part &&
        siblings
          .filter(
            (e) =>
              e.id !== exercise.id &&
              e.components?.some((c) => c.name === part.name && c.version === contract?.version),
          )
          .map((other) => (
            <button
              key={other.id}
              disabled={editor.readOnly}
              onClick={async () => {
                try {
                  const saved = await api.workspace(other.id)
                  const source = splitProject(saved.draft, other.components!).parts.find(
                    (p) => p.name === selected,
                  )!
                  setPreview({ ...source, from: other.id })
                  setError('')
                } catch (e) {
                  setError(String(e))
                }
              }}
            >
              载入组件 / Load {other.id} · {part.name}
            </button>
          ))}
      {preview && preview.name === selected && part && (
        <details open>
          <summary>
            {preview.from} · {preview.name}
          </summary>
          <pre>{preview.code}</pre>
          <button
            disabled={editor.readOnly}
            onClick={() => {
              apply(part.name, preview.code)
              setPreview(undefined)
            }}
          >
            应用到草稿 / Apply component
          </button>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      <CodeEditor
        {...editor}
        value={part?.code ?? editor.value}
        onChange={(v) => (part ? apply(part.name, v) : editor.onChange(v))}
      />
    </section>
  )
}

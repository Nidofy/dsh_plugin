import { useLayoutEffect, useRef, useState } from 'react'
import type { Exercise, LabApi, ProjectFile, RunRecord } from '../types.ts'

export function ProjectExchange({
  api,
  exercise,
  run,
  busy,
  onApply,
}: {
  api: LabApi
  exercise: Exercise
  run?: RunRecord
  busy: boolean
  onApply: (file: ProjectFile) => void
}) {
  const [file, setFile] = useState<ProjectFile>()
  const [error, setError] = useState('')
  const [comparison, setComparison] = useState<{ id: string; message: string }>()
  const generation = useRef(0)
  const previousContext = useRef({ api, exercise: exercise.id })
  useLayoutEffect(() => {
    generation.current++
    setComparison(undefined)
    setError('')
    if (previousContext.current.api !== api || previousContext.current.exercise !== exercise.id)
      setFile(undefined)
    previousContext.current = { api, exercise: exercise.id }
    return () => { generation.current++ }
  }, [api, exercise.id, run?.id, run?.run_status, busy])
  const exportable = !!run && run.run_status === 'completed' && !busy
  async function download() {
    if (!run || !exportable) return
    const token = ++generation.current
    setError('')
    try {
    const bundle = await api.projectFile(run.id)
    if (token !== generation.current) return
    const uri = URL.createObjectURL(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = uri
    a.download = exercise.id + '-' + run.id + '.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(uri), 1000)
    } catch (e) { if (token === generation.current) setError(String(e)) }
  }
  async function verify() {
    if (!run || !file || !exportable) return
    const token = ++generation.current
    setComparison(undefined)
    setError('')
    try {
    const actual = await api.projectFile(run.id)
    if (token !== generation.current) return
    const changed = (
      [
        'exerciseId',
        'codeHash',
        'image',
        'contentVersion',
        'testVersion',
        'seed',
        'learningRate',
        'signature',
      ] as const
    ).filter((k) => actual[k] !== file[k])
    const differences: string[] = [...changed]
    for (const key of ['protocol', 'dataset', 'splitHash', 'initialHash', 'batchHash'] as const)
      if (actual.manifest[key] !== file.manifest[key]) differences.push(key)
    setComparison({
      id: run.id,
      message: differences.length
        ? '差异 / Differences: ' + differences.join(', ')
        : '复现摘要一致（不验证导入来源） / Replay matched (import provenance unverified)',
    })
    } catch (e) { if (token === generation.current) setError(String(e)) }
  }
  return (
    <section aria-label="项目复现 Project replay">
      <h3>项目复现 / Project replay</h3>
      <button
        disabled={!exportable}
        onClick={() => void download()}
      >
        导出选中运行 / Export selected run
      </button>
      <label>
        预览实验文件 / Preview project file
        <input
          type="file"
          accept=".json"
          disabled={busy}
          onChange={async (e) => {
            const input = e.target.files?.[0]
            const token = ++generation.current
            setFile(undefined)
            setComparison(undefined)
            setError('')
            if (!input) return
            try {
              if (input.size > 200000) throw Error('File exceeds 200 KB')
              const text = await input.text()
              if (token !== generation.current) return
              const inspected = await api.inspectProject(exercise.id, text)
              if (token === generation.current) setFile(inspected)
            } catch (err) {
              if (token === generation.current) setError(String(err))
            }
          }}
        />
      </label>
      {file && (
        <>
          <p role="note">导入文件的来源、指标与解释尚未验证；格式校验和摘要一致不能证明来源真实性。载入草稿后请重新运行。
            {' / Imported provenance, results and explanations are unverified. Format checks and matching digests do not authenticate the source. Rerun the draft.'}</p>
          <p>
            来源 / Original run {file.runId} · seed {file.seed} · lr {file.learningRate} ·{' '}
            {file.image}
          </p>
          <p>{file.prediction}</p>
          <pre>{file.code}</pre>
          {file.explanations.map((v, i) => (
            <blockquote key={i}>{v}</blockquote>
          ))}
          <button disabled={busy} onClick={() => onApply(file)}>
            载入代码与参数到草稿 / Load draft for review
          </button>
          <button
            disabled={!exportable}
            onClick={() => void verify()}
          >
            核对选中运行 / Verify replay
          </button>
          {comparison?.id === run?.id && <p role="status">{comparison?.message}</p>}
        </>
      )}
      {run && (
        <details>
          <summary>组件与帮助记录 / Component manifest</summary>
          <p>
            {run.attemptId} · {run.help} · {run.check_status} · {run.variantOf ?? run.id}
          </p>
          {run.components?.map((c) => (
            <p key={c.name}>
              {c.name} v{c.version} · {c.sha256}
            </p>
          ))}
        </details>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

import { useState } from 'react'
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
  async function download() {
    if (!run) return
    const bundle = await api.projectFile(run.id)
    const uri = URL.createObjectURL(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = uri
    a.download = exercise.id + '-' + run.id + '.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(uri), 1000)
  }
  async function verify() {
    if (!run || !file) return
    const actual = await api.projectFile(run.id)
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
        : '复现一致 / Replay matched',
    })
  }
  return (
    <section aria-label="项目复现 Project replay">
      <h3>项目复现 / Project replay</h3>
      <button
        disabled={!run || busy}
        onClick={() => void download().catch((e) => setError(String(e)))}
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
            setFile(undefined)
            setComparison(undefined)
            setError('')
            if (!input) return
            try {
              if (input.size > 200000) throw Error('File exceeds 200 KB')
              setFile(await api.inspectProject(exercise.id, await input.text()))
            } catch (err) {
              setError(String(err))
            }
          }}
        />
      </label>
      {file && (
        <>
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
            disabled={!run || busy}
            onClick={() => void verify().catch((e) => setError(String(e)))}
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

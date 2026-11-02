import { useState } from 'react'
import type { RunRecord, RunEvent } from '../types.ts'
import { createApi } from '../client-api.ts'
export function Diagnostic({ run, event }: { run: RunRecord; event: RunEvent }) {
  const [matrix, setMatrix] = useState<number[][]>()
  const [clip, setClip] = useState(false)
  const [error, setError] = useState('')
  const values =
    matrix
      ?.flat()
      .map(Math.abs)
      .sort((a, b) => a - b) ?? []
  const stride = event.stride ?? 1
  const scale = values[Math.max(0, Math.ceil(values.length * (clip ? 0.95 : 1)) - 1)] || 1
  return (
    <section aria-label={event.name}>
      <button
        onClick={async () => {
          try {
            setMatrix(await createApi().diagnostic(run.id, event.artifactId!, run.codeHash!))
          } catch (e) {
            setError(String(e))
          }
        }}
      >
        查看热图 / Inspect {event.name}
      </button>
      <small>
        {event.detail} · step {event.step} · {event.artifactId}
      </small>
      {error && <p role="alert">{error}</p>}
      {matrix && (
        <>
          <p>
            Run {run.id} · SHA-256 {run.codeHash} · seed {run.seed} ·{' '}
            {run.trainingManifest?.protocol} · {run.resolvedImageId}
          </p>
          <label>
            <input type="checkbox" checked={clip} onChange={(e) => setClip(e.target.checked)} />
            95% 色阶截断 / Clip colour at P95
          </label>
          <p>色阶上限 / Colour maximum {scale} · 原始数值 / Exact values</p>
          <div className="nl-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Q / K</th>
                  {matrix[0]?.map((_, j) => (
                    <th key={j}>{j * stride}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i}>
                    <th>{i * stride}</th>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        title={
                          run.id +
                          ' / ' +
                          event.artifactId +
                          ' [' +
                          i * stride +
                          ',' +
                          j * stride +
                          '] = ' +
                          v
                        }
                        style={{
                          backgroundColor:
                            'rgba(45,147,155,' + Math.min(0.75, (0.75 * Math.abs(v)) / scale) + ')',
                        }}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

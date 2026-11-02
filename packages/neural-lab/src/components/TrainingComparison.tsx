import { useState } from 'react'
import type { RunRecord } from '../types.ts'
import { MetricChart } from './RunResults.tsx'

function changedLines(left: string, right: string) {
  const a = left.split('\n'),
    b = right.split('\n')
  let first = 0,
    endA = a.length,
    endB = b.length
  while (first < endA && first < endB && a[first] === b[first]) first++
  while (endA > first && endB > first && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  // Bound the edit-distance table; the raw snapshots remain available for unusually long edits.
  const rows = a.slice(first, endA),
    cols = b.slice(first, endB)
  if (rows.length * cols.length > 200000)
    return [...rows.map((v) => '- ' + v), ...cols.map((v) => '+ ' + v)].join('\n')
  const lengths = Array.from({ length: rows.length + 1 }, () => new Uint32Array(cols.length + 1))
  for (let i = rows.length - 1; i >= 0; i--)
    for (let j = cols.length - 1; j >= 0; j--)
      lengths[i]![j] =
        rows[i] === cols[j]
          ? 1 + lengths[i + 1]![j + 1]!
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
  const out: string[] = []
  let i = 0,
    j = 0
  while (i < rows.length || j < cols.length) {
    if (i < rows.length && j < cols.length && rows[i] === cols[j]) {
      out.push('  ' + rows[i++])
      j++
    } else if (j === cols.length || (i < rows.length && lengths[i + 1]![j]! >= lengths[i]![j + 1]!))
      out.push('- ' + rows[i++])
    else out.push('+ ' + cols[j++])
  }
  return out.join('\n')
}

export function TrainingComparison({ runs }: { runs: RunRecord[] }) {
  const [left, setLeft] = useState(''),
    [right, setRight] = useState('')
  const candidates = runs.filter(
    (r) =>
      r.run_status === 'completed' &&
      r.trainingManifest &&
      r.events.some((e) => e.name === 'validation_loss'),
  )
  const a = candidates.find((r) => r.id === left) ?? candidates[0]
  const matches = a
    ? candidates.filter(
        (r) =>
          r.id !== a.id &&
          r.seed === a.seed &&
          r.testVersion === a.testVersion &&
          r.resolvedImageId === a.resolvedImageId &&
          r.trainingManifest!.protocol === a.trainingManifest!.protocol &&
          r.trainingManifest!.dataset === a.trainingManifest!.dataset &&
          r.trainingManifest!.initialHash === a.trainingManifest!.initialHash &&
          r.trainingManifest!.splitHash === a.trainingManifest!.splitHash &&
          r.trainingManifest!.batchHash === a.trainingManifest!.batchHash,
      )
    : []
  const b = matches.find((r) => r.id === right) ?? matches[0]
  return (
    <section aria-label="同种子运行对照 Run comparison">
      <h3>同种子运行对照 / Compare runs</h3>
      {a && (
        <label>
          目标运行 A
          <select value={a.id} onChange={(e) => setLeft(e.target.value)}>
            {candidates.map((r) => (
              <option key={r.id} value={r.id} title={r.id}>
                {r.createdAt} · Seed {r.seed} · {r.check_status} · {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      {a && b ? (
        <>
          <label>
            比较运行 B
            <select value={b.id} onChange={(e) => setRight(e.target.value)}>
              {matches.map((r) => (
                <option key={r.id} value={r.id} title={r.id}>
                  {r.createdAt} · Seed {r.seed} · {r.check_status} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <p>
            Seed {a.seed} · A: {JSON.stringify(a.effectiveConfig)} · B:{' '}
            {JSON.stringify(b.effectiveConfig)}
          </p>
          <p>
            改变的变量 / Changed variables:{' '}
            {[
              ...(a.code !== b.code ? ['code'] : []),
              ...Object.keys({ ...a.effectiveConfig, ...b.effectiveConfig }).filter(
                (k) =>
                  JSON.stringify(a.effectiveConfig?.[k]) !== JSON.stringify(b.effectiveConfig?.[k]),
              ),
            ].join(', ') || '—'}
          </p>
          <pre aria-label="代码差异 Code diff">
            {changedLines(a.code, b.code) || '代码相同 / Identical code'}
          </pre>
          <MetricChart
            caption="两次运行的误差曲线 / Loss across two runs"
            series={[a, b].flatMap((r, i) =>
              ['train_loss', 'validation_loss'].map((name) => ({
                name: (i ? 'B ' : 'A ') + name,
                points: r.events.filter((e) => e.name === name && e.source === 'program'),
              })),
            )}
          />
        </>
      ) : (
        <p>用相同种子再运行一次，可单独改变学习率或训练代码。 / Run again with the same seed.</p>
      )}
    </section>
  )
}

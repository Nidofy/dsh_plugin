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
  return [
    ...a.slice(first, endA).map((line) => '- ' + line),
    ...b.slice(first, endB).map((line) => '+ ' + line),
  ].join('\n')
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
              <option key={r.id}>{r.id}</option>
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
                <option key={r.id}>{r.id}</option>
              ))}
            </select>
          </label>
          <p>
            Seed {a.seed} · A: {JSON.stringify(a.effectiveConfig)} · B:{' '}
            {JSON.stringify(b.effectiveConfig)}
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

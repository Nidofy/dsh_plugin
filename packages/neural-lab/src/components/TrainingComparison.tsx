import { useState } from 'react'
import type { RunRecord } from '../types.ts'
import { MetricChart } from './RunResults.tsx'

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object')
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}'
  return JSON.stringify(value) ?? 'unknown'
}

export function comparisonFactors(a: RunRecord, b: RunRecord) {
  const factor = (name: string, left: unknown, right: unknown) => ({
    name, left, right,
    status: left === undefined || right === undefined || left === '' || right === ''
      ? '未知 / Unknown' : stable(left) === stable(right) ? '相同 / Same' : '变化 / Changed',
  })
  return [
    factor('活动 / Activity', a.exerciseId, b.exerciseId),
    factor('代码 / Code', a.code, b.code),
    factor('代码哈希 / Code hash', a.codeHash, b.codeHash),
    factor('实际配置 / Effective config', a.effectiveConfig, b.effectiveConfig),
    factor('种子 / Seed', a.seed, b.seed),
    factor('环境 / Environment', a.environment, b.environment),
    factor('镜像身份 / Image digest', a.resolvedImageId, b.resolvedImageId),
    factor('内容版本 / Content version', a.contentVersion, b.contentVersion),
    factor('检查版本 / Test version', a.testVersion, b.testVersion),
    factor('组件版本 / Components', a.components, b.components),
    ...(['protocol', 'dataset', 'splitHash', 'initialHash', 'batchHash'] as const).map((key) =>
      factor(key, a.trainingManifest?.[key], b.trainingManifest?.[key])),
  ]
}

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
      r.events.some((e) => e.name === 'validation_loss'),
  )
  const a = candidates.find((r) => r.id === left) ?? candidates[0]
  const matches = a
    ? candidates.filter(
        (r) =>
          r.id !== a.id && r.exerciseId === a.exerciseId,
      )
    : []
  const b = matches.find((r) => r.id === right) ?? matches[0]
  return (
    <section aria-label="同种子运行对照 Run comparison">
      <h3>运行对照与归因 / Compare runs and attribution</h3>
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
          <p>Run A: {a.id} · Run B: {b.id}</p>
          <p role="note">
            变量变化或未知时，不可直接因果归因；即使记录一致，两次运行也不能证明因果。每次只改变一个因素，并重复验证。
            {' / Changes or unknown factors prevent direct causal attribution. Matching records alone do not prove causality; vary one factor and repeat.'}
          </p>
          <div className="nl-table-wrap"><table aria-label="归因因素 Attribution factors">
            <thead><tr><th>因素 / Factor</th><th>状态 / Status</th><th>A</th><th>B</th></tr></thead>
            <tbody>{comparisonFactors(a, b).map((f) => <tr key={f.name}>
              <th>{f.name}</th><td>{f.status}</td>
              <td>{f.name === '代码 / Code' ? '见下方差异 / See diff' : stable(f.left)}</td>
              <td>{f.name === '代码 / Code' ? '见下方差异 / See diff' : stable(f.right)}</td>
            </tr>)}</tbody>
          </table></div>
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
        <p>需要同一活动的两次已完成训练；建议固定种子，仅改变一个因素。 / Complete two runs of the same activity; keep the seed and vary one factor.</p>
      )}
    </section>
  )
}

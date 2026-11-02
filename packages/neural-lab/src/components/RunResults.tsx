import type { RunRecord, RunEvent } from '../types.ts'
interface Series {
  name: string
  points: RunEvent[]
}
const colors = ['#238b81', '#d88935', '#6664b5', '#bf5374', '#447eb6', '#679448']
export function MetricChart({ series, caption }: { series: Series[]; caption?: string }) {
  const values = series.flatMap((s) => s.points.map((p) => p.value!))
  const steps = series.flatMap((s) => s.points.map((p, i) => p.step ?? i))
  const logScale = values.every((v) => v > 0) && Math.max(...values) / Math.min(...values) >= 1000
  const axis = (v: number) => (logScale ? Math.log10(v) : v)
  const rawMin = Math.min(...values.map(axis)),
    rawMax = Math.max(...values.map(axis))
  const padding =
    rawMin === rawMax ? Math.max(Math.abs(rawMin) * 0.1, 0.01) : (rawMax - rawMin) * 0.06
  const low = rawMin - padding,
    high = rawMax + padding
  const first = Math.min(...steps),
    last = Math.max(...steps)
  const x = (step: number) => (first === last ? 265 : 55 + (425 * (step - first)) / (last - first))
  const y = (value: number) => 150 - (130 * (axis(value) - low)) / (high - low)
  return (
    <figure className="nl-chart">
      <figcaption>
        {caption ??
          (series.length > 1 ? 'Loss 对照 · 同一运行，共享坐标轴 / Shared scale' : series[0]!.name)}
        {logScale && ' · 对数 / log₁₀'}
      </figcaption>
      <ul className="nl-legend">
        {series.map((s, i) => (
          <li key={s.name}>
            <span style={{ background: colors[i % colors.length] }} />
            {s.name}
          </li>
        ))}
      </ul>
      <svg
        role="img"
        aria-label={
          series.length > 1 ? '共享 Loss 曲线 Shared loss chart' : `${series[0]!.name} 曲线`
        }
        viewBox="0 0 500 180"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="55"
              x2="480"
              y1={20 + 130 * t}
              y2={20 + 130 * t}
              stroke="currentColor"
              opacity=".12"
            />
            <text x="4" y={24 + 130 * t} fontSize="11">
              {(logScale ? 10 ** (high - (high - low) * t) : high - (high - low) * t).toPrecision(
                3,
              )}
            </text>
          </g>
        ))}
        <path d="M55 15V150H480" fill="none" stroke="currentColor" opacity=".5" />
        <text x="55" y="173" fontSize="11">
          {first}
        </text>
        <text x="455" y="173" fontSize="11">
          {last}
        </text>
        {series.map((s, index) => (
          <g key={s.name} data-series={s.name}>
            <polyline
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="2"
              points={s.points.map((p, i) => `${x(p.step ?? i)},${y(p.value!)}`).join(' ')}
            />
            {s.points.map((p, i) => (
              <circle
                key={p.seq}
                cx={x(p.step ?? i)}
                cy={y(p.value!)}
                r="2"
                fill={colors[index % colors.length]}
              >
                <title>
                  {s.name} · {p.step ?? i}: {p.value}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <details>
        <summary>采样值 / Values</summary>
        {series.map((s) => (
          <pre key={s.name}>
            {s.name}
            {'\n'}
            {s.points.map((p, i) => `${p.step ?? i}: ${p.value}`).join('\n')}
          </pre>
        ))}
      </details>
    </figure>
  )
}
export function RunResults({ run }: { run: RunRecord }) {
  const metrics = new Map<string, RunEvent[]>()
  for (const event of run.events) {
    if (event.type === 'metric' && typeof event.value === 'number' && Number.isFinite(event.value))
      metrics.set(event.name, [...(metrics.get(event.name) ?? []), event])
  }
  const series = [...metrics].map(([name, points]) => ({ name, points }))
  const scalar = series.filter((s) => s.points.length === 1)
  const sequences = series.filter((s) => s.points.length > 1)
  const losses = sequences.filter(
    (s) => !s.name.startsWith('student_') && /loss|^(train|valid)(_|$)/i.test(s.name),
  )
  const other = sequences.filter((s) => !losses.includes(s))
  return (
    <section className="nl-results" aria-label="运行结果 Results" data-run-id={run.id}>
      <div className="nl-result-heading">
        <h3>运行结果 / Results</h3>
        <span className={`nl-verdict nl-verdict-${run.check_status}`}>
          {run.run_status} · {run.check_status}
        </span>
      </div>
      <details className="nl-run-meta">
        <summary>运行身份 / Run {run.id}</summary>
        <p>
          Seed {run.seed} · Content {run.contentVersion} / Tests {run.testVersion}
        </p>
        <p>{run.environment}</p>
        {run.trainingManifest && <pre>{JSON.stringify(run.trainingManifest, null, 2)}</pre>}
        {run.prediction && <p>运行前预测 / Prediction: {run.prediction}</p>}
      </details>
      {run.effectiveConfig && (
        <details open>
          <summary>实际采用参数 / Effective configuration</summary>
          <pre>{JSON.stringify(run.effectiveConfig, null, 2)}</pre>
        </details>
      )}
      {run.events
        .filter((e) => e.type === 'sample')
        .map((e) => (
          <p key={e.seq}>
            模型采样 / Generated text <code>{e.detail}</code>
          </p>
        ))}
      {run.reason && (
        <p role="alert" className="nl-error">
          {run.reason}
        </p>
      )}
      {run.trainingManifest && (
        <p>
          student_* 为学习者报告，train_loss 与 validation_loss 由控制器从参数重算。 / Student
          reports and independently computed errors.
        </p>
      )}
      <ul className="nl-checks">
        {run.events
          .filter((e) => e.type === 'check')
          .map((e) => (
            <li key={e.seq}>
              {e.passed ? '✓' : '✗'} {e.name} {e.detail}
            </li>
          ))}
      </ul>
      <div className="nl-stats">
        {scalar.map((s) => (
          <div className="nl-stat" key={s.name} aria-label={`${s.name} 统计值`}>
            <span>{s.name}</span>
            <strong title={String(s.points[0]!.value)}>{s.points[0]!.value!.toPrecision(5)}</strong>
            <small>Step {s.points[0]!.step ?? 0} · 1 个真实采样 / sample</small>
            <details>
              <summary>原始值 / Exact value</summary>
              <code>{String(s.points[0]!.value)}</code>
            </details>
          </div>
        ))}
      </div>
      {losses.length > 0 && <MetricChart series={losses} />}
      {other.map((s) => (
        <MetricChart key={s.name} series={[s]} />
      ))}
      {run.events
        .filter((e) => e.type === 'tensor' && e.data)
        .map((e) => {
          const scale = Math.max(...e.data!.flat().map(Math.abs), 1e-12)
          return (
            <figure key={e.seq}>
              <figcaption>
                {e.name} · {e.data!.length} × {e.data![0]?.length ?? 0}
              </figcaption>
              <div className="nl-table">
                <table aria-label={`${e.name} 热图 Heatmap`}>
                  <tbody>
                    {e.data!.map((row, i) => (
                      <tr key={i}>
                        {row.map((value, j) => (
                          <td
                            key={j}
                            title={`[${i},${j}]=${value}`}
                            style={{
                              background: `rgba(${value < 0 ? '197,100,60' : '35,139,129'},${Math.min(0.8, (Math.abs(value) / scale) * 0.7 + 0.04)})`,
                            }}
                          >
                            {value.toPrecision(3)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </figure>
          )
        })}
      {run.events
        .filter((e) => e.type === 'artifact')
        .map((e) => (
          <p key={e.seq}>
            产物 Artifact: <code>{e.path}</code> {e.detail}
          </p>
        ))}
      {run.cleanupPending && <p role="alert">回收待确认 / Cleanup pending: {run.cleanupPending}</p>}
      <details open={run.run_status === 'failed'}>
        <summary>日志 / Logs</summary>
        <pre>{run.log || '尚无日志 / No logs yet'}</pre>
      </details>
    </section>
  )
}

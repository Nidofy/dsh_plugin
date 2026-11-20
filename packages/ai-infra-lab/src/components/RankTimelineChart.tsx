import type { Locale, RunEvent } from '../types.ts'
import { LegendItem } from './ExplorerPanel.tsx'

const colors = ['var(--ail-accent-hover)', 'var(--ail-sim-fg)', 'var(--ail-measured-fg)', 'var(--ail-formula-fg)', 'var(--ail-sign-fg)']

export function RankTimelineChart({ events, locale }: { events: readonly RunEvent[]; locale: Locale }) {
  const traces = events.filter(event => event.timeline?.length)
  if (!traces.length) return null
  return <section className="ail-card ail-chart">
    <h3>{{zh:'各进程通信时间线',en:'Communication timeline by rank'}[locale]}</h3>
    {traces.map(event => {
      // Each harness invocation has its own time origin. Compare ranks within that step.
      const calls = event.timeline!
      const start = Math.min(...calls.map(c => c.startMs))
      const span = Math.max(...calls.map(c => c.endMs)) - start
      const ranks = [...new Set(calls.map(c => c.rank))].sort((a,b) => a-b)
      const ops = [...new Set(calls.map(c => c.op))].sort()
      const color = (op: string) => colors[ops.indexOf(op) % colors.length]!
      const scale = (ms: number) => 548 * ms / (span || 1)
      return <figure key={event.seq}>
        <figcaption>{event.step ?? event.name} · {span.toFixed(3)} ms</figcaption>
        <svg viewBox={`0 0 648 ${ranks.length*28+30}`} role="img" aria-label={{zh:'按进程排列的通信调用',en:'Communication calls grouped by rank'}[locale]}>
          {ranks.map((rank,index) => <g key={rank} transform={`translate(0 ${index*28+4})`}>
            <text x="0" y="14" fill="currentColor" fontSize="13">Rank {rank}</text>
            <rect x="64" width="548" height="19" rx="3" fill="var(--ail-surface-2)" />
            {calls.filter(c => c.rank === rank).map((c,i) => <rect key={i} x={64+scale(c.startMs-start)} y="2"
              width={Math.max(1,scale(c.endMs-c.startMs))} height="15" fill={color(c.op)}>
              <title>{c.op} · {(c.startMs-start).toFixed(3)}–{(c.endMs-start).toFixed(3)} ms</title>
            </rect>)}
          </g>)}
          {[0,0.5,1].map(f => <text key={f} x={64+548*f} y={ranks.length*28+18} textAnchor="middle"
            fill="currentColor" fontSize="12">{(span*f).toFixed(2)} ms</text>)}
        </svg>
        <div className="ail-legend">{ops.map(op => <LegendItem key={op} color={color(op)}>{op}</LegendItem>)}</div>
        <details><summary>{{zh:'查看原始调用时刻（相对进程组启动）',en:'Raw call times from process-group launch'}[locale]}</summary>
          <table><thead><tr><th>Rank</th><th>{{zh:'调用',en:'Call'}[locale]}</th><th>{{zh:'开始',en:'Start'}[locale]} (ms)</th><th>{{zh:'结束',en:'End'}[locale]} (ms)</th></tr></thead>
            <tbody>{calls.map((c,i)=><tr key={i}><td>{c.rank}</td><td>{c.op}</td><td>{c.startMs.toFixed(3)}</td><td>{c.endMs.toFixed(3)}</td></tr>)}</tbody>
          </table>
        </details>
      </figure>
    })}
  </section>
}

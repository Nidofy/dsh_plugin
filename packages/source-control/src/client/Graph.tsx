import type { Commit } from '../shared.ts'
import type { en } from './messages.ts'

/** Edges use actual parent identities. Parents outside the 40-row window end in dashed stubs. */
export function layout(commits: Commit[]) {
  const lanes = new Map<string, number>(), positions = new Map<string, { x: number; y: number }>()
  const normalized = commits.map(c => ({ ...c, parents: c.parents.map(p => p.slice(-40)).filter(p => !/^0+$/.test(p)) }))
  let nextLane = 1
  for (const [index, commit] of normalized.entries()) {
    const lane = lanes.get(commit.node) ?? 0
    positions.set(commit.node, { x: lane * 14 + 8, y: index * 64 + 20 })
    commit.parents.forEach((parent, i) => { if (!lanes.has(parent)) lanes.set(parent, i === 0 ? lane : nextLane++) })
  }
  return { normalized, positions, width: Math.max(28, nextLane * 14 + 14) }
}
export function CommitGraph({ commits, t }: { commits: Commit[]; t: typeof en }) {
  const { normalized, positions, width } = layout(commits)
  return <div className="vcs-graph-history" style={{ position: 'relative', paddingLeft: width }}>
    <svg aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width, height: commits.length * 64, color: '#9fafd8' }}>
      {normalized.flatMap(commit => { const from = positions.get(commit.node)!; return commit.parents.map(parent => {
        const to = positions.get(parent)
        return <path key={commit.node + parent} d={to ? `M${from.x} ${from.y} C${from.x} ${from.y + 28} ${to.x} ${to.y - 28} ${to.x} ${to.y}` : `M${from.x} ${from.y}v28`} strokeDasharray={to ? undefined : '2 3'} />
      }) })}
      {normalized.map(commit => { const p = positions.get(commit.node)!; return <circle key={commit.node} cx={p.x} cy={p.y} r="3.5" fill="#292929" /> })}
    </svg>
    <ol className="vcs-history" style={{ margin: 0 }}>{normalized.map(commit => <li key={commit.node} style={{ height: 64, display: 'block', overflow: 'hidden' }} title={`${commit.subject}\n${t.parents}: ${commit.parents.join(', ')}`}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.subject}</div><div className="vcs-muted">{commit.node.slice(0, 8)} · {commit.author} · {commit.date.slice(0, 10)}</div><div className="vcs-muted">{t.parents}: {commit.parents.map(p => p.slice(0, 8)).join(', ') || '—'}</div></li>)}</ol>
  </div>
}

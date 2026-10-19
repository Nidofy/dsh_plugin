import { useEffect, useRef, useState } from 'react'
import type { Action, Commit, Discovery, Mutation, Operation, Repository, Snapshot, Worktree } from '../shared.ts'
import { en, zh, errorMessage } from './messages.ts'
import { css } from './style.ts'
import { CommitGraph } from './Graph.tsx'
import { repositoriesForProject } from './project.ts'

export type Request = <T>(route: string, data: object, signal: AbortSignal) => Promise<T>
export const request: Request = async (route, data, signal) => {
  const response = await fetch('/api/nidofy-vcs/' + route, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal })
  const result = await response.json()
  if (!response.ok) throw Error(result.error ?? 'REQUEST_FAILED')
  return result
}
type IconName = 'branch' | 'changes' | 'commit' | 'more' | 'down' | 'refresh' | 'close' | 'graph' | 'expand'
export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    branch: 'M6 6v12m0-7c8 0 12-1 12-5M6 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    changes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6v6h6M9 14h6m-3-3v6',
    commit: 'M3 12h5m8 0h5M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
    more: 'M5 12h.01M12 12h.01M19 12h.01', down: 'm7 10 5 5 5-5', refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 13 1M5 16a7 7 0 0 0 13 1',
    close: 'm6 6 12 12M6 18 18 6', graph: 'M6 3v18M18 3v6c0 5-12 3-12 9M3 7h6m6 0h6', expand: 'M14 3h7v7m0-7-7 7M3 14v7h7m-7 0 7-7',
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
}
type View = 'changes' | 'branches' | 'commit' | 'network' | 'history' | 'worktrees'
export function RepositoryPanel(props: { projectRoot: string | null; locale?: string; api?: Request; onClose?: () => void; onExpand?: () => void }) {
  // A project change disposes in-flight requests, drafts, and reviewed writes together.
  return <ProjectPanel key={props.projectRoot ?? ''} {...props} />
}
function ProjectPanel({ projectRoot, locale = 'zh', api = request, onClose, onExpand }: { projectRoot: string | null; locale?: string; api?: Request; onClose?: () => void; onExpand?: () => void }) {
  const t = locale.startsWith('zh') ? zh : en
  const [list, setList] = useState<Discovery | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setError('')
    if (!projectRoot) { setList({ repositories: [], warnings: [] }); return () => controller.abort() }
    void api<Discovery>('repositories', {}, controller.signal).then(value => {
      if (!controller.signal.aborted) setList({ repositories: repositoriesForProject(value.repositories, projectRoot), warnings: value.warnings.filter(warning => repositoriesForProject([{ id: '', name: '', root: warning.root, vcs: 'git' }], projectRoot).length > 0) })
    }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error, t)) })
    return () => controller.abort()
  }, [api, version, t, projectRoot])
  return <div className="dsh-vcs"><style>{css}</style><section className="vcs-panel" aria-label={t.title}>
    <div className="vcs-heading"><h2>{t.title}</h2><button title={t.refresh} aria-label={t.refresh} onClick={() => setVersion(x => x + 1)}><Icon name="refresh" /></button>
      {onExpand && <button title={t.details} aria-label={t.details} onClick={onExpand}><Icon name="expand" /></button>}
      {onClose && <button title={t.close} aria-label={t.close} onClick={onClose}><Icon name="close" /></button>}</div>
    <div className="vcs-content">{error && <p role="alert" className="vcs-error">{error}</p>}
      {!list && !error && <p className="vcs-empty">{t.loading}</p>}
      {list?.repositories.length === 0 && <p className="vcs-empty">{projectRoot ? t.empty : t.noProject}</p>}
      {list?.repositories.map(repo => <RepositoryCard key={repo.id} repo={repo} api={api} t={t} refresh={version} />)}
      {list?.warnings.map((warning, i) => <p className="vcs-error" key={i}>{warning.root}<br />{warning.error === 'TOOL_MISSING' ? t.missing : t.unavailable}</p>)}
    </div></section></div>
}
function RepositoryCard({ repo, api, t, refresh }: { repo: Repository; api: Request; t: typeof en; refresh: number }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false), [view, setView] = useState<View | null>(null), [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([]), [file, setFile] = useState(''), [staged, setStaged] = useState(false), [patch, setPatch] = useState('')
  const [message, setMessage] = useState(''), [branch, setBranch] = useState(''), [remote, setRemote] = useState('')
  const [pending, setPending] = useState<Mutation | null>(null), [history, setHistory] = useState<Commit[]>([]), [worktrees, setWorktrees] = useState<Worktree[]>([])
  const lifetime = useRef(new AbortController()), writing = useRef(false)
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort() }, [])
  useEffect(() => {
    const controller = new AbortController(); setLoading(true)
    void api<Snapshot>('status', { id: repo.id }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setSnapshot(value); setSelected(old => old.filter(path => value.changes.some(row => row.path === path)))
      setRemote(old => value.remotes.includes(old) ? old : value.remotes[0] ?? '')
    }).catch(e => { if (!controller.signal.aborted) { setError(errorMessage(e, t)); setSnapshot(null) } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, repo.id, refresh, version, t])
  useEffect(() => {
    if (!file || (view !== 'changes' && view !== 'commit')) return
    const controller = new AbortController(); setPatch(''); setError('')
    void api<string>('diff', { id: repo.id, path: file, staged }, controller.signal).then(value => { if (!controller.signal.aborted) setPatch(value) }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e, t)) })
    return () => controller.abort()
  }, [file, staged, view, snapshot?.revision, api, repo.id, t])
  useEffect(() => {
    if (view !== 'history' && view !== 'worktrees') return
    const controller = new AbortController(); setError(''); setHistory([]); setWorktrees([])
    void (view === 'history' ? api<Commit[]>('history', { id: repo.id }, controller.signal).then(rows => { if (!controller.signal.aborted) setHistory(rows) }) : api<Worktree[]>('worktrees', { id: repo.id }, controller.signal).then(rows => { if (!controller.signal.aborted) setWorktrees(rows) }))
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e, t)) })
    return () => controller.abort()
  }, [view, api, repo.id, snapshot?.revision, t])
  const choose = (next: View) => { setView(view === next ? null : next); setMenu(false); setPending(null); setError(''); setNotice('') }
  const prepare = (op: Operation) => { if (snapshot) { setPending({ ...op, id: repo.id, revision: snapshot.revision }); setError(''); setNotice('') } }
  const operate = async () => {
    if (!pending || writing.current) return
    writing.current = true; setBusy(true); setError(''); setNotice('')
    const signal = lifetime.current.signal
    try {
      const value = await api<Snapshot>('mutate', pending, signal)
      if (!signal.aborted) { setSnapshot(value); setPending(null); setSelected([]); setFile(''); setNotice(t.success); if (pending.action === 'commit') setMessage('') }
    } catch (error) {
      if (!signal.aborted) { setPending(null); setError(errorMessage(error, t) + ' ' + t.failure); setSnapshot(null); setVersion(v => v + 1) }
    } finally { writing.current = false; if (!signal.aborted) setBusy(false) }
  }
  const actionLabel = (action: Action) => action === 'fetch' && repo.vcs === 'hg' ? t.pull : t[action]
  const toggle = (path: string) => setSelected(old => old.includes(path) ? old.filter(p => p !== path) : [...old, path])
  const disabled = busy || loading || !snapshot
  const files = snapshot?.changes ?? []
  return <article className="vcs-repo" aria-label={repo.name} aria-busy={busy || loading}>
    <div className="vcs-repo-head"><span className="vcs-name" title={repo.root}>{repo.name}</span><span className="vcs-badge">{repo.vcs}</span><button aria-label={`${t.more}: ${repo.name}`} aria-expanded={menu} onClick={() => setMenu(!menu)} disabled={busy}><Icon name="more" /></button></div>
    {menu && <nav className="vcs-menu" aria-label={t.more}>{(['commit', 'branches', 'network', 'history', 'worktrees'] as View[]).filter(v => repo.vcs === 'git' || v !== 'worktrees').map(v => <button key={v} onClick={() => choose(v)}>{v === 'branches' ? t.switch : t[v as 'commit' | 'network' | 'history' | 'worktrees']}</button>)}</nav>}
    <button className="vcs-row" disabled={disabled} aria-expanded={view === 'changes'} onClick={() => choose('changes')}><Icon name="changes" /><span>{t.changes}</span>
      {snapshot && <span className="vcs-stats" title={repo.vcs === 'git' ? t.stats : t.hgStats}><span className="vcs-add">+{snapshot.added}</span><span className="vcs-remove">−{snapshot.removed}</span>{repo.vcs === 'git' && (snapshot.stagedAdded > 0 || snapshot.stagedRemoved > 0) && <><span className="vcs-muted">/</span><span className="vcs-add">+{snapshot.stagedAdded}</span><span className="vcs-remove">−{snapshot.stagedRemoved}</span></>}</span>}</button>
    <button className="vcs-row vcs-branch" disabled={disabled} aria-expanded={view === 'branches'} onClick={() => choose('branches')}><Icon name="branch" /><span>{snapshot?.branch || (snapshot?.head ? t.detached : t.unborn)}</span><Icon name="down" /></button>
    <button className="vcs-row" disabled={disabled} onClick={() => choose('commit')}><Icon name="commit" /><span>{t.commit}</span><span className="vcs-muted">{files.length ? `${files.length} ${t.files}` : t.clean}</span></button>
    {snapshot?.conflict && <p className="vcs-error">{t.conflict}</p>}
    {error && <p role="alert" className="vcs-error">{error}</p>}{notice && <p role="status" className="vcs-success">{notice}</p>}
    {view && snapshot && <div className="vcs-detail">
      {(view === 'changes' || view === 'commit') && <>
        <h3>{view === 'commit' ? t.commit : t.changes}</h3><p className="vcs-muted">{view === 'commit' ? repo.vcs === 'git' ? t.gitCommit : t.hgCommit : t.instructions}</p>
        <div className="vcs-files">{files.map(row => <div key={row.path} className="vcs-file" data-active={file === row.path}><input type="checkbox" aria-label={row.path} checked={selected.includes(row.path)} disabled={busy} onChange={() => toggle(row.path)} /><code title={`${t.staged} / ${t.working}`}>{repo.vcs === 'git' ? row.index + row.worktree : row.worktree}</code><button onClick={() => setFile(row.path)} title={row.original ? `${row.original} → ${row.path}` : row.path}>{row.path}</button></div>)}</div>
        <div className="vcs-actions"><span className="vcs-muted">{selected.length} {t.selected}</span>{(repo.vcs === 'git' ? ['stage', 'unstage'] as const : ['add', 'forget'] as const).map(action => <button key={action} className="vcs-secondary" disabled={disabled || !selected.length} onClick={() => prepare({ action, paths: selected })}>{t[action]}</button>)}</div>
        {view === 'commit' && <><label><span className="vcs-label">{t.message}</span><textarea value={message} maxLength={8000} disabled={busy} onChange={e => setMessage(e.target.value)} /></label><div className="vcs-actions"><button className="vcs-primary" disabled={disabled || !message.trim() || snapshot.conflict || (repo.vcs === 'hg' && !selected.length)} onClick={() => prepare({ action: 'commit', message, paths: selected })}>{t.review}</button><button disabled={busy} onClick={() => choose('network')}>{t.push}</button></div></>}
        {file && <><p className="vcs-muted">{file}</p>{repo.vcs === 'git' && <div className="vcs-actions"><button aria-pressed={!staged} className={!staged ? 'vcs-secondary' : ''} onClick={() => setStaged(false)}>{t.working}</button><button aria-pressed={staged} className={staged ? 'vcs-secondary' : ''} onClick={() => setStaged(true)}>{t.staged}</button></div>}<pre className="vcs-diff" aria-label={t.diff}>{patch ? patch.split('\n').map((line, i) => <span className={line.startsWith('+') ? 'vcs-add' : line.startsWith('-') ? 'vcs-remove' : ''} key={i}>{line || ' '}</span>) : t.noDiff}</pre></>}
      </>}
      {view === 'branches' && <><input aria-label={t.search} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} /><p className="vcs-muted">{t.dirtyHelp}</p><div className="vcs-branch-list">{snapshot.branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).map(b => <button key={b.name} className="vcs-branch-item" aria-current={b.current} disabled={disabled || b.current || !!files.length} onClick={() => prepare({ action: 'switch', branch: b.name })}><Icon name="branch" /><span>{b.name}{b.current && <small>{files.length ? `${files.length} ${t.files}` : t.clean}</small>}</span>{b.current && '✓'}</button>)}</div>
        <label><span className="vcs-label">{t.branchName}</span><input value={branch} disabled={busy} onChange={e => setBranch(e.target.value)} /></label>{repo.vcs === 'hg' && <p className="vcs-muted">{t.hgBranch}</p>}<div className="vcs-actions"><button disabled={disabled || !!files.length || !branch.trim()} onClick={() => prepare({ action: 'create', branch })}>＋ {t.create}</button><button onClick={() => choose('history')}><Icon name="graph" />{t.history}</button></div></>}
      {view === 'network' && <><h3>{t.network}</h3><p className="vcs-muted">{t.networkHelp}</p>{!snapshot.remotes.length ? <p>{t.noRemote}</p> : <><label><span className="vcs-label">{t.remote}</span><select value={remote} disabled={busy} onChange={e => setRemote(e.target.value)}>{snapshot.remotes.map(value => <option key={value}>{value}</option>)}</select></label><div className="vcs-actions"><button className="vcs-secondary" disabled={disabled || !remote} onClick={() => prepare({ action: 'fetch', remote })}>{repo.vcs === 'git' ? t.fetch : t.pull}</button><button className="vcs-primary" disabled={disabled || !remote} onClick={() => prepare({ action: 'push', remote })}>{t.push}</button></div></>}</>}
      {view === 'history' && <><h3>{t.history}</h3>{!history.length && <p className="vcs-muted">{t.noHistory}</p>}<CommitGraph commits={history} t={t} /></>}
      {view === 'worktrees' && <><h3>{t.worktrees}</h3>{worktrees.map(tree => <div className="vcs-worktree" key={tree.path}><Icon name="branch" /> {tree.branch || t.detached}<div className="vcs-muted">{tree.path}</div><div className="vcs-muted">{tree.head.slice(0, 8)}</div></div>)}</>}
      {pending && <section className="vcs-review" aria-label={t.preview}><strong>{t.preview} · {actionLabel(pending.action)}</strong><p className="vcs-muted">{repo.root}<br />{t.revision}: {pending.revision.slice(0, 12)}</p>{pending.branch && <p>{t.branch}: {pending.branch}</p>}{pending.remote && <p>{t.remote}: {pending.remote}</p>}{pending.message && <pre>{pending.message}</pre>}{pending.action === 'commit' && repo.vcs === 'git' && <p className="vcs-muted">{t.gitCommit}</p>}{pending.paths?.length ? <><span className="vcs-muted">{t.selectedFiles}</span><pre>{pending.paths.join('\n')}</pre></> : null}<div className="vcs-actions"><button className="vcs-primary" disabled={disabled} onClick={() => void operate()}>{busy ? t.loading : t.confirm}</button><button disabled={busy} onClick={() => setPending(null)}>{t.cancel}</button></div></section>}
    </div>}
  </article>
}

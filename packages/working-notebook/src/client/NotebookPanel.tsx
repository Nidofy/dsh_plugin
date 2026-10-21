/** In-rail notes and source search; user edits remain explicit versioned operations. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { NotebookV2, Note, NotebookHistoryPage, NotebookSynchronization, HistoryGroupView, HistoryAuthority } from '@nidofy/dsh-working-notebook/notebook-types'
import { Enhancement } from './Enhancement.tsx'
import type { Companion, CompanionScope } from '@nidofy/dsh-plugin-shared/client'
import { emptyDraft } from './drafts.ts'
import type { NotebookDraft } from './drafts.ts'
import type { notebookCoverage, continuationCard } from '../engine/continuation.ts'

interface Source { seq: number; type: string; text: string }
interface Status { notebook: NotebookV2; sourceThrough: number; index: string; synchronization?: NotebookSynchronization }
interface Hit {
  sessionId: string
  generation: string
  seq: number
  digest: string
  role: string
  type: string
  snippet: string
  surface: string
  authority?: HistoryAuthority
}
/** Validated local history copied only by an explicit user gesture. */
export interface NotebookHistorySource extends Hit { text: string }
async function request<T>(method: string, input: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/nidofy-notebook/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), ...(signal ? { signal } : {}) })
  if (!response.body) throw Error('CONTEXT_UNAVAILABLE')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1024 * 1024) throw Error('COMPANION_PAYLOAD_LIMIT')
      chunks.push(chunk.value)
    }
  } finally { try { await reader.cancel() } finally { reader.releaseLock() } }
  signal?.throwIfAborted()
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T & { error?: string }
  if (!response.ok) throw Error(value.error ?? 'CONTEXT_UNAVAILABLE')
  return value
}
/** Mount under a Session key so late responses cannot cross conversation switches. */
export function NotebookPanel({ sessionId, scope: companionScope, using, runWrite, uncertain = false, markUncertain, citeSource, refreshFacts, draft: storedDraft, editDraft, t }: PropsLocale<'nidofy.notebook'> & {
  draft?: NotebookDraft
  editDraft?: (change: Partial<NotebookDraft>) => void
  sessionId: string
  scope: CompanionScope
  using: Companion['using']
  runWrite?: <T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => Promise<T>
  uncertain?: boolean
  markUncertain?: (value: boolean) => void
  citeSource?: (scope: CompanionScope, source: NotebookHistorySource) => void
  /** Product registrations withdraw/re-read Companion evidence after a potentially committed write.
   * @param scope - The operation's complete scope; standalone hosts without Companion may omit it.
   */
  refreshFacts?: (scope: CompanionScope) => void
}) {
  const lifetime = useMemo(() => new AbortController(), [companionScope])
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const read = <T,>(method: string, input: object, signal?: AbortSignal): Promise<T> => {
    const source = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal
    const call = (operationSignal: AbortSignal) => using(companionScope,
      active => request<T>(method, input, active), operationSignal)
    const write = method === 'update' || method === 'save-search-groups'
    if (write) markUncertain?.(true)
    return (write && runWrite ? runWrite(call, source) : call(source)).then((value) => {
      if (write) markUncertain?.(false)
      return value
    }).finally(() => { if (method === 'update' || method === 'synchronize') refreshFacts?.(companionScope) })
  }
  const [status, setStatus] = useState<Status>(), [events, setEvents] = useState<Source[]>([])
  const [coverage, setCoverage] = useState<ReturnType<typeof notebookCoverage>>()
  const [continuation, setContinuation] = useState<{ card: ReturnType<typeof continuationCard>; markdown: string }>()
  const [linkedSessions, setLinkedSessions] = useState<{ authority: HistoryAuthority; incomplete: boolean; sessions: { id: string; cwd?: string }[] }>()
  const [returnSession, setReturnSession] = useState(sessionId)
  const continuationRequest = useRef<AbortController | null>(null)
  useEffect(() => () => { continuationRequest.current?.abort() }, [lifetime])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, refresh] = useState(0)
  const [organizing, setOrganizing] = useState(false), [organizationFailed, setOrganizationFailed] = useState(false)
  const [localDraft, setLocalDraft] = useState<NotebookDraft>(emptyDraft)
  const draftState = storedDraft ?? localDraft
  const currentDraft = useRef(draftState)
  currentDraft.current = draftState
  const change = (patch: Partial<NotebookDraft>) => {
    if (editDraft) editDraft(patch); else setLocalDraft(previous => ({ ...previous, ...patch }))
  }
  const { query, searchScope: scope, selected, text: draft, kind, source, quote, pinned } = draftState
  const setQuery = (query: string) =>{  change({ query }) }, setScope = (searchScope: string) =>{  change({ searchScope }) }
  const setDraft = (text: string) =>{  change({ text }) }, setKind = (kind: Note['kind']) =>{  change({ kind }) }
  const setSource = (source: string) =>{  change({ source }) }
  const setQuote = (quote: string) =>{  change({ quote }) }
  const setPinned = (pinned: boolean) =>{  change({ pinned }) }
  const [results, setResults] = useState<Hit[]>()
  const [preview, setPreview] = useState<{ source: NotebookHistorySource; scope: string }>()
  const [substringIncomplete, setSubstringIncomplete] = useState(false)
  const [indexCoverage, setIndexCoverage] = useState<{ sessionId: string; indexedThrough: number; durableThrough: number; reason?: 'capacity' | 'results' }[]>([])
  const historyRequest = useRef<AbortController | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [groups, setGroups] = useState<HistoryGroupView>(), [groupSelection, setGroupSelection] = useState<string[]>([])
  useEffect(() => () => { historyRequest.current?.abort() }, [lifetime])
  const resetSearch = () => {
    historyRequest.current?.abort(); historyRequest.current = null
    setHistoryBusy(false); setResults(undefined); setPreview(undefined); setSubstringIncomplete(false); setIndexCoverage([])
  }
  const searchRead = async <T,>(operation: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void) => {
    historyRequest.current?.abort()
    const request = new AbortController()
    historyRequest.current = request
    setHistoryBusy(true); setError('')
    try {
      const value = await operation(request.signal)
      request.signal.throwIfAborted(); lifetime.signal.throwIfAborted()
      accept(value)
    } catch (error) {
      if (!request.signal.aborted && !lifetime.signal.aborted) { setError(String(error)); setPreview(undefined) }
    } finally {
      if (historyRequest.current === request && !lifetime.signal.aborted) setHistoryBusy(false)
    }
  }
  const [history, setHistory] = useState<NotebookHistoryPage>()
  const acceptGroups = (value: HistoryGroupView) => {
    continuationRequest.current?.abort(); setContinuation(undefined); setLinkedSessions(undefined); setReturnSession(sessionId)
    setGroups(value); setGroupSelection(value.project?.members.map(member => member.id) ?? [value.current.id])
  }
  useEffect(() => {
    const abort = new AbortController()
    setOrganizing(true); setOrganizationFailed(false)
    setHistory(undefined)
    setCoverage(undefined); setContinuation(undefined)
    continuationRequest.current?.abort()
    void read('synchronize', { sessionId }, abort.signal)
      .then(() => Promise.all([read<Status>('status', { sessionId }, abort.signal), read<Source[]>('events', { sessionId }, abort.signal)]))
      .then(async ([state, sources]) => {
        if (!abort.signal.aborted) { setStatus(state); setEvents(sources) }
        const value = await read<ReturnType<typeof notebookCoverage>>('coverage', { sessionId }, abort.signal)
        if (!abort.signal.aborted && typeof value.evidenceThrough === 'number') setCoverage(value)
      })
      .catch((error: unknown) => { if (!abort.signal.aborted) { setError(String(error)); setOrganizationFailed(true) } })
      .finally(() => { if (!abort.signal.aborted) setOrganizing(false) })
    return () => { abort.abort() }
  }, [sessionId, revision])
  const edit = (row?: Note) => { change({ selected: row, text: row?.text ?? '', kind: row?.kind ?? 'constraint', source: row ? String(row.seq) : '', quote: row?.quote ?? '', pinned: row?.pinned ?? true }) }
  const save = async (remove = false) => {
    if (!status) return
    const submitted = draftState
    setBusy(true); setError('')
    const operation = remove && selected ? { action: 'REMOVE', id: selected.id } : {
      action: selected ? 'UPDATE' : 'ADD', id: selected?.id ?? '', expectedRevision: selected?.revision,
      kind, text: draft, seq: Number(source), quote, pinned,
    }
    try {
      await read('update', { sessionId, delta: { scope: status.notebook.scope, baseRevision: status.notebook.revision,
        cursors: { evidenceThrough: status.sourceThrough }, operations: [operation] } })
      if (!lifetime.signal.aborted && currentDraft.current === submitted) edit()
      if (!lifetime.signal.aborted) refresh(value => value + 1)
    } catch (error) { setError(String(error)); refresh(value => value + 1) }
    finally { setBusy(false) }
  }
  const restore = async (id: string) => {
    if (!status) return
    setBusy(true); setError('')
    try {
      await read('update', { sessionId, delta: { scope: status.notebook.scope, baseRevision: status.notebook.revision,
        operations: [{ action: 'RESTORE', id }] } })
      refresh(value => value + 1)
    } catch (error) { setError(String(error)); refresh(value => value + 1) }
    finally { setBusy(false) }
  }
  const loadContinuation = async (format?: 'json' | 'md') => {
    continuationRequest.current?.abort()
    const abort = new AbortController(); continuationRequest.current = abort
    setBusy(true); setError('')
    try {
      const value = await read<{ card: ReturnType<typeof continuationCard>; markdown: string }>('continuation',
        { sessionId, targetSessionId: returnSession, ...(returnSession !== sessionId ? { authority: linkedSessions?.authority } : {}) }, abort.signal)
      lifetime.signal.throwIfAborted(); abort.signal.throwIfAborted(); setContinuation(value)
      if (!format) return
      const url = URL.createObjectURL(new Blob([format === 'json' ? JSON.stringify(value.card, null, 2) : value.markdown],
        { type: format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = 'notebook-handoff.' + format; link.click()
      setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
    } catch (error) { if (!lifetime.signal.aborted && !abort.signal.aborted) setError(String(error)) }
    finally { if (!lifetime.signal.aborted && continuationRequest.current === abort) setBusy(false) }
  }
  return <div className="nidofy-detail nidofy-notebook">
    {uncertain && !busy && !historyBusy && <p role="status">{t('saveUnconfirmed')} <button onClick={() => { markUncertain?.(false) }}>{t('saveChecked')}</button></p>}
    <header><strong>{t('notebook')}</strong><button onClick={() => { refresh(value => value + 1) }}>{t('refresh')}</button></header>
    <details><summary>{t('noteSettings')}</summary><Enhancement t={t} /><p>{t('contextNotice')}</p></details>
    <small>{t('indexOnDemand')} · {t('revision')} {status?.notebook.revision ?? 0}</small>
    <p role="status">{t(organizing || status?.synchronization?.phase === 'organizing' ? 'organizationPending'
      : organizationFailed || status?.synchronization?.phase === 'failed' ? 'organizationFailed' : 'organizationReady')}
    {status?.synchronization?.diagnostic && ' · ' + status.synchronization.diagnostic}</p>
    {coverage && <div role="status">
      <p>{t('evidenceCoverage')}: {coverage.evidenceThrough} / {coverage.durableThrough} · {t('pendingEvents')}: {coverage.pendingEvents}</p>
      {!coverage.autoOrganize && <p>{t('organizationOff')}</p>}
      {coverage.blockedSeq !== undefined && <p>{t('blockedEvidence')}: #{coverage.blockedSeq}</p>}
      <small>{t('coveragePreview')}</small>
    </div>}
    <details><summary>{t('returnCard')}</summary>
      <p>{t('handoffNotice')}</p>
      <button disabled={busy || organizing} onClick={() => { void read<NonNullable<typeof linkedSessions>>('continuation-sessions', { sessionId }).then(value => { if (!lifetime.signal.aborted) setLinkedSessions(value) }).catch(error => { if (!lifetime.signal.aborted) setError(String(error)) }) }}>{t('chooseReturnSession')}</button>
      {linkedSessions && <><select aria-label={t('chooseReturnSession')} value={returnSession} onChange={event => {
        continuationRequest.current?.abort(); setBusy(false); setContinuation(undefined); setReturnSession(event.target.value)
      }}><option value={sessionId}>{t('currentSession')}</option>{linkedSessions.sessions.filter(row => row.id !== sessionId).map(row => <option key={row.id} value={row.id}>{row.id} · {row.cwd}</option>)}</select>
        {linkedSessions.incomplete && <small>{t('returnSessionsLimited')}</small>}</>}
      <button disabled={busy || organizing} onClick={() => { void loadContinuation() }}>{t('loadReturnCard')}</button>
      <button disabled={busy || organizing} onClick={() => { void loadContinuation('md') }}>{t('exportMarkdown')}</button>
      <button disabled={busy || organizing} onClick={() => { void loadContinuation('json') }}>{t('exportJson')}</button>
      {continuation?.card && <div aria-label={t('returnCard')}>
        <p>{t('baselineUnknown')}</p>
        {continuation.card.entries.length === 0 && <p>{t('noCommittedNotes')}</p>}
        {continuation.card.entries.map(row => <article key={row.id}><strong>{t(row.kind)}</strong><p>{row.text}</p>
          <small>{t(row.source.role === 'user' ? 'sourceUser' : row.source.role === 'tool' ? 'sourceTool' : row.source.role === 'assistant' ? 'sourceAssistant' : 'sourceUnknown')} · #{row.seq}</small>
          <blockquote>{row.quote}</blockquote>{!row.source.verified && <p>{t('sourceUnavailable')}</p>}
          {row.verification && <p>{t('verificationStale')}</p>}
        </article>)}
      </div>}
    </details>
    <form aria-busy={historyBusy} onSubmit={(event) => { event.preventDefault(); resetSearch(); void searchRead(signal => read<{ items: Hit[]; substringIncomplete: boolean; indexCoverage?: typeof indexCoverage }>('search', { sessionId, query, scope }, signal), (value) => { setResults(value.items); setSubstringIncomplete(value.substringIncomplete); setIndexCoverage(value.indexCoverage ?? []) }) }}>
      <label>{t('historySearch')}<input value={query} onChange={(event) => { resetSearch(); setQuery(event.target.value) }} required /></label>
      <select aria-label={t('searchScope')} value={scope} disabled={busy} onChange={(event) => { resetSearch(); setScope(event.target.value) }}><option value="session">{t('currentSession')}</option><option value="workspace">{t('sameWorkspace')}</option><option value="project">{t('linkedProject')}</option></select>
      <button disabled={busy || !query.trim()}>{t('search')}</button>
    </form>
    <button disabled={busy || historyBusy} onClick={() => { resetSearch(); void searchRead(signal => read<HistoryGroupView>('search-groups', { sessionId }, signal), acceptGroups) }}>{t('manageHistoryProject')}</button>
    {groups && <fieldset className="nidofy-history-project" aria-label={t('manageHistoryProject')} disabled={busy || historyBusy}>
      <p>{t('historyProjectNotice')}</p>
      {groups.candidates.map(row => <label className="nidofy-project-member" key={row.id}><input type="checkbox" checked={groupSelection.includes(row.id)} disabled={row.id === groups.current.id} onChange={(event) => {
        resetSearch(); setGroupSelection(value => event.target.checked ? [...value, row.id] : value.filter(id => id !== row.id))
      }} /><span>{row.title} · {row.path}</span></label>)}
      <div className="nidofy-inline-actions">
        <button disabled={groupSelection.length < 2} onClick={() => { resetSearch(); void searchRead(signal => read<HistoryGroupView>('save-search-groups', { sessionId, expectedRevision: groups.revision, workspaceIds: groupSelection }, signal), acceptGroups) }}>{t('saveHistoryProject')}</button>
        <button disabled={!groups.project} onClick={() => { resetSearch(); void searchRead(signal => read<HistoryGroupView>('save-search-groups', { sessionId, expectedRevision: groups.revision, workspaceIds: [] }, signal), (value) => { acceptGroups(value); setScope('session') }) }}>{t('removeHistoryProject')}</button>
      </div>
    </fieldset>}
    {indexCoverage.filter(row => row.reason).map(row => <p role="status" key={row.sessionId}>{t('indexCoverage')} · {row.sessionId}: {row.indexedThrough} / {row.durableThrough} · {t(row.reason === 'capacity' ? 'indexCapacity' : 'indexResults')}</p>)}
    {results && <div className="nidofy-change-list" aria-label={t('searchResults')}>{results.length === 0 && <p>{t('noMatches')}</p>}{substringIncomplete && <p role="status">{t('substringIncomplete')}</p>}{results.map(hit => <button key={hit.sessionId + ':' + hit.generation + ':' + String(hit.seq)} onClick={() => { setPreview(undefined); void searchRead(signal => read<NotebookHistorySource>('search-source', { sessionId, targetSessionId: hit.sessionId, generation: hit.generation, seq: hit.seq, digest: hit.digest, scope, authority: hit.authority }, signal), (value) => { setPreview({ source: value, scope }) }) }}><span>{hit.snippet}<small> · {hit.sessionId} #{hit.seq} · {hit.role} · {hit.generation}</small></span></button>)}</div>}
    {preview && <><pre aria-label={t('sourceEvent')}>{preview.source.text}</pre>{citeSource && <button disabled={busy || historyBusy} onClick={() => {
      void searchRead(signal => read<NotebookHistorySource>('search-source', { sessionId, targetSessionId: preview.source.sessionId, generation: preview.source.generation, seq: preview.source.seq, digest: preview.source.digest, scope: preview.scope, authority: preview.source.authority }, signal),
        (value) => { citeSource(companionScope, value) })
    }}>{t('citeSource')}</button>}</>}
    <h3>{t('activeNotes')} · {status?.notebook.active.length ?? 0}</h3>
    <div className="nidofy-change-list">{status?.notebook.active.map(row => <button key={row.id} onClick={() => { edit(row) }}><span>{row.pinned ? '● ' : ''}{row.text}<small> · #{row.seq}</small></span></button>)}</div>
    <button disabled={busy || history?.nextToken === null} onClick={() => {
      void read<NotebookHistoryPage>('history', { sessionId, pageToken: history?.nextToken }).then(setHistory)
        .catch((error: unknown) => { setError(String(error)) })
    }}>{history ? t('nextHistoryPage') : t('noteHistory')}</button>
    {history && <div className="nidofy-change-list" aria-label={t('noteHistory')}>{history.records.map((record, index) =>
      <div key={String(record.historyRevision) + ':' + String(index)}>
        {record.action === 'restore' ? <span>{t('restoredNote')} {record.id}</span> : record.note && <>
          <span>{record.note.text}</span><button disabled={busy} onClick={() => { if (record.note) void restore(record.note.id) }}>{t('restoreNote')}</button>
        </>}
      </div>)}</div>}
    <details open><summary>{selected ? t('editNote') : t('newNote')}</summary><form onSubmit={(event) => { event.preventDefault(); void save() }}>
      <label>{t('noteText')}<textarea value={draft} onChange={(event) => { setDraft(event.target.value) }} maxLength={2048} required /></label>
      <select aria-label={t('noteKind')} value={kind} onChange={(event) => { setKind(event.target.value as Note['kind']) }}>{(['objective', 'constraint', 'decision', 'file', 'verification', 'failure', 'issue', 'next'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select>
      <label>{t('sourceEvent')}<select value={source} onChange={(event) => { setSource(event.target.value); setQuote('') }} required><option value="">{t('chooseSource')}</option>{events.map(event => <option key={event.seq} value={event.seq}>#{event.seq} {event.type}</option>)}{selected && !events.some(event => event.seq === selected.seq) && <option value={selected.seq}>#{selected.seq}</option>}</select></label>
      {source && <pre>{events.find(event => event.seq === Number(source))?.text ?? selected?.quote}</pre>}
      <label>{t('sourceQuote')}<textarea value={quote} onChange={(event) => { setQuote(event.target.value) }} maxLength={512} required /></label>
      <label className="nidofy-note-pin"><input type="checkbox" checked={pinned} onChange={(event) => { setPinned(event.target.checked) }} />{t('pinNote')}</label>
      <div className="nidofy-inline-actions"><button disabled={busy || !status}>{t('saveNote')}</button><button type="button" onClick={() => { edit() }}>{t('newNote')}</button>{selected && <button type="button" disabled={busy} onClick={() => { void save(true) }}>{t('retireNote')}</button>}</div>
    </form></details>
    {error && <div role="alert"><p>{t('contextError')}</p><details><summary>{t('errorDetails')}</summary><pre>{error}</pre></details></div>}
  </div>
}

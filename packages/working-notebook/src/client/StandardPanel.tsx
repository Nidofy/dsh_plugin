/** Standard DSH settings panel owns explicit selection; it needs no Desktop selection API. */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Note, Notebook } from '../engine/standard-types.ts'
export const standardEn = { title: 'Notebook', session: 'Conversation', choose: 'Choose a conversation', refresh: 'Refresh',
  source: 'Original evidence', note: 'Working note', quote: 'Exact quote', pinned: 'Pin this note', save: 'Save note',
  retire: 'Retire', restore: 'Restore', edit: 'Edit', cancel: 'Cancel edit', copy: 'Copy reference', active: 'Active notes', history: 'Retired notes',
  description: 'Versioned working notes with original evidence. Automatic compaction organization requires the enhanced runtime.',
  uncertain: 'The result is unconfirmed. Refresh before saving again.', search: 'Search history', query: 'Search this conversation', error: 'The operation failed.', empty: 'No notes yet.' }
const standardZh: typeof standardEn = { title: '工作笔记', session: '会话', choose: '选择会话', refresh: '刷新', source: '原始证据', note: '工作笔记', quote: '原文引用', pinned: '固定这条笔记', save: '保存笔记', retire: '移入历史', restore: '恢复', edit: '编辑', cancel: '取消编辑', copy: '复制引用', active: '当前笔记', history: '已退役笔记', description: '保留版本和原始证据的工作笔记。压缩时自动整理需要增强运行时。', uncertain: '写入结果尚未确认，请先刷新，再决定是否保存。', search: '检索历史', query: '搜索当前会话', error: '操作失败。', empty: '暂无笔记。' }
export const standardLocales = { en: standardEn, zh: standardZh }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'nidofy.notebook-standard': keyof typeof standardEn } }
interface Source { seq: number; type: string; text: string }
interface Draft { id: string; text: string; quote: string; seq: number; pinned: boolean; expectedRevision: number; kind: Note['kind'] }
const empty: Draft = { id: '', text: '', quote: '', seq: -1, pinned: false, expectedRevision: 0, kind: 'constraint' }
/** Authenticated JSON requests, bounded and cancelled by the component's selected conversation lifetime. */
export async function standardRequest<T>(method: string, input: object, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/nidofy-notebook/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal })
  const value = await response.json()
  if (!response.ok) throw Error(value.error ?? 'NOTEBOOK_OPERATION_FAILED')
  signal.throwIfAborted()
  return value as T
}
export function StandardPanel({ t }: PropsLocale<'nidofy.notebook-standard'>) {
  const [sessions, setSessions] = useState<{ id: string; cwd: string }[]>([]), [sessionId, select] = useState('')
  const [notebook, setNotebook] = useState<Notebook | null>(null), [sources, setSources] = useState<Source[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false), [query, setQuery] = useState(''), [hits, setHits] = useState<{ seq: number; snippet: string }[]>([])
  const lifetime = useRef(new AbortController()), draft = drafts[sessionId] ?? empty
  const edit = (change: Partial<Draft>) => setDrafts(value => ({ ...value, [sessionId]: { ...(value[sessionId] ?? empty), ...change } }))
  useEffect(() => {
    const controller = new AbortController()
    void standardRequest<typeof sessions>('sessions', {}, controller.signal).then(setSessions).catch(e => { if (!controller.signal.aborted) setError(String(e.message)) })
    return () => controller.abort()
  }, [])
  const refresh = async (id: string, signal: AbortSignal) => {
    const [state, events] = await Promise.all([standardRequest<{ notebook: Notebook }>('status', { sessionId: id }, signal), standardRequest<Source[]>('events', { sessionId: id }, signal)])
    signal.throwIfAborted(); setNotebook(state.notebook); setSources(events); setUncertain(false)
  }
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    setNotebook(null); setSources([]); setHits([]); setError(''); setBusy(false); setUncertain(false)
    if (sessionId) void refresh(sessionId, controller.signal).catch(e => { if (!controller.signal.aborted) setError(String(e.message)) })
    return () => controller.abort()
  }, [sessionId])
  const run = async (work: (signal: AbortSignal) => Promise<void>, writing = false) => {
    const signal = lifetime.current.signal
    setBusy(true); setError('')
    try { await work(signal) }
    catch (e) { if (!signal.aborted) { setError(e instanceof Error ? e.message : t('error')); if (writing) setUncertain(true) } }
    finally { if (!signal.aborted) setBusy(false) }
  }
  const update = (operation: object) => run(async signal => {
    if (!notebook) throw Error('NOTEBOOK_READ_REQUIRED')
    const maxSeq = Math.max(notebook.sourceThrough, ...sources.map(row => row.seq), draft.seq)
    const saved = await standardRequest<Notebook>('update', { sessionId, delta: { baseRevision: notebook.revision, sourceThrough: maxSeq, operations: [operation] } }, signal)
    signal.throwIfAborted(); setNotebook(saved)
    setDrafts(value => ({ ...value, [sessionId]: empty }))
  }, true)
  const row = (note: Note) => <li key={note.id}><p>{note.pinned ? '📌 ' : ''}{note.text}</p><blockquote>{note.quote}</blockquote>
    <Button disabled={busy || uncertain} onClick={() => edit({ ...note, expectedRevision: note.revision })}>{t('edit')}</Button>
    <Button disabled={busy || uncertain} onClick={() => void update(note.active ? { action: 'REMOVE', id: note.id } : { ...note, action: 'UPDATE', expectedRevision: note.revision })}>{t(note.active ? 'retire' : 'restore')}</Button>
    <Button onClick={() => void run(async () => { await navigator.clipboard.writeText(`[${sessionId} #${note.seq}]\n${note.quote}`) })}>{t('copy')}</Button></li>
  return <section>
    <p>{t('description')}</p>
    <label>{t('session')} <select aria-label={t('session')} value={sessionId} disabled={busy} onChange={event => select(event.target.value)}>
      <option value="">{t('choose')}</option>{sessions.map(item => <option key={item.id} value={item.id}>{item.cwd ? item.cwd + ' · ' : ''}{item.id}</option>)}
    </select></label>
    <Button disabled={!sessionId || busy} onClick={() => void run(signal => refresh(sessionId, signal))}>{t('refresh')}</Button>
    <div role="status">{uncertain ? t('uncertain') : ''} {error}</div>
    {notebook && <>
      <h3>{t('active')}</h3>{notebook.entries.some(note => note.active) ? <ul>{notebook.entries.filter(note => note.active).map(row)}</ul> : <p>{t('empty')}</p>}
      <details><summary>{t('history')}</summary><ul>{notebook.entries.filter(note => !note.active).map(row)}</ul></details>
      <label>{t('source')} <select aria-label={t('source')} disabled={busy} value={draft.seq} onChange={event => { const source = sources.find(row => row.seq === Number(event.target.value)); if (source) edit({ seq: source.seq, quote: source.text.slice(0, 512) }) }}>
        <option value={-1}>—</option>{sources.map(source => <option value={source.seq} key={source.seq}>#{source.seq} {source.text.slice(0, 100)}</option>)}
      </select></label>
      <label style={{ display: 'block' }}>{t('note')}<textarea aria-label={t('note')} value={draft.text} maxLength={2048} disabled={busy} onChange={event => edit({ text: event.target.value })} style={{ width: '100%' }} /></label>
      <label style={{ display: 'block' }}>{t('quote')}<textarea aria-label={t('quote')} value={draft.quote} maxLength={512} disabled={busy} onChange={event => edit({ quote: event.target.value })} style={{ width: '100%' }} /></label>
      <label><input type="checkbox" checked={draft.pinned} disabled={busy} onChange={event => edit({ pinned: event.target.checked })} />{t('pinned')}</label>
      <Button disabled={busy || uncertain || !draft.text.trim() || !draft.quote.trim() || draft.seq < 0} onClick={() => void update({ ...draft, action: draft.id ? 'UPDATE' : 'ADD' })}>{t('save')}</Button>
      {draft.id && <Button disabled={busy} onClick={() => setDrafts(value => ({ ...value, [sessionId]: empty }))}>{t('cancel')}</Button>}
      <details><summary>{t('search')}</summary><input aria-label={t('query')} value={query} onChange={event => { setQuery(event.target.value); setHits([]) }} />
        <Button disabled={busy || !query.trim()} onClick={() => void run(async signal => { const result = await standardRequest<{ items: typeof hits }>('search', { sessionId, query }, signal); setHits(result.items) })}>{t('search')}</Button>
        <ul>{hits.map(hit => <li key={hit.seq}><Button onClick={() => void run(async signal => { const source = await standardRequest<Source>('source', { sessionId, seq: hit.seq }, signal); setSources(rows => [...rows.filter(row => row.seq !== source.seq), source]); edit({ seq: source.seq, quote: source.text.slice(0, 512) }) })}>#{hit.seq} {hit.snippet}</Button></li>)}</ul>
      </details>
    </>}
  </section>
}

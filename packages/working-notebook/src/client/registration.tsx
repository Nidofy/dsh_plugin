import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
/** Independent notebook settings and an optional contribution to the desktop environment rail. */
import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale, PropsRuntime, PropsStore, InjectFace, HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@nidofy/dsh-plugin-shared/client'
import type { Companion, CompanionView } from '@nidofy/dsh-plugin-shared/client'
import { NotebookPanel } from './NotebookPanel.tsx'
import type { NotebookHistorySource } from './NotebookPanel.tsx'
import type { CompanionScope } from '@nidofy/dsh-plugin-shared/client'
import { Enhancement } from './Enhancement.tsx'
import { en, zh } from './locales.ts'
import { notebookCss } from './style.ts'
import { createNotebookDraftStore, emptyDraft } from './drafts.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'nidofy.notebook': keyof typeof en }
}
interface NotebookInjected {
  readonly hooks: { readonly companion: HostObservable<CompanionView>; readonly generation: ConnectionHandle['generation'] }
  using: Companion['using']
  refreshFacts(scope: CompanionScope): void
  citeSource(scope: CompanionScope, source: NotebookHistorySource): void
}
type DraftProps = PropsStore<ReturnType<typeof createNotebookDraftStore>>
function Rail({ sessionId, scope, open, onOpenChange, runWrite, using, citeSource, refreshFacts, useGeneration, useStore, actions, t }: PropsRuntime<'nidofy.notebook'> & InjectFace<NotebookInjected> & PropsLocale<'nidofy.notebook'> & DraftProps) {
  const generation = useGeneration(value => value)
  const key = JSON.stringify([generation?.id, sessionId])
  const draft = useStore(state => state.drafts[key] ?? emptyDraft)
  const uncertain = useStore(state => state.uncertain[key] ?? false)
  return <div className="nidofy-notebook-surface"><button className="nidofy-row" aria-expanded={open} onClick={() => { onOpenChange(!open) }}><span>{t('notebook')}</span></button>{open && <NotebookPanel key={scope.revision} sessionId={sessionId} scope={scope} using={using} {...(runWrite ? { runWrite } : {})} uncertain={uncertain} markUncertain={(value) => { actions.markUncertain(key, value) }} citeSource={citeSource}
    refreshFacts={refreshFacts} draft={draft} editDraft={(change) => { actions.edit(key, change) }} t={t} />}</div>
}
interface SettingsInjected {
  hooks: { generation: ConnectionHandle['generation'] }
  using: Companion['using']
  citeSource: NotebookInjected['citeSource']
  refreshFacts: NotebookInjected['refreshFacts']
}
export function Settings({ useSessions, useGeneration, using, citeSource, refreshFacts, useStore, actions, t }: PropsRuntime<'settings.section'> & PropsLocale<'nidofy.notebook'> & InjectFace<SettingsInjected> & DraftProps) {
  const sessions = useSessions(value => value), generation = useGeneration(value => value)
  const [selection, select] = useState({ sessionId: '', revision: 0 })
  const sessionId = selection.sessionId
  // Standalone notes use their own selected-session lifetime; no Companion facts
  // or action capabilities are fabricated when the optional plugin is absent.
  const scope = useMemo<CompanionScope>(() => ({ sessionId: sessionId ? sessionId as SessionId : null, revision: selection.revision, hostEpoch: null,
    windowId: null, viewId: null, panelId: null, workspaceId: null, turn: null }), [sessionId, selection.revision, generation])
  const key = JSON.stringify([generation?.id, sessionId])
  const draft = useStore(state => state.drafts[key] ?? emptyDraft)
  const uncertain = useStore(state => state.uncertain[key] ?? false)
  const [open, setOpen] = useState(false), [writing, setWriting] = useState(0), [confirmClose, setConfirmClose] = useState(false)
  useEffect(() => { setOpen(false); setConfirmClose(false) }, [scope])
  const close = () => { if (writing > 0) setConfirmClose(true); else setOpen(false) }
  const runWrite = async <T,>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    setWriting(value => value + 1)
    try { return await operation(signal ?? new AbortController().signal) }
    finally { setWriting(value => value - 1) }
  }
  return <section className="nidofy-notebook-settings">
    <Enhancement key={generation?.id} t={t} />
    <label>{t('chooseConversation')}<select value={sessionId} onChange={event => select(previous => ({ sessionId: event.target.value, revision: previous.revision + 1 }))}>
      <option value="">{t('chooseConversation')}</option>{sessions.ids.map(id => <option key={id} value={id}>{sessions.byId[id]?.title || id}</option>)}
    </select></label>
    <div className="nidofy-notebook-setting-row"><div><div>{t('notebook')}</div><p>{t('notebookSettingsDescription')}</p></div>
      <Button disabled={!sessionId || !generation} onClick={() => { setOpen(true) }}>{t('openNotebook')}</Button></div>
    {!sessionId && <p>{t('chooseConversation')}</p>}
    <Modal open={open && !!sessionId && !!generation} onClose={close} title={t('notebook')} closeLabel={t('closeNotebook')}>
      <div className="nidofy-notebook-surface"><NotebookPanel key={`${sessionId}:${selection.revision}:${generation?.id}`} sessionId={sessionId ?? ''} scope={scope} using={using}
        runWrite={runWrite} uncertain={uncertain} markUncertain={(value) => { actions.markUncertain(key, value) }} citeSource={citeSource}
        refreshFacts={refreshFacts}
        draft={draft} editDraft={(change) => { actions.edit(key, change) }} t={t} /></div>
    </Modal>
    <Modal open={confirmClose} onClose={() => { setConfirmClose(false) }} title={t('savePending')} closeLabel={t('closeNotebook')}>
      <p>{t('stopWaitingNotice')}</p><Button onClick={() => { setConfirmClose(false) }}>{t('keepWaiting')}</Button>
      <Button onClick={() => { setConfirmClose(false); setOpen(false) }}>{t('stopWaiting')}</Button>
    </Modal>
  </section>
}
export const name = 'nidofy-working-notebook-client'
export const inject = ['slots', 'locale', 'uiWorkspace', 'uiSession', 'conversation', 'connection']
export function apply(ctx: Context): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const store = createNotebookDraftStore()
  ctx.effect(() => ctx.locale.register('nidofy.notebook', { en, zh }))
  const t = ctx.locale.bind('nidofy.notebook')
  const sessions = ctx.get('sessions') as unknown as ISessions
  const citeSource = (scope: CompanionScope, source: NotebookHistorySource) => {
    const binding = scope.sessionId ? sessions.binding(scope.sessionId as SessionId) : undefined
    if (!connection.generation.getSnapshot() || !binding) throw Error('NOTEBOOK_OPEN_CONVERSATION_TO_CITE')
    const input = ctx.conversation.input.for(binding.ctx), snapshot = input.state.getSnapshot()
    const text = (snapshot.draft ? '\n\n' : '') + t('referenceHeader') + ' ' + source.sessionId + ' @' + source.generation + ' #' + String(source.seq)
      + '\n' + source.text.split('\n').map(line => '> ' + line).join('\n')
    if (!binding.ctx.bail('slash/input-insert-text', { text, span: { start: snapshot.draft.length, end: snapshot.draft.length, draftRev: snapshot.draftRev } })) throw Error('NOTEBOOK_DRAFT_APPEND_REFUSED')
  }
  const injected = (companion: Companion): (() => NotebookInjected) => () => ({
    hooks: { companion: companion.view, generation: connection.generation },
    using: (scope, operation, signal) => companion.using(scope, operation, signal),
    refreshFacts: scope => { if (companion.current(scope)) void companion.refresh(scope).catch(console.warn) },
    citeSource: (scope, source) => { if (!companion.current(scope)) throw Error('NOTEBOOK_SCOPE_CHANGED'); citeSource(scope, source) },
  })
  ctx.inject(['companion'], child => {
    child.slots.inject('nidofy.notebook', () => child.slots.register({ name: 'nidofy.notebook', locale: 'nidofy.notebook', store, inject: injected(child.companion) }, Rail))
  })
  const independent = (): SettingsInjected => ({ hooks: { generation: connection.generation },
    refreshFacts: scope => {
      const companion = ctx.get('companion'), current = companion?.view.getSnapshot().scope
      if (companion && current && current.sessionId === scope.sessionId) injected(companion)().refreshFacts(current)
    },
    using: async (_scope, operation, signal) => {
      const generation = connection.generation.getSnapshot()
      if (!generation) throw Error('NOTEBOOK_SCOPE_CHANGED')
      const lifetime = new AbortController()
      const off = connection.generation.subscribe(() => { if (connection.generation.getSnapshot() !== generation) lifetime.abort() })
      const combined = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal
      try { combined.throwIfAborted(); const value = await operation(combined); combined.throwIfAborted(); return value }
      finally { off() }
    }, citeSource,
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'nidofy-notebook', order: 45, label: () => t('notebook'), locale: 'nidofy.notebook', store, inject: independent }, Settings))
  ctx.effect(() => {
    const style = document.createElement('style'); style.textContent = notebookCss; document.head.append(style)
    return () => { style.remove() }
  })
}

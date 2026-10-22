import { createRoot } from 'react-dom/client'
import { createElement, useSyncExternalStore } from 'react'
import { registerClient } from '../src/client/index.ts'
import { VillageRuntime } from '../src/client/runtime.ts'
import * as Git from '../../source-control/src/client/index.ts'
import * as Live2D from '../../live2d/src/client/index.ts'
import type { Context } from '@deepseek-ai/cordis'
function store<T>(value: T) {
  const listeners = new Set<() => void>()
  return { getSnapshot: () => value, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
    set: (next: T) => { value = next; for (const fn of listeners) fn() } }
}
const connection = store('connected'), selection = store({ key: 'session-a' }), panel = store<string | null>(null)
const cleanups: (() => unknown)[] = [], resets: (() => void)[] = [], entries: { slot: string; component: any; locale: string }[] = []
const dictionaries = new Map<string, { zh: Record<string, string> }>()
const ctx = { effect: (fn: () => (() => unknown)) => { cleanups.push(fn()) },
  on: (event: string, fn: () => void) => { if (event === 'connection/reset') resets.push(fn) },
  get: () => ({ state: connection }), uiSession: { adapter: { current: selection } },
  locale: { register: (ns: string, value: { zh: Record<string, string> }) => { dictionaries.set(ns, value); return () => dictionaries.delete(ns) },
    bind: (ns: string) => (key: string) => dictionaries.get(ns)?.zh[key] ?? key },
  slots: { inject: (_: string, fn: () => void) => fn(), register: (config: { name: string; locale: string }, component: any) => {
    entries.push({ slot: config.name, component, locale: config.locale }); return () => {}
  } },
} as unknown as Context
Git.apply(ctx); Live2D.apply(ctx)
let runtime = new VillageRuntime()
registerClient(ctx, runtime)
const root = createRoot(document.getElementById('root')!)
const sessions = { byId: {} }, workspaces = { items: [] }, statuses = new Map([['session-a', { running: false }], ['session-b', { running: false }]])
const props = (locale: string) => ({ t: (key: string) => dictionaries.get(locale)?.zh[key] ?? key,
  usePanelInfo: (select: (v: { activePanelId: string | null }) => unknown) => select({ activePanelId: useSyncExternalStore(panel.subscribe, panel.getSnapshot) }),
  useSessionStatus: (select: (v: typeof statuses) => unknown) => select(statuses),
  useSessions: (select: (v: typeof sessions) => unknown) => select(sessions), useWorkspaces: (select: (v: typeof workspaces) => unknown) => select(workspaces) })
function show() {
  root.render(<>{entries.filter(e => e.slot === 'shell.overlay').map((e, i) => createElement(e.component, { ...props(e.locale), key: i }))}</>)
}
show()
const api = {
  inspect: () => ({ entrance: { ...runtime.entrance, canReveal: runtime.canRevealEntrance, progress: runtime.entrance.progress(runtime.canRevealEntrance) }, resourceKeys: Object.keys(runtime.images ?? {}), errorCode: runtime.errorCode, recoveryState: runtime.recoveryState, diagnostics: JSON.parse(runtime.diagnostics.export()), presentation: runtime.presentation, notices: runtime.notices, world: runtime.controller?.snapshot(), revision: runtime.revision, ready: runtime.ready, frameReady: runtime.frameReady,
    drag: runtime.controller?.drag, reasons: [...runtime.reasons], error: runtime.error, generation: runtime.generation, profileId: runtime.profileId,
    homeDraft: runtime.homeDraft, decorationDraft: runtime.decorationDraft, extraDecorationDraft: runtime.extraDecorationDraft, homeDraftError: runtime.homeDraftError, album: runtime.album.state, albumError: runtime.album.error, photoMode: runtime.photoMode, actionError: runtime.actionError, preferences: runtime.preferences, preferencesSaving: runtime.preferencesSaving, saveReceipt: runtime.saveReceipt }),
  session: () => { selection.set({ key: selection.getSnapshot().key === 'session-a' ? 'session-b' : 'session-a' }) },
  sidebar: (open: boolean) => document.getElementById('frame')!.toggleAttribute('data-rightbar-collapsed', !open),
  connection: (value: boolean) => connection.set(value ? 'connected' : 'disconnected'),
  reset: () => { for (const fn of resets) fn() },
  panel: (value: boolean) => panel.set(value ? 'settings' : null),
  entranceViewport: () => runtime.present({type:'patch',patch:{expanded:true}}),
  preference: (theme: 'light' | 'dark') => runtime.setPreferences({theme}),
  flush: () => runtime.flush(),
  dispose: async () => { root.render(null); for (const fn of cleanups.reverse()) await fn() },
}
Object.assign(window, { __villageHostFixture: api })
document.getElementById('session')!.onclick = api.session
document.getElementById('sidebar')!.onclick = () => api.sidebar(document.getElementById('frame')!.hasAttribute('data-rightbar-collapsed'))
document.getElementById('reconnect')!.onclick = () => { api.connection(false); setTimeout(() => api.connection(true), 800) }

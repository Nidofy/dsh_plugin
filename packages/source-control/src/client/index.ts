import { HeaderLauncher } from './header-launcher.tsx'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { GlobalStandardProps, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useSyncExternalStore } from 'react'
import { PanelLauncher } from './Launcher.tsx'
import { RepositoryPanel } from './Panel.tsx'
import { FloatingPanel } from './Floating.tsx'
import { en, zh } from './messages.ts'
export { RepositoryPanel } from './Panel.tsx'
export type { Request } from './Panel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'nidofy.source-control': keyof typeof en }
}
export const name = 'nidofy-source-control-client'
export const inject = ['slots', 'locale', 'connection', 'uiSession']
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('nidofy.source-control', { en, zh }))
  const t = ctx.locale.bind('nidofy.source-control')
  let state = { open: false, generation: 0 }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const getSnapshot = () => state
  const change = (open: boolean, generation = state.generation) => {
    state = { open, generation }; for (const listener of listeners) listener()
  }
  ctx.on('connection/reset', () => change(false, state.generation + 1))
  const selection = ctx.uiSession.adapter.current
  type Localized = PropsLocale<'nidofy.source-control'>
  function useProject(props: GlobalStandardProps) {
    const binding = useSyncExternalStore(selection.subscribe, selection.getSnapshot)
    const cwd = props.useSessions(s => Object.values(s.byId).find(row => row.id === binding.key)?.cwd)
    const workspacePath = props.useWorkspaces(s => s.items.find(row => row.sessionIds.some(id => id === binding.key))?.path)
    return workspacePath ?? cwd ?? null
  }
  const language = (props: Localized) => props.t('title') === zh.title ? 'zh' : 'en'
  function Floating(props: GlobalStandardProps & Localized) {
    const current = useSyncExternalStore(subscribe, getSnapshot)
    const projectRoot = useProject(props)
    const mainPanel = props.usePanelInfo(s => s.activePanelId)
    return current.open && mainPanel === null ? createElement(FloatingPanel, {
      key: current.generation, projectRoot, locale: language(props), onClose: () => change(false),
    }) : null
  }
  function Settings(props: Localized & GlobalStandardProps) {
    const current = useSyncExternalStore(subscribe, getSnapshot)
    const projectRoot = useProject(props)
    return createElement(RepositoryPanel, { key: current.generation, projectRoot, locale: language(props) })
  }
  function Launcher(props: Localized) {
    const current = useSyncExternalStore(subscribe, getSnapshot)
    return createElement(PanelLauncher, { locale: language(props), open: current.open, onOpen: () => {
      if (!state.open) window.dispatchEvent(new CustomEvent('nidofy:floating-panel-open', { detail: 'source-control' }))
      change(!state.open)
    } })
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-source-control-floating', locale: 'nidofy.source-control' }, Floating))
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'nidofy-source-control', order: 48, locale: 'nidofy.source-control', label: () => t('title') }, Settings))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-source-control-launcher', order: -30, locale: 'nidofy.source-control' },
    (props: PropsLocale<'nidofy.source-control'>) => createElement(HeaderLauncher, { id: 'source-control', order: -30, children: createElement(Launcher, props) })))
}

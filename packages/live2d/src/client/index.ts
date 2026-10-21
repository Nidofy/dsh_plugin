import { HeaderLauncher } from './header-launcher.tsx'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { GlobalStandardProps, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useSyncExternalStore } from 'react'
import { Floating } from './Floating.tsx'
import { en, zh } from './messages.ts'
import { css } from './style.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'nidofy.live2d': keyof typeof en }
}
export const name = 'nidofy-live2d-client'
export const inject = ['slots', 'locale', 'connection', 'uiSession']
/** Additive floating panel; never claims a sidebar or Companion renderer slot. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('nidofy.live2d', { en, zh }))
  let state = { open: false, generation: 0 }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const snapshot = () => state
  const change = (open: boolean, generation = state.generation) => {
    state = { open, generation }; for (const listener of listeners) listener()
  }
  // Companions are exclusive; Git remains above either companion.
  const eventName = 'nidofy:floating-panel-open'
  ctx.effect(() => {
    const yieldPanel = (event: Event) => { if ((event as CustomEvent).detail === 'ai-village') change(false) }
    window.addEventListener(eventName, yieldPanel)
    return () => window.removeEventListener(eventName, yieldPanel)
  })
  ctx.on('connection/reset', () => change(state.open, state.generation + 1))
  const selection = ctx.uiSession.adapter.current
  const transport = ctx.get('connection') as ConnectionHandle
  function Surface(props: GlobalStandardProps & PropsLocale<'nidofy.live2d'>) {
    const current = useSyncExternalStore(subscribe, snapshot)
    const binding = useSyncExternalStore(selection.subscribe, selection.getSnapshot)
    const main = props.usePanelInfo(value => value.activePanelId)
    const facts = props.useSessionStatus(value => [...value].find(([id]) => id === binding.key)?.[1])
    const connection = useSyncExternalStore(transport.state.subscribe, transport.state.getSnapshot)
    const status = connection !== 'connected' ? 'disconnected' : facts?.pendingInteraction ? 'waiting' : facts?.running === true ? 'working' : facts?.running === false ? 'idle' : 'unknown'
    return current.open && binding.key ? createElement(Floating, {
      key: String(binding.key) + ':' + current.generation, locale: props.t('title') === zh.title ? 'zh' : 'en', status, active: main === null,
      onClose: () => { change(false); document.querySelector<HTMLButtonElement>('[data-nidofy-live2d-launcher]')?.focus() },
    }) : null
  }
  function Launcher(props: PropsLocale<'nidofy.live2d'>) {
    const current = useSyncExternalStore(subscribe, snapshot)
    return createElement('span', { className: 'dsh-live2d' }, createElement('style', null, css),
      createElement('button', { 'data-nidofy-live2d-launcher': '', title: props.t('open'), 'aria-label': props.t('open'), 'aria-pressed': current.open,
        onClick: () => {
          if (!state.open) window.dispatchEvent(new CustomEvent(eventName, { detail: 'live2d' }))
          change(!state.open)
        },
      }, '◉'))
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-live2d-floating', locale: 'nidofy.live2d' }, Surface))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-live2d-launcher', order: -20, locale: 'nidofy.live2d' },
    (props: PropsLocale<'nidofy.live2d'>) => createElement(HeaderLauncher, { id: 'live2d', order: -20, children: createElement(Launcher, props) })))
}

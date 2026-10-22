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
import { VillageRuntime } from './runtime.ts'
import { Floating, css } from './Floating.tsx'
import { en, zh } from './messages.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'nidofy.ai-village': keyof typeof en } }
export const name = 'nidofy-ai-village-client'
export const inject = ['slots', 'locale', 'connection', 'uiSession']
export function apply(ctx: Context): void {
  registerClient(ctx, new VillageRuntime())
}
export function registerClient(ctx: Context, runtime: VillageRuntime): void {
  ctx.effect(() => ctx.locale.register('nidofy.ai-village', { en, zh }))
  const transport = ctx.get('connection') as ConnectionHandle
  const close = () => { runtime.hide(); document.querySelector<HTMLButtonElement>('[data-nidofy-village-launcher]')?.focus() }
  ctx.effect(() => {
    const visibility = () => runtime.pause('hidden', document.hidden)
    const connection = () => runtime.setConnection(transport.state.getSnapshot() === 'connected')
    const yieldPanel = (event: Event) => { if ((event as CustomEvent).detail === 'live2d') runtime.hide(true) }
    const pagehide = () => { runtime.leavePage(); void runtime.dispose() }
    document.addEventListener('visibilitychange', visibility); window.addEventListener('nidofy:floating-panel-open', yieldPanel); window.addEventListener('pagehide', pagehide)
    const unsubscribe = transport.state.subscribe(connection)
    visibility(); connection()
    return async () => {
      unsubscribe(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('nidofy:floating-panel-open', yieldPanel); window.removeEventListener('pagehide', pagehide)
      await runtime.dispose()
    }
  })
  ctx.on('connection/reset', () => runtime.setConnection(transport.state.getSnapshot() === 'connected', true))
  function Surface(props: GlobalStandardProps & PropsLocale<'nidofy.ai-village'>) {
    const main = props.usePanelInfo(value => value.activePanelId)
    // Never key this owner by session id. The same world survives conversation switches.
    return createElement(Floating, { runtime, locale: props.t('title') === zh.title ? 'zh' : 'en', active: main === null, onClose: close })
  }
  function Launcher(props: PropsLocale<'nidofy.ai-village'>) {
    useSyncExternalStore(runtime.subscribeUI, runtime.snapshotUI)
    return createElement('span', { className: 'dsh-ai-village' }, createElement('style', null, css),
      createElement('button', { 'data-nidofy-village-launcher': '', title: props.t('open'), 'aria-label': props.t('open'), 'aria-pressed': runtime.open,
        onClick: () => { if (runtime.open) close(); else { window.dispatchEvent(new CustomEvent('nidofy:floating-panel-open', { detail: 'ai-village' })); runtime.show() } },
      }, '⌂'))
  }
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-ai-village-floating', locale: 'nidofy.ai-village' }, Surface))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'nidofy-ai-village-launcher', order: -10, locale: 'nidofy.ai-village' },
    (props: PropsLocale<'nidofy.ai-village'>) => createElement(HeaderLauncher, { id: 'ai-village', order: -10, children: createElement(Launcher, props) })))
}

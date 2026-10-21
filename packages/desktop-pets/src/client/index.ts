import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import { createElement } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { PetStore } from './store.ts'
import { PetSettingsPage } from './Settings.tsx'
import { desktopPetsBridge } from './native.ts'
const en = { title: 'Desktop pets' }, zh = { title: '桌宠' }
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'nidofy.desktop-pets': keyof typeof en }
}
export const name = 'nidofy-desktop-pets-client'
export const inject = ['slots', 'locale', 'connection']
export function apply(ctx: Context): void {
  const store = new PetStore()
  ctx.effect(() => ctx.locale.register('nidofy.desktop-pets', { en, zh }))
  ctx.effect(() => {
    void store.refresh()
    const timer = setInterval(() => { if (!document.hidden) void store.refresh() }, 1500)
    const visible = () => { if (!document.hidden) void store.refresh() }
    document.addEventListener('visibilitychange',visible)
    return () => {clearInterval(timer); document.removeEventListener('visibilitychange',visible); store.dispose()}
  })
  ctx.on('connection/reset',()=>store.reset())
  ctx.effect(() => desktopPetsBridge()?.onNavigate(sessionId => {
    const workspace = ctx.get('uiWorkspace') as unknown as { openSession?: (id: string) => void } | undefined
    workspace?.openSession?.(sessionId)
  }) ?? (() => {}))
  const t = ctx.locale.bind('nidofy.desktop-pets')
  ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section',id:'nidofy-desktop-pets',order:46,locale:'nidofy.desktop-pets',label:()=>t('title')},
    (props:PropsLocale<'nidofy.desktop-pets'>)=>createElement(PetSettingsPage,{store,zh:props.t('title')===zh.title})))
}

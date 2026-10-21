import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useSyncExternalStore } from 'react'
import { SkinSettings } from './settings.tsx'
import { decode, defaults, tokens, skinCss, storageKey, type SkinPreferences } from './presentation.ts'
const en={title:'Whale Island skin'},zh={title:'鲸屿皮肤'}
declare module '@deepseek-ai/dsh-client-ui-slots' {interface LocaleNamespaceMap {'nidofy.whale-skin':keyof typeof en}}
export const name='nidofy-whale-skin-client'
export const inject=['slots','locale','theme']
export function apply(ctx:Context) {
  let state={...defaults}, error='', release: (()=>void)|undefined
  try {state=decode(JSON.parse(localStorage.getItem(storageKey) ?? 'null'))} catch {}
  const listeners=new Set<()=>void>()
  const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
  const snapshot=()=>state
  const present=()=>{
    release?.();release=undefined
    document.body.removeAttribute('data-nidofy-whale-skin')
    document.body.style.removeProperty('--nidofy-whale-strength')
    if(state.enabled) {
      release=ctx.theme.overrideTokens('nidofy-whale-skin',tokens)
      document.body.setAttribute('data-nidofy-whale-skin',state.decorations?'decorated':'plain')
      document.body.style.setProperty('--nidofy-whale-strength',String(state.strength))
    }
  }
  const update=(value:Partial<SkinPreferences>)=>{
    const next=decode({...state,...value})
    try {localStorage.setItem(storageKey,JSON.stringify(next));error=''} catch {error='Settings could not be saved / 无法保存设置'}
    state=next;present();for(const listener of listeners)listener()
  }
  ctx.effect(()=>ctx.locale.register('nidofy.whale-skin',{en,zh}))
  ctx.effect(()=>{
    const style=document.createElement('style');style.textContent=skinCss;document.head.append(style);present()
    const storage=(event:StorageEvent)=>{if(event.key!==storageKey)return;try{state=decode(JSON.parse(event.newValue??'null'));present();for(const listener of listeners)listener()}catch{}}
    window.addEventListener('storage',storage)
    return()=>{window.removeEventListener('storage',storage);release?.();style.remove();document.body.removeAttribute('data-nidofy-whale-skin');document.body.style.removeProperty('--nidofy-whale-strength');listeners.clear()}
  })
  const t=ctx.locale.bind('nidofy.whale-skin')
  ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'nidofy-whale-skin',order:47,locale:'nidofy.whale-skin',label:()=>t('title')},
    (props:PropsLocale<'nidofy.whale-skin'>)=>{const state=useSyncExternalStore(subscribe,snapshot);return createElement(SkinSettings,{state,update,error,zh:props.t('title')===zh.title})}))
}

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { VillageIcon } from './Icon.tsx'
export function PanelHeader({runtime:r,cn,title}:{runtime:VillageRuntime;cn:boolean;title:string}) {
  return <header className="village-panel-header"><button aria-label={cn?'返回':'Back'} title={cn?(r.presentation.history.length?'返回来源页面':'返回小院'):(r.presentation.history.length?'Back to previous page':'Back to courtyard')} onClick={()=>r.present({type:'back'})}><VillageIcon name="back" /></button><h2>{title}</h2><button aria-label={cn?'关闭面板':'Close panel'} onClick={()=>r.present({type:'close'})}><VillageIcon name="close" /></button></header>
}
export function PanelShell({runtime:r,cn,title,className='',children}:{runtime:VillageRuntime;cn:boolean;title:string;className?:string;children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null), p=r.presentation, route=[p.tab,p.overlay,p.page].join('/')
  useLayoutEffect(()=>{const node=ref.current;if(!node)return;node.scrollTop=r.presentation.scrollTop
    const key=r.presentation.focusKey
    if(key) [...node.querySelectorAll<HTMLElement>('button,input,select,summary,[tabindex]')].find(el=>(el.dataset.focusKey||el.getAttribute('aria-label')||el.id||el.textContent||'')===key)?.focus({preventScroll:true})
  },[route,r])
  return <section className={`village-surface ${className}`} data-page={p.page} data-route={route} aria-label={title}>
    <PanelHeader runtime={r} cn={cn} title={title}/><div key={route} ref={ref} className="village-panel" onScroll={e=>{r.presentation.scrollTop=e.currentTarget.scrollTop}} onFocusCapture={e=>{const el=e.target;r.presentation.focusKey=el.dataset.focusKey||el.getAttribute('aria-label')||el.id||el.textContent||''}}>{children}</div>
  </section>
}

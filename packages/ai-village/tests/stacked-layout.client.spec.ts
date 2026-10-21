// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import { attachFloatingLayout as village, type FloatingGeometry } from '../src/client/floating-layout.ts'
import { attachFloatingLayout as git } from '../../source-control/src/client/floating-layout.ts'
import { attachFloatingLayout as live } from '../../live2d/src/client/floating-layout.ts'
it.each(['village','live2d'])('expanded Git grows and pushes %s down, fills a 1440p rail and shrinks again',async companion=>{
  const callbacks=new Set<()=>void>()
  vi.stubGlobal('ResizeObserver',class{constructor(fn:()=>void){callbacks.add(fn)}observe(){}unobserve(){}disconnect(){}})
  document.body.innerHTML='<div data-rightbar-collapsed><main><div data-conversation-content></div></main><div data-rightbar-col></div><div data-shell-overlay><div id="companion"></div><div data-nidofy-vcs-overlay id="git"><div class="dsh-vcs"></div></div></div></div>'
  document.getElementById('companion')!.setAttribute(companion==='village'?'data-nidofy-village-open':'data-nidofy-live2d-open','')
  const frame=document.body.firstElementChild!
  frame.querySelector('main')!.getBoundingClientRect=()=>({right:2560,width:2200} as DOMRect)
  frame.querySelector('[data-conversation-content]')!.getBoundingClientRect=()=>({top:80,height:1320} as DOMRect)
  let natural=190
  frame.querySelector('.dsh-vcs')!.getBoundingClientRect=()=>({height:natural} as DOMRect)
  const sizes:Record<string,FloatingGeometry|null>={}
  const stopGit=git(document.getElementById('git')!,v=>{sizes.git=v})
  const stopCompanion=(companion==='village'?village:live)(document.getElementById('companion')!,v=>{sizes.companion=v})
  try{
    expect(sizes.git!.height).toBe(190)
    const compact=sizes.companion!.top
    natural=660;callbacks.forEach(fn=>fn())
    expect(sizes.git!.height).toBe(660)
    expect(sizes.companion!.top).toBeGreaterThan(compact)
    expect(sizes.companion!.top).toBe(sizes.git!.top+sizes.git!.height+12)
    expect(sizes.companion!.top+sizes.companion!.height).toBe(1388)
    natural=3000;callbacks.forEach(fn=>fn())
    expect(sizes.git!.height).toBe(684);expect(sizes.companion!.height).toBe(600)
    natural=190;callbacks.forEach(fn=>fn());expect(sizes.companion!.top).toBe(compact)
  }finally{stopGit();stopCompanion();document.body.replaceChildren();vi.unstubAllGlobals()}
})
it('stacks Git above the village, shares one width, restores either panel and releases markers', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  document.body.innerHTML = '<div data-rightbar-collapsed><main><div data-conversation-content></div></main><div data-rightbar-col></div><div data-shell-overlay><div id="game" data-nidofy-village-open></div><div id="git" data-nidofy-vcs-overlay></div></div></div>'
  const frame = document.body.firstElementChild!, chat = frame.querySelector('[data-conversation-content]')!
  frame.querySelector('main')!.getBoundingClientRect = () => ({ right: 1300, width: 1000 } as DOMRect)
  chat.getBoundingClientRect = () => ({ top: 70, height: 800 } as DOMRect)
  let game: FloatingGeometry | null = null, vcs: FloatingGeometry | null = null
  const values = { game: () => game!, git: () => vcs! }
  const stopGame = village(document.getElementById('game')!, g => { game = g })
  const stopGit = git(document.getElementById('git')!, g => { vcs = g })
  try {
    expect(values.game().top).toBe(values.git().top + values.git().height + 12)
    expect(values.game().left).toBe(values.git().left)
    expect(values.game().height + values.git().height + 12).toBe(776)
    expect(document.querySelectorAll('[data-nidofy-ai-village-space],[data-nidofy-vcs-space]')).toHaveLength(1)
    document.getElementById('game')!.removeAttribute('data-nidofy-village-open'); await Promise.resolve()
    expect(values.git().height).toBe(776)
    document.getElementById('game')!.setAttribute('data-nidofy-village-open', ''); await Promise.resolve()
    document.getElementById('git')!.remove(); await Promise.resolve()
    expect(values.game().top).toBe(82); expect(values.game().height).toBe(776)
    frame.removeAttribute('data-rightbar-collapsed'); await Promise.resolve()
    expect(game).toBeNull(); expect(vcs).toBeNull()
  } finally { stopGame(); stopGit(); document.body.replaceChildren(); vi.unstubAllGlobals() }
})

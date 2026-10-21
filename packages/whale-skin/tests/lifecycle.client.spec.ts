// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {apply} from '../src/client/index.ts'
import {decode,storageKey} from '../src/client/presentation.ts'
afterEach(()=>{localStorage.clear();document.body.removeAttribute('data-nidofy-whale-skin')})
it('bounds persisted input',()=>{expect(decode({enabled:true,strength:999}).strength).toBe(.4);expect(decode({strength:NaN}).strength).toBe(.18)})
it('releases official theme overrides and decorations on unload and follows cross-window settings',()=>{
  localStorage.setItem(storageKey,JSON.stringify({enabled:true}))
  const effects:(()=>void)[]=[];const release=vi.fn(),overrideTokens=vi.fn(()=>release)
  const ctx={effect:(fn:()=>()=>void)=>effects.push(fn()),theme:{overrideTokens},locale:{register:()=>()=>{},bind:()=>()=>''},slots:{inject:vi.fn()}}
  apply(ctx as never)
  expect(document.body.getAttribute('data-nidofy-whale-skin')).toBe('decorated')
  expect(overrideTokens).toHaveBeenCalledOnce()
  window.dispatchEvent(new StorageEvent('storage',{key:storageKey,newValue:'{"enabled":false}'}))
  expect(release).toHaveBeenCalledOnce();expect(document.body.hasAttribute('data-nidofy-whale-skin')).toBe(false)
  effects.reverse().forEach(dispose=>dispose())
  expect(document.head.querySelector('style')).toBeNull()
})

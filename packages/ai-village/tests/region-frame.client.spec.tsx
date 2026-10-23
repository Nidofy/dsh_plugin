// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Floating } from '../src/client/Floating.tsx'
import { VillageRuntime } from '../src/client/runtime.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { frameVersion } from '../src/core/frame-protocol.ts'
import { scene } from '../src/definitions.ts'

vi.mock('../src/client/floating-layout.ts',()=>({attachFloatingLayout:(_anchor:HTMLElement,publish:(g:unknown)=>void)=>{publish({left:0,top:0,width:340,height:720});return()=>{}}}))
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('mounts exactly one fresh iframe for a committed region and ignores failure from the retired frame',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}))
  vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{})
  const r=new VillageRuntime();r.controller=new LivingController(createLivingWorld(scene),scene,()=>{})
  r.open=true;r.connected=true;r.ready=true;r.reasons.clear();r.reasons.add('user');r.controller.pauseReasons.add('user')
  r.preferences.theme='light';r.entrance.metadata=true;r.entrance.verified=1;r.images={}
  const ui=render(<Floating runtime={r} locale="zh" active onClose={()=>{}}/>),old=ui.container.querySelector('iframe')!,oldWindow=old.contentWindow!
  expect(ui.container.querySelectorAll('iframe')).toHaveLength(1)
  const post=vi.spyOn(oldWindow,'postMessage').mockImplementation(()=>{})
  await act(async()=>{window.dispatchEvent(new MessageEvent('message',{source:oldWindow,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,type:'ready',token:'',sequence:1}}))})
  const oldToken=post.mock.calls.find(([m])=>m.type==='init')![0].token
  await act(async()=>{
    r.controller!.world=switchRegion(r.controller!.world,scene,'bookhouse');r.controller!.syncScene()
    r.present({type:'close'})
  })
  const fresh=ui.container.querySelector('iframe')!
  expect(ui.container.querySelectorAll('iframe')).toHaveLength(1);expect(fresh).not.toBe(old);expect(old.isConnected).toBe(false)
  expect(fresh.title).toContain('书屋')
  expect(ui.container.querySelector('.village-region-transition')).not.toBeNull()
  expect(ui.container.querySelector('.village-entrance')).toBeNull()
  await act(async()=>{window.dispatchEvent(new MessageEvent('message',{source:oldWindow,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,type:'failed',token:oldToken,sequence:2}}))})
  expect(ui.container.querySelector('iframe')).toBe(fresh);expect(ui.queryByText('场景显示失败。')).toBeNull()
  await act(async()=>{ui.unmount()});expect(document.querySelectorAll('.village-canvas iframe')).toHaveLength(0)
  post.mockRestore();await r.dispose()
})
it('cold bookhouse and its hidden remount use the neutral overlay and keep only one current iframe',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}))
  vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{})
  const r=new VillageRuntime();r.controller=new LivingController(switchRegion(createLivingWorld(scene),scene,'bookhouse'),scene,()=>{})
  r.open=true;r.connected=true;r.ready=true;r.reasons.clear();r.reasons.add('user');r.controller.pauseReasons.add('user')
  r.preferences.theme='light';r.entrance.metadata=true;r.entrance.verified=1;r.images={}
  const ui=render(<Floating runtime={r} locale="zh" active onClose={()=>{}}/>),old=ui.container.querySelector('iframe')!
  expect(ui.container.querySelectorAll('iframe')).toHaveLength(1)
  expect(ui.container.querySelector('.village-region-transition')).not.toBeNull();expect(ui.container.querySelector('.village-entrance')).toBeNull()
  await act(async()=>{r.pause('hidden',true)})
  expect(ui.container.querySelectorAll('iframe')).toHaveLength(0)
  await act(async()=>{r.pause('hidden',false)})
  expect(ui.container.querySelectorAll('iframe')).toHaveLength(1);expect(ui.container.querySelector('iframe')).not.toBe(old)
  expect(ui.container.querySelector('.village-region-transition')).not.toBeNull();expect(r.canRevealEntrance).toBe(false)
  await act(async()=>{ui.unmount()});await r.dispose()
})

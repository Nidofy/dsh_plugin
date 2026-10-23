// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Floating } from '../src/client/Floating.tsx'
import { VillageRuntime } from '../src/client/runtime.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { scene } from '../src/definitions.ts'

vi.mock('../src/client/floating-layout.ts',()=>({attachFloatingLayout:(_anchor:HTMLElement,publish:(g:unknown)=>void)=>{publish({left:0,top:0,width:340,height:720});return()=>{}}}))
beforeEach(()=>{
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
  Object.defineProperty(HTMLImageElement.prototype,'decode',{configurable:true,value:()=>Promise.resolve()})
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}))
})
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
function setup() {
  const request=vi.fn(),r=new VillageRuntime(request)
  r.controller=new LivingController(createLivingWorld(scene),scene,()=>{})
  r.open=true;r.connected=true;r.ready=true;r.reasons.clear();r.reasons.add('user');r.controller.pauseReasons.add('user')
  r.preferences.theme='light';r.entrance.metadata=true;r.entrance.verified=1;r.images={}
  r.returnToDoor()
  const close=vi.fn(),ui=render(<Floating runtime={r} locale="zh" active onClose={close}/>)
  return {r,ui,request,close}
}
it('holds at the closed doors without a frame or writes, then opens once and waits for the verified frame',async()=>{
  const {r,ui,request}=setup(),world=r.controller!.snapshot()
  try {
    expect(ui.container.querySelector('iframe')).toBeNull()
    r.skipEntrance();r.finishEntrance();expect(r.entrance.blocking).toBe(true)
    const retry=vi.spyOn(r,'retryEntrance')
    fireEvent.click(ui.getByRole('button',{name:'点击开门，重新进入'}))
    fireEvent.click(ui.getByRole('button',{name:'点击开门，重新进入'}))
    await act(async()=>{await vi.advanceTimersByTimeAsync(419)})
    expect(retry).not.toHaveBeenCalled();expect(ui.container.querySelector('iframe')).toBeNull()
    await act(async()=>{await vi.advanceTimersByTimeAsync(1)})
    expect(retry).toHaveBeenCalledOnce();expect(ui.container.querySelectorAll('iframe')).toHaveLength(1)
    expect(ui.getByRole('progressbar')).toBeDefined();expect(ui.container.querySelectorAll('.entrance-portrait')).toHaveLength(7)
    expect(r.canRevealEntrance).toBe(false);r.finishEntrance();expect(r.entrance.blocking).toBe(true)
    expect(r.controller!.snapshot()).toEqual(world);expect(request).not.toHaveBeenCalled()
  } finally {ui.unmount();await r.dispose()}
})
it('cancels the opening timer on close/unmount and never steals the host composer focus',async()=>{
  const {r,ui}=setup(),retry=vi.spyOn(r,'retryEntrance'),composer=document.createElement('textarea')
  document.body.append(composer);composer.focus()
  try {
    expect(document.activeElement).toBe(composer)
    fireEvent.click(ui.getByRole('button',{name:'点击开门，重新进入'}));ui.unmount()
    await act(async()=>{await vi.advanceTimersByTimeAsync(500)})
    expect(retry).not.toHaveBeenCalled();expect(document.activeElement).toBe(composer)
  } finally {composer.remove();await r.dispose()}
})
it('keeps diagnostics explicit and returns to closed doors when checking an uncertain save fails',async()=>{
  const {r,ui,request}=setup()
  try {
    r.error='SAVE_UNCONFIRMED';r.errorCode='SAVE_UNCONFIRMED'
    const check=vi.spyOn(r,'checkRecovery').mockResolvedValue(),restore=vi.spyOn(r,'recover').mockResolvedValue()
    r.preferences.reducedMotion=true
    fireEvent.click(ui.getByRole('button',{name:'点击开门，重新进入'}))
    await act(async()=>{await vi.advanceTimersByTimeAsync(1)})
    expect(check).toHaveBeenCalledOnce();expect(restore).not.toHaveBeenCalled();expect(request).not.toHaveBeenCalled()
    expect(ui.container.querySelector('iframe')).toBeNull();expect(ui.getByRole('button',{name:'点击开门，重新进入'})).toBeDefined()
    fireEvent.click(ui.getByRole('button',{name:'恢复上一成功版本'}));expect(restore).toHaveBeenCalledOnce()
  } finally {ui.unmount();await r.dispose()}
})

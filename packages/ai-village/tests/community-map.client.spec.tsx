// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CommunityMap } from '../src/client/CommunityMap.tsx'
import { VillageRuntime } from '../src/client/runtime.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { scene } from '../src/definitions.ts'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function fixture(){
  vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{})
  const r=new VillageRuntime()
  r.controller=new LivingController(createLivingWorld(scene),scene,()=>{})
  r.open=true;r.connected=true;r.ready=true;r.frameReady=true;r.entrance.blocking=false;r.reasons.clear()
  r.presentation.overlay='map'
  return r
}
it('browses every place without saving and requires a separate travel confirmation',()=>{
  const r=fixture(),travel=vi.spyOn(r,'switchRegion').mockResolvedValue(),before=r.controller!.snapshot(),save=vi.spyOn(r,'save')
  render(<CommunityMap runtime={r} cn/>)
  const list=screen.getByRole('group',{name:'选择地点'})
  for(const name of ['湖畔花园','AI 工坊']){
    fireEvent.click(within(list).getByRole('button',{name:new RegExp(name)}))
    expect((screen.getByRole('button',{name:`前往 ${name}`}) as HTMLButtonElement).disabled).toBe(true)
  }
  fireEvent.click(within(list).getByRole('button',{name:/茶会广场/}))
  expect((screen.getByRole('button',{name:'前往 茶会广场'}) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(within(list).getByRole('button',{name:/AI 书屋/}))
  expect(travel).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();expect(r.controller!.world).toEqual(before)
  fireEvent.click(screen.getByRole('button',{name:'前往 AI 书屋'}))
  expect(travel).toHaveBeenCalledExactlyOnceWith('bookhouse')
})
it('uses localized place previews and exposes current and selected states independently',()=>{
  const r=fixture();render(<CommunityMap runtime={r} cn={false}/>)
  const list=screen.getByRole('group',{name:'Choose a place'})
  expect(within(list).getByRole('button',{name:/Whale Courtyard/}).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(list).getByRole('button',{name:/AI Bookhouse/}))
  expect(within(list).getByRole('button',{name:/Whale Courtyard/}).textContent).toContain('You are here')
  expect(within(list).getByRole('button',{name:/AI Bookhouse/}).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('region',{name:'Place preview'}).textContent).not.toContain('development preview')
  expect(screen.getByRole('region',{name:'Place preview'}).textContent).toContain('discover the secrets of its pages with a friend')
})
it('explains activity, drag, arrangement, photo, connection, save and readiness gates, while retaining user pause',()=>{
  const r=fixture(),w=r.controller!.world
  expect(r.regionTravelIssue('bookhouse')).toBeNull()
  w.userPaused=true;r.controller!.pauseReasons.add('user');expect(r.regionTravelIssue('bookhouse')).toBeNull()
  w.activeEvent={} as never;expect(r.regionTravelIssue('bookhouse')).toBe('EVENT_ACTIVE');w.activeEvent=null
  r.controller!.drag={} as never;expect(r.regionTravelIssue('bookhouse')).toBe('REGION_DRAGGING');r.controller!.drag=null
  vi.spyOn(r,'arranging','get').mockReturnValue(true);expect(r.regionTravelIssue('bookhouse')).toBe('REGION_ARRANGING');vi.restoreAllMocks()
  r.photoMode=true;expect(r.regionTravelIssue('bookhouse')).toBe('REGION_PHOTO');r.photoMode=false
  r.connected=false;expect(r.regionTravelIssue('bookhouse')).toBe('REGION_CONNECTION');r.connected=true
  r.frameReady=false;expect(r.regionTravelIssue('bookhouse')).toBe('REGION_NOT_READY');r.frameReady=true
  const receipt=vi.spyOn(r,'saveReceipt','get').mockReturnValue({status:'unknown',operationId:'test'} as never)
  expect(r.regionTravelIssue('bookhouse')).toBe('REGION_UNCONFIRMED')
  receipt.mockReturnValue({status:'pending',operationId:'test'} as never);expect(r.regionTravelIssue('bookhouse')).toBe('REGION_SAVING')
  receipt.mockRestore()
})

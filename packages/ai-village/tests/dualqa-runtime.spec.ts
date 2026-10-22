// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest'
import {VillageRuntime} from '../src/client/runtime.ts'
import {createHomeWorld,type HomeWorld} from '../src/core/home-state.ts'
import {scene} from '../src/definitions.ts'
import type {Saved} from '../src/host/save-store.ts'
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()})
function fixture({conflict=false}={}){
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{})
 const profileId=crypto.randomUUID(),epoch=crypto.randomUUID()
 let world= createHomeWorld(scene);world.userPaused=true
 let saved:Saved<HomeWorld>={revision:1,operationId:crypto.randomUUID(),world}
 let prefs:any=null,unknown=false,offline=false,writes=0,acquires=0
 const runtime=new VillageRuntime(async(path,init)=>{
  const data=init?.body?JSON.parse(String(init.body)):null;let result:unknown={ok:true}
  if(path.endsWith('/acquire')){acquires++;if(conflict)return new Response(JSON.stringify({error:'LEASE_BUSY'}),{status:409,headers:{'content-type':'application/json'}});result={profileId,epoch,lease:crypto.randomUUID()}}
  else if(path.endsWith('/preferences-state'))result={profileId,epoch,saved:prefs}
  else if(path.endsWith('/preferences-save')){prefs={revision:(prefs?.revision??0)+1,operationId:data.operationId,world:data.world};result={profileId,epoch,...prefs}}
  else if(path.endsWith('/state')){if(offline)throw Error('STATE_OFFLINE');result={profileId,epoch,saved}}
  else if(path.endsWith('/save')){writes++;saved={revision:saved.revision+1,operationId:data.operationId,world:data.world};if(unknown)throw Error('ACK_LOST');result={profileId,epoch,...saved}}
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}})
 })
 vi.spyOn(runtime as unknown as {ensureAssets():Promise<void>},'ensureAssets').mockResolvedValue()
 runtime.images={}
 return {runtime,loseAck:()=>{unknown=true;offline=true},readAgain:()=>{offline=false},stats:()=>({writes,acquires})}
}
function paint(r:VillageRuntime,token='current'){
 r.entrance.verified=1;r.beginEntranceFrame(token);r.expectEntranceFrame(token,r.assetRevision,1);r.setFrameReady(true)
 r.entranceFrame(token,r.entrance.attemptId,r.assetRevision,1)
}
it('DQ-SAVE-01: unknown commit plus hidden/recreated frame cannot reveal or replay the write',async()=>{
 const f=fixture(),r=f.runtime
 try{
  r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush()
  paint(r);r.finishEntrance();expect(r.entrance.blocking).toBe(false)
  r.beginHome();r.homeTemplate('reading');f.loseAck();await r.confirmHome()
  expect(r.saveReceipt.status).toBe('unknown');const writes=f.stats().writes,draft=structuredClone(r.homeDraft)
  r.pause('sidebar',true);r.setFrameReady(false);r.pause('sidebar',false);paint(r,'replacement');r.skipEntrance();r.finishEntrance()
  expect(r.canRevealEntrance).toBe(false);expect(r.entrance.blocking).toBe(true);expect(r.homeDraft).toEqual(draft);expect(f.stats().writes).toBe(writes)
  f.readAgain();await r.checkRecovery();expect(r.saveReceipt.status).toBe('committed');expect(f.stats().writes).toBe(writes)
  expect(r.controller!.world.userPaused).toBe(true)
 }finally{await r.dispose()}
})
it('DQ-PAUSE-01: overlapping sidebar/hidden blockers require both to clear; fresh paint preserves user pause and draft',async()=>{
 const f=fixture(),r=f.runtime
 try{
  r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush();paint(r);r.finishEntrance()
  r.beginHome();r.homeTemplate('reading');const draft=structuredClone(r.homeDraft),ticks=r.controller!.world.ticks,writes=f.stats().writes
  r.pause('sidebar',true);r.pause('hidden',true);r.setFrameReady(false);paint(r,'hidden-frame');r.pause('sidebar',false);r.finishEntrance()
  expect(r.canRevealEntrance).toBe(false);expect(r.entrance.blocking).toBe(true)
  r.pause('hidden',false);paint(r,'visible-frame');r.finishEntrance()
  expect(r.entrance.blocking).toBe(false);expect(r.reasons.has('user')).toBe(true);expect(r.reasons.has('arrange')).toBe(true)
  expect(r.homeDraft).toEqual(draft);expect(r.controller!.world.ticks).toBe(ticks);expect(f.stats().writes).toBe(writes)
 }finally{await r.dispose()}
})
it('DQ-LEASE-01: denied acquisition cannot be bypassed by current-shaped paint or skip',async()=>{
 const f=fixture({conflict:true}),r=f.runtime
 try{
  r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.error).not.toBe(''))
  paint(r);r.skipEntrance();r.finishEntrance()
  expect(r.ready).toBe(false);expect(r.canRevealEntrance).toBe(false);expect(r.entrance.blocking).toBe(true)
  expect(r.controller).toBeUndefined();expect(f.stats()).toEqual({writes:0,acquires:1})
 }finally{await r.dispose()}
})

// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { attachFrame, type FrameRuntime } from '../src/client/frame-bridge.ts'
import { frameVersion } from '../src/core/frame-protocol.ts'
import { EntranceCoordinator } from '../src/client/entrance-state.ts'
import { createHomeWorld } from '../src/core/home-state.ts'
import { scene } from '../src/definitions.ts'
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()})
function bridge() {
 const frame=document.createElement('iframe');document.body.append(frame)
 const target=frame.contentWindow!,post=vi.spyOn(target,'postMessage').mockImplementation(()=>{})
 const entrance=new EntranceCoordinator(),world=createHomeWorld(scene),failed=vi.fn(),receipt=vi.fn(),unsubscribe=vi.fn()
 let refresh=()=>{},sequence=0,token=''
 const runtime:FrameRuntime={entrance,assetRevision:1,beginEntranceFrame:t=>entrance.bindFrame(t),expectEntranceFrame:(t,a,v)=>entrance.expectFrame(t,a,v),
  entranceDecode:(t,a,r,p)=>{entrance.decode(t,a,r,p)},entranceFrame:(...args)=>{if(entrance.acknowledge(...args))receipt()},
  bundle:(()=>({images:{}})) as FrameRuntime['bundle'],subscribe:fn=>{refresh=fn;return unsubscribe},setFrameReady:vi.fn(),pointer:vi.fn(),cancelDrag:vi.fn(),
  view:()=>({world,position:world.actor.position,dragging:false,dragTime:0,paused:true,debug:false})}
 const dispose=attachFrame(frame,runtime,failed)
 const send=(patch:Record<string,unknown>)=>window.dispatchEvent(new MessageEvent('message',{source:target,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,token,sequence:++sequence,...patch}}))
 const last=(type:string)=>post.mock.calls.filter(([m])=>m.type===type).at(-1)?.[0]
 send({type:'ready'});token=last('init').token
 return {entrance,runtime,world,failed,receipt,unsubscribe,send,last,refresh:()=>refresh(),close:()=>{dispose();post.mockRestore();frame.remove()}}
}
const ack=(m:any)=>({type:'first-frame-rendered',bootAttemptId:m.bootAttemptId,assetRevision:m.assetRevision,viewRevision:m.viewRevision})
it('DQ-ACK-01: paint delivered before readiness cannot open; current paint accepted exactly once',()=>{
 vi.useFakeTimers();const b=bridge()
 try{
  b.send({...ack(b.last('init')),viewRevision:1});expect(b.receipt).not.toHaveBeenCalled()
  b.send({type:'ready-to-render'});const m=b.last('render')
  b.send(ack(m));b.send(ack(m));expect(b.receipt).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(20_001);expect(b.failed).not.toHaveBeenCalled()
 }finally{b.close()}
})
it('DQ-ACK-02: asset replacement invalidates paint while decode is pending and rejects late old progress',()=>{
 vi.useFakeTimers();const b=bridge()
 try{
  b.send({type:'ready-to-render'});const old=b.last('render');b.send(ack(old))
  b.runtime.assetRevision=2;b.refresh();expect(b.entrance.firstFrame).toBe(false)
  b.send({...ack(old),assetRevision:2});expect(b.receipt).toHaveBeenCalledTimes(1)
  b.send({type:'frame-resource-progress',bootAttemptId:old.bootAttemptId,assetRevision:1,progress:1});expect(b.entrance.decoded).toBe(0)
  for(const progress of [.8,.2,NaN,-1,1.01])b.send({type:'frame-resource-progress',bootAttemptId:old.bootAttemptId,assetRevision:2,progress})
  expect(b.entrance.decoded).toBe(.8)
  b.send({type:'assets-ready',assetRevision:1});expect(b.last('render')).toBe(old)
  b.send({type:'assets-ready',assetRevision:2});const current=b.last('render')
  b.send(ack(old));expect(b.receipt).toHaveBeenCalledTimes(1)
  b.send(ack(current));expect(b.receipt).toHaveBeenCalledTimes(2);expect(b.entrance.firstFrame).toBe(true)
 }finally{b.close()}
})
it('DQ-ACK-03: assets-ready alone never cancels the new decode/paint timeout',()=>{
 vi.useFakeTimers();const b=bridge()
 try{
  b.send({type:'ready-to-render'});b.send(ack(b.last('render')))
  b.runtime.assetRevision=2;b.refresh();b.send({type:'assets-ready',assetRevision:2})
  expect(b.entrance.firstFrame).toBe(false);vi.advanceTimersByTime(20_001);expect(b.failed).toHaveBeenCalledOnce()
 }finally{b.close()}
})
it('DQ-LIFE-01: 100 frame replacements release subscriptions, messages and deadlines',()=>{
 vi.useFakeTimers()
 for(let i=0;i<100;i++){
  const b=bridge();b.send({type:'ready-to-render'});const old=ack(b.last('render'))
  b.close();b.send(old);vi.advanceTimersByTime(20_001)
  expect(b.receipt).not.toHaveBeenCalled();expect(b.failed).not.toHaveBeenCalled();expect(b.unsubscribe).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
 }
 expect(document.querySelectorAll('iframe')).toHaveLength(0)
})
it('DQ-LOAD-01: randomized late decode receipts are monotone only within their current generation',()=>{
 const e=new EntranceCoordinator();e.open();e.metadata=true;e.verified=1;e.bindFrame('current');e.expectFrame('current',3,1)
 let last=e.progress(false),seed=71
 for(let i=0;i<300;i++){seed=(seed*1664525+1013904223)>>>0;const p=(seed%101)/100;e.decode(i%3?'current':'old',e.attemptId,3,p);const next=e.progress(false);expect(next).toBeGreaterThanOrEqual(last);expect(next).toBeLessThan(1);last=next}
 const attempt=e.attemptId;e.beginBoot();expect(e.progress(false)).toBe(0)
 expect(e.decode('current',attempt,3,1)).toBe(false);expect(e.acknowledge('current',attempt,3,1)).toBe(false)
})

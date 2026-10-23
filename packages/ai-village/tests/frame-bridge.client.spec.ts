// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { attachFrame, type FrameRuntime } from '../src/client/frame-bridge.ts'
import { frameVersion } from '../src/core/frame-protocol.ts'
import { EntranceCoordinator } from '../src/client/entrance-state.ts'
import { createHomeWorld } from '../src/core/home-state.ts'
import { scene } from '../src/definitions.ts'

it('invalidates old region messages, rendering, capture and timers before unmount; old cleanup cannot clear the replacement frame', async () => {
  vi.useFakeTimers();const old=document.createElement('iframe'),next=document.createElement('iframe');document.body.append(old,next)
  const oldTarget=old.contentWindow!,nextTarget=next.contentWindow!,oldPost=vi.spyOn(oldTarget,'postMessage').mockImplementation(()=>{}),nextPost=vi.spyOn(nextTarget,'postMessage').mockImplementation(()=>{})
  const callbacks=new Set<()=>void>(),ready=vi.fn(),pointer=vi.fn(),input=vi.fn(),failed=vi.fn(),bind=vi.fn(),world=createHomeWorld(scene)
  let region:'courtyard'|'bookhouse'='courtyard',generation=1
  const runtime:FrameRuntime={get frameKey(){return region},get generation(){return generation},bundle:(()=>({images:{}}))as FrameRuntime['bundle'],subscribe:fn=>{callbacks.add(fn);return()=>{callbacks.delete(fn)}},setFrameReady:ready,pointer,input,cancelDrag:vi.fn(),bindCapture:bind,view:()=>({world,position:world.actor.position,dragging:false,dragTime:0,paused:true,debug:false})}
  const oldDispose=attachFrame(old,runtime,failed);let oldSequence=0,newSequence=0
  const deliver=(target:Window,token:string,sequence:number,patch:object)=>window.dispatchEvent(new MessageEvent('message',{source:target,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,token,sequence,...patch}}))
  let nextDispose=()=>{}
  try {
    deliver(oldTarget,'',++oldSequence,{type:'ready'});const oldToken=oldPost.mock.calls.find(([m])=>m.type==='init')![0].token
    deliver(oldTarget,oldToken,++oldSequence,{type:'ready-to-render'});const oldCapture=bind.mock.calls[0]![0] as ()=>Promise<ArrayBuffer>
    const renders=oldPost.mock.calls.filter(([m])=>m.type==='render').length
    region='bookhouse';generation++;for(const cb of callbacks)cb()
    deliver(oldTarget,oldToken,++oldSequence,{type:'failed'});deliver(oldTarget,oldToken,++oldSequence,{type:'ready-to-render'})
    deliver(oldTarget,oldToken,++oldSequence,{type:'ui-input',viewportRevision:0,input:{kind:'scene'}})
    expect(oldPost.mock.calls.filter(([m])=>m.type==='render')).toHaveLength(renders);expect(input).not.toHaveBeenCalled()
    await expect(oldCapture()).rejects.toThrow('PHOTO_UNAVAILABLE');vi.advanceTimersByTime(20001);expect(failed).not.toHaveBeenCalled()
    nextDispose=attachFrame(next,runtime,failed);deliver(nextTarget,'',++newSequence,{type:'ready'})
    const init=nextPost.mock.calls.find(([m])=>m.type==='init')![0];expect(init.region).toBe('bookhouse')
    deliver(nextTarget,init.token,++newSequence,{type:'ready-to-render'});const bindings=bind.mock.calls.length,calls=ready.mock.calls.length
    oldDispose();expect(bind).toHaveBeenCalledTimes(bindings);expect(ready).toHaveBeenCalledTimes(calls);expect(callbacks.size).toBe(1)
    deliver(oldTarget,oldToken,++oldSequence,{type:'failed'});expect(failed).not.toHaveBeenCalled()
  } finally {oldDispose();nextDispose();old.remove();next.remove();oldPost.mockRestore();nextPost.mockRestore();vi.useRealTimers()}
})

it('sends view after ready, but accepts first paint only for the current snapshot; times out ready without paint', () => {
  vi.useFakeTimers()
  const frame=document.createElement('iframe');document.body.append(frame)
  const target=frame.contentWindow!, post=vi.spyOn(target,'postMessage').mockImplementation(()=>{}), failed=vi.fn(), receipt=vi.fn(), world=createHomeWorld(scene), entrance=new EntranceCoordinator()
  let refresh=()=>{}, sequence=0, token=''
  const runtime:FrameRuntime={entrance, beginEntranceFrame:t=>entrance.bindFrame(t), expectEntranceFrame:(t,a,v)=>entrance.expectFrame(t,a,v), entranceFrame:receipt, bundle:(()=>({images:{}}))as FrameRuntime['bundle'],subscribe:fn=>{refresh=fn;return()=>{}},setFrameReady:()=>{},pointer:()=>{},cancelDrag:()=>{},view:()=>({world,position:world.actor.position,dragging:false,dragTime:0,paused:true,debug:false})}
  const dispose=attachFrame(frame,runtime,failed)
  const send=(patch:Record<string,unknown>)=>window.dispatchEvent(new MessageEvent('message',{source:target,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,token,sequence:++sequence,...patch}}))
  try {
    send({type:'ready'}); token=post.mock.calls.find(([m])=>m.type==='init')![0].token
    send({type:'ready-to-render'});const first=post.mock.calls.find(([m])=>m.type==='render')![0]
    expect(first.view).toBeTruthy();expect(receipt).not.toHaveBeenCalled()
    const ack={type:'first-frame-rendered',bootAttemptId:first.bootAttemptId,assetRevision:first.assetRevision,viewRevision:first.viewRevision}
    send({...ack,token:'old'});send({...ack,sequence:0});send({...ack,bootAttemptId:'old'});send({...ack,assetRevision:9});send({...ack,viewRevision:0});expect(receipt).not.toHaveBeenCalled()
    world.ticks++;refresh();send(ack);expect(receipt).not.toHaveBeenCalled()
    const current=post.mock.calls.filter(([m])=>m.type==='render').at(-1)![0]
    send({...ack,viewRevision:current.viewRevision});expect(receipt).toHaveBeenCalledOnce()
    send({...ack,viewRevision:current.viewRevision});expect(receipt).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(20001);expect(failed).not.toHaveBeenCalled()
  } finally {dispose();post.mockRestore();frame.remove();vi.useRealTimers()}
})

it('does not clear the first-paint deadline on ready-to-render', () => {
  vi.useFakeTimers();const frame=document.createElement('iframe');document.body.append(frame)
  const target=frame.contentWindow!,post=vi.spyOn(target,'postMessage').mockImplementation(()=>{}),failed=vi.fn(),world=createHomeWorld(scene)
  const runtime:FrameRuntime={bundle:(()=>({images:{}}))as FrameRuntime['bundle'],subscribe:()=>()=>{},setFrameReady:()=>{},pointer:()=>{},cancelDrag:()=>{},view:()=>({world,position:world.actor.position,dragging:false,dragTime:0,paused:true,debug:false})}
  const dispose=attachFrame(frame,runtime,failed)
  try {
    const send=(data:object)=>window.dispatchEvent(new MessageEvent('message',{source:target,origin:'null',data:{channel:'nidofy-ai-village',version:frameVersion,...data}}))
    send({type:'ready',token:'',sequence:1});const token=post.mock.calls.find(([m])=>m.type==='init')![0].token
    send({type:'ready-to-render',token,sequence:2});vi.advanceTimersByTime(20001);expect(failed).toHaveBeenCalledOnce()
  } finally {dispose();post.mockRestore();frame.remove();vi.useRealTimers()}
})

it('fences frame input by source, origin, protocol, token, sequence, viewport and lifetime', () => {
  const frame = document.createElement('iframe'); document.body.append(frame)
  const target = frame.contentWindow!, post = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
  const unsubscribe = vi.fn(), pointer = vi.fn(), failed = vi.fn(), ready = vi.fn(), cancel = vi.fn()
  const world = createHomeWorld(scene)
  const runtime: FrameRuntime = { bundle: (() => ({ images: {} })) as FrameRuntime['bundle'], subscribe: () => unsubscribe,
    setFrameReady: ready, pointer, cancelDrag: cancel,
    view: () => ({ world, position: world.actor.position, dragging: false, dragTime: 0, paused: false, debug: false }) }
  const dispose = attachFrame(frame, runtime, failed)
  let sequence = 1, token = ''
  const send = (patch: Record<string, unknown> = {}, source: MessageEventSource = target, origin = 'null') => {
    window.dispatchEvent(new MessageEvent('message', { source, origin,
      data: { channel: 'nidofy-ai-village', version: frameVersion, token, sequence: sequence++, type: 'pointer', viewportRevision: 2,
        intent: { type: 'down', id: 1, css: { x: 10, y: 20 }, point: { x: 150, y: 300 } }, ...patch } }))
  }
  try {
    send({ type: 'ready' })
    token = post.mock.calls.find(([m]) => m.type === 'init')![0].token
    send({ type: 'ready-to-render' }); expect(ready).toHaveBeenCalledWith(true)
    send({ type: 'viewport', projection: { x: 0, y: 0, scale: 1, width: 340, height: 480 } })
    send({}, window); send({}, target, 'https://untrusted.invalid')
    send({ version: 1 }); send({ version: 2 }); send({ token: 'wrong' }); send({ sequence: 0 }); send({ sequence: NaN })
    send({ viewportRevision: 1 }); send({ intent: { type: 'down', id: 1, css: { x: NaN, y: 0 }, point: { x: 0, y: 0 } } })
    expect(pointer).not.toHaveBeenCalled()
    send(); expect(pointer).toHaveBeenCalledTimes(1)
    // Duplicate delivery is rejected even with otherwise valid credentials.
    send({ sequence: sequence - 1 }); expect(pointer).toHaveBeenCalledTimes(1)
    dispose(); send(); expect(pointer).toHaveBeenCalledTimes(1)
    expect(unsubscribe).toHaveBeenCalledOnce(); expect(ready).toHaveBeenLastCalledWith(false); expect(failed).not.toHaveBeenCalled()
  } finally { frame.remove(); post.mockRestore() }
})

it('applies the same frame trust fences and paired gestures to new UI intentions', () => {
  const frame=document.createElement('iframe');document.body.append(frame);const target=frame.contentWindow!,post=vi.spyOn(target,'postMessage').mockImplementation(()=>{}),input=vi.fn(),world=createHomeWorld(scene)
  const runtime:FrameRuntime={bundle:(()=>({images:{}}))as FrameRuntime['bundle'],subscribe:()=>()=>{},setFrameReady:()=>{},pointer:()=>{},cancelDrag:()=>{},input,view:()=>({world,position:world.actor.position,dragging:false,dragTime:0,paused:false,debug:false})}
  const dispose=attachFrame(frame,runtime,vi.fn());let sequence=0,token=''
  const send=(patch:Record<string,unknown>,origin='null',source:MessageEventSource=target)=>window.dispatchEvent(new MessageEvent('message',{origin,source,data:{channel:'nidofy-ai-village',version:frameVersion,token,sequence:++sequence,viewportRevision:1,...patch}}))
  const camera={type:'ui-input',input:{kind:'camera',camera:{zoom:1.2,panX:0,panY:0}}}
  try {
    send({type:'ready'});token=post.mock.calls.find(([m])=>m.type==='init')![0].token;send({type:'ready-to-render'});send({type:'viewport',projection:{x:0,y:0,scale:1,width:340,height:720}})
    send({...camera,token:'wrong'});send({...camera,version:2});send({...camera,viewportRevision:0});send(camera,'https://evil.invalid');send(camera,'null',window);expect(input).not.toHaveBeenCalled()
    send(camera);expect(input).toHaveBeenCalledTimes(1)
    const intent={kind:'arrange',phase:'up',id:'work',pointerId:7,index:1};send({type:'ui-input',input:intent});expect(input).toHaveBeenCalledTimes(1)
    send({type:'ui-input',input:{...intent,phase:'down',index:undefined}});send(camera);expect(input).toHaveBeenCalledTimes(2)
    send({type:'ui-input',input:{...intent,id:'eat'}});expect(input).toHaveBeenCalledTimes(2)
    send({type:'ui-input',input:intent});expect(input).toHaveBeenCalledTimes(3)
    send({type:'ui-input',input:{...intent,phase:'down'}});send({type:'viewport',viewportRevision:2,projection:{x:0,y:0,scale:1,width:580,height:720}});send({type:'ui-input',viewportRevision:2,input:intent});expect(input).toHaveBeenCalledTimes(4)
  } finally {dispose();post.mockRestore();frame.remove()}
})

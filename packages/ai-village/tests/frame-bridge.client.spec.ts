// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { attachFrame, type FrameRuntime } from '../src/client/frame-bridge.ts'
import { createHomeWorld } from '../src/core/home-state.ts'
import { scene } from '../src/definitions.ts'

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
      data: { channel: 'nidofy-ai-village', version: 3, token, sequence: sequence++, type: 'pointer', viewportRevision: 2,
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
  const send=(patch:Record<string,unknown>,origin='null',source:MessageEventSource=target)=>window.dispatchEvent(new MessageEvent('message',{origin,source,data:{channel:'nidofy-ai-village',version:3,token,sequence:++sequence,viewportRevision:1,...patch}}))
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

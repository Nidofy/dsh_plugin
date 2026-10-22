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
      data: { channel: 'nidofy-ai-village', version: 2, token, sequence: sequence++, type: 'pointer', viewportRevision: 2,
        intent: { type: 'down', id: 1, css: { x: 10, y: 20 }, point: { x: 150, y: 300 } }, ...patch } }))
  }
  try {
    send({ type: 'ready' })
    token = post.mock.calls.find(([m]) => m.type === 'init')![0].token
    send({ type: 'ready-to-render' }); expect(ready).toHaveBeenCalledWith(true)
    send({ type: 'viewport', projection: { x: 0, y: 0, scale: 1, width: 340, height: 480 } })
    send({}, window); send({}, target, 'https://untrusted.invalid')
    send({ version: 1 }); send({ token: 'wrong' }); send({ sequence: 0 }); send({ sequence: NaN })
    send({ viewportRevision: 1 }); send({ intent: { type: 'down', id: 1, css: { x: NaN, y: 0 }, point: { x: 0, y: 0 } } })
    expect(pointer).not.toHaveBeenCalled()
    send(); expect(pointer).toHaveBeenCalledTimes(1)
    // Duplicate delivery is rejected even with otherwise valid credentials.
    send({ sequence: sequence - 1 }); expect(pointer).toHaveBeenCalledTimes(1)
    dispose(); send(); expect(pointer).toHaveBeenCalledTimes(1)
    expect(unsubscribe).toHaveBeenCalledOnce(); expect(ready).toHaveBeenLastCalledWith(false); expect(failed).not.toHaveBeenCalled()
  } finally { frame.remove(); post.mockRestore() }
})

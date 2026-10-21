import type { VillageRuntime } from './runtime.ts'
import type { PointerIntent } from '../core/controller.ts'
const channel = 'nidofy-ai-village', version = 1
function pointer(value: unknown): value is PointerIntent {
  if (!value || typeof value !== 'object') return false
  const p = value as PointerIntent
  return ['down', 'move', 'up', 'cancel'].includes(p.type) && Number.isSafeInteger(p.id) && p.id >= 0
    && !!p.css && !!p.point && [p.point.x, p.point.y, p.css.x, p.css.y].every(n => Number.isFinite(n) && Math.abs(n) < 50000)
}
export function attachFrame(frame: HTMLIFrameElement, runtime: VillageRuntime, failed: () => void): () => void {
  const token = crypto.randomUUID()
  let sent = 0, received = 0, initialized = false, ready = false, disposed = false
  const send = (type: string, data = {}) => frame.contentWindow?.postMessage({ channel, version, token, sequence: ++sent, type, ...data }, '*')
  const render = () => { if (ready && !disposed) send('render', { view: runtime.view() }) }
  const timer = setTimeout(() => { if (!disposed && !ready) failed() }, 20000)
  const receive = (event: MessageEvent) => {
    const m = event.data
    if (disposed || event.source !== frame.contentWindow || event.origin !== 'null' || m?.channel !== channel || m.version !== version) return
    if (!Number.isSafeInteger(m.sequence) || m.sequence <= received) return
    if (m.type === 'ready' && m.token === '' && !initialized) {
      initialized = true; received = m.sequence
      const bundle = runtime.bundle()
      frame.contentWindow?.postMessage({ channel, version, token, type: 'init', ...bundle }, '*', Object.values(bundle.images))
      return
    }
    if (m.token !== token) return
    received = m.sequence
    if (m.type === 'ready-to-render') { ready = true; clearTimeout(timer); runtime.setFrameReady(true); render() }
    else if (m.type === 'pointer' && pointer(m.intent)) runtime.pointer(m.intent)
    else if (m.type === 'failed') failed()
  }
  const cancel = () => { if (!document.hasFocus()) runtime.cancelDrag() }
  const disposeSubscription = runtime.subscribe(render)
  const hello = () => send('hello')
  frame.addEventListener('load', hello)
  window.addEventListener('message', receive); window.addEventListener('blur', cancel)
  hello()
  return () => {
    disposed = true; ready = false; clearTimeout(timer); disposeSubscription()
    window.removeEventListener('message', receive); window.removeEventListener('blur', cancel)
    frame.removeEventListener('load', hello)
    send('dispose'); runtime.setFrameReady(false)
  }
}

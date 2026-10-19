import { channel, type DisplayStatus, type Viewport } from '../protocol.ts'
import { loadBluewhale } from './resources.ts'

async function sdkBytes(file: string, limit: number, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch('/api/nidofy-live2d/assets/live2d/' + file, { signal, redirect: 'error' })
  if (!response.ok || !response.body) throw Error('SDK_UNAVAILABLE')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) throw Error('SDK_LIMIT')
      chunks.push(chunk.value)
    }
  } finally { try { await reader.cancel() } finally { reader.releaseLock() } }
  signal.throwIfAborted()
  if (!size) throw Error('SDK_EMPTY')
  const result = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

/** The frame can report capability only; it cannot request arbitrary URLs or host actions. */
export function attachFrame(frame: HTMLIFrameElement, rendered: () => void, failed: () => void): {
  update(viewport: Viewport, status: DisplayStatus): void; dispose(): void
} {
  const lifetime = new AbortController()
  let loading = false, finished = false
  let current: { viewport: Viewport; status: DisplayStatus } | undefined
  const send = (message: object, transfer: Transferable[] = []) => frame.contentWindow?.postMessage({ channel, ...message }, '*', transfer)
  const fail = () => { if (!lifetime.signal.aborted && !finished) { finished = true; lifetime.abort(); clearTimeout(timer); failed() } }
  const timer = setTimeout(fail, 20000)
  const receive = (event: MessageEvent) => {
    if (lifetime.signal.aborted || event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.channel !== channel) return
    if (event.data.type === 'failed') { finished = false; fail(); return }
    if (event.data.type === 'rendered') { finished = true; clearTimeout(timer); rendered(); return }
    if (event.data.type !== 'ready' || loading) return
    loading = true
    void Promise.all([
      loadBluewhale(lifetime.signal), sdkBytes('live2dcubismcore.min.js', 512 * 1024, lifetime.signal),
      sdkBytes('bluewhale-sdk.mjs', 1024 * 1024, lifetime.signal),
    ]).then(([resources, core, sdk]) => {
      if (lifetime.signal.aborted) return
      if (current) send({ type: 'view', ...current })
      send({ type: 'init', resources, core, sdk }, [core.buffer, sdk.buffer, ...Object.values(resources).map(bytes => bytes.buffer)] as ArrayBuffer[])
    }).catch(fail)
  }
  const hello = () => send({ type: 'hello' })
  window.addEventListener('message', receive); frame.addEventListener('load', hello); hello()
  return {
    update(viewport, status) { current = { viewport, status }; if (!lifetime.signal.aborted) send({ type: 'view', ...current }) },
    dispose() {
      lifetime.abort(); clearTimeout(timer)
      window.removeEventListener('message', receive); frame.removeEventListener('load', hello)
      send({ type: 'dispose' })
    },
  }
}

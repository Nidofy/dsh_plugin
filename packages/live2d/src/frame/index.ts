/** Runs only in an opaque-origin sandbox. No network, host service or session data. */
import { channel, type DisplayStatus, type Factory, type Renderer, type Viewport } from '../protocol.ts'

const canvas = document.querySelector('canvas')!
const lifetime = new AbortController()
let renderer: Renderer | undefined, frame = 0, started = false, previous = -Infinity
let viewport: Viewport = { width: 410, height: 548, camera: .5, panX: 0, panY: 0 }
let status: DisplayStatus = 'idle'
const urls = new Set<string>()
const report = (type: 'ready' | 'rendered' | 'failed') => parent.postMessage({ channel, type }, '*')
function dispose(): void {
  lifetime.abort(); cancelAnimationFrame(frame)
  renderer?.dispose(); renderer = undefined
  for (const url of urls) URL.revokeObjectURL(url)
  urls.clear()
}
function fail(): void { try { dispose() } finally { report('failed') } }
function url(bytes: Uint8Array): string {
  const value = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/javascript' }))
  urls.add(value); return value
}
function draw(time: number): void {
  if (lifetime.signal.aborted || !renderer) return
  try {
    if (time - previous >= 1000 / 30) { renderer.draw(time / 1000, status); previous = time }
    frame = requestAnimationFrame(draw)
  } catch { fail() }
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== channel || lifetime.signal.aborted) return
  const data = event.data
  if (data.type === 'dispose') { dispose(); return }
  if (data.type === 'hello') { if (!started) report('ready'); return }
  if (data.type === 'view') {
    const value = data.viewport
    if (!value || ![value.width, value.height, value.camera, value.panX, value.panY].every(Number.isFinite)) return
    if (value.width < 1 || value.height < 1 || value.width * value.height > 4_000_000) return
    viewport = { width: Math.floor(value.width), height: Math.floor(value.height), camera: Math.max(0, Math.min(1, value.camera)),
      panX: Math.max(-.15, Math.min(.15, value.panX)), panY: Math.max(-.15, Math.min(.15, value.panY)) }
    if (['idle', 'working', 'waiting', 'disconnected'].includes(data.status)) status = data.status
    try { renderer?.setViewport(viewport) } catch { fail() }
    return
  }
  if (data.type !== 'init' || started) return
  started = true
  void (async () => {
    const script = document.createElement('script')
    script.src = url(data.core)
    await new Promise<void>((resolve, reject) => {
      script.onload = () => { script.remove(); resolve() }
      script.onerror = () => { script.remove(); reject(Error('CORE_LOAD_FAILED')) }
      document.head.append(script)
    })
    lifetime.signal.throwIfAborted()
    const sdk = await import(/* @vite-ignore */ url(data.sdk)) as { createRenderer: Factory }
    lifetime.signal.throwIfAborted()
    const created = await sdk.createRenderer(canvas, data.resources, lifetime.signal)
    if (lifetime.signal.aborted) { created.dispose(); return }
    renderer = created
    renderer.setViewport(viewport)
    renderer.draw(0, status)
    report('rendered'); frame = requestAnimationFrame(draw)
  })().catch(() => { if (!lifetime.signal.aborted) fail() })
})
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail() })
window.addEventListener('pagehide', dispose, { once: true })
report('ready')

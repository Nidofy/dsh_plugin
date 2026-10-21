import { WorldController } from '../core/controller.ts'
import { createWorld, validateWorld } from '../core/world.ts'
import type { PointerIntent } from '../core/controller.ts'
import type { Scene } from '../core/world.ts'
import type { Saved } from '../host/save-store.ts'
declare global { interface Window { __VILLAGE_KEY__: string; __village?: object } }
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const channel = 'nidofy-ai-village', version = 1
let controller: WorldController | undefined, scene: Scene, lease = '', revision = 0
let iframe: HTMLIFrameElement | null = null, frameToken = '', sequence = 0, received = 0, frameReady = false
let raf = 0, last = 0, dirty = false, saving: Promise<void> | null = null, checkpoint = 0, dragTime = 0
let language: 'zh' | 'en' = 'zh', debug = false, error = '', heartbeat: ReturnType<typeof setInterval> | undefined
let recovering = false
let bundle: { character: object; animations: object; scene: Scene; images: Record<string, ArrayBuffer> }
const clientId = crypto.randomUUID()
const labels: Record<string, [string, string]> = {
  idle: ['歇一会儿', 'Taking a break'], walk: ['慢慢逛', 'Wandering'], work: ['写写画画', 'Writing'],
  eat: ['吃饭时间', 'Enjoying rice'], rest: ['安静打盹', 'Resting'], put_down: ['站稳啦', 'Settling'],
  dragging: ['轻轻拎起', 'Picked up'], loading: ['正在准备小院…', 'Preparing the courtyard…'],
  saved: ['进度已保存', 'Progress saved'], saving: ['正在保存…', 'Saving…'], paused: ['已暂停', 'Paused'],
}
function text(key: string): string { return labels[key]?.[language === 'zh' ? 0 : 1] ?? key }
function status(message: string) { $('save-status').textContent = message }
async function api(path: string, method = 'GET', data?: unknown): Promise<any> {
  const response = await fetch('/api/' + path, { method, headers: { 'content-type': 'application/json', 'x-village-key': window.__VILLAGE_KEY__ },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(6000) })
  const result = await response.json()
  if (!response.ok) throw Error(result.error ?? 'REQUEST_FAILED')
  return result
}
function update() {
  const active = controller?.drag?.active
  $('activity').textContent = controller?.pauseReasons.size ? text('paused') : text(active ? 'dragging' : controller?.world.actor.behavior ?? 'loading')
  $('pause').textContent = controller?.world.userPaused ? (language === 'zh' ? '继续' : 'Resume') : (language === 'zh' ? '暂停' : 'Pause')
  $('toggle').textContent = controller?.pauseReasons.has('closed') ? (language === 'zh' ? '打开小院' : 'Open courtyard') : (language === 'zh' ? '收起小院' : 'Close courtyard')
  $('placement').textContent = controller?.lastPlacement === 'rejected'
    ? (language === 'zh' ? '这里不能落脚，已回到原位置。' : 'No safe landing here. Returned to the original position.') : ''
}
function send(type: string, data: object = {}) {
  iframe?.contentWindow?.postMessage({ channel, version, token: frameToken, sequence: ++sequence, type, ...data }, '*')
}
function render() {
  if (!controller || !frameReady) return
  send('render', { view: { world: controller.world, position: controller.drag?.active ? controller.drag.position : controller.world.actor.position,
    dragging: controller.drag?.active ?? false, dragTime, paused: !!controller.pauseReasons.size, debug } })
  update()
}
function loop(now: number) {
  raf = 0
  if (!controller || controller.pauseReasons.size || !frameReady) return
  const delta = last ? Math.min((now - last) / 1000, .1) : 0
  if (delta >= 1 / 30 || !last) {
    controller.advance(delta); if (controller.drag?.active) dragTime += delta
    last = now; render()
    if (controller.world.ticks - checkpoint >= 300) { checkpoint = controller.world.ticks; requestSave() }
  }
  raf = requestAnimationFrame(loop)
}
function schedule() {
  cancelAnimationFrame(raf); raf = 0; last = 0
  if (controller && !controller.pauseReasons.size && frameReady) raf = requestAnimationFrame(loop)
  update()
}
function fail(e: unknown) {
  error = String(e)
  controller?.pause('disconnected', true)
  schedule(); render()
  status((language === 'zh' ? '保存/连接异常，已暂停：' : 'Save/connection failed; paused: ') + error)
}
function requestSave(): void {
  if (!controller || !lease || error || recovering) return
  dirty = true
  if (saving) return
  saving = (async () => {
    while (dirty && controller && lease) {
      dirty = false
      const world = controller.snapshot(), operationId = crypto.randomUUID()
      status(text('saving'))
      let saved: Saved
      try { saved = await api('state', 'POST', { lease, expectedRevision: revision, operationId, world }) }
      catch (e) {
        // Read after an uncertain acknowledgement. Never blindly replay a mutation.
        const observed = await api('state').catch(() => null) as Saved | null
        if (observed?.operationId !== operationId) throw e
        saved = observed
      }
      revision = saved.revision
      status(text('saved') + ' · r' + revision)
    }
  })().catch(fail).finally(() => { saving = null })
}
function mount() {
  if (!controller || controller.pauseReasons.has('closed') || controller.pauseReasons.has('hidden') || iframe) return
  frameToken = crypto.randomUUID(); sequence = 0; received = 0; frameReady = false
  iframe = document.createElement('iframe')
  iframe.title = 'AI 小院互动场景 / Interactive courtyard'
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.src = '/frame'
  $('scene-container').replaceChildren(iframe)
}
function unmount() {
  controller?.cancelDrag(); frameReady = false
  iframe?.remove(); iframe = null; schedule()
}
function setHidden(reason: 'hidden' | 'closed', active: boolean) {
  controller?.pause(reason, active)
  if (active) unmount()
  else mount()
  $('closed-note').hidden = !controller?.pauseReasons.has('closed')
  update()
}
function validPointer(value: unknown): value is PointerIntent {
  if (!value || typeof value !== 'object') return false
  const p = value as PointerIntent
  return ['down', 'move', 'up', 'cancel'].includes(p.type) && Number.isSafeInteger(p.id) && p.id >= 0
    && !!p.point && !!p.css && [p.point.x, p.point.y, p.css.x, p.css.y].every(n => Number.isFinite(n) && Math.abs(n) < 50000)
}
window.addEventListener('message', async event => {
  if (!iframe || event.source !== iframe.contentWindow || event.origin !== 'null' || event.data?.channel !== channel || event.data.version !== version) return
  const m = event.data
  if (m.type === 'ready' && m.token === '' && received === 0) {
    received = m.sequence
    const images = Object.fromEntries(Object.entries(bundle.images).map(([key, bytes]) => [key, bytes.slice(0)]))
    iframe.contentWindow!.postMessage({ channel, version, token: frameToken, type: 'init', ...bundle, images }, '*', Object.values(images))
    return
  }
  if (m.token !== frameToken || !Number.isSafeInteger(m.sequence) || m.sequence <= received) return
  received = m.sequence
  if (m.type === 'ready-to-render') { frameReady = true; render(); schedule() }
  else if (m.type === 'pointer' && validPointer(m.intent)) {
    const active = controller?.drag?.active
    controller?.pointer(m.intent)
    if (!active && controller?.drag?.active) dragTime = 0
    render(); update()
  }
  else if (m.type === 'failed') fail(m.error)
})
async function prepare() {
  const [character, animations, sceneValue, manifest] = await Promise.all(['/character', '/animations', '/scene', '/manifest'].map(p => fetch(p).then(r => {
    if (!r.ok) throw Error('ASSET_UNAVAILABLE'); return r.json()
  })))
  scene = sceneValue
  const entries = await Promise.all(manifest.map(async (item: { key: string; url: string; sha256: string }) => {
    const bytes = await fetch(item.url).then(r => { if (!r.ok) throw Error('ASSET_UNAVAILABLE'); return r.arrayBuffer() })
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('')
    if (hash !== item.sha256) throw Error('ASSET_HASH_MISMATCH')
    return [item.key, bytes] as const
  }))
  bundle = { character, animations, scene, images: Object.fromEntries(entries) }
}
async function start() {
  try {
    await prepare()
    lease = (await api('lease', 'POST', { clientId })).lease
    heartbeat = setInterval(() => { void api('heartbeat', 'POST', { lease }).catch(fail) }, 4000)
    const saved = await api('state') as Saved | null
    revision = saved?.revision ?? 0
    controller = new WorldController(saved ? validateWorld(saved.world, scene) : createWorld(scene), scene, requestSave)
    error = ''
    if (document.hidden) controller.pause('hidden', true)
    mount(); update()
    status(text('saved') + ' · r' + revision)
    if (!saved) requestSave()
  } catch (e) { fail(e) }
}
$('pause').onclick = () => { if (!controller) return; controller.pause('user', !controller.world.userPaused); render(); schedule() }
$('toggle').onclick = () => setHidden('closed', !controller?.pauseReasons.has('closed'))
$('debug').onclick = () => { debug = !debug; render() }
$<HTMLSelectElement>('size').onchange = () => { $('scene-container').style.width = $<HTMLSelectElement>('size').value + 'px' }
$('save').onclick = async () => {
  if (!controller) return
  try {
    if (error) {
      const state = await api('state') as Saved | null
      if ((state?.revision ?? 0) !== revision) throw Error('REVISION_CONFLICT_RELOAD_REQUIRED')
      await api('heartbeat', 'POST', { lease })
      error = ''; controller.pause('disconnected', false); schedule()
    }
    requestSave()
  } catch (e) { fail(e) }
}
$('recover').onclick = async () => {
  if (recovering) return
  recovering = true; controller?.pause('ownership', true); schedule(); render()
  try {
    await saving; dirty = false
    const reasons = [...controller?.pauseReasons ?? []].filter(r => r === 'hidden' || r === 'closed')
    const saved = await api('recover', 'POST', { lease }) as Saved
    revision = saved.revision
    controller = new WorldController(validateWorld(saved.world, scene), scene, requestSave)
    for (const reason of reasons) controller.pause(reason, true)
    error = ''; unmount(); mount(); status(text('saved') + ' · r' + revision); update()
  } catch (e) { controller?.pause('ownership', false); fail(e) }
  finally { recovering = false }
}
$('retry').onclick = () => location.reload()
document.querySelectorAll<HTMLElement>('[data-en]').forEach(el => { el.dataset.zh = el.textContent ?? '' })
$('language').onclick = () => {
  language = language === 'zh' ? 'en' : 'zh'
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  document.querySelectorAll<HTMLElement>('[data-en]').forEach(el => { el.textContent = el.dataset[language] ?? '' })
  $('language').textContent = language === 'zh' ? 'English' : '中文'
  update(); status(error || text('saved') + ' · r' + revision)
}
document.addEventListener('visibilitychange', () => setHidden('hidden', document.hidden))
window.addEventListener('blur', () => { queueMicrotask(() => { if (!document.hasFocus()) { controller?.cancelDrag(); render() } }) })
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(raf); clearInterval(heartbeat)
  controller?.cancelDrag()
  if (lease) void fetch('/api/release', { method: 'POST', headers: { 'content-type': 'application/json', 'x-village-key': window.__VILLAGE_KEY__ },
    body: JSON.stringify({ lease }), keepalive: true }).catch(() => {})
})
// Development inspection only; this does not expose file paths or host capabilities.
window.__village = {
  inspect: () => ({ world: controller?.snapshot(), drag: controller?.drag, pauses: [...controller?.pauseReasons ?? []],
    revision, ready: frameReady, error, saving: !!saving, token: frameToken, placement: controller?.lastPlacement }),
  flush: async () => { requestSave(); await saving },
  hide: (hidden: boolean) => setHidden('hidden', hidden),
}
void start()

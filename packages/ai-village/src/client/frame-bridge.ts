import { frameChannel as channel, frameVersion as version, validPointer as pointer, validUIInput, type UIInput } from '../core/frame-protocol.ts'
import { pngInfo } from '../core/photo.ts'
import type { VillageRuntime } from './runtime.ts'
import type { SimulationWorld, Point } from '../core/world.ts'
import type { PointerIntent } from '../core/controller.ts'
import type { SceneArt } from '../frame/furniture.ts'
export type FrameRuntime = Pick<VillageRuntime, 'subscribe' | 'setFrameReady' | 'pointer' | 'cancelDrag'> & Partial<Pick<VillageRuntime, 'frameKey' | 'generation' | 'entrance' | 'beginEntranceFrame' | 'expectEntranceFrame' | 'entranceFrame' | 'entranceDecode'>> & { bundle(): Omit<ReturnType<VillageRuntime['bundle']>, 'scene' | 'region'> & { scene: SceneArt; region?: 'courtyard' | 'bookhouse' | 'tea-square' }; setSoftwareRendering?(value: boolean): void; input?(input: UIInput): void; assetRevision?: number; bindCapture?(handler: (() => Promise<ArrayBuffer>) | null): void; view(): { world: SimulationWorld; position: Point; dragging: boolean; dragTime: number; paused: boolean; debug: boolean; locale?: 'zh' | 'en'; reducedMotion?: boolean; bubbles?: boolean; decorationDraft?: 'window' | 'door' | 'wall' | null | undefined } | null }
const frameOwners = new WeakMap<object, symbol>()
export function attachFrame(frame: HTMLIFrameElement, runtime: FrameRuntime, failed: () => void): () => void {
  const owner = Symbol(), frameKey = runtime.frameKey, generation = runtime.generation
  frameOwners.set(runtime, owner)
  const token = crypto.randomUUID()
  runtime.beginEntranceFrame?.(token)
  const bootAttemptId = runtime.entrance?.attemptId ?? crypto.randomUUID()
  let viewRevision = 0, viewKey = '', confirmed = false
  let gesture: { pointerId: number; id: string } | null = null, actorPointer: number | null = null
  let sent = 0, received = 0, initialized = false, ready = false, disposed = false
  let viewportRevision = 0, assetRevision = -1, loadingAssets = false
  const current = () => !disposed && frameOwners.get(runtime) === owner && runtime.frameKey === frameKey && runtime.generation === generation
  const send = (type: string, data = {}) => frame.contentWindow?.postMessage({ channel, version, token, sequence: ++sent, type, ...data }, '*')
  const render = () => {
    if (!ready || !current() || loadingAssets) return
    if ((runtime.assetRevision ?? 0) !== assetRevision) {
      const bundle = runtime.bundle()
      assetRevision = runtime.assetRevision ?? 0; loadingAssets = true; confirmed = false; viewKey = ''; runtime.expectEntranceFrame?.(token, assetRevision, 0); runtime.setFrameReady(false)
      clearTimeout(timer); timer = setTimeout(() => { if (current() && !confirmed) failed() }, 20000)
      frame.contentWindow?.postMessage({ channel, version, token, sequence: ++sent, type: 'assets', bootAttemptId, assetRevision, images: bundle.images }, '*', Object.values(bundle.images))
      return
    }
    const view = runtime.view(), key = !confirmed || runtime.entrance?.blocking ? JSON.stringify(view) : viewKey
    if (!view) return
    if (key !== viewKey) {
      viewKey = key; viewRevision++
      if (!confirmed || runtime.entrance?.blocking) { confirmed = false; runtime.expectEntranceFrame?.(token, assetRevision, viewRevision) }
    }
    send('render', { view, bootAttemptId, assetRevision, viewRevision, firstFrame: !confirmed })
  }
  let capture: { id: string; resolve(bytes:ArrayBuffer):void; reject(e:Error):void; timer:ReturnType<typeof setTimeout> } | null = null
  runtime.bindCapture?.(() => new Promise<ArrayBuffer>((resolve,reject)=>{
    if(capture||!ready||loadingAssets||!current()){reject(Error('PHOTO_UNAVAILABLE'));return}
    const id=crypto.randomUUID(),timer=setTimeout(()=>{capture=null;reject(Error('PHOTO_TIMEOUT'))},15000)
    capture={id,resolve,reject,timer};send('capture',{id})
  }))
  let timer = setTimeout(() => { if (current() && !confirmed) failed() }, 20000)
  const receive = (event: MessageEvent) => {
    const m = event.data
    if (!current() || event.source !== frame.contentWindow || event.origin !== 'null' || m?.channel !== channel || m.version !== version) return
    if (!Number.isSafeInteger(m.sequence) || m.sequence <= received) return
    if (m.type === 'ready' && m.token === '' && !initialized) {
      initialized = true; received = m.sequence
      const bundle = runtime.bundle(); assetRevision = runtime.assetRevision ?? 0
      runtime.expectEntranceFrame?.(token, assetRevision, 0)
      frame.contentWindow?.postMessage({ channel, version, token, type: 'init', bootAttemptId, assetRevision, region: frameKey ?? 'courtyard', ...bundle }, '*', Object.values(bundle.images))
      return
    }
    if (m.token !== token) return
    received = m.sequence
    if (m.type === 'ready-to-render') { ready = true; runtime.setFrameReady(true); render() }
    else if (m.type === 'frame-resource-progress' && m.bootAttemptId === bootAttemptId && m.assetRevision === assetRevision && Number.isFinite(m.progress) && m.progress >= 0 && m.progress <= 1) runtime.entranceDecode?.(token, bootAttemptId, assetRevision, m.progress)
    else if (m.type === 'first-frame-rendered' && ready && !loadingAssets && m.bootAttemptId === bootAttemptId && m.assetRevision === assetRevision && m.viewRevision === viewRevision && viewRevision > 0 && !confirmed) {
      confirmed = true; clearTimeout(timer); runtime.entranceFrame?.(token, bootAttemptId, assetRevision, viewRevision)
    }
    else if (m.type === 'capabilities' && typeof m.softwareRendering === 'boolean') runtime.setSoftwareRendering?.(m.softwareRendering)
    else if (m.type === 'photo' && capture && capture.id === m.id) {
      const pending=capture;capture=null;clearTimeout(pending.timer)
      try { if(!(m.bytes instanceof ArrayBuffer))throw Error('INVALID_PHOTO');pngInfo(new Uint8Array(m.bytes));pending.resolve(m.bytes) } catch { pending.reject(Error('INVALID_PHOTO')) }
    }
    else if (m.type === 'photo-failed' && capture && capture.id === m.id) { clearTimeout(capture.timer);capture.reject(Error('PHOTO_UNAVAILABLE'));capture=null }
    else if (m.type === 'assets-ready' && m.assetRevision === assetRevision) { loadingAssets = false; runtime.setFrameReady(true); render() }
    else if (m.type === 'viewport' && Number.isSafeInteger(m.viewportRevision) && m.viewportRevision > viewportRevision) {
      const p = m.projection
      if (p && [p.x, p.y, p.scale, p.width, p.height].every(Number.isFinite) && p.scale > 0 && p.scale < 20 && p.width > 0 && p.height > 0) { viewportRevision = m.viewportRevision; gesture = null; actorPointer = null }
    }
    else if (m.type === 'pointer' && m.viewportRevision === viewportRevision && pointer(m.intent)) {
      if (m.intent.type === 'down' && actorPointer === null) actorPointer = m.intent.id
      else if (actorPointer !== m.intent.id) return
      runtime.pointer(m.intent)
      if (m.intent.type === 'up' || m.intent.type === 'cancel') actorPointer = null
    }
    else if (m.type === 'ui-input' && m.viewportRevision === viewportRevision && validUIInput(m.input)) {
      const input = m.input
      if (input.kind === 'arrange') {
        if (input.phase === 'down' && !gesture) gesture = { pointerId: input.pointerId, id: input.id }
        else if (!gesture || gesture.pointerId !== input.pointerId || gesture.id !== input.id) return
        if (input.phase !== 'down') gesture = null
      } else if (actorPointer !== null || gesture) return
      runtime.input?.(input)
    }
    else if (m.type === 'escape') frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    else if (m.type === 'failed') failed()
  }
  const cancel = () => { if (current() && !document.hasFocus()) runtime.cancelDrag() }
  const disposeSubscription = runtime.subscribe(render)
  const hello = () => { if (current()) send('hello') }
  frame.addEventListener('load', hello)
  window.addEventListener('message', receive); window.addEventListener('blur', cancel)
  hello()
  return () => {
    if (disposed) return
    const ownsRuntime = current()
    if(ownsRuntime)runtime.bindCapture?.(null)
    if(capture){clearTimeout(capture.timer);capture.reject(Error('PHOTO_CANCELLED'));capture=null}
    disposed = true; ready = false; clearTimeout(timer); disposeSubscription()
    window.removeEventListener('message', receive); window.removeEventListener('blur', cancel)
    frame.removeEventListener('load', hello)
    send('dispose')
    if (ownsRuntime) { frameOwners.delete(runtime); runtime.setFrameReady(false) }
  }
}

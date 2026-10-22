import type { CharacterId } from '../core/roster.ts'
import { defaultCamera, zoomCamera, clampCamera, type Camera, type Workspace } from '../core/camera.ts'
import type { ArrangementObject } from '../core/arrangement.ts'
import type { Point } from '../core/world.ts'
import type { UIInput } from '../core/frame-protocol.ts'
interface InputState { tableAt?(point: Point): {token:string;cell:number} | null; playAt?(point: Point): string | null; camera: Camera; workspace: Workspace; scale: number; local(p: Point): Point; actor(p: Point): CharacterId | null; paused: boolean; photo: boolean; overlay: boolean; dismiss: boolean; objects: ArrangementObject[]; selected: string }
export function routeInput(canvas: HTMLCanvasElement, state: () => InputState, send: (input: UIInput) => void, actor: (type: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) => void, ghost: (object: ArrangementObject | null, point?: Point, index?: number) => void) {
  let gesture: { id: number; playToken: string | null; tableCell: number | null; start: Point; previous: Point; type: 'table' | 'play' | 'actor' | 'resident' | 'pan' | 'arrange' | 'dismiss'; resident: CharacterId | null; object: ArrangementObject | undefined; camera: Camera; moved: boolean } | null = null, space = false
  const controller = new AbortController(), options = { signal: controller.signal }
  const css = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY })
  const nearest = (o: ArrangementObject, pt: Point, scale: number) => o.anchors.map((a, i) => ({ i, d: Math.hypot(a.x - pt.x, a.y - pt.y) * scale })).filter(a => a.d <= 26).sort((a, b) => a.d - b.d || a.i - b.i)[0]?.i
  const cancel = () => {
    if (!gesture) return false
    const g = gesture; gesture = null
    if (g.type === 'arrange') send({ kind: 'arrange', phase: 'cancel', id: g.object!.id, pointerId: g.id })
    if (g.type === 'pan' && g.moved) send({ kind: 'camera', camera: g.camera })
    if (g.type === 'actor') actor('cancel', new PointerEvent('pointercancel', { pointerId: g.id }))
    ghost(null); if (canvas.hasPointerCapture(g.id)) canvas.releasePointerCapture(g.id); return true
  }
  canvas.addEventListener('pointerdown', e => {
    if (gesture || ![0, 1].includes(e.button)) return
    const s = state(); if (s.photo) return
    const pt = s.local(css(e)), object = s.objects.find(o => pt.x >= o.rect.x && pt.x <= o.rect.x + o.rect.width && pt.y >= o.rect.y && pt.y <= o.rect.y + o.rect.height)
    const resident = s.actor(pt)
    const type = object ? 'arrange' : s.objects.length || s.overlay || s.dismiss ? 'dismiss' : e.button === 1 || space ? 'pan' : !s.paused && s.tableAt?.(pt) ? 'table' : !s.paused && s.playAt?.(pt) ? 'play' : resident ? s.paused ? 'resident' : 'actor' : 'pan'
    gesture = { id: e.pointerId, tableCell: type==='table' ? s.tableAt?.(pt)?.cell ?? null : null, playToken: type==='table' ? s.tableAt?.(pt)?.token ?? null : type==='play' ? s.playAt?.(pt) ?? null : null, start: css(e), previous: css(e), type, resident, object, camera: s.camera, moved: false }
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); e.preventDefault()
    if (type === 'actor') actor('down', e)
    if (type === 'arrange') send({ kind: 'arrange', phase: 'down', id: object!.id, pointerId: e.pointerId })
  }, options)
  canvas.addEventListener('pointermove', e => {
    const g = gesture; if (!g || g.id !== e.pointerId) return
    const s = state(), pt = css(e); g.moved ||= Math.hypot(pt.x - g.start.x, pt.y - g.start.y) >= 5
    if (g.type === 'actor') actor('move', e)
    if (g.moved && g.type === 'pan') send({ kind: 'camera', camera: clampCamera(s.workspace, { ...s.camera, panX: s.camera.panX + pt.x - g.previous.x, panY: s.camera.panY + pt.y - g.previous.y }) })
    if (g.moved && g.type === 'arrange') { const local = s.local(pt); ghost(g.object!, local, nearest(g.object!, local, s.scale)) }
    g.previous = pt
  }, options)
  canvas.addEventListener('pointerup', e => {
    const g = gesture; if (!g || g.id !== e.pointerId) return
    gesture = null; const s = state()
    if (g.type === 'table' && !g.moved && !s.paused && !s.dismiss && !s.overlay) { const point=s.local(css(e)), hit=s.tableAt?.(point); if(hit && hit.token===g.playToken && hit.cell===g.tableCell)send({kind:'table-move',token:hit.token,cell:hit.cell,point}) }
    if (g.type === 'play' && !g.moved && !s.paused && !s.dismiss && !s.overlay) { const point=s.local(css(e)), token=s.playAt?.(point); if(token && token===g.playToken)send({kind:'play-find',token,point}) }
    if (g.type === 'actor') actor('up', e)
    if (g.type === 'resident' && !g.moved && g.resident) send({ kind: 'resident', id: g.resident })
    if (g.type === 'arrange') { const index = g.moved ? nearest(g.object!, s.local(css(e)), s.scale) : undefined; send({ kind: 'arrange', phase: 'up', id: g.object!.id, pointerId: e.pointerId, ...(index !== undefined && g.object!.anchors[index]?.legal ? { index } : {}) }); ghost(null) }
    if (!g.moved && (g.type === 'dismiss' || g.type === 'pan')) send({ kind: 'scene' })
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  }, options)
  canvas.addEventListener('pointercancel', cancel, options); canvas.addEventListener('lostpointercapture', cancel, options); window.addEventListener('blur', cancel, options)
  canvas.addEventListener('wheel', e => { const s = state(); if (gesture || s.photo || s.objects.length || s.dismiss || e.ctrlKey || e.metaKey) return; e.preventDefault(); const delta = Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? s.workspace.height : 1))); send({ kind: 'camera', camera: zoomCamera(s.workspace, s.camera ?? defaultCamera, s.camera.zoom - delta * .002, { x: e.clientX, y: e.clientY }) }) }, { ...options, passive: false })
  canvas.addEventListener('keydown', e => { if (e.isComposing) return; if (e.code === 'Space') { space = true; e.preventDefault() } }, options)
  window.addEventListener('keyup', e => { if (e.code === 'Space') space = false }, options)
  return { inspect: () => gesture ? { type: gesture.type, object: gesture.object?.id, moved: gesture.moved } : null, cancel, dispose: () => { cancel(); controller.abort() } }
}

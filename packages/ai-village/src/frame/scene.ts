import { villageTime } from '../core/dialogue.ts'
import { photoLimits } from '../core/photo.ts'
import { NeighborhoodArt, microPose } from './neighborhood-art.ts'
import { validateNeighborhoodWorld, legacyContent, neighborhoodScene, type NeighborhoodWorld } from '../core/neighborhood-state.ts'
import { residentLine } from '../core/neighborhood-catalog.ts'
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { renderResolution } from './quality.ts'
import { sceneViewport } from './viewport.ts'
import { activityDepth, furnitureDepth, propVisible, seatProps } from './furniture.ts'
import type { SceneArt, SeatProp } from './furniture.ts'
import { PaperDoll } from '../art/paper-doll.ts'
import { samplePose } from '../art/animation.ts'
import { validateContentWorld, type ContentWorld } from '../core/content-state.ts'
import { dialogue, bellReaction } from '../core/dialogue.ts'
import { hitActor, orderedActors, validateWorld } from '../core/world.ts'
import type { Action, AnimationSet, Character } from '../art/types.ts'
import type { Actor, Point, Rect, World } from '../core/world.ts'
interface View { extraDecorationDraft?: { id: 'lantern' | 'planter'; slot: 'window' | 'door' | 'wall' | null } | null; world: World | ContentWorld | NeighborhoodWorld; position: Point; dragging: boolean; dragTime: number; paused: boolean; debug: boolean;
  photo?: { zoom:number;x:number;y:number;date:boolean;border:boolean } | null; locale: 'zh' | 'en'; reducedMotion: boolean; bubbles: boolean; decorationDraft: 'window' | 'door' | 'wall' | null | undefined }
const channel = 'nidofy-ai-village', version = 2
let token = '', received = 0, sent = 0, initialized = false, disposed = false, pointer: number | null = null
let app: Application | undefined, scene: SceneArt, character: Character, animations: AnimationSet
type AvatarArt = { character: Character; animations: AnimationSet; activityPrefix: string }
let roster: Record<string, AvatarArt> = {}
let view: View | undefined, shadow: Graphics, hints: Graphics, backdrop: Sprite
let neighborhoodArt: NeighborhoodArt, cushion: Sprite
let bell: Graphics, tea: Graphics, viewportRevision = 0, reactionUntil = 0
const bubbleNodes: HTMLDivElement[] = []
const props: { definition: SeatProp; sprite: Sprite }[] = []
const stage = new Container(), textures = new Map<string, Texture>(), urls = new Map<string, string>()
let keepAssets: Set<string> | null = null, assetLoading = false
interface Rig { doll: PaperDoll; resting: Sprite; activity: Container; arms: Map<string, Sprite>; art: AvatarArt }
const rigs = new Map<string, Rig>()
function removeRig(id: string, rig: Rig) {
  rig.doll.destroy(); rig.resting.destroy(); rig.activity.destroy({ children: true }); rigs.delete(id)
}
function rigFor(id: string): Rig {
  const previous = rigs.get(id)
  if (previous) return previous
  const art = roster[id]
  if (!art) throw Error('CHARACTER_UNAVAILABLE')
  const doll = new PaperDoll(art.character, textures), activity = new Container(), arms = new Map<string, Sprite>()
  const resting = new Sprite(textures.get(art.activityPrefix + 'rest-pose.png')!)
  resting.anchor.set(.5, 1); stage.addChild(doll.root, resting, activity)
  for (const name of ['work-left', 'work-right', 'eat-left', 'eat-right']) {
    const sprite = new Sprite(textures.get(art.activityPrefix + name + '.png')!)
    sprite.visible = false; activity.addChild(sprite); arms.set(name, sprite)
  }
  const rig = { doll, resting, activity, arms, art }; rigs.set(id, rig); return rig
}
const send = (type: string, data: object = {}) => parent.postMessage({ channel, version, token, sequence: ++sent, type, ...data }, '*')
function rectangleSprite(file: string, rect: Rect, z: number): Sprite {
  const sprite = new Sprite(textures.get(file)!)
  sprite.position.set(rect.x, rect.y); sprite.width = rect.width; sprite.height = rect.height; sprite.zIndex = z
  stage.addChild(sprite)
  return sprite
}
function layout() {
  if (!app) return
  app.renderer.resize(innerWidth, innerHeight, renderResolution(devicePixelRatio, innerWidth, innerHeight))
  const { world, background } = sceneViewport(innerWidth, innerHeight)
  stage.scale.set(world.scale); stage.position.set(world.x, world.y)
  backdrop.position.set(background.x, background.y)
  backdrop.width = background.width; backdrop.height = background.height
  viewportRevision++
  send('viewport', { viewportRevision, projection: { ...world, width: innerWidth, height: innerHeight } })
  paint()
}
function local(event: PointerEvent): Point {
  return { x: (event.clientX - stage.x) / stage.scale.x, y: (event.clientY - stage.y) / stage.scale.y }
}
function cancel() {
  if (pointer === null) return
  const id = pointer; pointer = null
  send('pointer', { viewportRevision, intent: { type: 'cancel', id, point: { x: 0, y: 0 }, css: { x: 0, y: 0 } } })
  if (app?.canvas.hasPointerCapture(id)) app.canvas.releasePointerCapture(id)
}
async function loadAssets(images: Record<string, ArrayBuffer>) {
  if (!images || Object.keys(images).length > 160 || Object.values(images).some(b=>!(b instanceof ArrayBuffer)||b.byteLength>8*1024*1024)) throw Error('INVALID_ASSETS')
  for (const [file, bytes] of Object.entries(images)) {
    if (textures.has(file)) continue
    const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})); urls.set(file,url)
    const image=new Image();image.src=url;await image.decode()
    if(disposed){URL.revokeObjectURL(url);return}
    textures.set(file,Texture.from(image))
  }
  keepAssets=new Set(Object.keys(images))
}
async function init(message: { character: Character; animations: AnimationSet; roster?: Record<string, AvatarArt>; scene: SceneArt; images: Record<string, ArrayBuffer> }) {
  character = message.character; animations = message.animations; scene = message.scene
  roster = { ...message.roster, bluewhale: { character, animations, activityPrefix: 'scene/' } }
  await loadAssets(message.images)
  const instance = new Application()
  await instance.init({ width: innerWidth, height: innerHeight, resolution: renderResolution(devicePixelRatio, innerWidth, innerHeight), autoDensity: true, antialias: true,
    preference: 'webgl', autoStart: false, sharedTicker: false, background: 0xf0eadb })
  if (disposed) { instance.destroy(true, { children: true }); return }
  app = instance
  backdrop = new Sprite(textures.get('scene/background.png')!)
  stage.sortableChildren = true; app.stage.addChild(backdrop, stage)
  document.body.append(app.canvas)
  app.canvas.style.touchAction = 'none'
  app.canvas.tabIndex = 0
  app.canvas.style.outline = 'none'
  cushion = rectangleSprite('scene/cushion.png', scene.cushion, 0)
  neighborhoodArt = new NeighborhoodArt(stage)
  for (const item of scene.furniture) {
    rectangleSprite(`scene/${item.asset}-back.png`, { ...item.rect, height: item.rect.height * item.split }, item.rect.y * 10)
    rectangleSprite(`scene/${item.asset}-front.png`, { ...item.rect, y: item.rect.y + item.rect.height * item.split, height: item.rect.height * (1 - item.split) }, (item.rect.y + item.rect.height) * 10)
  }
  for (const definition of seatProps(scene)) props.push({ definition,
    sprite: rectangleSprite(definition.asset, definition.rect, furnitureDepth(scene, definition.furnitureId) ?? 0) })
  shadow = new Graphics(); shadow.zIndex = 1; stage.addChild(shadow)
  hints = new Graphics(); hints.zIndex = 11000; stage.addChild(hints)
  bell = new Graphics(); bell.zIndex = 2; tea = new Graphics(); tea.zIndex = 4100; stage.addChild(bell, tea)
  for (let i = 0; i < 2; i++) {
    const bubble = document.createElement('div')
    bubble.style.cssText = 'display:none;position:absolute;pointer-events:none;box-sizing:border-box;background:#fff9e9;color:#394c36;padding:6px 8px;border:1px solid #bec6a8;border-radius:10px;font:11px/1.4 system-ui;max-height:82px;overflow:hidden;box-shadow:0 3px 12px #243b2020'
    document.body.append(bubble); bubbleNodes.push(bubble)
  }
  const emit = (type: 'down' | 'move' | 'up', event: PointerEvent) => send('pointer', {
    viewportRevision,
    intent: { type, id: event.pointerId, point: local(event), css: { x: event.clientX, y: event.clientY } },
  })
  app.canvas.addEventListener('pointerdown', event => {
    if (pointer !== null || !view || view.paused || event.button !== 0) return
    if (!hitActor(view.world, local(event))) return
    pointer = event.pointerId
    app!.canvas.focus({ preventScroll: true })
    app!.canvas.setPointerCapture(pointer)
    event.preventDefault()
    emit('down', event)
  })
  app.canvas.addEventListener('pointermove', event => { if (pointer === event.pointerId) emit('move', event) })
  app.canvas.addEventListener('pointerup', event => {
    if (pointer !== event.pointerId) return
    pointer = null; emit('up', event)
    if (app!.canvas.hasPointerCapture(event.pointerId)) app!.canvas.releasePointerCapture(event.pointerId)
  })
  app.canvas.addEventListener('pointercancel', cancel)
  app.canvas.addEventListener('lostpointercapture', event => { if (pointer === event.pointerId) cancel() })
  layout()
  send('ready-to-render')
}
let frames = 0, paintMs = 0, maxPaintMs = 0
function paint() {
  if (!app || !view || disposed) return
  const began = performance.now()
  const photo=view.photo,zoom=photo?.zoom??1
  app.stage.scale.set(zoom);app.stage.position.set(-(zoom-1)*innerWidth/2*(1+(photo?.x??0)),-(zoom-1)*innerHeight/2*(1+(photo?.y??0)))
  const members = orderedActors(view.world), ids = new Set(members.map(a => a.id))
  for (const [id, rig] of rigs) if (!ids.has(id as Actor['id'])) removeRig(id, rig)
  const neighborhood = view.world.schemaVersion === 5 ? view.world : null
  if (keepAssets) for(const [key,texture] of textures) if(!keepAssets.has(key)) { texture.destroy(true);textures.delete(key);const url=urls.get(key);if(url)URL.revokeObjectURL(url);urls.delete(key) }
  const content = neighborhood ? legacyContent(neighborhood) : view.world.schemaVersion === 4 ? view.world : null
  if (neighborhood) { neighborhoodArt.paint(neighborhood, view.reducedMotion, view.extraDecorationDraft); cushion.visible = neighborhood.neighborhood.layout === 'courtyard' }
  const servingTea = content?.activeEvent?.food === 'tea'
  for (const prop of props) prop.sprite.visible = !servingTea && propVisible(prop.definition, members, view.dragging ? view.world.actor.id : undefined)
  tea.clear()
  if (servingTea) for (const definition of props.map(p => p.definition)) {
    const actor = members.find(a => a.intent?.furnitureId === definition.furnitureId && a.intent.seat === definition.seat && a.intent.stage === 'use')
    const x = actor ? actor.position.x + 13 : definition.rect.x + 8, y = actor ? actor.position.y - 35 : definition.rect.y + 9
    tea.ellipse(x, y + 8, 12, 3).fill(0xe6d9b4).stroke({ color: 0x9f8a62, width: .7 })
    tea.roundRect(x - 7, y - 3, 14, 10, 3).fill(0xfaf6dc).stroke({ color: 0x88775a, width: .8 })
    tea.ellipse(x, y - 3, 7, 2.5).fill(0x8f6339).stroke({ color: 0xe5d7b5, width: 1 })
    tea.ellipse(x + 9, y + 1, 3, 3).stroke({ color: 0xc5b58c, width: 1.5 })
    const sway = view.reducedMotion ? 0 : Math.sin((actor?.phase ?? content!.ticks / 30) * 2)
    tea.moveTo(x - 2, y - 9).quadraticCurveTo(x - 5 + sway, y - 13, x + sway, y - 17).stroke({ color: 0xffffff, alpha: .65, width: 1 })
  }
  bell.clear()
  const slot = view.decorationDraft === undefined ? content?.decorations.windChime?.slot : view.decorationDraft
  if (slot) {
    const spots = { window: [185, 105], door: [234, 130], wall: [96, 117] } as const
    bell.position.set(...spots[slot]); bell.rotation = view.reducedMotion ? 0 : Math.sin(view.world.ticks / 45) * .055
    bell.alpha = view.decorationDraft === undefined ? 1 : .6
    bell.moveTo(0, 0).lineTo(0, 9).stroke({ color: 0x74613f, width: 1.3 })
    bell.roundRect(-7, 9, 14, 11, 5).fill(0xd9b15d).stroke({ color: 0x8f6b32, width: 1 })
    bell.ellipse(0, 19, 8, 2).fill(0x96713c)
    bell.moveTo(0, 20).lineTo(0, 26).stroke({ color: 0x74613f, width: 1 })
    bell.roundRect(-3, 26, 6, 13, 1).fill(0x698675).stroke({ color: 0xe0d7b2, width: .6 })
  }
  const lines = content && view.bubbles ? dialogue(content, view.locale) : []
  if (!lines.length && content && view.bubbles && content.decorations.windChime?.slot && content.ticks < reactionUntil)
    lines.push({ actor: content.actor.id, text: bellReaction(content.actor.id, view.locale) })
  if (neighborhood?.neighborhood.event?.phase === 'acting' && view.bubbles) {
    const e = neighborhood.neighborhood.event
    for (const [i, id] of e.participants.entries()) lines.push({ actor: id, text: residentLine(id, e.participants.length === 2 ? 4 : ['listen','sky'].includes(e.definitionId) ? 5 : 2, Math.floor((180-e.remainingTicks)/90)+i, view.locale) })
  }
  if (view.dragging && view.bubbles) lines.unshift({actor:view.world.actor.id,text:residentLine(view.world.actor.id,1,Math.floor(view.dragTime/2),view.locale)})
  for (let i = 0; i < bubbleNodes.length; i++) {
    const node = bubbleNodes[i]!, row = lines[i], resident = row && members.find(a => a.id === row.actor)
    node.style.display = resident && !view.photo ? 'block' : 'none'
    if (!row || !resident) continue
    const position = view.dragging && resident.id === view.world.actor.id ? view.position : resident.position
    const width = Math.min(170, innerWidth * .47), x = stage.x + position.x * stage.scale.x, y = stage.y + (position.y - 122) * stage.scale.y
    node.style.width = `${width}px`; node.style.left = `${Math.max(2, Math.min(innerWidth - width - 2, x - width / 2))}px`
    node.style.top = `${Math.max(35, Math.min(innerHeight - 85, y - (i ? 10 : 55)))}px`
    if (node.textContent !== row.text) { node.textContent = row.text; node.title = row.text }
  }
  shadow.clear()
  for (const [index, actor] of members.entries()) {
    const selected = actor.id === view.world.actor.id, dragging = selected && view.dragging
    drawActor(actor, dragging ? view.position : actor.position, dragging, index / 100)
    const ground = dragging ? actor.safe : actor.position
    shadow.ellipse(ground.x, ground.y, actor.behavior === 'rest' ? 27 : 23, 5).fill({ color: 0x424733, alpha: .14 })
    if (selected && members.length > 1 && !view.photo) shadow.ellipse(ground.x, ground.y, 25, 6).stroke({ color: 0x377d68, width: 1.5, alpha: .85 })
  }
  hints.clear()
  if (view.debug || view.dragging) {
    for (const hotspot of (neighborhood ? neighborhoodScene(scene,neighborhood.neighborhood.layout) : scene).hotspots) hints.roundRect(hotspot.hit.x, hotspot.hit.y, hotspot.hit.width, hotspot.hit.height, 8).stroke({ color: 0x4a9989, alpha: .7, width: 1.5 })
    if (view.debug) for (const rect of scene.obstacles) hints.rect(rect.x, rect.y, rect.width, rect.height).stroke({ color: 0xb35846, width: 1 })
  }
  app.render(); frames++
  const elapsed = performance.now() - began
  paintMs += elapsed; maxPaintMs = Math.max(maxPaintMs, elapsed)
}
async function capturePhoto(id:string) {
  if(!app||!view?.photo||!view.paused)throw Error('PHOTO_UNAVAILABLE')
  paint()
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=960
  const context=canvas.getContext('2d')!;context.fillStyle='#f8f0dd';context.fillRect(0,0,720,960)
  const margin=view.photo.border?24:0,bottom=view.photo.date?64:margin
  const width=720-margin*2,height=960-margin-bottom,scale=Math.max(width/app.canvas.width,height/app.canvas.height),sw=width/scale,sh=height/scale
  context.drawImage(app.canvas,(app.canvas.width-sw)/2,(app.canvas.height-sh)/2,sw,sh,margin,margin,width,height)
  if(view.photo.date){const time=villageTime(view.world.ticks);context.fillStyle='#4e5c43';context.font='20px system-ui';context.textAlign='center';context.fillText((view.locale==='zh'?'小院第 '+time.day+' 天':'Courtyard · Day '+time.day)+'  '+String(time.hour).padStart(2,'0')+':'+String(time.minute).padStart(2,'0'),360,935)}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PHOTO_FAILED')),'image/png'))
  if(blob.size>photoLimits.bytes)throw Error('PHOTO_TOO_LARGE')
  const bytes=await blob.arrayBuffer();if(!disposed)parent.postMessage({channel,version,token,sequence:++sent,type:'photo',id,bytes},'*',[bytes])
}
function drawActor(actor: Actor, pos: Point, dragging: boolean, depth: number) {
  if (!view) return
  const { doll, resting, activity, arms, art: { character, animations } } = rigFor(actor.id)
  const state = dragging ? 'dragging' : actor.behavior
  const action: Action = dragging && view.dragTime < .35 ? 'pickup' : ['work', 'eat', 'rest', 'sit', 'read', 'tend'].includes(state) ? 'idle' : state as Action
  const phase = view.reducedMotion ? 0 : actor.phase
  const pose = samplePose(character, animations.actions[action], view.reducedMotion ? 0 : dragging ? view.dragTime : phase)
  if (state === 'eat') pose.expression = Math.sin(actor.phase * 4) > 0 ? 'happy' : 'neutral'
  const scale = 108 / character.visibleHeight
  // This front-view rig has asymmetric accessories. Retain its approved orientation.
  doll.root.scale.set(scale)
  doll.root.position.set(pos.x - character.feet[0] * scale, pos.y - character.feet[1] * scale)
  doll.root.zIndex = dragging ? 10000 : pos.y * 10 + depth
  doll.root.visible = state !== 'rest'
  if (view.world.schemaVersion === 5) microPose(pose, actor, view.world, view.reducedMotion)
  doll.apply(pose)
  const teaGuest = state === 'eat' && view.world.schemaVersion !== 3 && view.world.activeEvent?.food === 'tea' && view.world.activeEvent.participants.includes(actor.id)
  const busy = (state === 'work' || state === 'eat') && !teaGuest
  doll.nodes.get('arm-left')!.visible = !busy; doll.nodes.get('arm-right')!.visible = !busy
  doll.nodes.get('leg-left')!.visible = !busy; doll.nodes.get('leg-right')!.visible = !busy
  resting.visible = state === 'rest'
  resting.width = 96 * resting.texture.width / resting.texture.height
  resting.height = 96 * (1 + .004 * Math.sin(phase * 2))
  resting.position.set(pos.x, pos.y); resting.zIndex = pos.y * 10 + depth
  activity.position.copyFrom(doll.root.position); activity.scale.set(scale)
  activity.zIndex = busy ? activityDepth(scene, actor, doll.root.zIndex + 1) : doll.root.zIndex + 1
  for (const [name, sprite] of arms) {
    sprite.visible = name.startsWith(state + '-') && busy
    const left = name.endsWith('left')
    sprite.width = state === 'work' ? 175 : 220; sprite.height = state === 'work' ? 200 : 185
    sprite.position.set(left ? 325 : 535, state === 'eat' ? 495 : 560)
    if (state === 'work' && left) { sprite.y += Math.sin(phase * 7) * 6; sprite.rotation = Math.sin(phase * 7) * .025 }
    else if (state === 'eat' && !left) { sprite.y -= (1 + Math.sin(phase * 3)) * 22; sprite.x -= (1 + Math.sin(phase * 3)) * 10; sprite.rotation = -.05 }
    else sprite.rotation = 0
  }
}
Object.assign(window, { __sceneMetrics: () => ({ frames, actors: rigs.size, textures: textures.size, tickerStarted: app?.ticker.started ?? false,
  viewport: sceneViewport(innerWidth, innerHeight),
  paused: view?.paused ?? true, meanPaintMs: frames ? paintMs / frames : 0, maxPaintMs }) })
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== channel || event.data?.version !== version || disposed) return
  const message = event.data
  if (message.type === 'hello' && !initialized) { send('ready'); return }
  if (message.type === 'dispose' && message.token === token) { dispose(); return }
  if (message.type === 'init' && !initialized) {
    if (typeof message.token !== 'string' || message.token.length !== 36 || !message.images
      || Object.keys(message.images).length > 160 || Object.values(message.images).some(b => !(b instanceof ArrayBuffer) || b.byteLength > 8 * 1024 * 1024)) return
    initialized = true; token = message.token
    void init(message).catch(error => send('failed', { error: String(error) }))
  } else if (message.token === token && Number.isSafeInteger(message.sequence) && message.sequence > received && app) {
    received = message.sequence
    if (message.type === 'assets' && !assetLoading) {
      assetLoading=true
      void loadAssets(message.images).then(()=>{assetLoading=false;if(!disposed)send('assets-ready',{assetRevision:message.assetRevision})}).catch(()=>{assetLoading=false;send('failed',{error:'ASSET_UNAVAILABLE'})})
    } else if (message.type === 'capture' && view?.photo && typeof message.id === 'string' && message.id.length===36) {
      void capturePhoto(message.id).catch(()=>send('photo-failed',{id:message.id}))
    } else if (message.type === 'render' && !assetLoading) {
      try {
        const world = message.view.world?.schemaVersion === 5 ? validateNeighborhoodWorld(message.view.world, scene) : message.view.world?.schemaVersion === 4 ? validateContentWorld(message.view.world, scene) : validateWorld(message.view.world, scene), p = message.view.position
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 5000 || Math.abs(p.y) > 5000) return
        if (!Number.isFinite(message.view.dragTime) || message.view.dragTime < 0) return
        if (world.schemaVersion === 4 && view?.world.schemaVersion === 4 && world.decorations.layoutRevision > view.world.decorations.layoutRevision) reactionUntil = world.ticks + 150
        const draft = message.view.decorationDraft
        if (draft !== undefined && draft !== null && !['window', 'door', 'wall'].includes(draft)) return
        const extra=message.view.extraDecorationDraft
        if(extra&&(!['lantern','planter'].includes(extra.id)||!(extra.slot===null||['window','door','wall'].includes(extra.slot))))return
        const photo=message.view.photo
        if(photo && (![photo.zoom,photo.x,photo.y].every(Number.isFinite)||photo.zoom<1||photo.zoom>1.5||Math.abs(photo.x)>1||Math.abs(photo.y)>1))return
        view = { extraDecorationDraft:extra??null, photo:photo?{zoom:photo.zoom,x:photo.x,y:photo.y,date:photo.date===true,border:photo.border===true}:null, world, position: p, dragging: message.view.dragging === true, dragTime: message.view.dragTime, paused: message.view.paused === true, debug: message.view.debug === true,
          locale: message.view.locale === 'en' ? 'en' : 'zh', reducedMotion: message.view.reducedMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches,
          bubbles: message.view.bubbles !== false, decorationDraft: draft }
        if (view.paused) cancel()
        paint()
      } catch { send('failed', { error: 'INVALID_RENDER_STATE' }) }
    } else if (message.type === 'inspect') send('metrics', { frames, textures: textures.size, tickerStarted: app.ticker.started })
  }
})
window.addEventListener('resize', layout)
window.addEventListener('blur', cancel)
window.addEventListener('keydown', event => { if (event.key === 'Escape') {
  if (pointer !== null) cancel(); else send('escape')
  event.preventDefault(); event.stopPropagation()
} })
function dispose() {
  if (disposed) return
  disposed = true; cancel()
  for (const [id, rig] of rigs) removeRig(id, rig)
  app?.destroy(true, { children: true })
  for (const texture of textures.values()) texture.destroy(true)
  for (const url of urls.values()) URL.revokeObjectURL(url)
}
window.addEventListener('pagehide', dispose)
window.addEventListener('unload', dispose)
send('ready')

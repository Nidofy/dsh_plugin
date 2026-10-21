import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { PaperDoll } from '../art/paper-doll.ts'
import { samplePose } from '../art/animation.ts'
import { hitActor, orderedActors, validateWorld } from '../core/world.ts'
import type { Action, AnimationSet, Character } from '../art/types.ts'
import type { Actor, Point, Rect, Scene, World } from '../core/world.ts'
interface SceneArt extends Scene { furniture: { id: string; asset: string; rect: Rect; split: number }[]; cushion: Rect }
interface View { world: World; position: Point; dragging: boolean; dragTime: number; paused: boolean; debug: boolean }
const channel = 'nidofy-ai-village', version = 1
let token = '', received = 0, sent = 0, initialized = false, disposed = false, pointer: number | null = null
let app: Application | undefined, scene: SceneArt, character: Character, animations: AnimationSet
type AvatarArt = { character: Character; animations: AnimationSet; activityPrefix: string }
let roster: Record<string, AvatarArt> = {}
let view: View | undefined, shadow: Graphics, hints: Graphics, tableBowl: Sprite
const stage = new Container(), textures = new Map<string, Texture>(), urls: string[] = []
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
  app.renderer.resize(innerWidth, innerHeight)
  const scale = Math.min(innerWidth / 360, innerHeight / 480)
  stage.scale.set(scale); stage.position.set((innerWidth - scale * 360) / 2, (innerHeight - scale * 480) / 2)
  paint()
}
function local(event: PointerEvent): Point {
  return { x: (event.clientX - stage.x) / stage.scale.x, y: (event.clientY - stage.y) / stage.scale.y }
}
function cancel() {
  if (pointer === null) return
  const id = pointer; pointer = null
  send('pointer', { intent: { type: 'cancel', id, point: { x: 0, y: 0 }, css: { x: 0, y: 0 } } })
  if (app?.canvas.hasPointerCapture(id)) app.canvas.releasePointerCapture(id)
}
async function init(message: { character: Character; animations: AnimationSet; roster?: Record<string, AvatarArt>; scene: SceneArt; images: Record<string, ArrayBuffer> }) {
  character = message.character; animations = message.animations; scene = message.scene
  roster = { ...message.roster, bluewhale: { character, animations, activityPrefix: 'scene/' } }
  for (const [file, bytes] of Object.entries(message.images)) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' })); urls.push(url)
    const image = new Image(); image.src = url; await image.decode()
    if (disposed) return
    textures.set(file, Texture.from(image))
  }
  const instance = new Application()
  await instance.init({ width: innerWidth, height: innerHeight, resolution: Math.min(devicePixelRatio, 2), antialias: true,
    preference: 'webgl', autoStart: false, sharedTicker: false, background: 0xf0eadb })
  if (disposed) { instance.destroy(true, { children: true }); return }
  app = instance
  stage.sortableChildren = true; app.stage.addChild(stage)
  document.body.append(app.canvas)
  app.canvas.style.touchAction = 'none'
  app.canvas.tabIndex = 0
  app.canvas.style.outline = 'none'
  rectangleSprite('scene/background.png', { x: 0, y: 0, width: 360, height: 480 }, -100)
  rectangleSprite('scene/cushion.png', scene.cushion, 0)
  for (const item of scene.furniture) {
    rectangleSprite(`scene/${item.asset}-back.png`, { ...item.rect, height: item.rect.height * item.split }, item.rect.y * 10)
    rectangleSprite(`scene/${item.asset}-front.png`, { ...item.rect, y: item.rect.y + item.rect.height * item.split, height: item.rect.height * (1 - item.split) }, (item.rect.y + item.rect.height) * 10)
  }
  tableBowl = rectangleSprite('scene/bowl.png', { x: 277, y: 241, width: 22, height: 17 }, 3080)
  shadow = new Graphics(); shadow.zIndex = 1; stage.addChild(shadow)
  hints = new Graphics(); hints.zIndex = 11000; stage.addChild(hints)
  const emit = (type: 'down' | 'move' | 'up', event: PointerEvent) => send('pointer', {
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
  const members = orderedActors(view.world), ids = new Set(members.map(a => a.id))
  for (const [id, rig] of rigs) if (!ids.has(id as Actor['id'])) removeRig(id, rig)
  tableBowl.visible = !members.some(a => a.behavior === 'eat' && (!view?.dragging || a.id !== view.world.actor.id))
  shadow.clear()
  for (const [index, actor] of members.entries()) {
    const selected = actor.id === view.world.actor.id, dragging = selected && view.dragging
    drawActor(actor, dragging ? view.position : actor.position, dragging, index / 100)
    const ground = dragging ? actor.safe : actor.position
    shadow.ellipse(ground.x, ground.y, actor.behavior === 'rest' ? 27 : 23, 5).fill({ color: 0x424733, alpha: .14 })
    if (selected && members.length > 1) shadow.ellipse(ground.x, ground.y, 25, 6).stroke({ color: 0x377d68, width: 1.5, alpha: .85 })
  }
  hints.clear()
  if (view.debug || view.dragging) {
    for (const hotspot of scene.hotspots) hints.roundRect(hotspot.hit.x, hotspot.hit.y, hotspot.hit.width, hotspot.hit.height, 8).stroke({ color: 0x4a9989, alpha: .7, width: 1.5 })
    if (view.debug) for (const rect of scene.obstacles) hints.rect(rect.x, rect.y, rect.width, rect.height).stroke({ color: 0xb35846, width: 1 })
  }
  app.render(); frames++
  const elapsed = performance.now() - began
  paintMs += elapsed; maxPaintMs = Math.max(maxPaintMs, elapsed)
}
function drawActor(actor: Actor, pos: Point, dragging: boolean, depth: number) {
  if (!view) return
  const { doll, resting, activity, arms, art: { character, animations } } = rigFor(actor.id)
  const state = dragging ? 'dragging' : actor.behavior
  const action: Action = dragging && view.dragTime < .35 ? 'pickup' : ['work', 'eat', 'rest'].includes(state) ? 'idle' : state as Action
  const pose = samplePose(character, animations.actions[action], dragging ? view.dragTime : actor.phase)
  if (state === 'eat') pose.expression = Math.sin(actor.phase * 4) > 0 ? 'happy' : 'neutral'
  const scale = 108 / character.visibleHeight
  // This front-view rig has asymmetric accessories. Retain its approved orientation.
  doll.root.scale.set(scale)
  doll.root.position.set(pos.x - character.feet[0] * scale, pos.y - character.feet[1] * scale)
  doll.root.zIndex = dragging ? 10000 : pos.y * 10 + depth
  doll.root.visible = state !== 'rest'
  doll.apply(pose)
  const busy = state === 'work' || state === 'eat'
  doll.nodes.get('arm-left')!.visible = !busy; doll.nodes.get('arm-right')!.visible = !busy
  doll.nodes.get('leg-left')!.visible = !busy; doll.nodes.get('leg-right')!.visible = !busy
  resting.visible = state === 'rest'
  resting.width = 96 * resting.texture.width / resting.texture.height
  resting.height = 96 * (1 + .004 * Math.sin(actor.phase * 2))
  resting.position.set(pos.x, pos.y); resting.zIndex = pos.y * 10 + depth
  activity.position.copyFrom(doll.root.position); activity.scale.set(scale); activity.zIndex = busy ? 3080 : doll.root.zIndex + 1
  for (const [name, sprite] of arms) {
    sprite.visible = name.startsWith(state + '-') && busy
    const left = name.endsWith('left')
    sprite.width = state === 'work' ? 175 : 220; sprite.height = state === 'work' ? 200 : 185
    sprite.position.set(left ? 325 : 535, state === 'eat' ? 495 : 560)
    if (state === 'work' && left) { sprite.y += Math.sin(actor.phase * 7) * 6; sprite.rotation = Math.sin(actor.phase * 7) * .025 }
    else if (state === 'eat' && !left) { sprite.y -= (1 + Math.sin(actor.phase * 3)) * 22; sprite.x -= (1 + Math.sin(actor.phase * 3)) * 10; sprite.rotation = -.05 }
    else sprite.rotation = 0
  }
}
Object.assign(window, { __sceneMetrics: () => ({ frames, actors: rigs.size, textures: textures.size, tickerStarted: app?.ticker.started ?? false,
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
    if (message.type === 'render') {
      try {
        const world = validateWorld(message.view.world, scene), p = message.view.position
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 5000 || Math.abs(p.y) > 5000) return
        if (!Number.isFinite(message.view.dragTime) || message.view.dragTime < 0) return
        view = { world, position: p, dragging: message.view.dragging === true, dragTime: message.view.dragTime, paused: message.view.paused === true, debug: message.view.debug === true }
        if (view.paused) cancel()
        paint()
      } catch { send('failed', { error: 'INVALID_RENDER_STATE' }) }
    } else if (message.type === 'inspect') send('metrics', { frames, textures: textures.size, tickerStarted: app.ticker.started })
  }
})
window.addEventListener('resize', layout)
window.addEventListener('blur', cancel)
window.addEventListener('keydown', event => { if (event.key === 'Escape' && pointer !== null) { cancel(); event.preventDefault(); event.stopPropagation() } })
function dispose() {
  if (disposed) return
  disposed = true; cancel()
  for (const [id, rig] of rigs) removeRig(id, rig)
  app?.destroy(true, { children: true })
  for (const texture of textures.values()) texture.destroy(true)
  for (const url of urls) URL.revokeObjectURL(url)
}
window.addEventListener('pagehide', dispose)
window.addEventListener('unload', dispose)
send('ready')

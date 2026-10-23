import { decodeFrameWorld } from '../core/frame-world.ts'
import { bookhouseScene } from '../core/bookhouse-scene.ts'
import { BookhouseArt } from './bookhouse-art.ts'
import { TableArt } from './table-art.ts'
import { displayGameBoard, tableBoardGeometry, tableCellAt } from '../core/table-geometry.ts'
import { keepsakeObservation } from '../core/keepsake-observation.ts'
import { PlayArt } from './play-art.ts'
import { migrateLivingWorld, homeProjection, type LivingWorld } from '../core/living-state.ts'
import { whalePoint } from '../core/living-engine.ts'
import { playDefinition } from '../core/play-catalog.ts'
import { lifePresentation } from '../core/life-engine.ts'
import { lifeDialogue } from '../core/life-dialogue.ts'
import { applyLifePose } from '../art/animation.ts'
import { cachedAtmosphere, backgroundSurface } from './atmosphere.ts'
import { frameChannel as channel, frameVersion as version, validFrameRegion } from '../core/frame-protocol.ts'
import { defaultCamera, projectCamera, validCamera, type Camera } from '../core/camera.ts'
import { routeInput } from './input-router.ts'
import type { ArrangementObject } from '../core/arrangement.ts'
import { homeScene, validateHomeWorld, neighborhoodProjection, type HomeWorld } from '../core/home-state.ts'
import { villageTime } from '../core/dialogue.ts'
import { photoLimits } from '../core/photo.ts'
import { NeighborhoodArt, microPose } from './neighborhood-art.ts'
import { validateNeighborhoodWorld, legacyContent, neighborhoodScene, type NeighborhoodWorld } from '../core/neighborhood-state.ts'
import { residentLine } from '../core/neighborhood-catalog.ts'
import { Application, Container, Graphics, Sprite, Texture, RenderTexture, Matrix, Text } from 'pixi.js'
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
interface View { overlayOpen: boolean; camera: Camera; dismissLayer: boolean; arrangementObjects: ArrangementObject[]; selectedFurniture: string; extraDecorationDraft?: { id: 'lantern' | 'planter'; slot: 'window' | 'door' | 'wall' | null } | null; arranging?: boolean; world: World | ContentWorld | NeighborhoodWorld | HomeWorld | LivingWorld; position: Point; dragging: boolean; dragTime: number; paused: boolean; debug: boolean;
  photo?: { zoom:number;x:number;y:number;date:boolean;border:boolean } | null; locale: 'zh' | 'en'; reducedMotion: boolean; bubbles: boolean; decorationDraft: 'window' | 'door' | 'wall' | null | undefined }

let token = '', received = 0, sent = 0, initialized = false, disposed = false, pointer: number | null = null
let bootAttemptId = '', assetRevision = -1, paintedRevision = 0
let renderContext: WebGLRenderingContext | WebGL2RenderingContext | null = null
const contextLost = () => { if (!disposed) send('failed', { error: 'RENDER_CONTEXT_LOST' }) }
let app: Application | undefined, scene: SceneArt, character: Character, animations: AnimationSet
type AvatarArt = { character: Character; animations: AnimationSet; activityPrefix: string }
let roster: Record<string, AvatarArt> = {}
let view: View | undefined, shadow: Graphics, hints: Graphics, backdrop: Sprite | undefined
let region: 'courtyard' | 'bookhouse' = 'courtyard', bookhouseArt: BookhouseArt | undefined
let atmosphere: Container | undefined, atmosphereCache: ReturnType<typeof cachedAtmosphere> | undefined, backgroundCache: ReturnType<typeof backgroundSurface> | undefined, atmosphereImage: HTMLImageElement | undefined
const playArt = new PlayArt(), tableArt = new TableArt()
let neighborhoodArt: NeighborhoodArt | undefined, cushion: Sprite | undefined
let bell: Graphics, tea: Graphics, viewportRevision = 0, reactionUntil = 0
const bubbleNodes: HTMLDivElement[] = []
const props: { definition: SeatProp; sprite: Sprite }[] = []
let inputRouter: ReturnType<typeof routeInput> | undefined
let projectionKey = ''
let ghostLabel: HTMLDivElement
let ghostObject: ArrangementObject | null = null, ghostPoint: Point | undefined, ghostIndex: number | undefined
const stage = new Container(), worldContent = new Container(), textures = new Map<string, Texture>(), urls = new Map<string, string>()
let renderScene: SceneArt
const furnitureSprites: {id: string; back: Sprite; front: Sprite}[] = []
const accessories = new Map<string, Graphics>()
const photoDate = new Text({text:'',style:{fontFamily:'system-ui',fontSize:20,fill:0x4e5c43}})
photoDate.anchor.set(.5,1)
const twilight = new Graphics(), photoMask = new Graphics(), photoPaper = new Graphics()
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
  resting.anchor.set(.5, 1); worldContent.addChild(doll.root, resting, activity)
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
  worldContent.addChild(sprite)
  return sprite
}
function workspace() { return { x: 0, y: 0, width: innerWidth, height: view?.arrangementObjects.length ? innerHeight - (innerHeight < 480 ? 134 : 194) : innerHeight } }
function photoRect() {
  const k=Math.min((innerWidth-24)/720,(innerHeight*.55-24)/960), margin=view?.photo?.border?24:0,bottom=view?.photo?.date?64:margin
  return { k, x:(innerWidth-720*k)/2, y:12, margin, bottom, width:720-margin*2, height:960-margin-bottom }
}
function projection() {
  const w = workspace(), photo = view?.photo
  if (photo) {
    const r=photoRect(), scale=Math.max(r.width/360,r.height/480)*r.k*photo.zoom
    return {scale,x:r.x+r.margin*r.k+(r.width*r.k-360*scale)/2*(1+photo.x),y:r.y+r.margin*r.k+(r.height*r.k-480*scale)/2*(1+photo.y)}
  }
  return projectCamera(w, view?.arrangementObjects.length ? defaultCamera : view?.camera ?? defaultCamera)
}
function applyProjection() {
  const p = projection(), key = JSON.stringify([p, innerWidth, innerHeight, devicePixelRatio])
  stage.scale.set(p.scale); stage.position.set(p.x, p.y)
  backgroundCache?.update(p.scale,!!view?.photo);atmosphereCache?.update(innerWidth,innerHeight,p,!!view?.photo)
  photoPaper.clear();photoMask.clear();stage.mask=null;photoDate.visible=!!view?.photo?.date
  if(view?.photo){const r=photoRect();photoPaper.rect(r.x,r.y,720*r.k,960*r.k).fill(0xf8f0dd);photoMask.rect(r.x+r.margin*r.k,r.y+r.margin*r.k,r.width*r.k,r.height*r.k).fill(0xffffff);stage.mask=photoMask;const time=villageTime(view.world.ticks);photoDate.text=(view.locale==='zh'?(region==='bookhouse'?'书屋第 ':'小院第 ')+time.day+' 天':(region==='bookhouse'?'Bookhouse · Day ':'Courtyard · Day ')+time.day)+'  '+String(time.hour).padStart(2,'0')+':'+String(time.minute).padStart(2,'0');photoDate.scale.set(r.k);photoDate.position.set(r.x+360*r.k,r.y+940*r.k)}
  if (key !== projectionKey) { projectionKey = key; viewportRevision++; send('viewport', { viewportRevision, projection: { ...p, width: innerWidth, height: innerHeight } }) }
}
function layout() {
  if (!app) return
  inputRouter?.cancel()
  app.renderer.resize(innerWidth, innerHeight, renderResolution(devicePixelRatio, innerWidth, innerHeight))
  applyProjection(); paint()
}
function local(event: { clientX: number; clientY: number }): Point { return { x: (event.clientX - stage.x) / stage.scale.x, y: (event.clientY - stage.y) / stage.scale.y } }
function cancel() { inputRouter?.cancel() }
async function loadAssets(images: Record<string, ArrayBuffer>) {
  if (!images || Object.keys(images).length > 160 || Object.values(images).some(b=>!(b instanceof ArrayBuffer)||b.byteLength>8*1024*1024)) throw Error('INVALID_ASSETS')
  const total = Object.values(images).reduce((n, b) => n + b.byteLength, 0)
  let decoded = 0
  for (const [file, bytes] of Object.entries(images)) {
    if (disposed) return
    if (textures.has(file)) { decoded += bytes.byteLength; continue }
    const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})); urls.set(file,url)
    const image=new Image();image.src=url;await image.decode()
    if(disposed){URL.revokeObjectURL(url);return}
    if (file === 'scene/background.png') { atmosphereImage = image; backgroundCache = backgroundSurface(image) }
    textures.set(file,file==='scene/background.png' ? backgroundCache!.texture : Texture.from(image))
    decoded += bytes.byteLength
    send('frame-resource-progress', { bootAttemptId, assetRevision, progress: .9 * decoded / total })
  }
  keepAssets=new Set(Object.keys(images))
}
async function init(message: { character: Character; animations: AnimationSet; roster?: Record<string, AvatarArt>; scene: SceneArt; region: 'courtyard' | 'bookhouse'; images: Record<string, ArrayBuffer> }) {
  character = message.character; animations = message.animations; scene = message.scene; region = message.region; renderScene = region === 'bookhouse' ? bookhouseScene : scene
  roster = { ...message.roster, bluewhale: { character, animations, activityPrefix: 'scene/' } }
  await loadAssets(message.images)
  if (disposed) return
  const instance = new Application()
  await instance.init({ width: innerWidth, height: innerHeight, resolution: renderResolution(devicePixelRatio, innerWidth, innerHeight), autoDensity: true, antialias: true,
    preference: 'webgl', autoStart: false, sharedTicker: false, background: 0xf0eadb })
  if (disposed) { instance.destroy(true, { children: true }); return }
  app = instance
  const gl=(app.canvas as HTMLCanvasElement).getContext('webgl2') ?? (app.canvas as HTMLCanvasElement).getContext('webgl'), debug=gl?.getExtension('WEBGL_debug_renderer_info')
  renderContext = gl; app.canvas.addEventListener('webglcontextlost', contextLost)
  send('capabilities',{softwareRendering:!!gl && /swiftshader|llvmpipe|software/i.test(String(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)))})
  if (region === 'courtyard') {
    atmosphereCache = cachedAtmosphere(atmosphereImage!); atmosphere = atmosphereCache.root; app.stage.addChild(atmosphere)
    backdrop = new Sprite(textures.get('scene/background.png')!)
    backdrop.width = 360; backdrop.height = 480; backdrop.zIndex = -100; stage.addChild(backdrop)
  }
  worldContent.sortableChildren = true; stage.addChild(worldContent); app.stage.addChild(photoPaper,stage,photoMask,photoDate)
  document.body.style.background = region === 'bookhouse' ? '#d8c7a7' : 'radial-gradient(ellipse at 50% 25%,#c9cbb4,#8e9b7b 65%,#59674f)'
  document.body.append(app.canvas)
  app.canvas.style.touchAction = 'none'
  app.canvas.tabIndex = 0
  app.canvas.style.outline = 'none'
  if (region === 'bookhouse') bookhouseArt = new BookhouseArt(worldContent)
  if (region === 'courtyard') {
  if (scene.cushion) cushion = rectangleSprite('scene/cushion.png', scene.cushion, 0)
  neighborhoodArt = new NeighborhoodArt(worldContent)
  for (const item of scene.furniture) {
    const back = rectangleSprite(`scene/${item.asset}-back.png`, { ...item.rect, height: item.rect.height * item.split }, item.rect.y * 10)
    const front = rectangleSprite(`scene/${item.asset}-front.png`, { ...item.rect, y: item.rect.y + item.rect.height * item.split, height: item.rect.height * (1 - item.split) }, (item.rect.y + item.rect.height) * 10)
    furnitureSprites.push({ id: item.id, back, front })
  }
  for (const definition of seatProps(scene)) props.push({ definition,
    sprite: rectangleSprite(definition.asset, definition.rect, furnitureDepth(scene, definition.furnitureId) ?? 0) })
  }
  shadow = new Graphics(); shadow.zIndex = 1; worldContent.addChild(shadow)
  hints = new Graphics(); hints.zIndex = 11000; worldContent.addChild(hints)
  bell = new Graphics(); bell.zIndex = 2; tea = new Graphics(); tea.zIndex = 4100; worldContent.addChild(bell, tea); twilight.zIndex=2; worldContent.addChild(twilight)
  for (let i = 0; i < 2; i++) {
    const bubble = document.createElement('div')
    bubble.style.cssText = 'display:none;position:absolute;pointer-events:none;box-sizing:border-box;background:#fff9e9;color:#394c36;padding:6px 8px;border:1px solid #bec6a8;border-radius:10px;font:12px/1.5 system-ui;max-height:82px;overflow:hidden;box-shadow:0 3px 12px #243b2020'
    document.body.append(bubble); bubbleNodes.push(bubble)
  }
  const emit = (type: 'down' | 'move' | 'up', event: PointerEvent) => send('pointer', {
    viewportRevision,
    intent: { type, id: event.pointerId, point: local(event), css: { x: event.clientX, y: event.clientY } },
  })
  ghostLabel = document.createElement('div'); ghostLabel.style.cssText='display:none;position:absolute;left:12px;top:64px;max-width:calc(100% - 24px);padding:6px 10px;background:#fffcf5;color:#34473c;border-radius:12px;font:12px/1.5 system-ui;pointer-events:none';document.body.append(ghostLabel)
  inputRouter = routeInput(app.canvas, () => ({ tableAt: point => { const w=view?.world; if(w?.schemaVersion!==10||w.play.active?.definitionId!=='table-game'||w.play.active.stage!==0||w.play.active.phase!=='ready')return null;const cell=tableCellAt(w.home,point);return cell!==null?{token:`${w.play.active.id}:0:${w.play.active.choices.length}`,cell}:null }, playAt: point => { if(view?.world.schemaVersion!==10||view.world.play.active?.phase!=='ready')return null;const p=whalePoint(view.world,scene);return p&&Math.hypot(point.x-p.x,point.y-p.y)<=18?`${view.world.play.active.id}:0`:null }, camera: view?.camera ?? defaultCamera, workspace: workspace(), scale: stage.scale.x,
    local: p => local({clientX:p.x,clientY:p.y}), actor: p => view ? hitActor(view.world,p)?.id ?? null : null, paused: view?.paused ?? true,
    photo: !!view?.photo, overlay: view?.overlayOpen ?? false, dismiss: view?.dismissLayer ?? false, objects: view?.arrangementObjects ?? [], selected: view?.selectedFurniture ?? 'work' }),
    input => send('ui-input', { viewportRevision, input }), (type, event) => send('pointer', { viewportRevision, intent: { type, id:event.pointerId, point:local(event), css:{x:event.clientX,y:event.clientY} } }),
    (object, point, index) => { ghostObject=object;ghostPoint=point;ghostIndex=index;paint() })
  layout()
  send('frame-resource-progress', { bootAttemptId, assetRevision, progress: 1 })
  send('ready-to-render')
}
let frames = 0, paintMs = 0, maxPaintMs = 0
// A bounded recent window; sorting happens only when diagnostics are requested.
const paintSamples: number[] = []
function paint() {
  if (!app || !view || disposed) return
  const began = performance.now()
  applyProjection()
  const members = orderedActors(view.world), ids = new Set(members.map(a => a.id))
  for (const [id, rig] of rigs) if (!ids.has(id as Actor['id'])) removeRig(id, rig)
  const living = view.world.schemaVersion === 10 ? view.world : null
  const courtyardLiving = region === 'courtyard' ? living : null
  const home = courtyardLiving ? homeProjection(courtyardLiving) : view.world.schemaVersion === 6 ? view.world : null
  const neighborhood = home ? neighborhoodProjection(home) : view.world.schemaVersion === 5 ? view.world : null
  const nextScene = region === 'bookhouse' ? bookhouseScene : home ? homeScene(scene, home.neighborhood.layout, home.home) : scene
  if (renderScene !== nextScene) {
    renderScene = nextScene
    for(const item of furnitureSprites){const f=renderScene.furniture.find(f=>f.id===item.id)!;item.back.position.set(f.rect.x,f.rect.y);item.front.position.set(f.rect.x,f.rect.y+f.rect.height*f.split);item.back.zIndex=f.rect.y*10;item.front.zIndex=(f.rect.y+f.rect.height)*10}
    if(cushion && renderScene.cushion)cushion.position.set(renderScene.cushion.x,renderScene.cushion.y)
    const definitions=seatProps(renderScene);for(let i=0;i<props.length;i++){const p=props[i]!,d=definitions[i]!;p.definition=d;p.sprite.position.set(d.rect.x,d.rect.y);p.sprite.zIndex=furnitureDepth(renderScene,d.furnitureId)??0}
  }
  const dusk = home?.home.environment === 'twilight'; if(atmosphere)atmosphere.tint=dusk?0x9eaccd:0xffffff; if(backdrop)backdrop.tint=dusk?0x9eaccd:0xffffff; worldContent.tint=dusk?0xd2dcf0:0xffffff;stage.alpha=1
  twilight.clear();if(dusk){for(const [x,y] of [[178,110],[250,132]])twilight.circle(x!,y!,25).fill({color:0xffdf9d,alpha:.18})}
  if (keepAssets) for(const [key,texture] of textures) if(!keepAssets.has(key)) { texture.destroy(true);textures.delete(key);const url=urls.get(key);if(url)URL.revokeObjectURL(url);urls.delete(key) }
  const content = neighborhood ? legacyContent(neighborhood) : view.world.schemaVersion === 4 ? view.world : null
  if (neighborhood && neighborhoodArt) { neighborhoodArt.paint(neighborhood, view.reducedMotion, view.extraDecorationDraft, home?.home); if(cushion)cushion.visible = neighborhood.neighborhood.layout === 'courtyard' }
  if(playArt.root.parent!==worldContent)worldContent.addChild(playArt.root)
  playArt.paint(courtyardLiving,scene,view.reducedMotion)
  if(tableArt.root.parent!==worldContent)worldContent.addChild(tableArt.root)
  tableArt.paint(courtyardLiving,renderScene)
  bookhouseArt?.paint(members.map(actor => ({ actor, point: view!.dragging && actor.id === view!.world.actor.id ? view!.position : actor.position })), view.world.ticks, view.reducedMotion)
  const servingTea = content?.activeEvent?.food === 'tea'
  const boardVisible = displayGameBoard(courtyardLiving)
  for (const prop of props) prop.sprite.visible = !(boardVisible && prop.definition.furnitureId === 'eat') && !servingTea && propVisible(prop.definition, members, view.dragging ? view.world.actor.id : undefined)
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
  if(courtyardLiving&&view.bubbles){const observation=keepsakeObservation(courtyardLiving,view.locale);if(observation)lines.push({actor:observation.actor,text:observation.text})}
  if(living && view.bubbles && !living.play.active)lines.push(...lifeDialogue(living,view.locale))
  if(living?.play.active && view.bubbles && living.play.active.phase==='observing'){const e=living.play.active;lines.unshift({actor:e.participants[0]!,text:playDefinition(e.definitionId)!.stages[e.stage]!.text[view.locale]})}
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
  for (const [id,g] of accessories) if(!ids.has(id as Actor['id'])){g.destroy();accessories.delete(id)}
  for(const actor of members){let g=accessories.get(actor.id);if(!g){g=new Graphics();worldContent.addChild(g);accessories.set(actor.id,g)}g.clear();const choice=(living?.home ?? home?.home)?.accessories[actor.id];const p=actor.id===view.world.actor.id&&view.dragging?view.position:actor.position;g.position.set(p.x,p.y);g.zIndex=view.dragging&&actor.id===view.world.actor.id?10001:p.y*10+2
    if(actor.behavior!=='rest'&&choice==='ribbon') {g.poly([20,-82,30,-87,30,-76]).fill(0xc37f81);g.poly([40,-82,30,-87,30,-76]).fill(0xd69491);g.circle(30,-82,3).fill(0xf1c59d)}
    if(actor.behavior!=='rest'&&choice==='leaf'){g.ellipse(17,-45,5,3).fill(0x8da66e).stroke({color:0xd7be7f,width:.8});g.moveTo(13,-43).lineTo(21,-47).stroke({color:0xe7d7a6,width:.7})}
  }
  hints.clear()
  if (view.debug || view.dragging || view.arranging) {
    for (const hotspot of renderScene.hotspots) hints.roundRect(hotspot.hit.x, hotspot.hit.y, hotspot.hit.width, hotspot.hit.height, 8).stroke({ color: 0x4a9989, alpha: .7, width: 1.5 })
    if (view.debug) for (const rect of renderScene.obstacles) hints.rect(rect.x, rect.y, rect.width, rect.height).stroke({ color: 0xb35846, width: 1 })
  }
  if (!view.photo && view.arrangementObjects.length) {
    const object = view.arrangementObjects.find(o => o.id === view!.selectedFurniture) ?? view.arrangementObjects[0]!
    for (const [i, a] of object.anchors.entries()) hints.circle(a.x,a.y,26/stage.scale.x).stroke({color:a.legal?0x456740:0xa33d32,width:2/stage.scale.x}).moveTo(a.x-3,a.y).lineTo(a.x+3,a.y).stroke({color:0xffffff,width:2/stage.scale.x})
    if (ghostObject && ghostPoint) { const r=ghostObject.rect, a=ghostIndex === undefined ? undefined : ghostObject.anchors[ghostIndex]; hints.rect((a?.x??ghostPoint.x)-r.width/2,(a?.y??ghostPoint.y)-r.height/2,r.width,r.height).stroke({color:a?.legal?0x456740:0xa33d32,width:2/stage.scale.x}) }
  }
  const moved: {node: Container;x:number;y:number;alpha:number}[] = []
  if (ghostLabel) ghostLabel.style.display = ghostObject ? 'block' : 'none'
  if (ghostObject && ghostPoint) {
    const anchor = ghostIndex === undefined ? undefined : ghostObject.anchors[ghostIndex], id=ghostObject.id, rect=ghostObject.rect
    if (ghostLabel) ghostLabel.textContent = view.locale==='zh' ? anchor ? anchor.legal ? '✓ 可放置 · 松开选择锚点' : '× 此处被占用' : '× 请靠近合法锚点' : anchor ? anchor.legal ? '✓ Release at this anchor' : '× This spot is occupied' : '× Move closer to a legal anchor'
    const furniture=furnitureSprites.find(f=>f.id===id)
    const nodes = (furniture ? [furniture.back,furniture.front] : id==='bench' ? [neighborhoodArt?.bench,neighborhoodArt?.benchBack] : id==='corner' ? [neighborhoodArt?.corner,cushion] : id==='windChime' ? [bell] : [neighborhoodArt?.decorations[id as 'lantern' | 'planter']]).filter((node): node is Sprite | Graphics => !!node)
    const dx=(anchor?.x??ghostPoint.x)-rect.x-rect.width/2,dy=(anchor?.y??ghostPoint.y)-rect.y-rect.height/2
    for(const node of nodes){moved.push({node,x:node.x,y:node.y,alpha:node.alpha});node.x+=dx;node.y+=dy;node.alpha=.78}
  }
  app.render()
  if (renderContext?.isContextLost()) throw Error('RENDER_CONTEXT_LOST')
  for(const row of moved){row.node.position.set(row.x,row.y);row.node.alpha=row.alpha}
  frames++
  const elapsed = performance.now() - began
  paintMs += elapsed; maxPaintMs = Math.max(maxPaintMs, elapsed)
  paintSamples[(frames - 1) % 600] = elapsed
}
async function capturePhoto(id:string) {
  if(!app||!view?.photo||!view.paused)throw Error('PHOTO_UNAVAILABLE')
  paint()
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=960
  const context=canvas.getContext('2d')!;context.fillStyle='#f8f0dd';context.fillRect(0,0,720,960)
  const margin=view.photo.border?24:0,bottom=view.photo.date?64:margin
  const width=720-margin*2,height=960-margin-bottom
  const target = RenderTexture.create({ width, height, resolution: 1 }), oldMask=stage.mask
  const old = { x: stage.x, y: stage.y, scale: stage.scale.x }, photo = view.photo
  try {
    stage.mask=null; stage.scale.set(1); stage.position.set(0,0)
    const z = Math.max(width/360,height/480)*photo.zoom, transform = new Matrix(z,0,0,z,(width-360*z)/2*(1+photo.x),(height-480*z)/2*(1+photo.y))
    app.renderer.render({ container: stage, target, transform, clear: true })
    const source = app.renderer.extract.canvas(target)
    context.drawImage(source as HTMLCanvasElement,margin,margin)
  } finally { target.destroy(true); stage.mask=oldMask; stage.scale.set(old.scale); stage.position.set(old.x,old.y); app.render() }
  if(view.photo.date){const time=villageTime(view.world.ticks);context.fillStyle='#4e5c43';context.font='20px system-ui';context.textAlign='center';context.fillText((view.locale==='zh'?(region==='bookhouse'?'书屋第 ':'小院第 ')+time.day+' 天':(region==='bookhouse'?'Bookhouse · Day ':'Courtyard · Day ')+time.day)+'  '+String(time.hour).padStart(2,'0')+':'+String(time.minute).padStart(2,'0'),360,935)}
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
  if (view.world.schemaVersion === 5 || view.world.schemaVersion === 6) microPose(pose, actor, view.world.schemaVersion === 6 ? neighborhoodProjection(view.world) : view.world, view.reducedMotion)
  if(view.world.schemaVersion===10&&!dragging){const w=view.world;microPose(pose,actor,neighborhoodProjection(homeProjection(w)),view.reducedMotion);const life=lifePresentation(w,actor.id);if(life&&!w.play.active&&!w.neighborhood.event&&!w.activeEvent)applyLifePose(pose,actor.id,life.motion,life.elapsed,view.reducedMotion);if(w.play.active?.participants.includes(actor.id)&&actor.behavior==='idle')applyLifePose(pose,actor.id,w.play.active.phase==='observing'?'point':'waiting',actor.phase,view.reducedMotion)}
  if(region==='courtyard'&&view.world.schemaVersion===10&&!dragging){const observation=keepsakeObservation(view.world,view.locale);if(observation?.actor===actor.id)applyLifePose(pose,actor.id,'point',observation.elapsed,view.reducedMotion)}
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
  activity.zIndex = busy ? activityDepth(renderScene, actor, doll.root.zIndex + 1) : doll.root.zIndex + 1
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
Object.assign(window, { __sceneMetrics: () => { const samples = [...paintSamples].sort((a, b) => a - b), sources = [...new Set([...textures.values()].map(texture => texture.source))]; return ({ frames, actors: rigs.size, textures: textures.size, textureSources: sources.length, decodedRGBABytes: sources.reduce((bytes,source)=>bytes+source.pixelWidth*source.pixelHeight*4,0)+(atmosphereCache?256*256*4:0), tickerStarted: app?.ticker.started ?? false, atmosphereTextureSources: atmosphereCache ? 1 : 0, atmosphereCacheSize: [256,256],
  region, urls: urls.size, tableGame: region==='courtyard'&&view?.world.schemaVersion===10&&displayGameBoard(view.world)?tableBoardGeometry(view.world.home):null, playTarget: region==='courtyard'&&view?.world.schemaVersion===10?whalePoint(view.world,scene):null, geometry: renderScene?.hotspots, environment: view?.world.schemaVersion === 6 || view?.world.schemaVersion === 10 ? view.world.home.environment : null, viewport: { ...sceneViewport(innerWidth, innerHeight), world: projection() }, arrangementObjects: view?.arrangementObjects, gesture: inputRouter?.inspect(),
  paused: view?.paused ?? true, meanPaintMs: frames ? paintMs / frames : 0, maxPaintMs,
  paintSampleCount: samples.length, p50PaintMs: samples[Math.ceil(samples.length * .5) - 1] ?? 0,
  p95PaintMs: samples[Math.ceil(samples.length * .95) - 1] ?? 0 }) } })
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== channel || event.data?.version !== version || disposed) return
  const message = event.data
  if (message.type === 'hello' && !initialized) { send('ready'); return }
  if (message.type === 'dispose' && message.token === token) { dispose(); return }
  if (message.type === 'init' && !initialized) {
    if (typeof message.token !== 'string' || message.token.length !== 36 || !validFrameRegion(message.region) || !message.images
      || Object.keys(message.images).length > 160 || Object.values(message.images).some(b => !(b instanceof ArrayBuffer) || b.byteLength > 8 * 1024 * 1024)) return
    if (typeof message.bootAttemptId !== 'string' || message.bootAttemptId.length !== 36 || !Number.isSafeInteger(message.assetRevision) || message.assetRevision < 0) return
    initialized = true; token = message.token; bootAttemptId = message.bootAttemptId; assetRevision = message.assetRevision
    void init(message).catch(error => send('failed', { error: String(error) }))
  } else if (message.token === token && Number.isSafeInteger(message.sequence) && message.sequence > received && app) {
    received = message.sequence
    if (message.type === 'assets' && !assetLoading) {
      if (message.bootAttemptId !== bootAttemptId || !Number.isSafeInteger(message.assetRevision) || message.assetRevision <= assetRevision) return
      assetLoading=true; assetRevision = message.assetRevision; paintedRevision = 0
      void loadAssets(message.images).then(()=>{assetLoading=false;if(!disposed)send('assets-ready',{assetRevision:message.assetRevision})}).catch(()=>{assetLoading=false;send('failed',{error:'ASSET_UNAVAILABLE'})})
    } else if (message.type === 'capture' && view?.photo && typeof message.id === 'string' && message.id.length===36) {
      void capturePhoto(message.id).catch(()=>send('photo-failed',{id:message.id}))
    } else if (message.type === 'render' && !assetLoading) {
      if (message.bootAttemptId !== bootAttemptId || message.assetRevision !== assetRevision || !Number.isSafeInteger(message.viewRevision) || message.viewRevision < 1) return
      try {
        const world = decodeFrameWorld(message.view.world, scene), p = message.view.position
        if ((world.schemaVersion === 10 ? world.region.active : 'courtyard') !== region) throw Error('FRAME_REGION_CHANGED')
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 5000 || Math.abs(p.y) > 5000) return
        if (!Number.isFinite(message.view.dragTime) || message.view.dragTime < 0) return
        if (world.schemaVersion === 4 && view?.world.schemaVersion === 4 && world.decorations.layoutRevision > view.world.decorations.layoutRevision) reactionUntil = world.ticks + 150
        const draft = message.view.decorationDraft
        if (draft !== undefined && draft !== null && !['window', 'door', 'wall'].includes(draft)) return
        const extra=message.view.extraDecorationDraft
        if(extra&&(!['lantern','planter'].includes(extra.id)||!(extra.slot===null||['window','door','wall'].includes(extra.slot))))return
        const photo=message.view.photo
        if(photo && (![photo.zoom,photo.x,photo.y].every(Number.isFinite)||photo.zoom<1||photo.zoom>1.5||Math.abs(photo.x)>1||Math.abs(photo.y)>1))return
        if (message.view.camera !== undefined && !validCamera(message.view.camera)) return
        const objects = message.view.arrangementObjects ?? []
        if (region === 'bookhouse' && (objects.length || message.view.arranging || draft !== undefined || extra)) throw Error('INVALID_REGION_VIEW')
        if (!Array.isArray(objects) || objects.length > 4 || objects.some((o: ArrangementObject) => !o || !['work','eat','bench','corner','windChime','lantern','planter'].includes(o.id) || !o.rect || ![o.rect.x,o.rect.y,o.rect.width,o.rect.height].every(Number.isFinite) || !Array.isArray(o.anchors) || o.anchors.length > 3 || o.anchors.some(a => ![a.x,a.y].every(Number.isFinite) || typeof a.legal !== 'boolean'))) return
        view = { overlayOpen: message.view.overlayOpen === true, camera: message.view.camera ?? defaultCamera, dismissLayer: message.view.dismissLayer === true, arrangementObjects: objects, selectedFurniture: message.view.selectedFurniture, arranging: message.view.arranging === true, extraDecorationDraft:extra??null, photo:photo?{zoom:photo.zoom,x:photo.x,y:photo.y,date:photo.date===true,border:photo.border===true}:null, world, position: p, dragging: message.view.dragging === true, dragTime: message.view.dragTime, paused: message.view.paused === true, debug: message.view.debug === true,
          locale: message.view.locale === 'en' ? 'en' : 'zh', reducedMotion: message.view.reducedMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches,
          bubbles: message.view.bubbles !== false, decorationDraft: draft }
        if (view.paused && !view.arrangementObjects.length && !validCamera(message.view.camera)) cancel()
        paint()
        // paint calls app.render synchronously. This is a successful submission, not a physical display claim.
        if (message.firstFrame && message.viewRevision > paintedRevision) {
          paintedRevision = message.viewRevision
          send('first-frame-rendered', { bootAttemptId, assetRevision, viewRevision: paintedRevision })
        }
      } catch { send('failed', { error: 'INVALID_RENDER_STATE' }) }
    } else if (message.type === 'inspect') send('metrics', { frames, textures: textures.size, tickerStarted: app.ticker.started })
  }
})
window.addEventListener('resize', layout)
window.addEventListener('blur', cancel)
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing) {
  if (!inputRouter?.cancel()) send('escape')
  event.preventDefault(); event.stopPropagation()
} })
function dispose() {
  if (disposed) return
  inputRouter?.dispose(); disposed = true; cancel()
  app?.canvas.removeEventListener('webglcontextlost', contextLost)
  for (const [id, rig] of rigs) removeRig(id, rig)
  bookhouseArt?.destroy()
  app?.destroy(true, { children: true }); atmosphereCache?.destroy()
  for (const texture of textures.values()) texture.destroy(true)
  for (const url of urls.values()) URL.revokeObjectURL(url)
}
window.addEventListener('pagehide', dispose)
window.addEventListener('unload', dispose)
send('ready')

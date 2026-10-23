import * as v9 from './living-state-v9.ts'
import { homeScene, type HomeWorld } from './home-state.ts'
import { bookhouseScene } from './bookhouse-scene.ts'
import { actors, available, validateWorld, walkable, type Actor, type Point, type Scene } from './world.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { validateLifeState } from './life-engine.ts'
import type { WorldCodec } from './migrations.ts'
export { blankPlay, isPlayId } from './living-state-v9.ts'
export type { PlayEvent, PlayMemory, PlayState } from './living-state-v9.ts'

export type RegionId = 'courtyard' | 'bookhouse'
export interface ParkedPose { id: CharacterId; position: Point; safe: Point; facing: 'left' | 'right' }
export interface RegionState { version: 1; active: RegionId; returns: Record<RegionId, ParkedPose[] | null> }
export interface LivingWorld extends Omit<v9.LivingWorld, 'schemaVersion' | 'contentRevision'> {
  schemaVersion: 10; contentRevision: 7; region: RegionState
}
const blankRegion = (): RegionState => ({ version: 1, active: 'courtyard', returns: { courtyard: null, bookhouse: null } })
export const isRegionId = (id: unknown): id is RegionId => id === 'courtyard' || id === 'bookhouse'
export function requireCourtyard(w: LivingWorld) { if (w.region.active !== 'courtyard') throw Error('COURTYARD_REQUIRED') }
export function regionScene(w: LivingWorld, base: Scene) { return w.region.active === 'bookhouse' ? bookhouseScene : homeScene(base,w.neighborhood.layout,w.home) }
const invalid = (): never => { throw Error('INVALID_REGION_WORLD') }
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k=>!Object.hasOwn(value,k))) invalid()
}
function point(value: unknown, scene: Scene): Point {
  exact(value,['x','y'])
  if (!walkable(scene,value as unknown as Point)) invalid()
  return { x: value.x as number, y: value.y as number }
}
export function idlePose(pose: ParkedPose): Actor {
  return { ...structuredClone(pose), behavior:'idle', phase:0, remaining:3, destination:null, intent:null }
}
/** A read-only courtyard projection validates shared history using actual parked courtyard feet. */
function previousProjection(w: LivingWorld): v9.LivingWorld {
  const {region, ...rest}=w
  const old: v9.LivingWorld={...rest,schemaVersion:9,contentRevision:6}
  if(region.active==='bookhouse') {
    const parked=region.returns.courtyard
    if(!parked) return invalid()
    const resident=(id:CharacterId)=>{const p=parked.find(p=>p.id===id);return p?idlePose(p):invalid()}
    old.actor=resident(w.actor.id);old.companions=w.companions.map(a=>resident(a.id));old.life={social:null}
  }
  return old
}
export function homeProjection(w: LivingWorld): HomeWorld { return v9.homeProjection(previousProjection(w)) }
export function withLiving(base: HomeWorld, source?: LivingWorld): LivingWorld {
  if(source) requireCourtyard(source)
  const old=v9.withLiving(base,source?previousProjection(source):undefined)
  const region=structuredClone(source?.region??blankRegion()), ids=new Set(actors(old).map(a=>a.id))
  if(region.returns.bookhouse)region.returns.bookhouse=region.returns.bookhouse.filter(p=>ids.has(p.id))
  return {...old,schemaVersion:10,contentRevision:7,region}
}
function validateRegion(value: unknown,w:LivingWorld,base:Scene): RegionState {
  exact(value,['version','active','returns'])
  if(value.version!==1||!isRegionId(value.active))return invalid()
  exact(value.returns,['courtyard','bookhouse'])
  const ids=actors(w).map(a=>a?.id)
  if(ids.length>7||!ids.every(isCharacterId)||new Set(ids).size!==ids.length)return invalid()
  const result:RegionState={version:1,active:value.active,returns:{courtyard:null,bookhouse:null}}
  for(const id of ['courtyard','bookhouse'] as const){
    const raw=value.returns[id]
    if(id===value.active&&raw!==null)return invalid()
    if(raw===null)continue
    if(!Array.isArray(raw)||raw.length>7)return invalid()
    const g=id==='bookhouse'?bookhouseScene:homeScene(base,w.neighborhood.layout,w.home)
    const seen=new Set<CharacterId>(),checked:ParkedPose[]=[]
    for(const item of raw){
      exact(item,['id','position','safe','facing'])
      if(!isCharacterId(item.id)||!ids.includes(item.id)||seen.has(item.id)||(item.facing!=='left'&&item.facing!=='right'))return invalid()
      const position=point(item.position,g),safe=point(item.safe,g)
      if(checked.some(p=>Math.hypot(p.position.x-position.x,p.position.y-position.y)<24))return invalid()
      checked.push({id:item.id,position,safe,facing:item.facing});seen.add(item.id)
    }
    result.returns[id]=checked
  }
  if(result.active==='bookhouse'&&result.returns.courtyard?.length!==ids.length)return invalid()
  return result
}
/** Schema10 bookhouse actors are closed data, unlike the permissive historical low-level decoder. */
function closedActor(a: Actor) {
  exact(a,['id','position','safe','facing','behavior','phase','remaining','destination','intent'])
  point(a.position,bookhouseScene);point(a.safe,bookhouseScene)
  if(a.destination!==null)point(a.destination,bookhouseScene)
  if(a.intent!==null){
    exact(a.intent,['furnitureId','seat','activity','stage','route','expires'])
    if(!Array.isArray(a.intent.route))return invalid()
    for(const p of a.intent.route)point(p,bookhouseScene)
  }
  if(['work','eat','rest','sit','read','tend'].includes(a.behavior)&&!a.intent)return invalid()
}
export function validateLivingWorld(value: unknown,base:Scene):LivingWorld {
  const w=value as LivingWorld
  if(!w||w.schemaVersion!==10||w.sceneVersion!==3||w.simulationRulesVersion!==4||w.contentRevision!==7)throw Error('UNSUPPORTED_WORLD_VERSION')
  if(new TextEncoder().encode(JSON.stringify(w)).length>48*1024)throw Error('SAVE_TOO_LARGE')
  if(!w.actor||!Array.isArray(w.companions)||w.companions.length>6)return invalid()
  const region=validateRegion(w.region,w,base)
  // Unknown shared fields remain in this projection and are rejected by the frozen codec.
  const old=v9.validateLivingWorld(previousProjection({...w,region}),base)
  if(region.active==='courtyard')return {...old,schemaVersion:10,contentRevision:7,region}
  if(w.activeEvent!==null||w.neighborhood.event!==null||w.play.active!==null)return invalid()
  actors(w).forEach(closedActor)
  const current=validateWorld({schemaVersion:3,worldId:w.worldId,sceneVersion:bookhouseScene.version,avatarDefinitionVersion:w.avatarDefinitionVersion,
    ticks:w.ticks,rng:w.rng,userPaused:w.userPaused,actor:w.actor,companions:w.companions},bookhouseScene)
  if(!actors(current).every(a=>available(current,a.position,a.id)))return invalid()
  const life=validateLifeState(w.life,current,bookhouseScene)
  if(life.social&&['chime','garden'].includes(life.social.kind))return invalid()
  return {...old,schemaVersion:10,contentRevision:7,actor:current.actor,companions:current.companions,life,region}
}
export function createLivingWorld(base:Scene):LivingWorld {
  return {...v9.createLivingWorld(base),schemaVersion:10,contentRevision:7,region:blankRegion()}
}
export function migrateLivingWorld(value:unknown,base:Scene):LivingWorld {
  if((value as LivingWorld)?.schemaVersion===10)return validateLivingWorld(value,base)
  const old=v9.migrateLivingWorld(value,base)
  return validateLivingWorld({...old,schemaVersion:10,contentRevision:7,region:blankRegion()},base)
}
export function livingWorldCodec(base:Scene):WorldCodec<LivingWorld> {
  return {decode:v=>migrateLivingWorld(v,base),validate:v=>validateLivingWorld(v,base),needsUpgrade:v=>(v as LivingWorld)?.schemaVersion!==10}
}

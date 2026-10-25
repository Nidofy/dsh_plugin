import * as v13 from './living-state-v13.ts'
import { homeScene, type HomeWorld } from './home-state.ts'
import { actors, abandon, available, validateWorld, walkable, reachable, type Actor, type Point, type Scene } from './world.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { bookhouseScene } from './bookhouse-scene.ts'
import { teaSquareScene } from './tea-square-scene.ts'
import { blankTeaSquare, validateTeaSquare, type TeaSquareState } from './tea-square-state.ts'
import type { WorldCodec } from './migrations.ts'
export { blankPlay, isPlayId, idlePose } from './living-state-v13.ts'
export type { ParkedPose, PlayEvent, PlayMemory, PlayState, ManualMoveIntent } from './living-state-v13.ts'
import type { ParkedPose } from './living-state-v13.ts'
export type RegionId='courtyard'|'bookhouse'|'tea-square'
export interface RegionState {version:2;active:RegionId;returns:Record<RegionId,ParkedPose[]|null>}
export interface LivingWorld extends Omit<v13.LivingWorld,'schemaVersion'|'contentRevision'|'region'> {schemaVersion:14;contentRevision:10;region:RegionState;teaSquare:TeaSquareState}
export const isRegionId=(v:unknown):v is RegionId=>v==='courtyard'||v==='bookhouse'||v==='tea-square'
export function requireCourtyard(w:LivingWorld){if(w.region.active!=='courtyard')throw Error('COURTYARD_REQUIRED')}
export function regionScene(w:LivingWorld,base:Scene){return w.region.active==='tea-square'?teaSquareScene:w.region.active==='bookhouse'?bookhouseScene:homeScene(base,w.neighborhood.layout,w.home)}
const fail=():never=>{throw Error('INVALID_REGION_WORLD')}
function exact(v:unknown,keys:string[]):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail()}
function point(p:unknown,g:Scene):asserts p is Point{exact(p,['x','y']);if(!walkable(g,p as Point))fail()}
function validateRegion(w:LivingWorld,base:Scene):RegionState{
 const r=w.region;exact(r,['version','active','returns']);exact(r.returns,['courtyard','bookhouse','tea-square'])
 if(r.version!==2||!isRegionId(r.active)||!w.actor||!Array.isArray(w.companions)||w.companions.length>6)fail()
 const ids=actors(w).map(a=>a?.id);if(!ids.every(isCharacterId)||new Set(ids).size!==ids.length)fail()
 for(const id of ['courtyard','bookhouse','tea-square'] as const){
  const poses=r.returns[id];if(id===r.active&&poses!==null)fail();if(poses===null)continue
  if(!Array.isArray(poses)||poses.length>7)fail()
  const seen=new Set<CharacterId>(),g=id==='tea-square'?teaSquareScene:id==='bookhouse'?bookhouseScene:homeScene(base,w.neighborhood.layout,w.home)
  for(const p of poses){exact(p,['id','position','safe','facing']);if(!ids.includes(p.id)||seen.has(p.id)||!['left','right'].includes(p.facing))fail();point(p.position,g);point(p.safe,g);if(poses.some(q=>q!==p&&Math.hypot(q.position.x-p.position.x,q.position.y-p.position.y)<24))fail();seen.add(p.id)}
 }
 if(r.active!=='courtyard'&&r.returns.courtyard?.length!==ids.length)fail()
 return structuredClone(r)
}
function previous(w:LivingWorld):v13.LivingWorld{
 const {teaSquare:_tea,region,...rest}=w
 const old:v13.LivingWorld={...rest,schemaVersion:13,contentRevision:9,region:{version:1,active:region.active==='tea-square'?'courtyard':region.active,returns:{courtyard:region.active==='tea-square'?null:region.returns.courtyard,bookhouse:region.returns.bookhouse}}}
 if(region.active==='tea-square'){
  const restore=(id:CharacterId)=>{const p=region.returns.courtyard?.find(p=>p.id===id);return p?v13.idlePose(p):fail()}
  old.actor=restore(w.actor.id);old.companions=w.companions.map(a=>restore(a.id));old.life={social:null};old.manualMove=null
 }
 return old
}
export function homeProjection(w:LivingWorld):HomeWorld{return v13.homeProjection(previous(w))}
export function withLiving(base:HomeWorld,source?:LivingWorld):LivingWorld{
 if(source)requireCourtyard(source)
 const old=v13.withLiving(base,source?previous(source):undefined),ids=new Set(actors(old).map(a=>a.id))
 return {...old,schemaVersion:14,contentRevision:10,region:{...old.region,version:2,returns:{...old.region.returns,'tea-square':source?.region.returns['tea-square']?.filter(p=>ids.has(p.id))??null}},teaSquare:structuredClone(source?.teaSquare??blankTeaSquare())}
}
function closedActor(a:Actor){exact(a,['id','position','safe','facing','behavior','phase','remaining','destination','intent']);point(a.position,teaSquareScene);point(a.safe,teaSquareScene);if(a.destination!==null)point(a.destination,teaSquareScene);if(a.intent!==null){exact(a.intent,['furnitureId','seat','activity','stage','route','expires']);if(!Array.isArray(a.intent.route))fail();a.intent.route.forEach(p=>point(p,teaSquareScene))}if(['work','eat','rest','sit','read','tend'].includes(a.behavior)&&!a.intent)fail()}
export function validateLivingWorld(value:unknown,base:Scene):LivingWorld{
 const w=value as LivingWorld;if(!w||w.schemaVersion!==14||w.contentRevision!==10)throw Error('UNSUPPORTED_WORLD_VERSION')
 if(new TextEncoder().encode(JSON.stringify(w)).length>48*1024)throw Error('SAVE_TOO_LARGE')
 const region=validateRegion(w,base),old=v13.validateLivingWorld(previous({...w,region}),base)
 let actor=old.actor,companions=old.companions,life=old.life
 if(region.active==='tea-square'){
  exact(w.life,['social'])
  if(w.activeEvent||w.play.active||w.neighborhood.event||w.bookhouse.active||w.life?.social!==null)fail()
  actors(w).forEach(closedActor)
  const current=validateWorld({schemaVersion:3,worldId:w.worldId,sceneVersion:1,avatarDefinitionVersion:w.avatarDefinitionVersion,ticks:w.ticks,rng:w.rng,userPaused:w.userPaused,actor:w.actor,companions:w.companions},teaSquareScene,'current')
  if(!actors(current).every(a=>available(current,a.position,a.id)))fail()
  actor=current.actor;companions=current.companions;life={social:null}
  const m=w.manualMove
  if(m!==null){
   exact(m,['actorId','target','route','waitTicks','replans','expires']);const a=actors(w).find(a=>a.id===m.actorId)
   if(!a||a.intent||a.behavior!=='walk'||!a.destination||!Number.isSafeInteger(m.waitTicks)||m.waitTicks<0||m.waitTicks>=30||!Number.isSafeInteger(m.replans)||m.replans<0||m.replans>3||!Number.isSafeInteger(m.expires)||m.expires<=w.ticks||m.expires>w.ticks+1800||!Array.isArray(m.route)||!m.route.length||m.route.length>9)fail()
   point(m.target,teaSquareScene);let last=a!.position;for(const p of m.route){point(p,teaSquareScene);if(!reachable(teaSquareScene,last,p))fail();last=p}
   if(last.x!==m.target.x||last.y!==m.target.y||a!.destination!.x!==m.route[0]!.x||a!.destination!.y!==m.route[0]!.y)fail()
  }
 }
 const result:LivingWorld={...old,schemaVersion:14,contentRevision:10,actor,companions,life,region,manualMove:structuredClone(w.manualMove),teaSquare:w.teaSquare}
 result.teaSquare=validateTeaSquare(w.teaSquare,result);return result
}
export function createLivingWorld(base:Scene):LivingWorld{return migrateLivingWorld(v13.createLivingWorld(base),base)}
export function migrateLivingWorld(value:unknown,base:Scene):LivingWorld{
 if((value as LivingWorld)?.schemaVersion===14)return validateLivingWorld(value,base)
 const old=v13.migrateLivingWorld(value,base)
 return validateLivingWorld({...old,schemaVersion:14,contentRevision:10,region:{...old.region,version:2,returns:{...old.region.returns,'tea-square':null}},teaSquare:blankTeaSquare()},base)
}
export function livingWorldCodec(base:Scene):WorldCodec<LivingWorld>{return {decode:v=>migrateLivingWorld(v,base),validate:v=>validateLivingWorld(v,base),needsUpgrade:v=>(v as LivingWorld)?.schemaVersion!==14}}

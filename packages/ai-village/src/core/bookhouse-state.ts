import { actors, walkable, reachable, type Point } from './world.ts'
import { uuid } from './content-state.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { bookhouseScene } from './bookhouse-scene.ts'
import type { LivingWorld } from './living-state.ts'
export const bookhouseStages = [
  { target:'bookcase', title:{zh:'书页里的一道光',en:'A light between the pages'}, text:{zh:'一本旧书里夹着空白书签。选一个今天想记住的主题。',en:'A blank bookmark rests in an old book. Choose something to remember today.'}, action:{zh:'选好这页',en:'Choose this page'} },
  { target:'reading-desk', title:{zh:'给这一天写一句话',en:'A sentence for today'}, text:{zh:'把刚才读到的心情写在书签背面。朋友会留下一句自己的回应。',en:'Write your impression on the bookmark. Your friend adds a response of their own.'}, action:{zh:'写下我们的句子',en:'Write our sentence'} },
  { target:'window-seat', title:{zh:'窗边留下的书签',en:'A bookmark by the window'}, text:{zh:'在窗边一起读完。不是每一页都要读懂，有人陪着记住就很好。',en:'Read it together by the window. Not every page needs an answer; sharing the memory is enough.'}, action:{zh:'收好这枚微光书签',en:'Keep the little-light bookmark'} },
] as const
export type BookTheme = 'light' | 'wind'
export interface BookhouseEvent { id:string; participants:[CharacterId,CharacterId]; stage:number; phase:'approaching'|'observing'|'ready'; remainingTicks:number; approachRemainingTicks:number; targets:Point[]; routes:Point[][]; theme:BookTheme|null }
export interface BookhouseMemory { eventId:string; participants:[CharacterId,CharacterId]; completedTick:number; count:number; theme:BookTheme }
export interface BookhouseState { version:1; active:BookhouseEvent|null; memory:BookhouseMemory|null; lastEventId:string|null; keepsake:'bookhouse'|'courtyard'|null }
export const blankBookhouse=():BookhouseState=>({version:1,active:null,memory:null,lastEventId:null,keepsake:null})
const fail=():never=>{throw Error('INVALID_BOOKHOUSE_STORY')}
function exact(v:unknown,keys:string[]):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail()}
const integer=(n:unknown,min:number,max:number):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max
function pair(v:unknown):v is [CharacterId,CharacterId]{return Array.isArray(v)&&v.length===2&&v.every(isCharacterId)&&v[0]!==v[1]}
const theme=(v:unknown):v is BookTheme=>v==='light'||v==='wind'
function point(p:unknown):asserts p is Point{exact(p,['x','y']);if(!walkable(bookhouseScene,p as Point))fail()}
export function validateBookhouseState(value:unknown,w:LivingWorld):BookhouseState {
 exact(value,['version','active','memory','lastEventId','keepsake'])
 if(value.version!==1||(value.lastEventId!==null&&!uuid(value.lastEventId))||![null,'bookhouse','courtyard'].includes(value.keepsake))fail()
 const used=new Set([...w.journal.map(m=>m.eventId),...w.neighborhood.memories.map(m=>m.eventId),w.play.lastEventId,w.neighborhood.lastEventId,w.progress.lastCompletedEventId,w.play.active?.id,w.neighborhood.event?.id,w.activeEvent?.id])
 if(value.memory!==null){const m=value.memory;exact(m,['eventId','participants','completedTick','count','theme']);if(!uuid(m.eventId)||used.has(m.eventId)||!pair(m.participants)||!integer(m.completedTick,0,w.ticks)||!integer(m.count,1,1000000)||!theme(m.theme))fail();if(m.count===1&&m.eventId!==value.lastEventId)fail()}
 if((value.memory!==null)!==(value.lastEventId!==null)||(!value.memory&&value.keepsake!==null)||used.has(value.lastEventId)&&value.lastEventId!==null)fail()
 if(value.active!==null){
  const e=value.active;exact(e,['id','participants','stage','phase','remainingTicks','approachRemainingTicks','targets','routes','theme'])
  if(w.region.active!=='bookhouse'||w.activeEvent||w.neighborhood.event||w.play.active||w.life.social||!uuid(e.id)||used.has(e.id)||e.id===value.lastEventId||e.id===value.memory?.eventId||!pair(e.participants)||!e.participants.every((id:CharacterId)=>actors(w).some(a=>a.id===id))||!integer(e.stage,0,2)||!['approaching','observing','ready'].includes(e.phase)||!integer(e.remainingTicks,0,90)||!integer(e.approachRemainingTicks,0,1800)||(e.stage===0?e.theme!==null:!theme(e.theme))||!Array.isArray(e.targets)||e.targets.length!==2||!Array.isArray(e.routes)||e.routes.length!==2)fail()
  const anchor=bookhouseScene.hotspots.find(h=>h.id===bookhouseStages[e.stage as 0|1|2].target)!.anchor
  e.targets.forEach((target:unknown,i:number)=>{
   point(target);if(Math.hypot(target.x-anchor.x,target.y-anchor.y)>80||e.targets.some((p:Point,j:number)=>i!==j&&Math.hypot(target.x-p.x,target.y-p.y)<24))fail()
   const a=actors(w).find(a=>a.id===e.participants[i])!,route=e.routes[i]
   if(a.intent||!Array.isArray(route)||route.length>9)fail()
   let last=a.position;for(const p of route){point(p);if(!reachable(bookhouseScene,last,p))fail();last=p}
   if(route.length){if(JSON.stringify(route.at(-1))!==JSON.stringify(target)||a.behavior!=='walk'||JSON.stringify(a.destination)!==JSON.stringify(route[0])||e.phase!=='approaching')fail()}
   else if(Math.hypot(a.position.x-target.x,a.position.y-target.y)>.01||a.destination!==null||a.behavior!=='idle')fail()
  })
  if(e.phase==='ready'&&e.remainingTicks!==0)fail()
 }
 return structuredClone(value) as BookhouseState
}

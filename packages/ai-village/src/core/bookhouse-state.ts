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
export interface BookhouseEvent { kind:'reading'|'puzzle'; board:number[]; id:string; participants:[CharacterId,CharacterId]; stage:number; phase:'approaching'|'observing'|'ready'; remainingTicks:number; approachRemainingTicks:number; targets:Point[]; routes:Point[][]; theme:BookTheme|null }
export interface BookhouseMemory { eventId:string; participants:[CharacterId,CharacterId]; completedTick:number; count:number; theme:BookTheme }
export interface BookhousePuzzleMemory { eventId:string; participants:[CharacterId,CharacterId]; completedTick:number; count:number }
export interface BookhouseState { version:2; puzzleMemory:BookhousePuzzleMemory|null; puzzleLastEventId:string|null; active:BookhouseEvent|null; memory:BookhouseMemory|null; lastEventId:string|null; keepsake:'bookhouse'|'courtyard'|null }
export const blankBookhouse=():BookhouseState=>({version:2,puzzleMemory:null,puzzleLastEventId:null,active:null,memory:null,lastEventId:null,keepsake:null})
const fail=():never=>{throw Error('INVALID_BOOKHOUSE_STORY')}
function exact(v:unknown,keys:string[]):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail()}
const integer=(n:unknown,min:number,max:number):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max
function pair(v:unknown):v is [CharacterId,CharacterId]{return Array.isArray(v)&&v.length===2&&v.every(isCharacterId)&&v[0]!==v[1]}
const theme=(v:unknown):v is BookTheme=>v==='light'||v==='wind'
function point(p:unknown):asserts p is Point{exact(p,['x','y']);if(!walkable(bookhouseScene,p as Point))fail()}
export function validateBookhouseState(value:unknown,w:LivingWorld):BookhouseState {
 exact(value,['version','active','memory','lastEventId','keepsake','puzzleMemory','puzzleLastEventId'])
 if(value.version!==2||(value.lastEventId!==null&&!uuid(value.lastEventId))||![null,'bookhouse','courtyard'].includes(value.keepsake))fail()
 const used=new Set([...w.journal.map(m=>m.eventId),...w.neighborhood.memories.map(m=>m.eventId),w.play.lastEventId,w.neighborhood.lastEventId,w.progress.lastCompletedEventId,w.play.active?.id,w.neighborhood.event?.id,w.activeEvent?.id])
 if(value.memory!==null){const m=value.memory;exact(m,['eventId','participants','completedTick','count','theme']);if(!uuid(m.eventId)||used.has(m.eventId)||!pair(m.participants)||!integer(m.completedTick,0,w.ticks)||!integer(m.count,1,1000000)||!theme(m.theme))fail();if(m.count===1&&m.eventId!==value.lastEventId)fail()}
 if((value.memory!==null)!==(value.lastEventId!==null)||(!value.memory&&value.keepsake!==null)||used.has(value.lastEventId)&&value.lastEventId!==null)fail()
 if(value.puzzleMemory!==null){const m=value.puzzleMemory;exact(m,['eventId','participants','completedTick','count']);if(!uuid(m.eventId)||used.has(m.eventId)||m.eventId===value.memory?.eventId||m.eventId===value.lastEventId||!pair(m.participants)||!integer(m.completedTick,0,w.ticks)||!integer(m.count,1,1000000))fail();if(m.count===1&&m.eventId!==value.puzzleLastEventId)fail()}
 if((value.puzzleMemory!==null)!==(value.puzzleLastEventId!==null)||(value.puzzleLastEventId!==null&&(!uuid(value.puzzleLastEventId)||used.has(value.puzzleLastEventId)||value.puzzleLastEventId===value.lastEventId||value.puzzleLastEventId===value.memory?.eventId)))fail()
 if(value.active!==null){
  const e=value.active;exact(e,['id','participants','stage','phase','remainingTicks','approachRemainingTicks','targets','routes','theme','kind','board'])
  if(!['reading','puzzle'].includes(e.kind)||!Array.isArray(e.board)||e.board.length!==3||e.board.some((n:unknown)=>!integer(n,-1,2))||new Set(e.board.filter((n:number)=>n>=0)).size!==e.board.filter((n:number)=>n>=0).length)fail()
  if(e.kind==='reading'?e.board.some((n:number)=>n!==-1):e.stage===0?e.board.some((n:number)=>n!==-1):e.stage===2?!e.board.every((n:number,i:number)=>n===i):e.board.every((n:number,i:number)=>n===i))fail()
  if(w.region.active!=='bookhouse'||w.activeEvent||w.neighborhood.event||w.play.active||w.life.social||!uuid(e.id)||used.has(e.id)||e.id===value.lastEventId||e.id===value.memory?.eventId||e.id===value.puzzleMemory?.eventId||e.id===value.puzzleLastEventId||!pair(e.participants)||!e.participants.every((id:CharacterId)=>actors(w).some(a=>a.id===id))||!integer(e.stage,0,2)||!['approaching','observing','ready'].includes(e.phase)||!integer(e.remainingTicks,0,90)||!integer(e.approachRemainingTicks,0,1800)||(e.kind==='puzzle'?e.theme!==null:e.stage===0?e.theme!==null:!theme(e.theme))||!Array.isArray(e.targets)||e.targets.length!==2||!Array.isArray(e.routes)||e.routes.length!==2)fail()
  const anchor=bookhouseScene.hotspots.find(h=>h.id===bookhouseEventStages({kind:e.kind})[e.stage as 0|1|2].target)!.anchor
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

export const bookhousePuzzleStages = [
 {target:'bookcase', title:{zh:'书架里的谜题',en:'A puzzle on the shelf'}, text:{zh:'三张书页掉出了装订：种子、发芽、开花。先和朋友看看哪一页是开头。',en:'Three pages slipped free: seed, sprout, flower. Find the beginning with a friend.'},action:{zh:'把书页带到阅读桌',en:'Bring the pages to the reading desk'}},
 {target:'reading-desk', title:{zh:'让故事重新长大',en:'Let the story grow again'},text:{zh:'按种子、发芽、开花的顺序排好书页。可以重排，不计时，也不会扣除回忆。',en:'Arrange seed, sprout, then flower. Rearrange freely; there is no timer and no lost memories.'},action:{zh:'整理书页',en:'Arrange the pages'}},
 {target:'window-seat', title:{zh:'给下一位读者留一页',en:'A page for the next reader'},text:{zh:'把整理好的书页放在窗边。今天是种子开花的故事，下次还可以和另一位朋友慢慢读。',en:'Leave the pages by the window. A seed has bloomed today; another friend can read along next time.'},action:{zh:'记住这次书页整理',en:'Remember arranging the pages'}},
] as const
export function bookhouseEventStages(e:Pick<BookhouseEvent,'kind'>){return e.kind==='puzzle'?bookhousePuzzleStages:bookhouseStages}

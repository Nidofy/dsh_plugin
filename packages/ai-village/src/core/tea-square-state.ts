import { actors, reachable, walkable, type Point } from './world.ts'
import { uuid } from './content-state.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import type { LivingWorld } from './living-state.ts'
import { teaSquareScene, teaSquareSeats, teaSquareClosing } from './tea-square-scene.ts'
import { villageTime } from './dialogue.ts'
export interface TeaSquareEvent { kind:'three-cups'; version:1; id:string; participants:[CharacterId,CharacterId,CharacterId]; stage:0|1|2; phase:'approaching'|'observing'|'ready'; remainingTicks:number; approachRemainingTicks:number; targets:Point[]; routes:Point[][]; seed:number; board:number[]; serial:number }
export interface TeaSquareActivity { actorId:CharacterId; stage:'counter'|'choosing'|'seat'|'waiting'; seat:number; route:Point[]; remainingTicks:number; expires:number }
export interface TeaSquareMemory { eventId:string; participants:[CharacterId,CharacterId,CharacterId]; completedTick:number; day:number; count:number }
export interface TeaSquareState { version:1; active:TeaSquareEvent|null; activity:TeaSquareActivity|null; memory:TeaSquareMemory|null; lastEventId:string|null; keepsake:'message-tree'|null }
export const blankTeaSquare=():TeaSquareState=>({version:1,active:null,activity:null,memory:null,lastEventId:null,keepsake:null})
export function teaSquareToken(e:TeaSquareEvent){return `${e.id}:${e.stage}:${e.serial}`}
export function teaSquareOrder(seed:number):readonly number[]{return [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]][seed%6]!}
export const teaSquareStages=[
 {title:{zh:'三杯不同的下午',en:'Three cups, one afternoon'},text:{zh:'先等三位朋友走到桌边，听听每个人带来的小提示。',en:'Wait for all three friends to reach the table and share their hints.'}},
 {title:{zh:'让杯垫说一句话',en:'Let the coasters tell a story'},text:{zh:'照着提示把云、叶、星放到三个位置。可以随时重排。',en:'Arrange cloud, leaf and star in the three places using the hint. Rearrange freely.'}},
 {title:{zh:'把今天挂在树上',en:'Leave today on the tree'},text:{zh:'等朋友走完收尾的小路，再记住这个下午。',en:'Let your friends finish their walk, then remember this afternoon.'}},
] as const
const lines:Record<CharacterId,[string,string]>={bluewhale:['我想先听大家说完，再一起摆好。','I will listen to everyone before we arrange them.'],claude:['把杯下的小纸条排成一句话吧。','Let us turn the notes under our cups into a sentence.'],gemini:['我想到两种组合，先试一种，再换一种！','I have two combinations. Let us try one, then the other!'],gpt:['三个位置都留好，就能慢慢试了。','With three places ready, we can take our time.'],grok:['星星不一定最后出场，对吧？','The star does not always have to come last, right?'],kimi:['我把这片叶子留在茶香旁边。','I will leave this leaf beside the scent of tea.'],qwen:['云来，叶落，星亮，都有自己的顺序。','Cloud, leaf and star each have their own turn.'],seedance:['三个杯垫，也能排出轻轻的节拍。','Three coasters can make a gentle rhythm.'],glm:['先看看图案，再读读留下的线索。','Look at the shapes, then read the hint.'],minimax:['这三个小图案，刚好够讲一个故事。','These three shapes are enough for a little story.'],llama:['杯子暖暖的，我可以慢慢等。','My cup is warm. I can wait.'],mistral:['先把纸签压好，别让风替我们重排。','Hold the notes down before the breeze rearranges them.']}
export function teaSquareLine(id:CharacterId,locale:'zh'|'en'){return lines[id][locale==='zh'?0:1]}
const fail=():never=>{throw Error('INVALID_TEA_SQUARE')}
function exact(v:unknown,keys:string[]):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail()}
const integer=(n:unknown,min:number,max:number):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y
function triple(v:unknown):v is [CharacterId,CharacterId,CharacterId]{return Array.isArray(v)&&v.length===3&&v.every(isCharacterId)&&new Set(v).size===3}
export function teaSquareUsedIds(w:LivingWorld){return new Set([...w.afternoon.memories.map(m=>m.eventId),...Object.values(w.afternoon.lastEventIds),w.afternoon.active?.id,...w.journal.map(m=>m.eventId),...w.neighborhood.memories.map(m=>m.eventId),w.play.lastEventId,w.neighborhood.lastEventId,w.progress.lastCompletedEventId,w.play.active?.id,w.neighborhood.event?.id,w.activeEvent?.id,w.bookhouse.active?.id,w.bookhouse.memory?.eventId,w.bookhouse.lastEventId,w.bookhouse.puzzleMemory?.eventId,w.bookhouse.puzzleLastEventId])}
function route(w:LivingWorld,id:CharacterId,path:unknown,target:Point,moving:boolean,seatedAt?:number){
 const a=actors(w).find(a=>a.id===id);if(!Array.isArray(path))return fail();if(!a||path.length>9)fail()
 const sitting=seatedAt!==undefined&&a!.behavior==='sit'&&a!.intent?.furnitureId==='tea-table'
  &&a!.intent.seat===teaSquareScene.hotspots[seatedAt]!.seat&&a!.intent.activity==='sit'&&a!.intent.stage==='use'&&a!.intent.route.length===0
 if(a!.intent&&!sitting)fail()
 let last=a!.position;for(const p of path){exact(p,['x','y']);if(!walkable(teaSquareScene,p as Point)||!reachable(teaSquareScene,last,p as Point))fail();last=p as Point}
 if(path.length){if(!moving||!same(last,target)||a!.behavior!=='walk'||!a!.destination||!same(a!.destination!,path[0]))fail()}
 // Existing world14 checkpoints may still have idle waiting; retain those bytes while new activities sit.
 else if(!same(a!.position,target)||a!.behavior!=='idle'&&!sitting||a!.destination!==null)fail()
}
export function validateTeaSquare(value:unknown,w:LivingWorld):TeaSquareState{
 exact(value,['version','active','activity','memory','lastEventId','keepsake'])
 if(value.version!==1||![null,'message-tree'].includes(value.keepsake))fail()
 const used=teaSquareUsedIds(w),m=value.memory
 if(m!==null){exact(m,['eventId','participants','completedTick','day','count']);if(!uuid(m.eventId)||used.has(m.eventId)||!triple(m.participants)||!integer(m.completedTick,0,w.ticks)||m.day!==villageTime(m.completedTick).day||!integer(m.count,1,1000000)||m.count===1&&m.eventId!==value.lastEventId)fail()}
 if((m!==null)!==(value.lastEventId!==null)||value.lastEventId!==null&&(!uuid(value.lastEventId)||used.has(value.lastEventId))||!m&&value.keepsake!==null)fail()
 if(value.active!==null||value.activity!==null){if(w.region.active!=='tea-square'||w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event||w.life.social||w.manualMove||value.active&&value.activity)fail()}
 if(value.active!==null){
  const e=value.active;exact(e,['kind','version','id','participants','stage','phase','remainingTicks','approachRemainingTicks','targets','routes','seed','board','serial'])
  if(e.kind!=='three-cups'||e.version!==1||!uuid(e.id)||used.has(e.id)||e.id===value.lastEventId||e.id===m?.eventId||!triple(e.participants)||!integer(e.stage,0,2)||!['approaching','observing','ready'].includes(e.phase)||!integer(e.remainingTicks,0,90)||!integer(e.approachRemainingTicks,0,2400)||!integer(e.seed,1,0xffffffff)||!integer(e.serial,0,1000000)||!Array.isArray(e.board)||e.board.length!==3||e.board.some((n:unknown)=>!integer(n,-1,2))||new Set(e.board.filter((n:number)=>n>=0)).size!==e.board.filter((n:number)=>n>=0).length||!Array.isArray(e.targets)||e.targets.length!==3||!Array.isArray(e.routes)||e.routes.length!==3)fail()
  const solved=e.board.every((n:number,i:number)=>n===teaSquareOrder(e.seed)[i]);if(e.stage===0&&e.board.some((n:number)=>n!==-1)||e.stage===1&&solved||e.stage===2&&!solved)fail()
  e.targets.forEach((p:unknown,i:number)=>{exact(p,['x','y']);const target=p as Point;if(e.stage===2?!teaSquareClosing.some(q=>same(target,q)):!same(target,teaSquareSeats[i]!))fail();if(e.targets.some((q:Point,j:number)=>j!==i&&Math.hypot(target.x-q.x,target.y-q.y)<24))fail();route(w,e.participants[i],e.routes[i],target,e.phase==='approaching')})
  if(e.stage===0&&e.serial!==0||e.stage===1&&e.serial<1||e.stage===2&&e.serial<4||e.phase==='approaching'&&(e.remainingTicks!==90||e.approachRemainingTicks===0)||e.phase==='observing'&&e.remainingTicks===0||e.phase==='ready'&&e.remainingTicks!==0||e.phase!=='approaching'&&e.routes.some((p:Point[])=>p.length))fail()
 }
 if(value.activity!==null){const a=value.activity;exact(a,['actorId','stage','seat','route','remainingTicks','expires']);if(!isCharacterId(a.actorId)||!['counter','choosing','seat','waiting'].includes(a.stage)||!integer(a.seat,0,2)||!integer(a.remainingTicks,0,180)||!integer(a.expires,w.ticks+1,w.ticks+2400))fail();route(w,a.actorId,a.route,['counter','choosing'].includes(a.stage)?teaSquareScene.hotspots[3]!.anchor:teaSquareSeats[a.seat]!,a.stage==='counter'||a.stage==='seat',a.stage==='waiting'?a.seat:undefined)}
 return structuredClone(value) as TeaSquareState
}

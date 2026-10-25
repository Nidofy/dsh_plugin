import { actors, abandon, walkable, step, seatAvailable, seatKey, type Point, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { validateLivingWorld, type LivingWorld } from './living-state.ts'
import { teaSquareScene, teaSquareSeats, teaSquareClosing } from './tea-square-scene.ts'
import { teaSquareOrder, teaSquareToken, teaSquareUsedIds, type TeaSquareEvent } from './tea-square-state.ts'
import { cancelLifeSocial } from './life-engine.ts'
import { cancelManualMove } from './manual-move.ts'
import type { CharacterId } from './roster.ts'
import { uuid } from './content-state.ts'
import { villageTime } from './dialogue.ts'
function available(w:LivingWorld){if(w.region.active!=='tea-square')throw Error('TEA_SQUARE_REQUIRED');if(w.teaSquare.active||w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE')}
function path(w:LivingWorld,id:CharacterId,target:Point,occupied:Point[]){const a=actors(w).find(a=>a.id===id)!;if(!walkable(teaSquareScene,target)||occupied.some(p=>Math.hypot(p.x-target.x,p.y-target.y)<24))throw Error('FURNITURE_OCCUPIED');const route=residentRoute(teaSquareScene,a.position,target,occupied);if(!route||route.length>9)throw Error('PATH_BLOCKED');return route.filter((p,i)=>i!==0||Math.hypot(p.x-a.position.x,p.y-a.position.y)>.001)}
function assign(w:LivingWorld,id:CharacterId,route:Point[]){const a=actors(w).find(a=>a.id===id)!;abandon(a);a.destination=route[0]??null;a.behavior=a.destination?'walk':'idle'}
function prepare(w:LivingWorld){
 const e=w.teaSquare.active!,targets:Point[]=[],outsiders=actors(w).filter(a=>!e.participants.includes(a.id)).map(a=>a.position),routes:Point[][]=[]
 for(let i=0;i<3;i++){
  const occupied=[...outsiders,...targets,...e.participants.slice(i+1).map(id=>actors(w).find(a=>a.id===id)!.position)]
  let found=false
  for(const target of e.stage===2?teaSquareClosing:[teaSquareSeats[i]!]){
   try{const route=path(w,e.participants[i]!,target,occupied);targets.push({...target});routes.push(route);found=true;break}catch{}
  }
  if(!found)throw Error('PATH_BLOCKED')
 }
 e.targets=structuredClone([...targets]);e.routes=routes;e.phase='approaching';e.remainingTicks=90;e.approachRemainingTicks=2400
 e.participants.forEach((id,i)=>assign(w,id,routes[i]!))
}
export function startTeaSquareStory(source:LivingWorld,base:Scene,participants:CharacterId[],id:string){
 const w=validateLivingWorld(source,base);available(w)
 if(participants.length!==3||new Set(participants).size!==3||participants.some(id=>!actors(w).some(a=>a.id===id))||!uuid(id)||teaSquareUsedIds(w).has(id)||id===w.teaSquare.lastEventId||id===w.teaSquare.memory?.eventId)throw Error('INVALID_INVITATION')
 cancelTeaSquareActivity(w);cancelManualMove(w);cancelLifeSocial(w);for(const a of actors(w))abandon(a)
 const seed=[...id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261)||1
 w.teaSquare.active={kind:'three-cups',version:1,id,participants:[...participants].sort() as TeaSquareEvent['participants'],stage:0,phase:'approaching',remainingTicks:90,approachRemainingTicks:2400,targets:[],routes:[],seed,board:[-1,-1,-1],serial:0}
 prepare(w);return validateLivingWorld(w,base)
}
export function cancelTeaSquareStory(w:LivingWorld){for(const id of w.teaSquare.active?.participants??[]){const a=actors(w).find(a=>a.id===id);if(a)abandon(a)}w.teaSquare.active=null}
function move(w:LivingWorld,id:CharacterId,route:Point[],incremental=false){
 if(!route.length)return true
 const a=actors(w).find(a=>a.id===id)!,target=route[0]!,occupied=actors(w).filter(a=>a.id!==id).map(a=>a.position)
 const dx=target.x-a.position.x,dy=target.y-a.position.y,d=Math.hypot(dx,dy)
 const stride=Math.min(17/30,d),next=d?{x:a.position.x+dx/d*stride,y:a.position.y+dy/d*stride}:{...target}
 if(!clearSegment(teaSquareScene,a.position,incremental?next:target,occupied))return false
 if(Math.abs(dx)>.01)a.facing=dx<0?'left':'right'
 if(d<=17/30){a.position={...target};route.shift();a.destination=route[0]??null;if(!a.destination){a.behavior='idle';a.phase=0}}
 else a.position={x:a.position.x+dx/d*17/30,y:a.position.y+dy/d*17/30}
 a.safe={...a.position}
 return true
}
export function stepTeaSquare(w:LivingWorld){
 if(w.userPaused)return
 const e=w.teaSquare.active,a=w.teaSquare.activity
 if(e){
  w.ticks++;for(const actor of actors(w))actor.phase+=1/30
  if(e.phase==='ready')return
  if(e.phase==='observing'){e.remainingTicks=Math.max(0,e.remainingTicks-1);if(!e.remainingTicks)e.phase='ready';return}
  if(--e.approachRemainingTicks<=0){cancelTeaSquareStory(w);return 'blocked' as const}
  const i=e.routes.findIndex(r=>r.length);if(i<0){e.phase='observing';return}move(w,e.participants[i]!,e.routes[i]!);return
 }
 if(!a){step(w,teaSquareScene);return}
 // This finite activity reserves its two real destinations. Other residents still live normally,
 // but cannot autonomously claim the counter or chosen table seat while the participant approaches.
 const reserved=new Set([seatKey(teaSquareScene.hotspots[3]!),seatKey(teaSquareScene.hotspots[a.seat]!)])
 step(w,{...teaSquareScene,hotspots:teaSquareScene.hotspots.filter(h=>!reserved.has(seatKey(h)))},undefined,new Set([a.actorId]))
 actors(w).find(actor=>actor.id===a.actorId)!.phase+=1/30
 if(w.ticks>=a.expires){cancelTeaSquareActivity(w);return 'blocked' as const}
 if(a.route.length){
  if(!move(w,a.actorId,a.route,true)&&w.ticks%30===0){
   const target=a.stage==='counter'?teaSquareScene.hotspots[3]!.anchor:teaSquareSeats[a.seat]!
   try{a.route=path(w,a.actorId,target,actors(w).filter(other=>other.id!==a.actorId).map(other=>other.position));const actor=actors(w).find(other=>other.id===a.actorId)!;actor.destination=a.route[0]??null;actor.behavior=actor.destination?'walk':'idle'}catch{/* Keep the same bounded intent while a moving neighbor clears the route. */}
  }
  return
 }
 if(a.stage==='counter'){a.stage='choosing';a.remainingTicks=60;return}
 if(a.stage==='seat'){
  a.stage='waiting';a.remainingTicks=180
  const actor=actors(w).find(actor=>actor.id===a.actorId)!,hotspot=teaSquareScene.hotspots[a.seat]!
  actor.behavior='sit';actor.phase=0;actor.remaining=6
  actor.intent={furnitureId:hotspot.id,seat:hotspot.seat!,activity:'sit',stage:'use',route:[],expires:w.ticks+181}
  return
 }
 if(a.remainingTicks>0){a.remainingTicks--;return}
 if(a.stage==='waiting'){cancelTeaSquareActivity(w);return}
 if(w.ticks%30===0)try{a.route=path(w,a.actorId,teaSquareSeats[a.seat]!,actors(w).filter(r=>r.id!==a.actorId).map(r=>r.position));a.stage='seat';assign(w,a.actorId,a.route)}catch{/* Retry within expires; never displace a resident to force a seat. */}
}
export type TeaSquareAction='continue'|'place'|'reset'|'remember'
export function actTeaSquareStory(source:LivingWorld,base:Scene,token:string,action:TeaSquareAction,choice?:string){
 const w=validateLivingWorld(source,base),e=w.teaSquare.active
 if(!e||token!==teaSquareToken(e)||e.serial>=1000000)throw Error('STALE_PLAY_ACTION')
 if(e.phase!=='ready')throw Error('PLAY_NOT_READY')
 if(e.stage===0){if(action!=='continue'||choice!==undefined)throw Error('INVALID_PLAY_ACTION');e.stage=1;e.serial++;prepare(w)}
 else if(e.stage===1){
  if(action==='reset'&&choice===undefined)e.board=[-1,-1,-1]
  else if(action==='place'&&choice&&/^[0-2]:[0-2]$/.test(choice)){const [item,slot]=choice.split(':').map(Number) as [number,number];e.board=e.board.map(n=>n===item?-1:n);e.board[slot]=item}
  else throw Error('INVALID_PLAY_ACTION')
  e.serial++;if(e.board.every((n,i)=>n===teaSquareOrder(e.seed)[i])){e.stage=2;prepare(w)}
 }else{
  if(action!=='remember'||choice!==undefined)throw Error('INVALID_PLAY_ACTION')
  if(w.teaSquare.memory)w.teaSquare.memory.count=Math.min(1000000,w.teaSquare.memory.count+1)
  else {w.teaSquare.memory={eventId:e.id,participants:[...e.participants],completedTick:w.ticks,day:villageTime(w.ticks).day,count:1};w.teaSquare.keepsake='message-tree'}
  w.teaSquare.lastEventId=e.id;cancelTeaSquareStory(w)
 }
 return validateLivingWorld(w,base)
}
export function startTeaSquareActivity(source:LivingWorld,base:Scene){
 const w=validateLivingWorld(source,base);available(w);if(w.teaSquare.activity)throw Error('EVENT_ACTIVE')
 const id=w.actor.id,occupied=actors(w).filter(a=>a.id!==id).map(a=>a.position)
 if(!seatAvailable(w,teaSquareScene.hotspots[3]!,id))throw Error('FURNITURE_OCCUPIED')
 const seat=teaSquareSeats.findIndex((p,i)=>seatAvailable(w,teaSquareScene.hotspots[i]!,id)&&occupied.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=24));if(seat<0)throw Error('FURNITURE_OCCUPIED')
 // Both phases must be geometrically possible before accepting this ordinary activity.
 const route=path(w,id,teaSquareScene.hotspots[3]!.anchor,occupied)
 if(!residentRoute(teaSquareScene,teaSquareScene.hotspots[3]!.anchor,teaSquareSeats[seat]!,occupied))throw Error('PATH_BLOCKED')
 cancelManualMove(w);cancelLifeSocial(w);w.teaSquare.activity={actorId:id,stage:'counter',seat,route,remainingTicks:0,expires:w.ticks+2400};assign(w,id,route);return validateLivingWorld(w,base)
}
export function cancelTeaSquareActivity(w:LivingWorld){const a=actors(w).find(a=>a.id===w.teaSquare.activity?.actorId);if(a)abandon(a);w.teaSquare.activity=null}
export function placeTeaSquareKeepsake(source:LivingWorld,base:Scene,place:'message-tree'|null){const w=validateLivingWorld(source,base);if(!w.teaSquare.memory)throw Error('DECORATION_LOCKED');if(w.teaSquare.active||w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE');if(place!==null&&place!=='message-tree')throw Error('INVALID_SLOT');w.teaSquare.keepsake=place;return validateLivingWorld(w,base)}

import { actors, abandon, walkable, type Point, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { bookhouseScene } from './bookhouse-scene.ts'
import { bookhouseEventStages, type BookTheme } from './bookhouse-state.ts'
import { validateLivingWorld, type LivingWorld } from './living-state.ts'
import { cancelCommunitySocial as cancelLifeSocial } from './community-life.ts'
import type { CharacterId } from './roster.ts'
import { uuid } from './content-state.ts'
import { cancelManualMove } from './manual-move.ts'
function prepare(w:LivingWorld){
 const e=w.bookhouse.active!,anchor=bookhouseScene.hotspots.find(h=>h.id===bookhouseEventStages(e)[e.stage as 0|1|2].target)!.anchor
 const candidates=[anchor,...[32,48,64].flatMap(r=>[{x:anchor.x+r,y:anchor.y},{x:anchor.x-r,y:anchor.y},{x:anchor.x,y:anchor.y+r}])]
 const members=e.participants.map(id=>actors(w).find(a=>a.id===id)!),outsiders=actors(w).filter(a=>!e.participants.includes(a.id)).map(a=>a.position)
 const targets:Point[]=[],routes:Point[][]=[]
 for(const a of members){
  let found=false
  for(const target of candidates){
   if(!walkable(bookhouseScene,target)||[...outsiders,...targets].some(p=>Math.hypot(p.x-target.x,p.y-target.y)<24))continue
   const occupied=[...outsiders,...targets,...members.slice(targets.length).filter(other=>other.id!==a.id).map(other=>other.position)]
   const route=residentRoute(bookhouseScene,a.position,target,occupied);if(!route||route.length>9)continue
   targets.push({...target});routes.push(route.filter((p,i)=>i!==0||Math.hypot(p.x-a.position.x,p.y-a.position.y)>.01));found=true;break
  }
  if(!found)throw Error('PATH_BLOCKED')
 }
 e.targets=targets;e.routes=routes;e.phase='approaching';e.remainingTicks=90;e.approachRemainingTicks=1800
 members.forEach((a,i)=>{abandon(a);a.destination=routes[i]![0]??null;a.behavior=a.destination?'walk':'idle'})
}
export function startBookhouseStory(source:LivingWorld,base:Scene,friend:CharacterId,id:string,kind:'reading'|'puzzle'='reading'){
 const w=validateLivingWorld(source,base)
 if(w.region.active!=='bookhouse')throw Error('BOOKHOUSE_REQUIRED')
 if(w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE')
 if(friend===w.actor.id||!actors(w).some(a=>a.id===friend)||!uuid(id)||id===w.bookhouse.lastEventId)throw Error('INVALID_INVITATION')
 cancelManualMove(w);cancelLifeSocial(w)
 // Reserve the room for the brief shared reading; everyone stays at real feet.
 for(const a of actors(w))abandon(a)
 w.bookhouse.active={id,kind,board:[-1,-1,-1],participants:[w.actor.id,friend],stage:0,phase:'approaching',remainingTicks:90,approachRemainingTicks:1800,targets:[],routes:[],theme:null}
 prepare(w);return validateLivingWorld(w,base)
}
export function cancelBookhouseStory(w:LivingWorld){for(const a of actors(w))if(w.bookhouse.active?.participants.includes(a.id))abandon(a);w.bookhouse.active=null}
export function stepBookhouseStory(w:LivingWorld){
 const e=w.bookhouse.active;if(!e)return
 w.ticks++;for(const a of actors(w))a.phase+=1/30
 if(e.phase==='ready')return
 if(e.phase==='observing'){if(e.remainingTicks>0)e.remainingTicks--;if(!e.remainingTicks)e.phase='ready';return}
 e.approachRemainingTicks=Math.max(0,e.approachRemainingTicks-1)
 const i=e.routes.findIndex(r=>r.length);if(i<0){e.phase='observing';return}
 const a=actors(w).find(a=>a.id===e.participants[i])!,target=e.routes[i]![0]!,occupied=actors(w).filter(b=>b.id!==a.id).map(b=>b.position)
 if(!clearSegment(bookhouseScene,a.position,target,occupied))return
 const dx=target.x-a.position.x,dy=target.y-a.position.y,d=Math.hypot(dx,dy)
 if(Math.abs(dx)>.01)a.facing=dx<0?'left':'right'
 if(d<=17/30){a.position={...target};e.routes[i]!.shift();a.destination=e.routes[i]![0]??null;if(!a.destination){a.behavior='idle';a.phase=0}}
 else a.position={x:a.position.x+dx/d*17/30,y:a.position.y+dy/d*17/30}
 a.safe={...a.position}
}
export function bookhouseStoryAction(source:LivingWorld,base:Scene,token:string,choice?:BookTheme|string){
 const w=validateLivingWorld(source,base),e=w.bookhouse.active
 if(!e||token!==`${e.id}:${e.stage}`)throw Error('STALE_PLAY_ACTION')
 if(e.phase!=='ready')throw Error('PLAY_NOT_READY')
 if(e.kind==='puzzle'){
  if(e.stage===1){
   if(choice==='reset')e.board=[-1,-1,-1]
   else if(choice&&/^[0-2]:[0-2]$/.test(choice)){const [item,slot]=choice.split(':').map(Number) as [number,number];e.board=e.board.map(n=>n===item?-1:n);e.board[slot]=item}
   else throw Error('INVALID_PLAY_ACTION')
   if(!e.board.every((n,i)=>n===i))return validateLivingWorld(w,base)
  }else if(choice!==undefined)throw Error('INVALID_PLAY_ACTION')
 }else if(e.stage===0){if(choice!=='light'&&choice!=='wind')throw Error('INVALID_PLAY_ACTION');e.theme=choice}
 else if(choice!==undefined)throw Error('INVALID_PLAY_ACTION')
 if(e.stage<2){e.stage++;prepare(w)}else{
  if(e.kind==='puzzle'){
   if(w.bookhouse.puzzleMemory)w.bookhouse.puzzleMemory.count=Math.min(1000000,w.bookhouse.puzzleMemory.count+1)
   else w.bookhouse.puzzleMemory={eventId:e.id,participants:[...e.participants],completedTick:w.ticks,count:1}
   w.bookhouse.puzzleLastEventId=e.id
  }else if(w.bookhouse.memory)w.bookhouse.memory.count=Math.min(1000000,w.bookhouse.memory.count+1)
  else w.bookhouse.memory={eventId:e.id,participants:[...e.participants],completedTick:w.ticks,count:1,theme:e.theme!}
  const pair=[...e.participants].sort() as [CharacterId,CharacterId],bond=w.neighborhood.bonds.find(b=>b.pair.join('/')===pair.join('/'))
  if(bond){bond.count=Math.min(1000000,bond.count+1);bond.lastTick=w.ticks}else w.neighborhood.bonds.push({pair,count:1,lastTick:w.ticks})
  if(e.kind==='reading'){w.bookhouse.lastEventId=e.id;w.bookhouse.keepsake??='bookhouse'};cancelBookhouseStory(w)
 }
 return validateLivingWorld(w,base)
}
export function placeBookhouseKeepsake(source:LivingWorld,base:Scene,place:LivingWorld['bookhouse']['keepsake']){
 const w=validateLivingWorld(source,base)
 if(!w.bookhouse.memory)throw Error('DECORATION_LOCKED')
 if(w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE')
 if(![null,'courtyard','bookhouse'].includes(place))throw Error('INVALID_SLOT')
 cancelLifeSocial(w);w.bookhouse.keepsake=place;return validateLivingWorld(w,base)
}

export function startBookhousePuzzle(source:LivingWorld,base:Scene,friend:CharacterId,id:string){return startBookhouseStory(source,base,friend,id,'puzzle')}

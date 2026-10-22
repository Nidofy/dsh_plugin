import * as home from './home-engine.ts'
import { arrangeHome as arrangeV6, homeScene, type Home } from './home-state.ts'
import { homeProjection, withLiving, validateLivingWorld, type LivingWorld, type PlayEvent } from './living-state.ts'
import { playDefinition, playDefinitions, whalePlace, type PlayDecorationId } from './play-catalog.ts'
import { actors, abandon, step, walkable, available, type Scene, type Point } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { uuid, type Food, type BellSlot } from './content-state.ts'
import type { CharacterId } from './roster.ts'
import type { LayoutId, ExtraDecoration } from './neighborhood-catalog.ts'
import { cancelLifeSocial, stepLifeSocial, settleLifeSocial } from './life-engine.ts'

const geometry = (w: LivingWorld, base: Scene) => homeScene(base,w.neighborhood.layout,w.home)
function availableForCommand(w: LivingWorld) { if(w.play.active)throw Error('EVENT_ACTIVE'); cancelLifeSocial(w) }
export function inviteTea(w:LivingWorld,b:Scene,p:[CharacterId,CharacterId],f:Food,id:string) { const n=validateLivingWorld(w,b);availableForCommand(n);return withLiving(home.inviteTea(homeProjection(n),b,p,f,id),n) }
export function startNeighborhoodEvent(w:LivingWorld,b:Scene,d:string,p:CharacterId[],id:string) { const n=validateLivingWorld(w,b);availableForCommand(n);return withLiving(home.startNeighborhoodEvent(homeProjection(n),b,d,p,id),n) }
export function placeBell(w:LivingWorld,b:Scene,s:BellSlot|null) { return withLiving(home.placeBell(homeProjection(w),b,s),w) }
export function decorateExtra(w:LivingWorld,b:Scene,id:ExtraDecoration,s:BellSlot|null) { return withLiving(home.decorateExtra(homeProjection(w),b,id,s),w) }
export function arrangeHome(w:LivingWorld,b:Scene,h:Home,l:LayoutId,r:number) {const n=validateLivingWorld(w,b);availableForCommand(n);return withLiving(arrangeV6(homeProjection(n),b,h,l,r),n)}
export function changeLayout(w:LivingWorld,b:Scene,l:LayoutId) { return arrangeHome(w,b,w.home,l,w.home.revision) }
export function cancelTea(w:LivingWorld) { const n=homeProjection(w);home.cancelTea(n);Object.assign(w,withLiving(n,w));cancelPlay(w);cancelLifeSocial(w) }
export function settleTea(w:LivingWorld,b:Scene) {
  if(w.play.active?.phase==='approaching'&&w.play.active.approachRemainingTicks===0){const n=validateLivingWorld(w,b);cancelPlay(n);return n}
  const n=home.settleTea(homeProjection(w),b);return n?withLiving(n,w):null
}
export function cancelPlay(w:LivingWorld) { for(const a of actors(w))if(w.play.active?.participants.includes(a.id))abandon(a);w.play.active=null }
function usedId(w:LivingWorld,id:string) {return w.play.lastEventId===id||w.journal.some(m=>m.eventId===id)||w.neighborhood.memories.some(m=>m.eventId===id)||w.progress.lastCompletedEventId===id||w.neighborhood.lastEventId===id}
export { whalePlace } from './play-catalog.ts'
export function whalePoint(w:LivingWorld,base:Scene):Point|null {
  const e=w.play.active;if(e?.definitionId!=='find-whale'||e.stage!==0)return null
  const g=geometry(w,base), place=whalePlace(e), h=g.hotspots.find(h=>place==='corner'?!['work','eat','bench'].includes(h.id):h.id===place)
  if(!h)return null
  // Visible beside furniture, inside the legal world; never overlaps the HUD coordinates.
  for(const p of [{x:h.anchor.x+22,y:h.anchor.y+18},{x:h.anchor.x-22,y:h.anchor.y+18},h.anchor])if(walkable(g,p))return p
  return null
}
function prepareStage(w:LivingWorld,base:Scene) {
  const e=w.play.active!,d=playDefinition(e.definitionId)!,s=d.stages[e.stage]!,g=geometry(w,base)
  e.target=s.target;e.remainingTicks=s.observeTicks;e.approachRemainingTicks=1800;e.phase='approaching'
  const members=e.participants.map(id=>actors(w).find(a=>a.id===id)!)
  const anchor = s.target===null ? members[0]!.position : g.hotspots.find(h=>s.target==='corner'?!['work','eat','bench'].includes(h.id):h.id===s.target)?.anchor
  if(!anchor)throw Error('LAYOUT_REQUIRED')
  const candidates=[anchor,...[32,48,64,80].flatMap(r=>[{x:anchor.x+r,y:anchor.y},{x:anchor.x-r,y:anchor.y},{x:anchor.x,y:anchor.y+r},{x:anchor.x+r,y:anchor.y+r},{x:anchor.x-r,y:anchor.y+r}])]
  const targets:Point[]=[],routes:Point[][]=[]
  const outsiders=actors(w).filter(a=>!e.participants.includes(a.id)).map(a=>a.position)
  // Participants walk in stable sequence. Planning checks existing bodies and already reserved targets.
  for(const a of members){
    let found=false
    for(const target of candidates){
      if(!walkable(g,target)||[...outsiders,...targets].some(p=>Math.hypot(p.x-target.x,p.y-target.y)<24))continue
      const occupied=[...outsiders,...targets,...members.filter(other=>other.id!==a.id&&!members.slice(0,targets.length).includes(other)).map(other=>other.position)]
      const path=residentRoute(g,a.position,target,occupied)
      if(!path||path.length>9)continue
      targets.push({...target});routes.push(path);found=true;break
    }
    if(!found)throw Error('PATH_BLOCKED')
  }
  e.targets=targets;e.routes=routes
  members.forEach((a,i)=>{abandon(a);a.behavior='walk';a.destination=e.routes[i]![0]??null})
}
export function startPlay(source:LivingWorld,base:Scene,definitionId:string,participants:CharacterId[],id:string):LivingWorld {
  const w=validateLivingWorld(source,base),d=playDefinition(definitionId)
  if(w.activeEvent||w.neighborhood.event||w.play.active)throw Error('EVENT_ACTIVE')
  if(w.ticks<w.play.nextTick)throw Error('INTERACTION_COOLDOWN')
  if(!d||!uuid(id)||usedId(w,id)||participants.length!==d.count||new Set(participants).size!==d.count||participants.some(id=>!actors(w).some(a=>a.id===id))||(d.id==='lost-rice'&&participants[0]!=='bluewhale'))throw Error('INVALID_INVITATION')
  cancelLifeSocial(w)
  w.play.active={id,definitionId:d.id,participants:[...participants],stage:0,phase:'approaching',remainingTicks:0,approachRemainingTicks:1800,target:null,choices:[],board:[-1,-1,-1],targets:[],routes:[]}
  prepareStage(w,base);return validateLivingWorld(w,base)
}
export function stepLiving(w:LivingWorld,base:Scene) {
  const e=w.play.active,g=geometry(w,base)
  if(!e){
    if(w.activeEvent||w.neighborhood.event){cancelLifeSocial(w);const n=homeProjection(w);home.stepHome(n,base);Object.assign(w,withLiving(n,w));return}
    const held=stepLifeSocial(w,g)
    step(w,g,undefined,new Set(held));settleLifeSocial(w,g);return
  }
  w.ticks++
  for(const a of actors(w)){a.phase+=1/30;if(a.intent)a.intent.expires++}
  if(e.phase==='ready')return
  if(e.phase==='observing'){if(e.remainingTicks>0)e.remainingTicks--;if(!e.remainingTicks)e.phase='ready';return}
  e.approachRemainingTicks=Math.max(0,e.approachRemainingTicks-1)
  const i=e.routes.findIndex(route=>route.length>0)
  if(i<0){e.phase='observing';return}
  const a=actors(w).find(a=>a.id===e.participants[i])!,target=e.routes[i]![0]!,occupied=actors(w).filter(other=>other.id!==a.id).map(a=>a.position)
  if(!clearSegment(g,a.position,target,occupied))return // bounded cancellation; never teleport through a friend
  const dx=target.x-a.position.x,dy=target.y-a.position.y,distance=Math.hypot(dx,dy)
  if(Math.abs(dx)>.01)a.facing=dx<0?'left':'right'
  if(distance<=17/30){a.position={...target};e.routes[i]!.shift();a.destination=e.routes[i]![0]??null;if(!a.destination){a.behavior='idle';a.phase=0}}
  else a.position={x:a.position.x+dx/distance*17/30,y:a.position.y+dy/distance*17/30}
  a.safe={...a.position}
}
export function playAction(source:LivingWorld,base:Scene,action:string,value?:string,token?:string):LivingWorld {
  const w=validateLivingWorld(source,base),e=w.play.active
  if(!e||token!==`${e.id}:${e.stage}`)throw Error('STALE_PLAY_ACTION')
  if(e.phase!=='ready')throw Error('PLAY_NOT_READY')
  const d=playDefinition(e.definitionId)!,s=d.stages[e.stage]!
  let advance=false
  if(s.action==='find'){
    if(action==='hint'){if(e.choices.filter(v=>v==='hint').length>=2)throw Error('HINT_LIMIT');e.choices.push('hint')}
    else if(action==='find'){if(value!==whalePlace(e))throw Error('NOT_HERE');advance=true}
    else throw Error('INVALID_PLAY_ACTION')
  }else if(s.action==='place'){
    if(action==='reset')e.board=[-1,-1,-1]
    else if(action==='place'&&value&&/^[0-2]:[0-2]$/.test(value)){
      const [item,slot]=value.split(':').map(Number) as [number,number];e.board=e.board.map(n=>n===item?-1:n);e.board[slot]=item
      advance=e.board.every((item,slot)=>item===slot)
    }else throw Error('INVALID_PLAY_ACTION')
  }else if(s.action==='choose'){
    if(action!=='choose'||!['rice','tea','fruit'].includes(value??'')||e.choices.length>=3)throw Error('INVALID_PLAY_ACTION')
    e.choices.push(value!);advance=e.choices.length===3
  }else {if(action!==s.action)throw Error('INVALID_PLAY_ACTION');advance=true}
  if(advance){
    if(e.stage+1<d.stages.length){e.stage++;prepareStage(w,base)}
    else{
      const previous=w.neighborhood.memories.find(m=>m.id===d.id)
      if(previous)previous.count=Math.min(1000000,previous.count+1)
      else w.neighborhood.memories.push({id:d.id,eventId:e.id,participants:[...e.participants],completedTick:w.ticks,count:1})
      // Existing shared-experience storage, including each pair of the three-person event.
      for(let i=0;i<e.participants.length;i++)for(let j=i+1;j<e.participants.length;j++){
        const pair=[e.participants[i]!,e.participants[j]!].sort() as [CharacterId,CharacterId]
        const bond=w.neighborhood.bonds.find(b=>b.pair.join('/')===pair.join('/'))
        if(bond){bond.count=Math.min(1000000,bond.count+1);bond.lastTick=w.ticks}else w.neighborhood.bonds.push({pair,count:1,lastTick:w.ticks})
      }
      w.play.lastEventId=e.id;w.play.nextTick=w.ticks+90;cancelPlay(w)
    }
  }
  return validateLivingWorld(w,base)
}
export function placePlayDecoration(source:LivingWorld,base:Scene,id:string,slot:BellSlot|null){
  const w=validateLivingWorld(source,base),d=playDefinitions.find(d=>d.reward===id)
  if(!d||!w.neighborhood.memories.some(m=>m.id===d.id))throw Error('DECORATION_LOCKED')
  if(slot!==null&&!['window','door','wall'].includes(slot))throw Error('INVALID_SLOT')
  w.play.decorations[id as PlayDecorationId]=slot;return validateLivingWorld(w,base)
}

import { teaSquareScene, teaSquareEntries } from './tea-square-scene.ts'
import { cancelTeaSquareActivity } from './tea-square-engine.ts'
import { actors, abandon, available, seatAvailable, walkable, step, type Scene, type Point } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { cancelManualMove } from './manual-move.ts'
import { assertCommunityTravel } from './community-map.ts'
import { bookhouseScene, bookhouseEntries } from './bookhouse-scene.ts'
import { cancelLifeSocial } from './life-engine.ts'
import { idlePose, isRegionId, validateLivingWorld, type LivingWorld, type ParkedPose } from './living-state.ts'

/** Explicit travel: inactive areas retain only bounded feet, never a second simulation or clock. */
export function switchRegion(source:LivingWorld,base:Scene,target:unknown):LivingWorld {
  const w=validateLivingWorld(source,base)
  assertCommunityTravel(w.region.active,target)
  if(!isRegionId(target))throw Error('INVALID_REGION')
  if(target===w.region.active)throw Error('REGION_UNCHANGED')
  if(w.teaSquare.active||w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE')
  const departing=actors(w).map(a=>({id:a.id,position:{...a.position},safe:{...a.safe},facing:a.facing}))
  cancelTeaSquareActivity(w);cancelManualMove(w);cancelLifeSocial(w)
  const restored:ParkedPose[]=structuredClone(w.region.returns[target]??[])
  if(target==='bookhouse'||target==='tea-square'){
    const scene=target==='tea-square'?teaSquareScene:bookhouseScene
    const candidates:Point[]=[...target==='tea-square'?teaSquareEntries:bookhouseEntries]
    for(let y=250;y<=430;y+=36)for(let x=48;x<=312;x+=36)candidates.push({x,y})
    for(const a of actors(w).sort((a,b)=>a.id.localeCompare(b.id))){
      if(restored.some(p=>p.id===a.id))continue
      const position=candidates.find(p=>walkable(scene,p)&&restored.every(other=>Math.hypot(other.position.x-p.x,other.position.y-p.y)>=24))
      if(!position)throw Error('REGION_FULL')
      restored.push({id:a.id,position:{...position},safe:{...position},facing:a.facing})
    }
  }
  const restore=(id:typeof w.actor.id)=>{const p=restored.find(p=>p.id===id);if(!p)throw Error('INVALID_REGION_WORLD');return idlePose(p)}
  w.actor=restore(w.actor.id);w.companions=w.companions.map(a=>restore(a.id))
  w.region.returns[w.region.active]=departing;w.region.returns[target]=null;w.region.active=target
  return validateLivingWorld(w,base)
}
export const bookhouseActivityIds=['bookcase','reading-desk','window-seat'] as const
export type BookhouseActivityId=typeof bookhouseActivityIds[number]
/** Current bookhouse policy only; frozen world.step retains its historical collision semantics. */
export function stepBookhouseActivities(w:LivingWorld,held:readonly string[]=[]):'blocked'|undefined {
  if(w.userPaused)return
  const approaching=actors(w).filter(a=>a.intent?.stage==='approach'&&!held.includes(a.id)).sort((a,b)=>a.id.localeCompare(b.id))
  const deadlines=new Map(approaching.map(a=>[a.id,a.intent!.expires]))
  step(w,bookhouseScene,undefined,new Set([...held,...approaching.map(a=>a.id)]))
  let blocked=false
  for(const a of approaching){
    const intent=a.intent!
    // Exclusion normally freezes an intent's deadline. A navigation wait must consume its budget.
    intent.expires=deadlines.get(a.id)!
    a.phase+=1/30;a.remaining=Math.max(0,a.remaining-1/30)
    if(intent.expires<=w.ticks){abandon(a);blocked=true;continue}
    const target=a.destination!,occupied=actors(w).filter(other=>other.id!==a.id).map(other=>other.position)
    const dx=target.x-a.position.x,dy=target.y-a.position.y,distance=Math.hypot(dx,dy),stride=Math.min(17/30,distance)
    const next=distance?{x:a.position.x+dx/distance*stride,y:a.position.y+dy/distance*stride}:{...target}
    if(!clearSegment(bookhouseScene,a.position,next,occupied)){
      // Derived cadence survives cold restore without a second counter, timer or persistent intent.
      if(w.ticks%30===0){
        const hotspot=bookhouseScene.hotspots.find(h=>h.id===intent.furnitureId&&(h.seat??'main')===intent.seat)!
        const route=residentRoute(bookhouseScene,a.position,hotspot.anchor,occupied)
        if(route?.length){a.destination={...route[0]!};intent.route=route.slice(1)}
      }
      continue
    }
    if(Math.abs(dx)>.01)a.facing=dx<0?'left':'right'
    a.position=next;a.safe={...next}
    if(distance<=17/30){
      const waypoint=intent.route.shift()
      if(waypoint)a.destination=waypoint
      else{
        a.destination=null;intent.stage='use';a.behavior=intent.activity;a.phase=0
        // Same one-draw duration rule as ordinary arrival, with the world's existing seeded RNG.
        w.rng=(Math.imul(w.rng,1664525)+1013904223)>>>0;a.remaining=12+w.rng/0x100000000*12;intent.expires=w.ticks+900
      }
    }
  }
  return blocked?'blocked':undefined
}
/** Ordinary resident navigation and seat occupancy; reading does not manufacture a collection fact. */
export function bookhouseActivity(source:LivingWorld,base:Scene,id:BookhouseActivityId):LivingWorld {
  const w=validateLivingWorld(source,base)
  if(w.region.active!=='bookhouse')throw Error('BOOKHOUSE_REQUIRED')
  if(w.bookhouse.active)throw Error('EVENT_ACTIVE')
  const h=bookhouseScene.hotspots.find(h=>h.id===id),a=w.actor
  if(!bookhouseActivityIds.includes(id)||!h?.activity)throw Error('INVALID_BOOKHOUSE_ACTIVITY')
  cancelManualMove(w);cancelLifeSocial(w)
  if(!seatAvailable(w,h,a.id)||!available(w,h.anchor,a.id))throw Error('FURNITURE_OCCUPIED')
  const route=residentRoute(bookhouseScene,a.position,h.anchor,actors(w).filter(other=>other.id!==a.id).map(a=>a.position))
  if(!route||route.length>bookhouseScene.obstacles.length*4+1)throw Error('PATH_BLOCKED')
  abandon(a)
  a.intent={furnitureId:h.id,seat:h.seat??'main',activity:h.activity,stage:'approach',route:route.slice(1),expires:w.ticks+1800}
  // A zero-distance first segment still takes one simulation tick to enter the activity.
  a.destination=route[0]??{...h.anchor};a.behavior='walk'
  return validateLivingWorld(w,base)
}
export function cancelBookhouseActivity(source:LivingWorld,base:Scene):LivingWorld {
  const w=validateLivingWorld(source,base)
  if(w.region.active!=='bookhouse')throw Error('BOOKHOUSE_REQUIRED')
  if(w.bookhouse.active)throw Error('EVENT_ACTIVE')
  cancelManualMove(w);cancelLifeSocial(w);abandon(w.actor)
  return validateLivingWorld(w,base)
}

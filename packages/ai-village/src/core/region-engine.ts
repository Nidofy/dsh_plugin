import { actors, abandon, available, seatAvailable, walkable, type Scene, type Point } from './world.ts'
import { residentRoute } from './navigation.ts'
import { bookhouseScene, bookhouseEntries } from './bookhouse-scene.ts'
import { cancelLifeSocial } from './life-engine.ts'
import { idlePose, isRegionId, validateLivingWorld, type LivingWorld, type ParkedPose } from './living-state.ts'

/** Explicit travel: inactive areas retain only bounded feet, never a second simulation or clock. */
export function switchRegion(source:LivingWorld,base:Scene,target:unknown):LivingWorld {
  const w=validateLivingWorld(source,base)
  if(!isRegionId(target))throw Error('INVALID_REGION')
  if(target===w.region.active)throw Error('REGION_UNCHANGED')
  if(w.bookhouse.active||w.play.active||w.activeEvent||w.neighborhood.event)throw Error('EVENT_ACTIVE')
  const departing=actors(w).map(a=>({id:a.id,position:{...a.position},safe:{...a.safe},facing:a.facing}))
  cancelLifeSocial(w)
  const restored:ParkedPose[]=structuredClone(w.region.returns[target]??[])
  if(target==='bookhouse'){
    const candidates:Point[]=[...bookhouseEntries]
    for(let y=250;y<=430;y+=36)for(let x=48;x<=312;x+=36)candidates.push({x,y})
    for(const a of actors(w).sort((a,b)=>a.id.localeCompare(b.id))){
      if(restored.some(p=>p.id===a.id))continue
      const position=candidates.find(p=>walkable(bookhouseScene,p)&&restored.every(other=>Math.hypot(other.position.x-p.x,other.position.y-p.y)>=24))
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
/** Ordinary resident navigation and seat occupancy; reading does not manufacture a collection fact. */
export function bookhouseActivity(source:LivingWorld,base:Scene,id:BookhouseActivityId):LivingWorld {
  const w=validateLivingWorld(source,base)
  if(w.region.active!=='bookhouse')throw Error('BOOKHOUSE_REQUIRED')
  if(w.bookhouse.active)throw Error('EVENT_ACTIVE')
  const h=bookhouseScene.hotspots.find(h=>h.id===id),a=w.actor
  if(!bookhouseActivityIds.includes(id)||!h?.activity)throw Error('INVALID_BOOKHOUSE_ACTIVITY')
  cancelLifeSocial(w)
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
  cancelLifeSocial(w);abandon(w.actor)
  return validateLivingWorld(w,base)
}

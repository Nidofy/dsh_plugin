import { cancelTeaSquareActivity } from './tea-square-engine.ts'
import { actors, abandon, available, contains, step, walkable, type Point, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { regionScene, validateLivingWorld, type LivingWorld } from './living-state.ts'
import { cancelCommunitySocial as cancelLifeSocial } from './community-life.ts'

export function cancelManualMove(w: LivingWorld) {
  const a = w.manualMove && actors(w).find(a => a.id === w.manualMove!.actorId)
  if (a) abandon(a)
  w.manualMove = null
}
export function requestManualMove(source: LivingWorld, base: Scene, target: Point): LivingWorld {
  const w = validateLivingWorld(source,base), scene = regionScene(w,base)
  if (w.afternoon.active || w.teaSquare.active || w.activeEvent || w.neighborhood.event || w.play.active || w.bookhouse.active) throw Error('EVENT_ACTIVE')
  if (w.userPaused) throw Error('MOVE_PAUSED')
  if (!target || !walkable(scene,target)) throw Error('INVALID_MOVE_TARGET')
  if (scene.hotspots.some(h => contains(h.hit,target))) throw Error('MOVE_FURNITURE')
  if (!available(w,target,w.actor.id)) throw Error('PATH_BLOCKED')
  if (Math.hypot(w.actor.position.x-target.x,w.actor.position.y-target.y)<1) throw Error('MOVE_ALREADY_HERE')
  const route = residentRoute(scene,w.actor.position,target,actors(w).filter(a=>a.id!==w.actor.id).map(a=>a.position))
  if (!route?.length) throw Error('PATH_BLOCKED')
  cancelTeaSquareActivity(w); cancelManualMove(w); cancelLifeSocial(w); abandon(w.actor)
  w.manualMove = { actorId:w.actor.id, target:{...target}, route, waitTicks:0, replans:0, expires:w.ticks+1800 }
  w.actor.behavior='walk';w.actor.destination={...route[0]!}
  return validateLivingWorld(w,base)
}
/** Others continue ordinary life. A blocked player order waits 1s and retries at most 3 times. */
export function stepManualMove(w: LivingWorld, scene: Scene): 'walking' | 'arrived' | 'blocked' {
  const m=w.manualMove!, a=actors(w).find(a=>a.id===m.actorId)!
  step(w,scene,undefined,new Set([a.id]));a.phase+=1/30
  if(w.ticks>=m.expires){cancelManualMove(w);return 'blocked'}
  const target=m.route[0]!, occupied=actors(w).filter(b=>b.id!==a.id).map(b=>b.position)
  const dx=target.x-a.position.x,dy=target.y-a.position.y,d=Math.hypot(dx,dy),stride=Math.min(17/30,d)
  const next=d?{x:a.position.x+dx/d*stride,y:a.position.y+dy/d*stride}:{...target}
  if(!clearSegment(scene,a.position,next,occupied)){
    if(++m.waitTicks>=30){
      m.waitTicks=0
      if(m.replans>=3){cancelManualMove(w);return 'blocked'}
      m.replans++
      const route=residentRoute(scene,a.position,m.target,occupied)
      if(route?.length){m.route=route;a.destination={...route[0]!}}
    }
    return 'walking'
  }
  m.waitTicks=0
  if(Math.abs(dx)>.01)a.facing=dx<0?'left':'right'
  a.position=next;a.safe={...next}
  if(d<=17/30){m.route.shift();a.destination=m.route[0]?{...m.route[0]}:null;if(!m.route.length){cancelManualMove(w);return 'arrived'}}
  return 'walking'
}

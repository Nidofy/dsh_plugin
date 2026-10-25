import { teaSquareScene } from '../core/tea-square-scene.ts'
import type { Actor,Point } from '../core/world.ts'

/** Use the resident's own approved whole rest pose only after reaching a real tea seat. */
export function teaSeatPresentation(region:string,actor:Actor,point:Point,dragging:boolean):string|null{
  if(region!=='tea-square'||dragging||actor.behavior!=='sit'||actor.intent?.furnitureId!=='tea-table'
    ||actor.intent.stage!=='use'||actor.intent.activity!=='sit')return null
  const seat=teaSquareScene.hotspots.find(h=>h.id==='tea-table'&&h.seat===actor.intent!.seat)
  return seat&&Math.hypot(point.x-seat.anchor.x,point.y-seat.anchor.y)<.01?seat.seat!:null
}

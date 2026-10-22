import { actors } from './world.ts'
import type { LivingWorld } from './living-state.ts'
import { playDecorationIds, playDecorationNames, type PlayDecorationId } from './play-catalog.ts'
/** Shared placement coordinates for drawing and residents noticing a real placed object. */
export function keepsakePositions(world: LivingWorld) {
  const spots={window:{x:148,y:155},door:{x:248,y:172},wall:{x:72,y:155}},counts={window:0,door:0,wall:0}
  return playDecorationIds.flatMap(id=>{const slot=world.play.decorations[id];if(!slot)return[];const n=counts[slot]++,p=spots[slot];return[{id,x:p.x+(n%2)*27,y:p.y+Math.floor(n/2)*30}]})
}
/** Presentation of an idle resident's actual nearby view; no fabricated historical discovery. */
export function keepsakeObservation(world:LivingWorld,locale:'zh'|'en') {
  if(world.play.active||world.activeEvent||world.neighborhood.event||world.life.social||world.ticks%900>=120)return null
  const placed=keepsakePositions(world)
  for(const a of actors(world).sort((a,b)=>a.id.localeCompare(b.id))){
    if(a.behavior!=='idle'||a.intent||a.phase<.4||a.phase>2.4)continue
    const item=placed.find(p=>Math.hypot(a.position.x-p.x,a.position.y-70-p.y)<110)
    if(item)return {actor:a.id,item:item.id,elapsed:a.phase,text:locale==='zh'?`看见${playDecorationNames[item.id].zh}，又想起那次一起度过的时光。`:`That ${playDecorationNames[item.id].en.toLowerCase()} reminds me of our time together.`}
  }
  return null
}

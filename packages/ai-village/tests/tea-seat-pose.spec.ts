import { expect,it } from 'vitest'
import { teaSeatPresentation } from '../src/frame/tea-seat-pose.ts'
import { teaSquareScene } from '../src/core/tea-square-scene.ts'
import { createWorld } from '../src/core/world.ts'
import { scene } from '../src/definitions.ts'
import { teaSquareFixture } from './tea-square.fixture.ts'
import { startTeaSquareActivity,cancelTeaSquareActivity } from '../src/core/tea-square-engine.ts'
import { stepLiving } from '../src/core/living-engine.ts'
it.each(['left','middle','right'])('only activates the original rest art at the real %s tea seat, never while dragging or in another region',seat=>{
 const h=teaSquareScene.hotspots.find(h=>h.id==='tea-table'&&h.seat===seat)!,a=createWorld(teaSquareScene).actor
 a.position={...h.anchor};a.behavior='sit';a.intent={furnitureId:'tea-table',seat,activity:'sit',stage:'use',route:[],expires:200}
 const before=JSON.stringify(a);expect(teaSeatPresentation('tea-square',a,a.position,false)).toBe(seat);expect(JSON.stringify(a)).toBe(before)
 expect(teaSeatPresentation('tea-square',a,a.position,true)).toBeNull();expect(teaSeatPresentation('tea-square',a,{x:a.position.x+1,y:a.position.y},false)).toBeNull()
 for(const region of['courtyard','bookhouse'])expect(teaSeatPresentation(region,a,a.position,false)).toBeNull()
 a.intent.stage='approach';expect(teaSeatPresentation('tea-square',a,a.position,false)).toBeNull();a.intent.stage='use';a.behavior='idle';expect(teaSeatPresentation('tea-square',a,a.position,false)).toBeNull()
})
it('real ordinary tea stays standing throughout both routes and choosing, sits at waiting, and immediately resets on cancellation',()=>{
 const w=startTeaSquareActivity(teaSquareFixture(),scene)
 for(let i=0;i<2500&&w.teaSquare.activity?.stage!=='waiting';i++){expect(teaSeatPresentation('tea-square',w.actor,w.actor.position,false)).toBeNull();stepLiving(w,scene)}
 expect(w.teaSquare.activity?.stage).toBe('waiting');expect(teaSeatPresentation('tea-square',w.actor,w.actor.position,false)).toBe(w.actor.intent!.seat)
 const feet={...w.actor.position};cancelTeaSquareActivity(w);expect(w.actor.position).toEqual(feet);expect(teaSeatPresentation('tea-square',w.actor,w.actor.position,false)).toBeNull()
})

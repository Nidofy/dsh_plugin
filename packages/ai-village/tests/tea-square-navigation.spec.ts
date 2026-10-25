import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { teaSquareFixture } from './tea-square.fixture.ts'
import { scene } from '../src/definitions.ts'
import { startTeaSquareActivity,cancelTeaSquareActivity } from '../src/core/tea-square-engine.ts'
import { validateLivingWorld } from '../src/core/living-state.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { actors,available,seatKey } from '../src/core/world.ts'
import { residentRoute } from '../src/core/navigation.ts'
import { teaSquareScene } from '../src/core/tea-square-scene.ts'

it('completes the real seven-body GPT tea checkpoint with bounded rerouting, reserved destinations and exact cold replay',()=>{
 // Copy of isolated approved-tea-dpr1-diagnostic-01 snapshot revision57, tick4292.
 // Source managed-v1-731054cc-013c-4574-a84a-3cb6ed72d51d.json remains unchanged.
 let w=validateLivingWorld(JSON.parse(readFileSync(new URL('./fixtures/tea-ordinary-world14.json',import.meta.url),'utf8')),scene),cold=structuredClone(w)
 const initial=structuredClone(w),activity=w.teaSquare.activity!,deadline=activity.expires,id=activity.actorId,stages=new Set<string>(),movers=new Set<string>()
 const reserved=new Set([seatKey(teaSquareScene.hotspots[3]!),seatKey(teaSquareScene.hotspots[activity.seat]!)])
 let rerouted=false
 for(let i=0;i<2400&&w.teaSquare.activity;i++){
  stages.add(w.teaSquare.activity.stage);const before=actors(w).map(a=>({...a.position}))
  expect(stepLiving(w,scene)).not.toBe('blocked');stepLiving(cold,scene)
  if(w.teaSquare.activity){expect(w.teaSquare.activity.expires).toBe(deadline);if(w.teaSquare.activity.route.length>1)rerouted=true}
  for(const [j,a] of actors(w).entries()){
   const distance=Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)
   expect(distance).toBeLessThanOrEqual(17/30+1e-6);expect(available(w,a.position,a.id)).toBe(true)
   if(a.id!==id){if(distance>0)movers.add(a.id);if(a.intent)expect(reserved.has(JSON.stringify([a.intent.furnitureId,a.intent.seat]))).toBe(false)}
  }
  if(i%90===0)cold=validateLivingWorld(JSON.parse(JSON.stringify(cold)),scene)
 }
 expect([...stages]).toEqual(['counter','choosing','seat','waiting']);expect(rerouted).toBe(true);expect(movers.size).toBeGreaterThan(0)
 expect(w.teaSquare.activity).toBeNull();expect(w.ticks).toBeLessThan(deadline);expect(cold).toEqual(w)
 expect(w.teaSquare.memory).toEqual(initial.teaSquare.memory);expect(w.teaSquare.lastEventId).toBe(initial.teaSquare.lastEventId)
})

function claimHotspot(index:number){
 const w=teaSquareFixture(),a=w.companions[0]!,h=teaSquareScene.hotspots[index]!
 const route=residentRoute(teaSquareScene,a.position,h.anchor,actors(w).filter(other=>other.id!==a.id).map(other=>other.position))!
 a.behavior='walk';a.destination=route[0]!;a.intent={furnitureId:h.id,seat:h.seat!,activity:h.activity!,stage:'approach',route:route.slice(1),expires:w.ticks+1800}
 return validateLivingWorld(w,scene)
}
it('respects another resident already approaching the counter or an empty-looking table seat',()=>{
 const counter=claimHotspot(3),before=JSON.stringify(counter)
 expect(()=>startTeaSquareActivity(counter,scene)).toThrow('FURNITURE_OCCUPIED');expect(JSON.stringify(counter)).toBe(before)
 const reservedSeat=claimHotspot(0),started=startTeaSquareActivity(reservedSeat,scene)
 expect(started.teaSquare.activity!.seat).not.toBe(0);expect(started.companions[0]!.intent).toEqual(reservedSeat.companions[0]!.intent)
})
it('waits within the original deadline then cancels with feedback, without displacing a late blocker',()=>{
 let w=startTeaSquareActivity(teaSquareFixture(),scene)
 w.teaSquare.activity!.expires=w.ticks+30
 const blocker=w.companions[0]!;blocker.position={...teaSquareScene.hotspots[3]!.anchor};blocker.safe={...blocker.position};blocker.remaining=60
 w=validateLivingWorld(w,scene);const feet=structuredClone(w.companions[0]!.position),deadline=w.teaSquare.activity!.expires
 let outcome:unknown
 while(w.teaSquare.activity){outcome=stepLiving(w,scene);expect(w.companions[0]!.position).toEqual(feet)}
 expect(w.ticks).toBe(deadline);expect(outcome).toBe('blocked');expect(w.actor.intent).toBeNull();expect(w.actor.destination).toBeNull();expect(w.teaSquare.memory).toBeNull()
 const again=startTeaSquareActivity(teaSquareFixture(),scene);cancelTeaSquareActivity(again)
 expect(startTeaSquareActivity(again,scene).teaSquare.activity?.stage).toBe('counter')
})

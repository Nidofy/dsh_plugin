import { expect,it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { createLivingWorld,validateLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { switchRegion,bookhouseActivity,cancelBookhouseActivity,stepBookhouseActivities } from '../src/core/region-engine.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { actors,available,step } from '../src/core/world.ts'
import { stepLifeSocial,settleLifeSocial } from '../src/core/life-engine.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'

function book(seven=false){
 const c=new LivingController(createLivingWorld(scene),scene,()=>{})
 for(const id of seven?['claude','gemini','gpt','grok','kimi','qwen']:['claude'])c.setCharacterPresent(id,true)
 return switchRegion(c.world,scene,'bookhouse')
}
it('reproduces the real seven-person Grok collision and reaches the requested bookcase without freezing anyone or extending its deadline',()=>{
 // approved-play-dpr1-01: confirmed pre-travel RNG, seven stable entry IDs, command at tick 3.
 let source=book(true);source.rng=2387716937
 for(let i=0;i<3;i++)stepLiving(source,scene)
 source=bookhouseActivity(source,scene,'bookcase')
 const historical=structuredClone(source)
 for(let i=0;i<1800&&historical.actor.intent?.stage==='approach';i++){
  const {decorations:_courtyard,...projection}=historical,held=stepLifeSocial(projection,bookhouseScene)
  step(historical,bookhouseScene,undefined,new Set(held));projection.ticks=historical.ticks;settleLifeSocial(projection,bookhouseScene)
 }
 expect(historical.ticks).toBe(254);expect(historical.actor.intent).toBeNull()
 expect(historical.actor.position.x).toBeCloseTo(181.25552219554228);expect(historical.actor.position.y).toBeCloseTo(365.45570991574215)
 let w=structuredClone(source),cold=structuredClone(source),movedBystanders=new Set<string>()
 const deadline=w.actor.intent!.expires
 for(let i=0;i<1800&&w.actor.intent?.stage==='approach';i++){
  const before=actors(w).map(a=>({...a.position}))
  expect(stepLiving(w,scene)).not.toBe('blocked');stepLiving(cold,scene)
  for(const [j,a] of actors(w).entries()){
   const d=Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)
   expect(d).toBeLessThanOrEqual(17/30+1e-6);expect(available(w,a.position,a.id)).toBe(true)
   if(j&&d>0)movedBystanders.add(a.id)
  }
  if(w.actor.intent?.stage==='approach')expect(w.actor.intent.expires).toBe(deadline)
  if(i%90===0)cold=validateLivingWorld(JSON.parse(JSON.stringify(cold)),scene)
 }
 expect(w.actor.intent?.stage).toBe('use');expect(w.actor.behavior).toBe('read');expect(w.actor.position).toEqual({x:276,y:268})
 expect(movedBystanders.size).toBeGreaterThan(0);expect(w.ticks).toBeLessThan(deadline);expect(cold).toEqual(w)
})
it('waits at a newly occupied goal, cold restores the reservation and reports bounded expiry without a reward',()=>{
 let w=bookhouseActivity(book(),scene,'bookcase')
 const blocker=w.companions[0]!;blocker.position={x:276,y:268};blocker.safe={...blocker.position};blocker.remaining=60
 w=validateLivingWorld(w,scene)
 const deadline=w.actor.intent!.expires,initialPosition={...blocker.position};let outcome:unknown,waited=false
 for(let i=0;i<1800&&w.actor.intent;i++){
  const before={...w.actor.position};outcome=stepLiving(w,scene)
  if(w.actor.intent?.stage==='approach'){
   expect(w.actor.intent.expires).toBe(deadline)
   if(w.actor.position.x===before.x&&w.actor.position.y===before.y)waited=true
  }
  expect(actors(w).every(a=>available(w,a.position,a.id))).toBe(true)
  if(i===600){expect(waited).toBe(true);w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene);expect(w.companions[0]!.position).toEqual(initialPosition)}
 }
 expect(w.ticks).toBe(deadline);expect(outcome).toBe('blocked');expect(w.actor.intent).toBeNull();expect(w.actor.destination).toBeNull()
 expect(w.bookhouse.memory).toBeNull();expect(validateLivingWorld(w,scene)).toEqual(w)
})
it('preserves pause and explicit cancellation while an activity approaches',()=>{
 let w=bookhouseActivity(book(),scene,'bookcase');w.userPaused=true
 const before=structuredClone(w);for(let i=0;i<90;i++)stepLiving(w,scene);expect(w).toEqual(before)
 w=cancelBookhouseActivity(w,scene);expect(w.actor.intent).toBeNull();expect(w.actor.destination).toBeNull();expect(w.actor.position).toEqual(before.actor.position)
 expect(w.userPaused).toBe(true);expect(w.bookhouse.memory).toBeNull()
})
it('respects a resident held by another current controller rather than advancing its approach twice',()=>{
 const w=bookhouseActivity(book(),scene,'bookcase'),before=structuredClone(w.actor)
 stepBookhouseActivities(w,[w.actor.id])
 expect(w.actor.position).toEqual(before.position);expect(w.actor.phase).toBe(before.phase)
 expect(w.actor.intent).toEqual({...before.intent,expires:before.intent!.expires+1});expect(w.ticks).toBe(1)
})

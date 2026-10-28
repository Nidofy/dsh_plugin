import { expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { createLivingWorld, migrateLivingWorld, validateLivingWorld, regionScene } from '../src/core/living-state.ts'
import { createLivingWorld as createV12, livingWorldCodec as codecV12 } from '../src/core/living-state-v12.ts'
import { cancelManualMove, requestManualMove } from '../src/core/manual-move.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { stepLiving, startPlay } from '../src/core/living-engine.ts'
import { actors, available, reachable, walkable } from '../src/core/world.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { validUIInput } from '../src/core/frame-protocol.ts'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SaveStore } from '../src/host/save-store.ts'
import { livingWorldCodec } from '../src/core/living-state.ts'
const book = () => switchRegion(createLivingWorld(scene),scene,'bookhouse')

it('walks around the reading desk at bounded speed, resumes every cold checkpoint, then idles at the target',()=>{
  const original=book(), target={x:180,y:300},raw=JSON.stringify(original)
  let w=requestManualMove(original,scene,target)
  expect(JSON.stringify(original)).toBe(raw);expect(w.manualMove!.route.length).toBeGreaterThan(1)
  const start={...w.actor.position};let ticks=0
  while(w.manualMove&&ticks++<1800){const before={...w.actor.position};stepLiving(w,scene);expect(Math.hypot(w.actor.position.x-before.x,w.actor.position.y-before.y)).toBeLessThanOrEqual(17/30+1e-7);expect(reachable(regionScene(w,scene),before,w.actor.position)).toBe(true);if(ticks%30===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)}
  expect(ticks).toBeGreaterThan(Math.hypot(target.x-start.x,target.y-start.y)/(17/30));expect(w.manualMove).toBeNull();expect(w.actor.position).toEqual(target);expect(w.actor.behavior).toBe('idle');expect(w.actor.intent).toBeNull()
})
it('does not write invalid targets, furniture hits, occupied feet or orders during stories',()=>{
  const w=book(),raw=JSON.stringify(w)
  expect(()=>requestManualMove(w,scene,{x:0,y:0})).toThrow('INVALID_MOVE_TARGET')
  expect(()=>requestManualMove(w,scene,{x:276,y:268})).toThrow('MOVE_FURNITURE')
  expect(()=>requestManualMove(w,scene,w.actor.position)).toThrow('MOVE_ALREADY_HERE')
  expect(()=>requestManualMove({...w,userPaused:true},scene,{x:300,y:300})).toThrow('MOVE_PAUSED')
  expect(JSON.stringify(w)).toBe(raw)
  const story=startPlay(createLivingWorld(scene),scene,'find-whale',['bluewhale'],crypto.randomUUID())
  expect(()=>requestManualMove(story,scene,{x:180,y:430})).toThrow('EVENT_ACTIVE')
})
it('freezes hidden/user paused movement, supports cancelling and travel without a stale order',()=>{
  const c=new LivingController(requestManualMove(book(),scene,{x:300,y:300}),scene,()=>{})
  c.pause('hidden',true);const raw=JSON.stringify(c.world);for(let i=0;i<60;i++)c.advance(.1);expect(JSON.stringify(c.world)).toBe(raw)
  c.pause('hidden',false);c.advance(.1);expect(JSON.stringify(c.world)).not.toBe(raw)
  const travelled=switchRegion(c.world,scene,'courtyard');expect(travelled.manualMove).toBeNull()
  cancelManualMove(c.world);expect(c.snapshot().manualMove).toBeNull();expect(c.world.actor.destination).toBeNull()
})
it('keeps seven residents separated through movement and bounded obstacle replanning',()=>{
  const c=new LivingController(createLivingWorld(scene),scene,()=>{})
  for(const id of ['claude','gemini','gpt','grok','kimi','qwen'])c.setCharacterPresent(id,true)
  let w=switchRegion(c.world,scene,'bookhouse');w=requestManualMove(w,scene,{x:300,y:300})
  for(let i=0;i<1800;i++){stepLiving(w,scene);expect(actors(w).every(a=>available(w,a.position,a.id)&&walkable(regionScene(w,scene),a.position))).toBe(true);if(i%90===0)w=validateLivingWorld(w,scene)}
  expect(w.manualMove).toBeNull()
})
it('waits and retries at most three times when a new resident blocks the destination, then explains failure',()=>{
  const roster=new LivingController(createLivingWorld(scene),scene,()=>{});roster.setCharacterPresent('claude',true)
  const w=requestManualMove(switchRegion(roster.world,scene,'bookhouse'),scene,{x:300,y:300})
  Object.assign(w.companions[0]!,{position:{x:300,y:300},safe:{x:300,y:300},behavior:'idle',remaining:60,destination:null,intent:null})
  const c=new LivingController(validateLivingWorld(w,scene),scene,()=>{})
  let ticks=0,maxReplans=0
  while(c.world.manualMove&&ticks++<1800){maxReplans=Math.max(maxReplans,c.world.manualMove.replans);c.advance(1/30);expect(actors(c.world).every(a=>available(c.world,a.position,a.id))).toBe(true)}
  expect(maxReplans).toBe(3);expect(c.moveOutcome).toBe('blocked');expect(c.world.manualMove).toBeNull();expect(c.world.actor.position).not.toEqual({x:300,y:300});expect(c.world.actor.behavior).toBe('idle')
})
it('migrates frozen schema12 without mutating it, rejects forged intent and freezes the old writer',()=>{
  const old=createV12(scene),raw=JSON.stringify(old),next=migrateLivingWorld(old,scene)
  expect(next.schemaVersion).toBe(15);expect(next.manualMove).toBeNull();expect(JSON.stringify(old)).toBe(raw);expect(()=>codecV12(scene).validate(next)).toThrow()
  const moving=requestManualMove(book(),scene,{x:180,y:300})
  for(const mutate of [(w:typeof moving)=>{w.manualMove!.route=[]},(w:typeof moving)=>{w.manualMove!.expires=w.ticks},(w:typeof moving)=>{w.manualMove!.replans=4},(w:typeof moving)=>{w.manualMove!.route[0]={x:100,y:345}},(w:typeof moving)=>{(w.manualMove as any).extra=true}]){const bad=structuredClone(moving);mutate(bad);expect(()=>validateLivingWorld(bad,scene)).toThrow()}
  expect(validUIInput({kind:'ground-move',point:{x:180,y:300}})).toBe(true);expect(validUIInput({kind:'ground-move',point:{x:NaN,y:300}})).toBe(false);expect(validUIInput({kind:'cancel-move',extra:true})).toBe(false)
})
it('protects schema12 original snapshot bytes beyond ordinary retention after the first schema13 save',async()=>{
 const root=await mkdtemp(join(tmpdir(),'village-move-v13-')),legacy=await SaveStore.open(root,scene,codecV12(scene))
 await legacy.save(0,createV12(scene),crypto.randomUUID())
 const pointer=await readFile(join(legacy.directory,'current.json'),'utf8'),file=JSON.parse(pointer).snapshot,bytes=await readFile(join(legacy.directory,'snapshots',file))
 const store=await SaveStore.open(root,scene,livingWorldCodec(scene));let saved=(await store.read())!
 for(let i=0;i<42;i++)saved=await store.save(saved.revision,saved.world,crypto.randomUUID())
 expect(saved.world.schemaVersion).toBe(15);expect(await readFile(join(legacy.directory,'snapshots',file))).toEqual(bytes)
 const refs=(await readdir(legacy.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(refs.map(n=>readFile(join(legacy.directory,n),'utf8')))).toContain(pointer)
})

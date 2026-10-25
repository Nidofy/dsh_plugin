import { expect,it } from 'vitest'
import { mkdtemp,readFile,readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { teaSquareFixture } from './tea-square.fixture.ts'
import { scene } from '../src/definitions.ts'
import { actors,available,walkable } from '../src/core/world.ts'
import { teaSquareClosing,teaSquareScene } from '../src/core/tea-square-scene.ts'
import { startTeaSquareStory,actTeaSquareStory,cancelTeaSquareStory,startTeaSquareActivity,cancelTeaSquareActivity,placeTeaSquareKeepsake } from '../src/core/tea-square-engine.ts'
import { teaSquareToken,teaSquareOrder } from '../src/core/tea-square-state.ts'
import { validateLivingWorld,migrateLivingWorld,livingWorldCodec,type LivingWorld } from '../src/core/living-state.ts'
import { createLivingWorld as create13,livingWorldCodec as codec13 } from '../src/core/living-state-v13.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { requestManualMove } from '../src/core/manual-move.ts'
import { collectionFacts } from '../src/core/collection-catalog.ts'
import { relationshipFacts } from '../src/core/relationship-catalog.ts'
import { deriveNotices } from '../src/core/notifications.ts'
import { SaveStore } from '../src/host/save-store.ts'
const cast=['bluewhale','claude','gemini'] as const
function ready(w:LivingWorld){for(let i=0;i<2500&&w.teaSquare.active?.phase!=='ready';i++){const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene);actors(w).forEach((a,j)=>{expect(available(w,a.position,a.id)).toBe(true);expect(Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)).toBeLessThanOrEqual(17/30+1e-6)});if(i%120===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)}expect(w.teaSquare.active?.phase).toBe('ready');return w}
function complete(w:LivingWorld){w=ready(w);w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'continue');w=ready(w);for(let slot=0;slot<3;slot++){const e=w.teaSquare.active!;w=actTeaSquareStory(w,scene,teaSquareToken(e),'place',`${teaSquareOrder(e.seed)[slot]}:${slot}`)}return actTeaSquareStory(ready(w),scene,teaSquareToken(w.teaSquare.active!),'remember')}
it('runs a seven-body three-person route and puzzle, rejects stale reorder tokens, records one fact and preserves first cast on replay',()=>{
 let w=startTeaSquareStory(teaSquareFixture(true),scene,[...cast],crypto.randomUUID()),outsiders=actors(w).filter(a=>!cast.includes(a.id as any)).map(a=>({id:a.id,position:{...a.position}}))
 expect(()=>actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'continue')).toThrow('PLAY_NOT_READY')
 w=ready(w);w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'continue');w=ready(w)
 const token=teaSquareToken(w.teaSquare.active!),wrong=(teaSquareOrder(w.teaSquare.active!.seed)[0]!+1)%3
 w=actTeaSquareStory(w,scene,token,'place',`${wrong}:0`);expect(w.teaSquare.active!.stage).toBe(1);expect(()=>actTeaSquareStory(w,scene,token,'reset')).toThrow('STALE_PLAY_ACTION')
 w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'reset');expect(w.teaSquare.active!.board).toEqual([-1,-1,-1])
 for(let slot=0;slot<3;slot++){const e=w.teaSquare.active!;w=actTeaSquareStory(w,scene,teaSquareToken(e),'place',`${teaSquareOrder(e.seed)[slot]}:${slot}`)}
 expect(w.teaSquare.active!.stage).toBe(2);expect(w.teaSquare.memory).toBeNull();w=ready(w);const done=teaSquareToken(w.teaSquare.active!);w=actTeaSquareStory(w,scene,done,'remember');expect(()=>actTeaSquareStory(w,scene,done,'remember')).toThrow('STALE_PLAY_ACTION')
 const first=structuredClone(w.teaSquare.memory);expect(first?.participants).toEqual(cast);expect(w.teaSquare.keepsake).toBe('message-tree')
 for(const a of outsiders)expect(actors(w).find(b=>b.id===a.id)!.position).toEqual(a.position)
 expect(deriveNotices(w).filter(n=>n.story==='tea-square-three-cups')).toHaveLength(1);expect(relationshipFacts(w).pairs.filter(p=>p.sources.some(s=>s.id==='tea-square-three-cups'))).toHaveLength(3)
 expect(collectionFacts(w,null).categories.find(c=>c.id==='group')!.items.some(i=>i.id==='tea-square-three-cups')).toBe(true);expect(collectionFacts(w,null).goals.find(g=>g.id==='shared-pairs')!.count).toBe(3)
 w=placeTeaSquareKeepsake(w,scene,null);w=complete(startTeaSquareStory(w,scene,[...cast],crypto.randomUUID()));expect(w.teaSquare.memory).toEqual({...first,count:2});expect(w.teaSquare.keepsake).toBeNull()
 expect(switchRegion(w,scene,'courtyard').teaSquare.memory).toEqual(w.teaSquare.memory)
})
it('opens approved production tea travel, guards active story against movement and travel, cancellation grants nothing',()=>{
 expect(switchRegion(migrateLivingWorld(create13(scene),scene),scene,'tea-square').region.active).toBe('tea-square')
 const w=startTeaSquareStory(teaSquareFixture(),scene,[...cast],crypto.randomUUID())
 expect(()=>switchRegion(w,scene,'courtyard')).toThrow('EVENT_ACTIVE');expect(()=>requestManualMove(w,scene,{x:220,y:420})).toThrow('EVENT_ACTIVE');expect(()=>startTeaSquareActivity(w,scene)).toThrow('EVENT_ACTIVE')
 cancelTeaSquareStory(w);expect(w.teaSquare.memory).toBeNull();expect(w.teaSquare.keepsake).toBeNull();expect(validateLivingWorld(w,scene)).toEqual(w)
})
it('pauses and cold-resumes exact routes; rejects forged seats, paths, board, token, memory and region returns',()=>{
 const w=startTeaSquareStory(teaSquareFixture(),scene,[...cast],crypto.randomUUID()),controller=new LivingController(w,scene,()=>{})
 controller.pause('hidden',true);const frozen=JSON.stringify(w);controller.advance(.1);expect(JSON.stringify(w)).toBe(frozen);controller.pause('hidden',false)
 for(let i=0;i<90;i++)stepLiving(w,scene);const restored=migrateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
 for(let i=0;i<90;i++){stepLiving(w,scene);stepLiving(restored,scene)}expect(restored).toEqual(w)
 for(const change of [(v:any)=>v.teaSquare.extra=1,(v:any)=>v.teaSquare.active.phase='ready',(v:any)=>v.teaSquare.active.serial=-1,(v:any)=>v.teaSquare.active.board=[0,0,-1],(v:any)=>v.teaSquare.active.targets[0]={x:50,y:430},(v:any)=>v.teaSquare.active.routes[0].push({x:180,y:310}),(v:any)=>v.teaSquare.active.seed=0,(v:any)=>v.teaSquare.keepsake='message-tree',(v:any)=>v.region.returns.courtyard=[]]){const bad=structuredClone(w);change(bad);expect(()=>validateLivingWorld(bad,scene)).toThrow()}
})
it('ordinary tea chooses at counter then reaches a free seat, stays bounded and never awards a story',()=>{
 let w=startTeaSquareActivity(teaSquareFixture(),scene),stages=new Set<string>()
 for(let i=0;i<2500&&w.teaSquare.activity;i++){stages.add(w.teaSquare.activity.stage);stepLiving(w,scene);if(w.teaSquare.activity?.stage==='waiting'){expect(w.actor.behavior).toBe('sit');expect(w.actor.intent).toMatchObject({furnitureId:'tea-table',activity:'sit',stage:'use'});w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)}else if(i%90===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)}
 expect([...stages]).toEqual(['counter','choosing','seat','waiting']);expect(w.teaSquare.activity).toBeNull();expect(w.teaSquare.memory).toBeNull()
 w=startTeaSquareActivity(teaSquareFixture(),scene);cancelTeaSquareActivity(w);expect(w.actor.destination).toBeNull();expect(validateLivingWorld(w,scene).teaSquare.activity).toBeNull()
})
it('retains legacy world14 idle waiting checkpoints and rejects forged seated activity slots',()=>{
 let w=startTeaSquareActivity(teaSquareFixture(),scene)
 for(let i=0;i<2400&&w.teaSquare.activity?.stage!=='waiting';i++)stepLiving(w,scene)
 expect(w.teaSquare.activity?.stage).toBe('waiting');expect(w.actor.behavior).toBe('sit')
 const seated=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene),bad=structuredClone(seated)
 bad.teaSquare.activity!.seat=(bad.teaSquare.activity!.seat+1)%3
 expect(()=>validateLivingWorld(bad,scene)).toThrow()
 const legacy=structuredClone(seated);legacy.actor.behavior='idle';legacy.actor.intent=null
 expect(migrateLivingWorld(legacy,scene)).toEqual(legacy)
 cancelTeaSquareActivity(seated);expect(seated.actor.behavior).toBe('idle');expect(seated.actor.intent).toBeNull()
})
it('advances the ordinary tea resident animation with its real route and freezes both under pause',()=>{
 const w=startTeaSquareActivity(teaSquareFixture(),scene),before=structuredClone(w.actor)
 for(let i=0;i<30;i++)stepLiving(w,scene)
 expect(w.actor.behavior).toBe('walk');expect(w.actor.phase-before.phase).toBeCloseTo(1)
 expect(Math.hypot(w.actor.position.x-before.position.x,w.actor.position.y-before.position.y)).toBeCloseTo(17)
 w.userPaused=true;const paused=JSON.stringify(w)
 for(let i=0;i<30;i++)stepLiving(w,scene)
 expect(JSON.stringify(w)).toBe(paused);w.userPaused=false
 for(let i=0;i<2400&&w.teaSquare.activity?.stage!=='waiting';i++)stepLiving(w,scene)
 expect(w.actor.behavior).toBe('sit');const seated=structuredClone(w.actor)
 for(let i=0;i<30;i++)stepLiving(w,scene)
 expect(w.actor.position).toEqual(seated.position);expect(w.actor.phase-seated.phase).toBeCloseTo(1)
 expect(validateLivingWorld(w,scene)).toEqual(w)
})
it('round-trips seven residents through approved tea travel and preserves both parked regions through cold decode',()=>{
 const tea=teaSquareFixture(true),courtyard=switchRegion(tea,scene,'courtyard'),book=switchRegion(courtyard,scene,'bookhouse')
 const via=switchRegion(book,scene,'courtyard');via.userPaused=true
 const before=JSON.stringify(via),next=switchRegion(via,scene,'tea-square'),feet=actors(tea).map(a=>a.position)
 expect(JSON.stringify(via)).toBe(before);expect(next.worldId).toBe(via.worldId);expect(next.ticks).toBe(via.ticks);expect(next.rng).toBe(via.rng);expect(next.userPaused).toBe(true)
 expect(actors(next).map(a=>a.position)).toEqual(feet);expect(actors(next).every(a=>available(next,a.position,a.id))).toBe(true)
 expect(next.region.returns.bookhouse).toEqual(via.region.returns.bookhouse)
 const cold=migrateLivingWorld(JSON.parse(JSON.stringify(next)),scene);expect(cold).toEqual(next)
 const back=switchRegion(cold,scene,'courtyard');expect(actors(back).map(a=>a.position)).toEqual(actors(via).map(a=>a.position))
 expect(switchRegion(back,scene,'bookhouse').actor.position).toEqual(book.actor.position)
 expect(next.teaSquare.memory).toBeNull()
})
it('migrates frozen world13 including manual intent without mutation and protects original bytes across 42 saves',async()=>{
 const current=requestManualMove(switchRegion(migrateLivingWorld(create13(scene),scene),scene,'bookhouse'),scene,{x:300,y:310})
 const {teaSquare:_teaSquare,region,...rest}=current
 const old=codec13(scene).validate({...rest,schemaVersion:13,contentRevision:9,region:{version:1,active:region.active,returns:{courtyard:region.returns.courtyard,bookhouse:region.returns.bookhouse}}}),original=JSON.stringify(old),root=await mkdtemp(join(tmpdir(),'tea-square-v13-')),store=await SaveStore.open(root,scene,codec13(scene))
 await store.save(0,old,crypto.randomUUID());const pointer=await readFile(join(store.directory,'current.json'),'utf8'),name=JSON.parse(pointer).snapshot,bytes=await readFile(join(store.directory,'snapshots',name))
 const upgraded=await SaveStore.open(root,scene,livingWorldCodec(scene));let saved=(await upgraded.read())!;expect(saved.world.schemaVersion).toBe(14);expect(saved.world.region.version).toBe(2);expect(saved.world.actor).toEqual(old.actor);expect(saved.world.manualMove).toEqual(old.manualMove);expect(saved.world.region.returns.courtyard).toEqual(old.region.returns.courtyard);expect(saved.world.worldId).toBe(old.worldId);expect(JSON.stringify(old)).toBe(original)
 for(let i=0;i<42;i++)saved=await upgraded.save(saved.revision,saved.world,crypto.randomUUID())
 expect(await readFile(join(store.directory,'snapshots',name))).toEqual(bytes);const refs=(await readdir(store.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(refs.map(n=>readFile(join(store.directory,n),'utf8')))).toContain(pointer)
 expect(()=>codec13(scene).decode(saved.world)).toThrow();expect(()=>livingWorldCodec(scene).decode({...old,teaSquare:{}})).toThrow()
})
it('abandons a dynamically blocked route within its budget with feedback and no reward, without moving any body through the blocker',()=>{
 let w=startTeaSquareStory(teaSquareFixture(true),scene,[...cast],crypto.randomUUID())
 const blocker=actors(w).find(a=>a.id==='gpt')!;blocker.position={...w.teaSquare.active!.targets[0]!};blocker.safe={...blocker.position}
 w=validateLivingWorld(w,scene);let outcome:unknown
 for(let i=0;i<2400&&w.teaSquare.active;i++){outcome=stepLiving(w,scene);expect(actors(w).every(a=>available(w,a.position,a.id))).toBe(true)}
 expect(outcome).toBe('blocked');expect(w.teaSquare.active).toBeNull();expect(w.teaSquare.memory).toBeNull();expect(validateLivingWorld(w,scene)).toEqual(w)
})
it('keeps the first actual three-person provenance when a different cast replays and never turns replay totals into pair counts',()=>{
 let w=complete(startTeaSquareStory(teaSquareFixture(true),scene,[...cast],crypto.randomUUID())),first=structuredClone(w.teaSquare.memory)
 w=complete(startTeaSquareStory(w,scene,['bluewhale','gpt','grok'],crypto.randomUUID()))
 expect(w.teaSquare.memory).toEqual({...first,count:2})
 const facts=relationshipFacts(w).pairs.filter(p=>p.sources.some(s=>s.id==='tea-square-three-cups'))
 expect(facts).toHaveLength(3);expect(facts.every(p=>p.pair.every(id=>first!.participants.includes(id))&&p.sharedCount===null)).toBe(true)
})
it('finishes all 35 seven-resident casts consecutively without displacing bystanders or exhausting closing feet',()=>{
 let w=teaSquareFixture(true)
 const ids=actors(w).map(a=>a.id).sort(),casts:typeof ids[]=[]
 for(let i=0;i<5;i++)for(let j=i+1;j<6;j++)for(let k=j+1;k<7;k++)casts.push([ids[i]!,ids[j]!,ids[k]!])
 expect(casts.slice(0,4)).toEqual([['bluewhale','claude','gemini'],['bluewhale','claude','gpt'],['bluewhale','claude','grok'],['bluewhale','claude','kimi']])
 expect(teaSquareClosing.slice(0,5)).toEqual([{x:54,y:348},{x:304,y:258},{x:262,y:380},{x:306,y:348},{x:98,y:380}])
 for(const [i,p] of teaSquareClosing.entries()){
  expect(walkable(teaSquareScene,p)).toBe(true)
  for(const q of teaSquareClosing.slice(i+1))expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeGreaterThanOrEqual(24)
 }
 const settle=(members:typeof ids)=>{
  let ticks=0
  while(w.teaSquare.active?.phase!=='ready'&&ticks++<2500){
   const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene)
   for(const [index,actor] of actors(w).entries()){
    const distance=Math.hypot(actor.position.x-before[index]!.x,actor.position.y-before[index]!.y)
    if(!available(w,actor.position,actor.id)||distance>17/30+1e-6||!members.includes(actor.id)&&distance!==0)throw Error('Unsafe replay movement')
   }
  }
  expect(w.teaSquare.active?.phase).toBe('ready')
  w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
 }
 let first:LivingWorld['teaSquare']['memory']=null
 for(const members of casts){
  const outsiders=actors(w).filter(a=>!members.includes(a.id)).map(a=>({id:a.id,position:{...a.position}}))
  w=startTeaSquareStory(w,scene,members,crypto.randomUUID());settle(members)
  w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'continue');settle(members)
  for(let slot=0;slot<3;slot++)w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'place',`${teaSquareOrder(w.teaSquare.active!.seed)[slot]}:${slot}`)
  settle(members);expect(w.teaSquare.memory).toEqual(first?{...first,count:casts.indexOf(members)}:null)
  w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'remember');first??=structuredClone(w.teaSquare.memory)
  for(const outsider of outsiders)expect(actors(w).find(a=>a.id===outsider.id)!.position).toEqual(outsider.position)
 }
 expect(w.teaSquare.memory).toEqual({...first,count:35});expect(w.teaSquare.active).toBeNull()
},15000)

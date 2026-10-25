import { legacyCharacterIds } from '../src/core/roster-policy.ts'
import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, validateLivingWorld, migrateLivingWorld, livingWorldCodec } from '../src/core/living-state.ts'
import { createLivingWorld as createV10, livingWorldCodec as codecV10 } from '../src/core/living-state-v10.ts'
import { createLivingWorld as createV9, livingWorldCodec as codecV9 } from '../src/core/living-state-v9.ts'
import { createHomeWorld, homeWorldCodec } from '../src/core/home-state.ts'
import { createNeighborhoodWorld, neighborhoodWorldCodec } from '../src/core/neighborhood-state.ts'
import { createContentWorld, validateContentWorld } from '../src/core/content-state.ts'
import { createWorld, validateWorld, actors, available } from '../src/core/world.ts'
import { legacySceneV1 } from '../src/core/migrations.ts'
import { switchRegion, bookhouseActivity } from '../src/core/region-engine.ts'
import { startBookhouseStory, bookhouseStoryAction, cancelBookhouseStory, placeBookhouseKeepsake } from '../src/core/bookhouse-engine.ts'
import { stepLiving, settleTea, startPlay, inviteTea } from '../src/core/living-engine.ts'
import { SaveStore } from '../src/host/save-store.ts'
function world(){const c=new LivingController(createLivingWorld(scene),scene,()=>{});c.setCharacterPresent('seedance',true);return switchRegion(c.world,scene,'bookhouse')}
function ready(w:ReturnType<typeof world>){for(let i=0;i<1900&&w.bookhouse.active?.phase!=='ready';i++){
 const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene)
 actors(w).forEach((a,j)=>{expect(available(w,a.position,a.id)).toBe(true);expect(Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)).toBeLessThanOrEqual(17/30+1e-6)})
 if(i%120===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
 w=settleTea(w,scene)??w
 }expect(w.bookhouse.active?.phase).toBe('ready');return w}
function action(w:ReturnType<typeof world>){const e=w.bookhouse.active!;return bookhouseStoryAction(w,scene,`${e.id}:${e.stage}`,e.stage===0?'light':undefined)}
it('walks all three real places, records first companions atomically, travels with the keepsake and replays without replacing first facts',()=>{
 let w=startBookhouseStory(world(),scene,'seedance',crypto.randomUUID());const feet=actors(w).map(a=>a.position)
 for(let i=0;i<3;i++)w=action(ready(w))
 expect(w.bookhouse.active).toBeNull();expect(w.bookhouse.memory?.count).toBe(1);expect(w.bookhouse.keepsake).toBe('bookhouse');expect(w.neighborhood.bonds).toEqual([{pair:['bluewhale','seedance'],count:1,lastTick:w.ticks}]);expect(actors(w).map(a=>a.position)).not.toEqual(feet)
 const first=structuredClone(w.bookhouse.memory),courtyard=placeBookhouseKeepsake(switchRegion(w,scene,'courtyard'),scene,'courtyard')
 expect(courtyard.bookhouse.memory).toEqual(first);expect(courtyard.bookhouse.keepsake).toBe('courtyard')
 w=startBookhouseStory(switchRegion(courtyard,scene,'bookhouse'),scene,'seedance',crypto.randomUUID());for(let i=0;i<3;i++)w=action(ready(w))
 expect(w.neighborhood.bonds[0]?.count).toBe(2);expect(w.bookhouse.memory).toEqual({...first,count:2});expect(w.bookhouse.keepsake).toBe('courtyard')
})
it('rejects cross-region travel, ordinary activity, courtyard story and stale double actions while a reading is active',()=>{
 const w=startBookhouseStory(world(),scene,'seedance',crypto.randomUUID())
 expect(()=>switchRegion(w,scene,'courtyard')).toThrow('EVENT_ACTIVE');expect(()=>bookhouseActivity(w,scene,'bookcase')).toThrow('EVENT_ACTIVE')
 expect(()=>startPlay(w,scene,'find-whale',['bluewhale'],crypto.randomUUID())).toThrow('COURTYARD_REQUIRED')
 const r=ready(w),old=`${r.bookhouse.active!.id}:0`,next=bookhouseStoryAction(r,scene,old,'wind')
 expect(()=>bookhouseStoryAction(next,scene,old,'wind')).toThrow('STALE_PLAY_ACTION')
 cancelBookhouseStory(next);expect(next.bookhouse.memory).toBeNull();expect(validateLivingWorld(next,scene).bookhouse.keepsake).toBeNull()
})
it('validates closed bounded story, actual path, phase, identities, and reward provenance',()=>{
 const w=startBookhouseStory(world(),scene,'seedance',crypto.randomUUID())
 for(const mutate of [(v:any)=>v.bookhouse.extra=1,(v:any)=>v.bookhouse.active.stage=3,(v:any)=>v.bookhouse.active.routes[0].push({x:0,y:0}),(v:any)=>v.bookhouse.active.participants[1]='glm',(v:any)=>v.bookhouse.keepsake='courtyard',(v:any)=>v.bookhouse.active.phase='ready',(v:any)=>v.bookhouse.active.remainingTicks=91,(v:any)=>v.bookhouse.active.theme='wind']){
 const bad=structuredClone(w);mutate(bad);expect(()=>validateLivingWorld(bad,scene)).toThrow()
 }
})
it('pause freezes the story; cold continuation equals uninterrupted simulation',()=>{
 const w=startBookhouseStory(world(),scene,'seedance',crypto.randomUUID()),c=new LivingController(w,scene,()=>{});c.pause('hidden',true);const raw=JSON.stringify(c.world);c.advance(.1);expect(JSON.stringify(c.world)).toBe(raw);c.pause('hidden',false)
 for(let i=0;i<100;i++)stepLiving(w,scene)
 const recovered=migrateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
 for(let i=0;i<100;i++){stepLiving(w,scene);stepLiving(recovered,scene)}expect(recovered).toEqual(w)
})
it('twelve selectable residents retain a strict seven simultaneous limit and support old tea with new participants',()=>{
 const c=new LivingController(createLivingWorld(scene),scene,()=>{});for(const id of ['claude','gemini','gpt','grok','kimi','seedance','glm','minimax'])c.setCharacterPresent(id,true)
 expect(actors(c.world)).toHaveLength(7);c.setCharacterPresent('claude',false);c.setCharacterPresent('glm',true);expect(actors(c.world).some(a=>a.id==='glm')).toBe(true)
 const duo=new LivingController(createLivingWorld(scene),scene,()=>{});duo.setCharacterPresent('glm',true)
 const invited=inviteTea(duo.world,scene,['bluewhale','glm'],'tea',crypto.randomUUID());expect(validateLivingWorld(invited,scene).activeEvent?.participants).toEqual(['bluewhale','glm'])
})
it('legacy decoders reject new IDs even in history-only fields; mixed validation never leaks policy',()=>{
 const old=createV10(scene),current=createLivingWorld(scene)
 const bad=structuredClone(old);bad.neighborhood.bonds=[{pair:['bluewhale','seedance'],count:1,lastTick:0}]
 expect(()=>codecV10(scene).decode(bad)).toThrow();const bad9=createV9(scene);bad9.neighborhood.bonds=bad.neighborhood.bonds;expect(()=>codecV9(scene).decode(bad9)).toThrow()
 for(const [raw,validate] of [[createWorld(legacySceneV1),(v:unknown)=>validateWorld(v,legacySceneV1)],[createContentWorld(scene),(v:unknown)=>validateContentWorld(v,scene)],[createNeighborhoodWorld(scene),(v:unknown)=>neighborhoodWorldCodec(scene).decode(v)],[createHomeWorld(scene),(v:unknown)=>homeWorldCodec(scene).decode(v)]] as const){const data=structuredClone(raw);data.actor.id='seedance';expect(()=>validate(data)).toThrow()}
 expect(validateLivingWorld(current,scene)).toEqual(current);expect(codecV10(scene).decode(old)).toEqual(old)
 expect(()=>codecV10(scene).decode({...current,schemaVersion:10,contentRevision:7})).toThrow()
})
it('upgrades v10 without data loss and protects original bytes after forty-two saves',async()=>{
 const old=createV10(scene);old.home.accessories.claude='ribbon';const original=JSON.stringify(old),root=await mkdtemp(join(tmpdir(),'bookhouse-story-'))
 const store=await SaveStore.open(root,scene,codecV10(scene));await store.save(0,old,crypto.randomUUID());const pointer=await readFile(join(store.directory,'current.json'),'utf8'),name=JSON.parse(pointer).snapshot,bytes=await readFile(join(store.directory,'snapshots',name))
 const upgraded=await SaveStore.open(root,scene,livingWorldCodec(scene));let saved=(await upgraded.read())!
 expect(saved.world.home.accessories.claude).toBe('ribbon');expect(saved.world.home.accessories.seedance).toBe('none');expect(saved.world.actor).toEqual(old.actor);expect(JSON.stringify(old)).toBe(original)
 for(let i=0;i<42;i++)saved=await upgraded.save(saved.revision,saved.world,crypto.randomUUID())
 expect(await readFile(join(store.directory,'snapshots',name))).toEqual(bytes);const refs=(await readdir(store.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(refs.map(n=>readFile(join(store.directory,n),'utf8')))).toContain(pointer)
})

it('completes shared reading with seven present bodies without collisions or moving outsiders',()=>{
 const c=new LivingController(createLivingWorld(scene),scene,()=>{});for(const id of ['claude','gemini','gpt','grok','kimi','seedance'])c.setCharacterPresent(id,true)
 let w=startBookhouseStory(switchRegion(c.world,scene,'bookhouse'),scene,'seedance',crypto.randomUUID())
 const outsiders=actors(w).filter(a=>!w.bookhouse.active!.participants.includes(a.id)).map(a=>({id:a.id,position:a.position}))
 for(let stage=0;stage<3;stage++)w=action(ready(w))
 expect(w.bookhouse.memory?.count).toBe(1);expect(actors(w)).toHaveLength(7);for(const a of outsiders)expect(actors(w).find(b=>b.id===a.id)?.position).toEqual(a.position)
})
it('migrates v10 in-flight courtyard play and bookhouse ordinary activity without changing paths or shared facts',()=>{
 const c=new LivingController(createLivingWorld(scene),scene,()=>{});c.setCharacterPresent('claude',true)
 const worlds=[startPlay(c.world,scene,'find-whale',['bluewhale'],crypto.randomUUID()),bookhouseActivity(switchRegion(c.world,scene,'bookhouse'),scene,'bookcase')]
 for(const w of worlds){const {teaSquare:_teaSquare,manualMove:_manualMove,bookhouse:_b,region,...old}=structuredClone(w);const prior={...old,region:{version:1,active:region.active,returns:{courtyard:region.returns.courtyard,bookhouse:region.returns.bookhouse}},schemaVersion:10,contentRevision:7,home:{...old.home,accessories:Object.fromEntries(legacyCharacterIds.map(id=>[id,old.home.accessories[id]]))}};const checked=codecV10(scene).validate(prior),raw=JSON.stringify(checked),next=migrateLivingWorld(checked,scene)
 expect(next.actor).toEqual(checked.actor);expect(next.companions).toEqual(checked.companions);expect(next.play).toEqual(checked.play);expect(next.region).toEqual({...checked.region,version:2,returns:{...checked.region.returns,'tea-square':null}});expect(next.ticks).toBe(checked.ticks);expect(next.rng).toBe(checked.rng);expect(JSON.stringify(checked)).toBe(raw)
 }
})
it('rejects a bookhouse completion identity reused by an active courtyard event',()=>{
 let w=startBookhouseStory(world(),scene,'seedance',crypto.randomUUID());for(let stage=0;stage<3;stage++)w=action(ready(w))
 w=switchRegion(w,scene,'courtyard');expect(()=>inviteTea(w,scene,['bluewhale','seedance'],'tea',w.bookhouse.memory!.eventId)).toThrow()
})

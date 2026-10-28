import { currentEncounter, encounterWindow, encounterPeriod } from '../src/core/encounter.ts'
import { validUIInput } from '../src/core/frame-protocol.ts'
import { createWorld } from '../src/core/world.ts'
import { legacySceneV1 } from '../src/core/migrations.ts'
import { createContentWorld } from '../src/core/content-state.ts'
import { createNeighborhoodWorld } from '../src/core/neighborhood-state.ts'
import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, validateLivingWorld, migrateLivingWorld, livingWorldCodec, homeProjection, type LivingWorld } from '../src/core/living-state.ts'
import { createHomeWorld, homeWorldCodec } from '../src/core/home-state.ts'
import { playAction, startPlay, stepLiving, settleTea, cancelPlay, placePlayDecoration, whalePlace, inviteTea, setTableMode } from '../src/core/living-engine.ts'
import { playDefinitions } from '../src/core/play-catalog.ts'
import { actors, available } from '../src/core/world.ts'
import { SaveStore } from '../src/host/save-store.ts'
function world(count=2){const c=new LivingController(createLivingWorld(scene),scene,()=>{});if(count>=2)c.setCharacterPresent('claude',true);if(count>=3)c.setCharacterPresent('gemini',true);return c.world}
function ready(w:LivingWorld){
  for(let i=0;i<1805&&w.play.active?.phase!=='ready';i++){
    const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene)
    actors(w).forEach((a,j)=>{expect(available(w,a.position,a.id)).toBe(true);expect(Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)).toBeLessThanOrEqual(17/30+1e-6)})
    if(i%120===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
    w=settleTea(w,scene)??w
    if(!w.play.active)throw Error('APPROACH_CANCELLED')
  }
  expect(w.play.active?.phase).toBe('ready');return w
}
function act(w:LivingWorld,action:string,value?:string){return playAction(w,scene,action,value,w.play.active!.definitionId==='table-game'?`${w.play.active!.id}:${w.play.active!.stage}:${w.play.active!.choices.length}`:`${w.play.active!.id}:${w.play.active!.stage}`)}
function offer(w:LivingWorld,id:string){
  if(playDefinitions.find(d=>d.id===id)?.kind!=='event')return undefined
  for(let i=Math.floor(w.ticks/encounterPeriod);i<Math.floor(w.ticks/encounterPeriod)+4;i++){
    const window=encounterWindow(i*encounterPeriod)
    if(window.definitionId===id&&window.index>w.play.encounterWindow&&window.startsTick>=w.play.nextTick){w.ticks=window.startsTick;return currentEncounter(w)!.token}
  }throw Error('NO_ENCOUNTER')
}
function finish(w:LivingWorld){
  while(w.play.active){w=ready(w);const e=w.play.active!,s=playDefinitions.find(d=>d.id===e.definitionId)!.stages[e.stage]!
    if(s.action==='move')w=act(w,'move',String(e.board.indexOf(-1)))
    else if(s.action==='find')w=act(w,'find',whalePlace(e))
    else if(s.action==='place'){w=act(w,'place','0:0');w=act(w,'place','1:1');w=act(w,'place','2:2')}
    else if(s.action==='choose'){w=act(w,'choose','rice');w=act(w,'choose','tea');w=act(w,'choose','fruit')}
    else w=act(w,s.action)
  }return w
}
it('plays all current definitions through movement, observation, input, shared memory and visible placement',()=>{
  for(const d of playDefinitions){let w=world(d.requiredParticipants?1:d.count);if(d.requiredParticipants){const c=new LivingController(w,scene,()=>{});for(const id of d.requiredParticipants)c.setCharacterPresent(id,true);w=c.snapshot()};if(d.id==='table-game')w=setTableMode(w,scene,'game');const rng=w.rng,token=offer(w,d.id);w=startPlay(w,scene,d.id,d.requiredParticipants?[...d.requiredParticipants]:actors(w).map(a=>a.id),crypto.randomUUID(),token);w=finish(w)
    expect(w.neighborhood.memories).toHaveLength(1);expect(w.neighborhood.memories[0]!.id).toBe(d.id);expect(w.rng).toBe(rng)
    if(d.reward){w=placePlayDecoration(w,scene,d.reward,'window');expect(w.play.decorations[d.reward]).toBe('window')}
    else expect(Object.values(w.play.decorations).every(v=>v===null)).toBe(true)
    if(d.introduction){w.ticks=w.play.nextTick;expect(()=>startPlay(w,scene,d.id,[d.introduction!],crypto.randomUUID())).toThrow('INTRODUCTION_COMPLETE');continue}
    const first=structuredClone(w.neighborhood.memories[0]);const copy=validateLivingWorld(w,scene);copy.neighborhood.memories[0]!.count++;expect(w.neighborhood.memories[0]).toEqual(first);w.ticks=w.play.nextTick
    const nextToken=offer(w,d.id);w=finish(startPlay(w,scene,d.id,d.requiredParticipants?[...d.requiredParticipants]:actors(w).map(a=>a.id),crypto.randomUUID(),nextToken))
    expect(w.neighborhood.memories[0]).toEqual({...first,count:2});if(d.reward)expect(w.play.decorations[d.reward]).toBe('window')
    if(d.count===3)expect(w.neighborhood.bonds).toHaveLength(3)
  }
})
it('cannot skip travel, double-complete, reuse a stale stage, forge fields or equip locked rewards',()=>{
  let w=startPlay(world(),scene,'lost-rice',['bluewhale','claude'],crypto.randomUUID());const token=`${w.play.active!.id}:0`
  expect(()=>playAction(w,scene,'talk',undefined,token)).toThrow('PLAY_NOT_READY');w=ready(w);w=act(w,'talk')
  expect(()=>playAction(w,scene,'search',undefined,token)).toThrow('STALE_PLAY_ACTION')
  expect(()=>validateLivingWorld({...w,unknown:1},scene)).toThrow();expect(()=>validateLivingWorld({...w,play:{...w.play,unknown:1}},scene)).toThrow()
  expect(()=>placePlayDecoration(w,scene,'rice-bowl','wall')).toThrow('DECORATION_LOCKED')
  w=finish(w);expect(()=>playAction(w,scene,'finish',undefined,token)).toThrow('STALE_PLAY_ACTION')
})
it('pauses exactly, cancels on participant departure, keeps committed facts and resumes identical cold checkpoints',()=>{
  const active=startPlay(world(),scene,'quiet-page',['bluewhale','claude'],crypto.randomUUID()),c=new LivingController(active,scene,()=>{})
  c.pause('hidden',true);c.pause('user',true);const before=c.snapshot();for(let i=0;i<100;i++)c.advance(.1);expect(c.snapshot()).toEqual(before)
  c.pause('hidden',false);c.advance(.1);expect(c.snapshot()).toEqual(before);c.pause('user',false)
  const twin=new LivingController(c.snapshot(),scene,()=>{});for(let i=0;i<60;i++){c.advance(.1);twin.advance(.1)}expect(c.snapshot()).toEqual(twin.snapshot())
  c.setCharacterPresent('claude',false);expect(c.world.play.active).toBeNull();expect(c.world.neighborhood.memories).toEqual([])
})
it('desk handles wrong placements/reset and hints are finite without granting a discovery',()=>{
  let w=ready(startPlay(world(1),scene,'tidy-desk',['bluewhale'],crypto.randomUUID()));w=act(w,'place','0:2');expect(w.play.active!.stage).toBe(0)
  w=act(w,'reset');expect(w.play.active!.board).toEqual([-1,-1,-1]);cancelPlay(w)
  w=ready(startPlay(w,scene,'find-whale',['bluewhale'],crypto.randomUUID()));w=act(w,'hint');w=act(w,'hint');expect(()=>act(w,'hint')).toThrow('HINT_LIMIT');expect(w.neighborhood.memories).toEqual([])
})
it('migrates v6 byte-preservingly, retains old activities, protects original disk bytes, and uses the same CAS owner',async()=>{
  const old=createHomeWorld(scene),raw=JSON.stringify(old),migrated=migrateLivingWorld(old,scene);expect(homeProjection(migrated)).toEqual({...old,home:{...old.home,accessories:migrated.home.accessories}});expect(migrated.home.accessories).toMatchObject(old.home.accessories);expect(JSON.stringify(old)).toBe(raw)
  const dir=await mkdtemp(join(tmpdir(),'village-living-')),v6=await SaveStore.open(dir,scene,homeWorldCodec(scene))
  await v6.save(0,old,crypto.randomUUID());const pointer=await readFile(join(v6.directory,'current.json'),'utf8')
  const store=await SaveStore.open(dir,scene,livingWorldCodec(scene));expect((await store.read())?.world.schemaVersion).toBe(15)
  const snapshot=JSON.parse(pointer).snapshot, bytes=await readFile(join(v6.directory,'snapshots',snapshot));let saved=await store.save(1,migrated,crypto.randomUUID());expect((await store.read())?.world).toEqual(migrated)
  for(let i=0;i<42;i++)saved=await store.save(saved.revision,saved.world,crypto.randomUUID())
  expect(await readFile(join(v6.directory,'snapshots',snapshot))).toEqual(bytes)
  const protectedName=(await readdir(v6.directory)).find(n=>n.startsWith('upgrade-v1-'))!;expect(await readFile(join(v6.directory,protectedName),'utf8')).toBe(pointer)
  await expect(store.save(1,migrated,crypto.randomUUID())).rejects.toThrow()
  expect(pointer).toContain('revision');expect(migrated.play.active).toBeNull()
  const tea=inviteTea(world(),scene,['bluewhale','claude'],'rice',crypto.randomUUID());expect(()=>startPlay(tea,scene,'quiet-page',['bluewhale','claude'],crypto.randomUUID())).toThrow('EVENT_ACTIVE')
})
it('runs seven residents deterministically with current social state and bounded snapshots',()=>{
  const c=new LivingController(createLivingWorld(scene),scene,()=>{});for(const id of ['claude','gemini','gpt','grok','kimi','qwen'] as const)c.setCharacterPresent(id,true)
  let a=c.snapshot(),b=c.snapshot()
  for(let i=0;i<18000;i++){stepLiving(a,scene);stepLiving(b,scene);if(i%900===0){a=validateLivingWorld(a,scene);b=validateLivingWorld(b,scene)}}
  expect(a).toEqual(b);expect(JSON.stringify(a).length).toBeLessThan(48*1024);expect(a.neighborhood.memories).toEqual([])
})

it('reads every historical schema 1–6 without mutating raw input, refusing future fields and forged play clicks',()=>{
 const v3=createWorld(legacySceneV1),v1={...v3,schemaVersion:1};delete (v1 as any).companions
 for(const old of [v1,{...v3,schemaVersion:2},v3,createContentWorld(scene),createNeighborhoodWorld(scene),createHomeWorld(scene)]){
  const raw=JSON.stringify(old),next=migrateLivingWorld(old,scene);expect(next.schemaVersion).toBe(15);expect(next.play.active).toBeNull();expect(JSON.stringify(old)).toBe(raw)
 }
 expect(()=>migrateLivingWorld({...createLivingWorld(scene),schemaVersion:16},scene)).toThrow()
 const token=crypto.randomUUID()+':0';expect(validUIInput({kind:'play-find',token,point:{x:100,y:200}})).toBe(true)
 for(const bad of [{kind:'play-find',token:'bad',point:{x:1,y:2}},{kind:'play-find',token,point:{x:NaN,y:2}},{kind:'play-find',token,point:{x:1,y:2},extra:true}])expect(validUIInput(bad)).toBe(false)
})

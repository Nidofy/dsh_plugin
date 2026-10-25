import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, livingWorldCodec, migrateLivingWorld, validateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { createLivingWorld as createV11, livingWorldCodec as codecV11 } from '../src/core/living-state-v11.ts'
import { startPlay, playAction, stepLiving, cancelPlay, settleTea } from '../src/core/living-engine.ts'
import { startBookhousePuzzle, startBookhouseStory, bookhouseStoryAction, cancelBookhouseStory } from '../src/core/bookhouse-engine.ts'
import { playDefinitions } from '../src/core/play-catalog.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { actors, available } from '../src/core/world.ts'
import { characterIds, type CharacterId } from '../src/core/roster.ts'
import { SaveStore } from '../src/host/save-store.ts'

function world(ids:CharacterId[]){const c=new LivingController(createLivingWorld(scene),scene,()=>{});for(const id of ids)c.setCharacterPresent(id,true);return c.snapshot()}
function ready(w:LivingWorld){for(let i=0;i<1900&&(w.play.active??w.bookhouse.active)?.phase!=='ready';i++){
 const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene)
 actors(w).forEach((a,j)=>{expect(available(w,a.position,a.id)).toBe(true);expect(Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)).toBeLessThanOrEqual(17/30+1e-6)})
 if(i%100===0)w=migrateLivingWorld(JSON.parse(JSON.stringify(w)),scene)
 w=settleTea(w,scene)??w
 }expect((w.play.active??w.bookhouse.active)?.phase).toBe('ready');return w}
function finish(w:LivingWorld){while(w.play.active){w=ready(w);const e=w.play.active!,s=playDefinitions.find(d=>d.id===e.definitionId)!.stages[e.stage]!;w=playAction(w,scene,s.action,undefined,`${e.id}:${e.stage}`)}return w}
function bookAction(w:LivingWorld,choice?:string){const e=w.bookhouse.active!;return bookhouseStoryAction(w,scene,`${e.id}:${e.stage}`,choice)}

it('five introductions use actual routes, persist exactly once, reject absent or wrong residents and cancel without rewards',()=>{
 for(const d of playDefinitions.filter(d=>d.introduction)){
  let w=world([d.introduction!]);expect(()=>startPlay(w,scene,d.id,['bluewhale'],crypto.randomUUID())).toThrow('INVALID_INVITATION')
  expect(()=>startPlay(world([]),scene,d.id,[d.introduction!],crypto.randomUUID())).toThrow('INVALID_INVITATION')
  w=startPlay(w,scene,d.id,[d.introduction!],crypto.randomUUID());const before=actors(w).find(a=>a.id===d.introduction)!.position
  const cancelled=structuredClone(w);cancelPlay(cancelled);expect(validateLivingWorld(cancelled,scene).neighborhood.memories).toEqual([])
  const c=new LivingController(w,scene,()=>{});c.pause('hidden',true);const checkpoint=c.snapshot();c.advance(.1);expect(c.snapshot()).toEqual(checkpoint)
  w=finish(w);expect(actors(w).find(a=>a.id===d.introduction)!.position).not.toEqual(before)
  expect(w.neighborhood.memories[0]).toMatchObject({id:d.id,participants:[d.introduction],count:1});expect(w.neighborhood.bonds).toEqual([])
  w=migrateLivingWorld(JSON.parse(JSON.stringify(w)),scene);w.ticks=w.play.nextTick
  expect(()=>startPlay(w,scene,d.id,[d.introduction!],crypto.randomUUID())).toThrow('INTRODUCTION_COMPLETE')
  const bad=structuredClone(w);bad.neighborhood.memories[0]!.count=2;expect(()=>validateLivingWorld(bad,scene)).toThrow()
 }
})

it('authored pairs enforce identity, preserve first memory on replay, and create no furniture reward',()=>{
 expect(playDefinitions.filter(d=>d.id.startsWith('pair-'))).toHaveLength(6)
 for(const d of playDefinitions.filter(d=>d.id.startsWith('pair-'))){
  let w=world([...d.requiredParticipants!]);expect(()=>startPlay(w,scene,d.id,['bluewhale','grok'],crypto.randomUUID())).toThrow('INVALID_INVITATION')
  w=finish(startPlay(w,scene,d.id,[...d.requiredParticipants!],crypto.randomUUID()));const first=structuredClone(w.neighborhood.memories[0]);w.ticks=w.play.nextTick
  w=finish(startPlay(w,scene,d.id,[...d.requiredParticipants!].reverse(),crypto.randomUUID()))
  expect(w.neighborhood.memories[0]).toEqual({...first,count:2});expect(w.neighborhood.bonds[0]!.count).toBe(2)
  expect(Object.values(w.play.decorations).every(v=>v===null)).toBe(true)
 }
})

it('bookhouse puzzle accepts rearranging and reset, resumes cold, and repeats without replacing first readers or granting bookmarks',()=>{
 let w=switchRegion(world(['glm','gemini']),scene,'bookhouse');w=startBookhousePuzzle(w,scene,'glm',crypto.randomUUID())
 const forged=structuredClone(w);forged.bookhouse.active!.board=[0,1,2];expect(()=>validateLivingWorld(forged,scene)).toThrow('INVALID_BOOKHOUSE_STORY')
 const cancelled=structuredClone(w);cancelBookhouseStory(cancelled);expect(cancelled.bookhouse.puzzleMemory).toBeNull()
 w=bookAction(ready(w));w=ready(w);w=bookAction(w,'0:2');expect(w.bookhouse.active!.stage).toBe(1)
 w=bookAction(w,'reset');expect(w.bookhouse.active!.board).toEqual([-1,-1,-1]);w=bookAction(w,'0:0')
 w=migrateLivingWorld(JSON.parse(JSON.stringify(w)),scene);w=bookAction(w,'1:1');w=bookAction(w,'2:2');w=bookAction(ready(w))
 expect(w.bookhouse.memory).toBeNull();expect(w.bookhouse.keepsake).toBeNull();const first=structuredClone(w.bookhouse.puzzleMemory)
 w=startBookhousePuzzle(w,scene,'gemini',crypto.randomUUID());w=bookAction(ready(w));w=ready(w)
 for(const value of ['0:0','1:1','2:2'])w=bookAction(w,value)
 w=bookAction(ready(w));expect(w.bookhouse.puzzleMemory).toEqual({...first,count:2});expect(w.neighborhood.bonds).toHaveLength(2)
 expect(()=>startBookhousePuzzle(w,scene,'glm',first!.eventId)).toThrow()
})

it('frozen schema11 rejects new content; upgrade preserves active reading and disk originals beyond retention',async()=>{
 const reading=startBookhouseStory(switchRegion(world(['glm']),scene,'bookhouse'),scene,'glm',crypto.randomUUID());for(let i=0;i<70;i++)stepLiving(reading,scene)
 const {kind:_kind,board:_board,...oldActive}=reading.bookhouse.active!;const {puzzleMemory:_puzzle,puzzleLastEventId:_last,...oldBook}=reading.bookhouse
 const {teaSquare:_teaSquare,region,manualMove:_manualMove,...v12Reading}=reading;const old=codecV11(scene).validate({...v12Reading,region:{version:1,active:region.active,returns:{courtyard:region.returns.courtyard,bookhouse:region.returns.bookhouse}},schemaVersion:11,contentRevision:8,bookhouse:{...oldBook,version:1,active:oldActive}}),raw=JSON.stringify(old);const upgraded=migrateLivingWorld(old,scene)
 expect(upgraded.schemaVersion).toBe(14);expect(upgraded.bookhouse).toMatchObject({version:2,puzzleMemory:null,puzzleLastEventId:null});expect(JSON.stringify(old)).toBe(raw);expect(upgraded.bookhouse.active).toEqual({...oldActive,kind:'reading',board:[-1,-1,-1]});expect(upgraded.actor).toEqual(old.actor);expect(upgraded.ticks).toBe(old.ticks);expect(upgraded.rng).toBe(old.rng)
 const fresh=finish(startPlay(world(['glm']),scene,'intro-glm',['glm'],crypto.randomUUID()))
 const forged={...fresh,schemaVersion:11,contentRevision:8,bookhouse:old.bookhouse};expect(()=>codecV11(scene).decode(forged)).toThrow()
 const dir=await mkdtemp(join(tmpdir(),'village-v011-'));const legacy=await SaveStore.open(dir,scene,codecV11(scene));await legacy.save(0,old,crypto.randomUUID())
 const pointer=await readFile(join(legacy.directory,'current.json'),'utf8'),file=JSON.parse(pointer).snapshot,bytes=await readFile(join(legacy.directory,'snapshots',file))
 const store=await SaveStore.open(dir,scene,livingWorldCodec(scene));let saved=(await store.read())!
 for(let i=0;i<42;i++)saved=await store.save(saved.revision,saved.world,crypto.randomUUID())
 expect(await readFile(join(legacy.directory,'snapshots',file))).toEqual(bytes)
 const refs=(await readdir(legacy.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(refs.map(n=>readFile(join(legacy.directory,n),'utf8')))).toContain(pointer)
})

it('all new facts and sixty-six bonds remain bounded by the unchanged 48 KiB budget',()=>{
 expect(playDefinitions).toHaveLength(21)
 const w=world([]);w.ticks=10000
 for(const d of playDefinitions)w.neighborhood.memories.push({id:d.id,eventId:crypto.randomUUID(),participants:d.requiredParticipants?[...d.requiredParticipants]:['bluewhale','claude','gemini'].slice(0,d.count) as CharacterId[],completedTick:100,count:1})
 w.play.lastEventId=w.neighborhood.memories.at(-1)!.eventId
 for(let i=0;i<characterIds.length;i++)for(let j=i+1;j<characterIds.length;j++)w.neighborhood.bonds.push({pair:[characterIds[i]!,characterIds[j]!].sort() as [CharacterId,CharacterId],count:1000000,lastTick:w.ticks})
 const checked=validateLivingWorld(w,scene);expect(checked.neighborhood.bonds).toHaveLength(66);expect(new TextEncoder().encode(JSON.stringify(checked)).length).toBeLessThan(48*1024)
 expect(()=>validateLivingWorld({...checked,overflow:'x'.repeat(48*1024)},scene)).toThrow('SAVE_TOO_LARGE')
})

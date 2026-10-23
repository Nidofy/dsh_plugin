import { expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { createLivingWorld, migrateLivingWorld, livingWorldCodec, validateLivingWorld } from '../src/core/living-state.ts'
import { createLivingWorld as createV8, livingWorldCodec as codecV8 } from '../src/core/living-state-v8.ts'
import { currentEncounter, dismissEncounter, encounterWindow, encounterPeriod } from '../src/core/encounter.ts'
import { startPlay, cancelPlay, stepLiving, setTableMode } from '../src/core/living-engine.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { SaveStore } from '../src/host/save-store.ts'

function offered() {
  const c=new LivingController(createLivingWorld(scene),scene,()=>{})
  c.setCharacterPresent('claude',true)
  c.world.ticks=encounterWindow(0).startsTick
  return c.snapshot()
}
it('offers both kinds in bounded pairs without changing state or resident RNG',()=>{
  const w=createLivingWorld(scene),before=structuredClone(w)
  expect(currentEncounter(w)).toBeNull();expect(w).toEqual(before)
  for(let pair=0;pair<100;pair++){
    const kinds=new Set<string>()
    for(let index=pair*2;index<pair*2+2;index++){
      const window=encounterWindow(index*encounterPeriod);kinds.add(window.definitionId)
      w.ticks=window.startsTick-1;expect(currentEncounter(w)).toBeNull()
      w.ticks++;const rng=w.rng;expect(currentEncounter(w)?.token).toBe(window.token);expect(w.rng).toBe(rng)
      w.ticks=window.expiresTick;expect(currentEncounter(w)).toBeNull()
    }
    expect([...kinds].sort()).toEqual(['leaves-gather','paper-rescue'])
  }
})
it('consumes an offer on accept or dismiss, rejects stale tokens and keeps cancellation reward-free',()=>{
  const original=offered(),offer=currentEncounter(original)!,before=JSON.stringify(original)
  expect(()=>startPlay(original,scene,offer.definitionId,['bluewhale','claude'],crypto.randomUUID(),'stale')).toThrow('ENCOUNTER_EXPIRED')
  expect(JSON.stringify(original)).toBe(before)
  const skipped=dismissEncounter(original,scene,offer.token);expect(currentEncounter(skipped)).toBeNull()
  expect(()=>dismissEncounter(skipped,scene,offer.token)).toThrow('ENCOUNTER_EXPIRED')
  const accepted=startPlay(original,scene,offer.definitionId,['bluewhale','claude'],crypto.randomUUID(),offer.token)
  expect(accepted.play.encounterWindow).toBe(offer.index);cancelPlay(accepted)
  expect(currentEncounter(accepted)).toBeNull();expect(accepted.neighborhood.memories).toEqual([])
  expect(validateLivingWorld(JSON.parse(JSON.stringify(accepted)),scene)).toEqual(accepted)
  const future=structuredClone(original);future.ticks=encounterWindow(2*encounterPeriod).startsTick
  expect(()=>startPlay(future,scene,offer.definitionId,['bluewhale','claude'],crypto.randomUUID(),offer.token)).toThrow('ENCOUNTER_EXPIRED')
})
it('freezes windows on hide, resumes identically and cancels participants without resurrecting offers',()=>{
  const w=offered(),offer=currentEncounter(w)!,c=new LivingController(w,scene,()=>{})
  c.pause('hidden',true);const frozen=c.snapshot();for(let n=0;n<100;n++)c.advance(.1)
  expect(c.snapshot()).toEqual(frozen);expect(currentEncounter(c.world)).toEqual(offer)
  c.pause('hidden',false);const twin=new LivingController(c.snapshot(),scene,()=>{})
  for(let n=0;n<90;n++){c.advance(.1);twin.advance(.1)}expect(c.snapshot()).toEqual(twin.snapshot())
  const active=startPlay(w,scene,offer.definitionId,['bluewhale','claude'],crypto.randomUUID(),offer.token)
  const d=new LivingController(active,scene,()=>{});d.setCharacterPresent('claude',false)
  expect(d.world.play.active).toBeNull();expect(d.world.play.encounterWindow).toBe(offer.index)
})
it('rejects malformed counters and preserves natural simulation when offers are only inspected',()=>{
  const w=offered()
  for(const bad of [-2,NaN,.5,2])expect(()=>validateLivingWorld({...w,play:{...w.play,encounterWindow:bad}},scene)).toThrow()
  const a=createLivingWorld(scene),b=structuredClone(a)
  for(let n=0;n<6000;n++){currentEncounter(a);stepLiving(a,scene);stepLiving(b,scene)}expect(a).toEqual(b)
})
it('migrates v8 with exact original snapshot protection and cold-restores a consumed offer',async()=>{
  const old=createV8(scene),raw=JSON.stringify(old),next=migrateLivingWorld(old,scene)
  expect(next.schemaVersion).toBe(9);expect(next.play.encounterWindow).toBe(-1)
  expect(JSON.stringify(old)).toBe(raw);expect(()=>codecV8(scene).validate(next)).toThrow()
  const root=await mkdtemp(join(tmpdir(),'village-encounter-')),legacy=await SaveStore.open(root,scene,codecV8(scene))
  await legacy.save(0,old,crypto.randomUUID())
  const pointer=await readFile(join(legacy.directory,'current.json'),'utf8'),file=JSON.parse(pointer).snapshot
  const bytes=await readFile(join(legacy.directory,'snapshots',file)),store=await SaveStore.open(root,scene,livingWorldCodec(scene))
  const offeredWorld=offered(),skipped=dismissEncounter(offeredWorld,scene,currentEncounter(offeredWorld)!.token)
  await store.save(1,skipped,crypto.randomUUID())
  const reopened=await SaveStore.open(root,scene,livingWorldCodec(scene));expect((await reopened.read())?.world).toEqual(skipped)
  expect(await readFile(join(legacy.directory,'snapshots',file))).toEqual(bytes)
  await expect(store.save(1,skipped,crypto.randomUUID())).rejects.toThrow()
})
it('preserves a checked v8 in-flight table game without moving residents, consuming RNG or changing the board',()=>{
  const source=offered(),current=startPlay(setTableMode(source,scene,'game'),scene,'table-game',['bluewhale','claude'],crypto.randomUUID())
  stepLiving(current,scene)
  const legacy:any=structuredClone(current)
  legacy.schemaVersion=8;legacy.contentRevision=5;delete legacy.play.encounterWindow
  delete legacy.play.decorations['message-board'];delete legacy.play.decorations['leaf-pot']
  const old=codecV8(scene).validate(legacy),raw=JSON.stringify(old),next=migrateLivingWorld(old,scene)
  expect(next.play.active).toEqual(old.play.active);expect(next.actor).toEqual(old.actor);expect(next.companions).toEqual(old.companions)
  expect(next.rng).toBe(old.rng);expect(next.ticks).toBe(old.ticks);expect(next.play.tableMode).toBe('game')
  expect(next.neighborhood).toEqual(old.neighborhood);expect(JSON.stringify(old)).toBe(raw)
})

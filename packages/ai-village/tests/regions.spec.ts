import { legacyCharacterIds } from '../src/core/roster-policy.ts'
import { blankBookhouse } from '../src/core/bookhouse-state.ts'
import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { createLivingWorld, migrateLivingWorld, validateLivingWorld, livingWorldCodec, regionScene, homeProjection } from '../src/core/living-state.ts'
import { createLivingWorld as createV9, livingWorldCodec as codecV9 } from '../src/core/living-state-v9.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { switchRegion, bookhouseActivity, cancelBookhouseActivity, bookhouseActivityIds } from '../src/core/region-engine.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { actors, available, walkable } from '../src/core/world.ts'
import { characterIds } from '../src/core/roster.ts'
import { stepLiving, startPlay, setTableMode, arrangeHome, placeBell, decorateExtra, placePlayDecoration } from '../src/core/living-engine.ts'
import { currentEncounter } from '../src/core/encounter.ts'
import { keepsakeObservation } from '../src/core/keepsake-observation.ts'
import { SaveStore } from '../src/host/save-store.ts'
function courtyard(count=7){const c=new LivingController(createLivingWorld(scene),scene,()=>{});for(const id of characterIds.slice(0,count))c.setCharacterPresent(id,true);return c.snapshot()}
const shared=(w:ReturnType<typeof createLivingWorld>)=>({home:w.home,progress:w.progress,journal:w.journal,neighborhood:w.neighborhood,play:w.play,decorations:w.decorations})
const feet=(w:ReturnType<typeof createLivingWorld>)=>actors(w).map(a=>({id:a.id,position:a.position,safe:a.safe,facing:a.facing})).sort((a,b)=>a.id.localeCompare(b.id))
it('travels with all residents, one clock and unchanged shared facts, preserving exact return feet and user pause',()=>{
  const w=courtyard();w.userPaused=true;const raw=JSON.stringify(w),before=feet(w)
  const book=switchRegion(w,scene,'bookhouse')
  expect(w).toEqual(JSON.parse(raw));expect(book.actor.id).toBe(w.actor.id);expect(book.userPaused).toBe(true)
  expect(book.ticks).toBe(w.ticks);expect(book.rng).toBe(w.rng);expect(shared(book)).toEqual(shared(w))
  expect(book.region.returns.bookhouse).toBeNull();expect(book.region.returns.courtyard!.length).toBe(7)
  expect(actors(book).every(a=>walkable(bookhouseScene,a.position)&&available(book,a.position,a.id))).toBe(true)
  expect(regionScene(book,scene)).toBe(bookhouseScene)
  const restored=switchRegion(book,scene,'courtyard');expect(feet(restored)).toEqual(before);expect(shared(restored)).toEqual(shared(w))
  expect(feet(switchRegion(restored,scene,'bookhouse'))).toEqual(feet(book))
})
it('does not advance inactive poses or invent history across 18000 deterministic bookhouse ticks and cold checkpoints',()=>{
  const original=switchRegion(courtyard(),scene,'bookhouse'),parked=structuredClone(original.region.returns.courtyard)
  let a=structuredClone(original),b=structuredClone(original)
  const actions=new Set<string>()
  for(let n=0;n<18000;n++){
    stepLiving(a,scene);stepLiving(b,scene)
    for(const resident of actors(a)){expect(available(a,resident.position,resident.id)).toBe(true);actions.add(resident.behavior)}
    if(n%900===0){a=validateLivingWorld(JSON.parse(JSON.stringify(a)),scene);b=validateLivingWorld(b,scene)}
  }
  expect(a).toEqual(b);expect(a.region.returns.courtyard).toEqual(parked);expect(shared(a)).toEqual(shared(original))
  expect([...actions]).toEqual(expect.arrayContaining(['walk','read','work','sit']))
  expect(JSON.stringify(a).length).toBeLessThan(48*1024);expect(currentEncounter(a)).toBeNull();expect(keepsakeObservation(a,'zh')).toBeNull()
  expect(feet(switchRegion(a,scene,'courtyard'))).toEqual(feet(courtyard()))
})
it('walks to each real activity seat, cold restores while approaching and respects occupancy without rewarding navigation',()=>{
  for(const id of bookhouseActivityIds){
    const source=switchRegion(courtyard(1),scene,'bookhouse');let w=bookhouseActivity(source,scene,id)
    expect(w.actor.intent?.stage).toBe('approach');expect(w.actor.position).toEqual(source.actor.position)
    let ticks=0
    while(w.actor.intent?.stage==='approach'&&ticks++<1800){stepLiving(w,scene);if(ticks%120===0)w=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene)}
    expect(w.actor.intent?.stage).toBe('use');expect(w.actor.position).toEqual(bookhouseScene.hotspots.find(h=>h.id===id)!.anchor)
    expect(shared(w)).toEqual(shared(source));expect(cancelBookhouseActivity(w,scene).actor.intent).toBeNull()
  }
  const source=switchRegion(courtyard(2),scene,'bookhouse'),active=bookhouseActivity(source,scene,'bookcase')
  const c=new LivingController(active,scene,()=>{});c.selectCharacter('claude')
  expect(()=>bookhouseActivity(c.world,scene,'bookcase')).toThrow('FURNITURE_OCCUPIED')
})
it('keeps current region controller authoritative for hide, selection, drag and roster changes',()=>{
  const initial=switchRegion(courtyard(2),scene,'bookhouse'),c=new LivingController(initial,scene,()=>{})
  c.pause('hidden',true);const frozen=c.snapshot();c.advance(.1);expect(c.snapshot()).toEqual(frozen);c.pause('hidden',false)
  c.advance(.1);expect(c.world.ticks).toBeGreaterThan(frozen.ticks)
  c.setCharacterPresent('gpt',true);c.setCharacterPresent('claude',false);expect(actors(c.world)).toHaveLength(2)
  c.selectCharacter('gpt');expect(c.world.actor.id).toBe('bluewhale');c.selectCharacter('claude');expect(c.world.actor.id).toBe('claude')
  const a=c.world.actor,p={x:a.position.x,y:a.position.y-25}
  c.pointer({type:'down',id:1,point:p,css:{x:10,y:10}})
  c.pointer({type:'move',id:1,point:{x:300,y:405},css:{x:80,y:80}})
  c.pointer({type:'up',id:1,point:{x:300,y:405},css:{x:80,y:80}})
  expect(c.lastPlacement).toBe('accepted');expect(c.snapshot().region.active).toBe('bookhouse')
  const saved=c.snapshot();c.pointer({type:'down',id:2,point:{x:300,y:405},css:{x:10,y:10}});c.pointer({type:'up',id:2,point:{x:0,y:0},css:{x:100,y:100}})
  expect(c.lastPlacement).toBe('rejected');expect(c.snapshot()).toEqual(saved)
})
it('prunes departed and replaced courtyard IDs before changed callbacks can save, and allocates legal entry feet for newcomers',()=>{
  let w=switchRegion(switchRegion(courtyard(2),scene,'bookhouse'),scene,'courtyard')
  const c=new LivingController(w,scene,()=>{validateLivingWorld(c.world,scene)})
  c.setCharacterPresent('claude',false);expect(c.world.region.returns.bookhouse!.map(p=>p.id)).toEqual(['bluewhale'])
  c.selectCharacter('gpt');expect(c.world.region.returns.bookhouse).toEqual([])
  c.setCharacterPresent('kimi',true);w=switchRegion(c.snapshot(),scene,'bookhouse')
  expect(actors(w).map(a=>a.id).sort()).toEqual(['gpt','kimi']);expect(actors(w).every(a=>available(w,a.position,a.id))).toBe(true)
})
it('rejects active story travel and courtyard-only actions in bookhouse without mutating source',()=>{
  const w=courtyard(2),active=startPlay(w,scene,'quiet-page',['bluewhale','claude'],crypto.randomUUID()),raw=JSON.stringify(active)
  expect(()=>switchRegion(active,scene,'bookhouse')).toThrow('EVENT_ACTIVE');expect(JSON.stringify(active)).toBe(raw)
  const book=switchRegion(w,scene,'bookhouse'),before=JSON.stringify(book)
  for(const command of [()=>startPlay(book,scene,'quiet-page',['bluewhale','claude'],crypto.randomUUID()),()=>setTableMode(book,scene,'game'),()=>arrangeHome(book,scene,book.home,'reading',book.home.revision),()=>placeBell(book,scene,null),()=>decorateExtra(book,scene,'lantern',null),()=>placePlayDecoration(book,scene,'leaf-pot',null)])expect(command).toThrow('COURTYARD_REQUIRED')
  expect(JSON.stringify(book)).toBe(before);expect(()=>switchRegion(book,scene,'unknown')).toThrow('INVALID_REGION')
})
it('rejects unknown regions, duplicate/foreign/illegal return feet, wrong current geometry and open actor data',()=>{
  const book=switchRegion(courtyard(2),scene,'bookhouse')
  const mutations=[(w:any)=>w.region.active='unknown',(w:any)=>w.region.version=3,(w:any)=>w.region.extra=true,
    (w:any)=>w.region.returns.bookhouse=[],(w:any)=>w.region.returns.courtyard=null,(w:any)=>w.region.returns.courtyard.pop(),
    (w:any)=>w.region.returns.courtyard[1].id=w.region.returns.courtyard[0].id,(w:any)=>w.region.returns.courtyard[0].id='gpt',
    (w:any)=>w.region.returns.courtyard[0].position={x:0,y:0},(w:any)=>w.actor.position={x:240,y:230},
    (w:any)=>w.actor.position.extra=true,(w:any)=>w.actor.extra=true,(w:any)=>delete w.actor.intent,(w:any)=>w.extra=true]
  for(const mutate of mutations){const bad=structuredClone(book);mutate(bad);expect(()=>validateLivingWorld(bad,scene)).toThrow()}
  const current=bookhouseActivity(book,scene,'bookcase');current.actor.intent!.route.push({x:0,y:0});expect(()=>validateLivingWorld(current,scene)).toThrow()
  expect(()=>migrateLivingWorld({...book,schemaVersion:15},scene)).toThrow()
})
it('migrates frozen v9 in-flight gameplay exactly and protects old bytes beyond the regular snapshot retention window',async()=>{
  const w=courtyard(2),current=startPlay(setTableMode(w,scene,'game'),scene,'table-game',['bluewhale','claude'],crypto.randomUUID())
  stepLiving(current,scene)
  const {teaSquare:_teaSquare,manualMove:_manualMove,region:_region,bookhouse:_bookhouse,...rest}=current;rest.home.accessories=Object.fromEntries(legacyCharacterIds.map(id=>[id,rest.home.accessories[id]])) as typeof rest.home.accessories;const old=codecV9(scene).validate({...rest,schemaVersion:9,contentRevision:6}),raw=JSON.stringify(old)
  const next=migrateLivingWorld(old,scene)
  expect(next).toEqual({...old,schemaVersion:14,manualMove:null,contentRevision:10,teaSquare:current.teaSquare,home:next.home,bookhouse:blankBookhouse(),region:{version:2,active:'courtyard',returns:{courtyard:null,bookhouse:null,'tea-square':null}}})
  expect(JSON.stringify(old)).toBe(raw);expect(()=>codecV9(scene).validate(next)).toThrow();expect(homeProjection(migrateLivingWorld(createV9(scene),scene))).toEqual(homeProjection(createLivingWorld(scene)))
  const root=await mkdtemp(join(tmpdir(),'village-regions-')),legacy=await SaveStore.open(root,scene,codecV9(scene))
  await legacy.save(0,old,crypto.randomUUID());const pointer=await readFile(join(legacy.directory,'current.json'),'utf8'),name=JSON.parse(pointer).snapshot
  const bytes=await readFile(join(legacy.directory,'snapshots',name)),store=await SaveStore.open(root,scene,livingWorldCodec(scene));let saved=(await store.read())!
  for(let n=0;n<42;n++)saved=await store.save(saved.revision,saved.world,crypto.randomUUID())
  expect(await readFile(join(store.directory,'snapshots',name))).toEqual(bytes)
  const upgrades=(await readdir(store.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(upgrades.map(n=>readFile(join(store.directory,n),'utf8')))).toContain(pointer)
  expect((await (await SaveStore.open(root,scene,livingWorldCodec(scene))).read())?.world).toEqual(next)
})

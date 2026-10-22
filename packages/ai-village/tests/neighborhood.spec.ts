import { describe, expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { createContentWorld } from '../src/core/content-state.ts'
import { createNeighborhoodWorld, validateNeighborhoodWorld, migrateNeighborhoodWorld, legacyContent, neighborhoodScene } from '../src/core/neighborhood-state.ts'
import { startNeighborhoodEvent, stepNeighborhood, settleTea, changeLayout, decorateExtra, inviteTea } from '../src/core/neighborhood-engine.ts'
import { NeighborhoodController } from '../src/core/neighborhood-controller.ts'
import { neighborhoodEvents, residentLines, stories, furnitureCatalog } from '../src/core/neighborhood-catalog.ts'
import { actors, available } from '../src/core/world.ts'
function fresh() {
 const world = createNeighborhoodWorld(scene)
 world.companions.push({ ...structuredClone(world.actor), id: 'claude', position: { x: 225, y: 340 }, safe: { x: 225, y: 340 } })
 return world
}
function finish(world: ReturnType<typeof fresh>) {
 for (let i = 0; i < 1300 && (world.activeEvent || world.neighborhood.event); i++) {
  const positions = actors(world).map(a => ({ id: a.id, ...a.position }))
  stepNeighborhood(world, scene)
  expect(actors(world).every(a => available(world, a.position, a.id))).toBe(true)
  for (const a of actors(world)) { const old = positions.find(p => p.id === a.id)!; expect(Math.hypot(a.position.x-old.x,a.position.y-old.y)).toBeLessThanOrEqual(17/30+1e-6) }
  if (i % 60 === 0) world = validateNeighborhoodWorld(JSON.parse(JSON.stringify(world)), scene)
  world = settleTea(world, scene) ?? world
 }
 return world
}
describe('0.5 neighborhood production rules', () => {
 it('ships the full bounded bilingual content catalog', () => {
  expect(neighborhoodEvents.filter(d=>d.count===1)).toHaveLength(8)
  expect(neighborhoodEvents.filter(d=>d.count===2)).toHaveLength(5) // sixth is the existing tea event
  expect(stories.length+1).toBe(12); expect(furnitureCatalog).toHaveLength(6)
  for (const lines of Object.values(residentLines)) { expect(lines).toHaveLength(12); expect(new Set(lines.map(l=>l.zh)).size).toBe(12); expect(lines.every(l=>l.zh&&l.en)).toBe(true) }
 })
 it('every solo and pair event reaches its actual activity and keeps one first memory', () => {
  for (const d of neighborhoodEvents) {
   let world = fresh()
   world = changeLayout(world,scene,d.furniture==='books'||d.id==='shared-book'?'reading':d.furniture==='plant'||d.id==='plant-care'?'garden':'courtyard')
   world = startNeighborhoodEvent(world,scene,d.id,d.count===1?['bluewhale']:['bluewhale','claude'],crypto.randomUUID())
   world = finish(world)
   expect(world.neighborhood.event,d.id).toBeNull(); expect(world.neighborhood.memories[0]?.id,d.id).toBe(d.story)
   const first=structuredClone(world.neighborhood.memories[0])
   world.ticks+=90
   world=startNeighborhoodEvent(world,scene,d.id,d.count===1?['bluewhale']:['bluewhale','claude'],crypto.randomUUID())
   world=finish(world)
   expect(world.neighborhood.memories).toEqual([{...first,count:2}])
   expect(world.neighborhood.bonds.length).toBe(d.count===2?1:0)
  }
 })
 it('migrates 0.4 without rewriting source or losing a running tea', () => {
  const old=createContentWorld(scene), bytes=JSON.stringify(old), world=migrateNeighborhoodWorld(old,scene)
  expect(JSON.stringify(old)).toBe(bytes);expect(legacyContent(world)).toEqual(old)
  const active=inviteTea(fresh(),scene,['bluewhale','claude'],'tea',crypto.randomUUID())
  const resumed=migrateNeighborhoodWorld(legacyContent(active),scene)
  expect(resumed.activeEvent).toEqual(active.activeEvent)
  expect(finish(resumed).journal).toHaveLength(1)
 })
 it('freezes during drag/pause, cancels both guests on departure and rejects locked rewards', () => {
  const world=startNeighborhoodEvent(fresh(),scene,'bench-chat',['bluewhale','claude'],crypto.randomUUID())
  const c=new NeighborhoodController(world,scene,()=>{})
  c.pause('photo',true); const saved=c.snapshot();c.advance(.1);expect(c.snapshot()).toEqual(saved);c.pause('photo',false)
  c.setCharacterPresent('claude',false);expect(c.world.neighborhood.event).toBeNull();expect(c.world.actor.intent).toBeNull()
  expect(()=>decorateExtra(c.world,scene,'lantern','window')).toThrow('DECORATION_LOCKED')
  expect(()=>startNeighborhoodEvent(fresh(),scene,'read',['bluewhale'],crypto.randomUUID())).toThrow('LAYOUT_REQUIRED')
 })
 it('resumes deterministic simulation for one hour with seven residents and bounded state', () => {
  const c=new NeighborhoodController(createNeighborhoodWorld(scene),scene,()=>{})
  for(const id of Object.keys(residentLines)) c.setCharacterPresent(id,true)
  const a=c.snapshot(),b=validateNeighborhoodWorld(JSON.parse(JSON.stringify(a)),scene)
  for(let i=0;i<108000;i++){stepNeighborhood(a,scene);stepNeighborhood(b,scene);if(i%3000===0)validateNeighborhoodWorld(a,scene)}
  expect(a).toEqual(b);expect(JSON.stringify(a).length).toBeLessThan(48*1024)
  expect(neighborhoodScene(scene,'courtyard').hotspots).toHaveLength(6)
 })
})

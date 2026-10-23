import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { blankHome, createHomeWorld, validateHomeWorld, homeScene, homeTemplates, arrangeHome, migrateHomeWorld, homeWorldCodec, neighborhoodProjection, type HomeWorld } from '../src/core/home-state.ts'
import { createNeighborhoodWorld, neighborhoodWorldCodec } from '../src/core/neighborhood-state.ts'
import { inviteTea as inviteOld } from '../src/core/neighborhood-engine.ts'
import { inviteTea, stepHome, settleTea, startNeighborhoodEvent } from '../src/core/home-engine.ts'
import { HomeController } from '../src/core/home-controller.ts'
import { legacyCharacterIds as characterIds } from '../src/core/roster-policy.ts'
import { neighborhoodEvents } from '../src/core/neighborhood-catalog.ts'
import { actors, walkable, available, routeTo, placement } from '../src/core/world.ts'
import { SaveStore } from '../src/host/save-store.ts'
function finish(world: HomeWorld) {
  for (let i = 0; i < 1300 && (world.activeEvent || world.neighborhood.event); i++) {
    const previous = actors(world).map(a => ({ ...a.position }))
    stepHome(world, scene)
    actors(world).forEach((a, n) => {
      expect(available(world, a.position, a.id)).toBe(true)
      expect(Math.hypot(a.position.x - previous[n]!.x, a.position.y - previous[n]!.y)).toBeLessThanOrEqual(17 / 30 + 1e-6)
    })
    if (i % 60 === 0) world = validateHomeWorld(JSON.parse(JSON.stringify(world)), scene)
    world = settleTea(world, scene) ?? world
  }
  return world
}
it('selects a tap only on pointer-up, cancels without selecting and keeps the five CSS pixel drag threshold', () => {
  const c = new HomeController(createHomeWorld(scene), scene, () => {})
  c.setCharacterPresent('claude', true)
  const point = { ...c.world.companions[0]!.position }, before = c.snapshot()
  const down = { type: 'down' as const, id: 1, point, css: { x: 0, y: 0 } }
  c.pointer(down); expect(c.world.actor.id).toBe('bluewhale'); c.cancelDrag(); expect(c.snapshot()).toEqual(before)
  c.pointer(down); c.pointer({ ...down, type: 'up', css: { x: 4, y: 0 } })
  expect(c.world.actor.id).toBe('claude'); expect(c.world.actor.position).toEqual(point); expect(c.lastPlacement).toBe('selected')
  c.selectCharacter('bluewhale'); c.pointer(down); c.pointer({ ...down, type: 'move', css: { x: 5, y: 0 } })
  expect(c.drag?.active).toBe(true); expect(c.world.actor.id).toBe('claude'); c.cancelDrag()
})
it('all 48 bounded layouts expose reachable distinct seats and translate geometry with furniture', () => {
  for (const layout of ['courtyard', 'reading', 'garden'] as const) for (let mask = 0; mask < 16; mask++) {
    const home = blankHome(); Object.keys(home.positions).forEach((id, i) => { home.positions[id as keyof typeof home.positions] = ((mask >> i) & 1) as 0 | 1 })
    const geometry = homeScene(scene, layout, home)
    for (const seat of geometry.hotspots) {
      expect(walkable(geometry, seat.anchor)).toBe(true); expect(routeTo(geometry, scene.spawn, seat.anchor)).not.toBeNull()
      expect(placement(geometry, seat.anchor, scene.spawn).hotspot).toEqual(seat)
    }
    expect(geometry.hotspots).toHaveLength(6)
    if (home.positions.eat) { expect(geometry.obstacles[1]!.x).toBe(scene.obstacles[1]!.x - 54); expect(geometry.seatProps![0]!.rect.x).toBe(130) }
  }
})
it('confirms geometry atomically, rejects residents under furniture and stale or forged drafts', () => {
  const world = createHomeWorld(scene), original = JSON.stringify(world), home = { ...world.home, positions: { ...homeTemplates.reading } }
  const next = arrangeHome(world, scene, home, 'reading', 0)
  expect(JSON.stringify(world)).toBe(original); expect(next.home.revision).toBe(1)
  expect(homeScene(scene, 'reading', next.home).obstacles).not.toEqual(scene.obstacles)
  expect(() => arrangeHome(next, scene, home, 'garden', 0)).toThrow('LAYOUT_CONFLICT')
  world.actor.position = world.actor.safe = { x: 175, y: 280 }
  expect(() => arrangeHome(world, scene, home, 'reading', 0)).toThrow('FURNITURE_OCCUPIED')
  for (const bad of [{ ...next.home, environment: 'rain' }, { ...next.home, positions: { ...next.home.positions, work: 8 } }, { ...next.home, injected: true }]) expect(() => validateHomeWorld({ ...next, home: bad }, scene)).toThrow()
  expect(() => validateHomeWorld({ ...next, injected: true }, scene)).toThrow()
  expect(() => validateHomeWorld({ ...next, schemaVersion: 7 }, scene)).toThrow('UNSUPPORTED_WORLD_VERSION')
})
it('21 resident pairs finish tea at actual moved table seats in all three templates', () => {
  for (const layout of ['courtyard', 'reading', 'garden'] as const) for (let i = 0; i < characterIds.length; i++) for (let j = i + 1; j < characterIds.length; j++) {
    let world = createHomeWorld(scene); world.actor.id = characterIds[i]!
    world.companions = [{ ...structuredClone(world.actor), id: characterIds[j]!, position: { x: 225, y: 340 }, safe: { x: 225, y: 340 } }]
    world = arrangeHome(world, scene, { ...world.home, positions: { ...homeTemplates[layout] } }, layout, 0)
    world = finish(inviteTea(world, scene, [characterIds[i]!, characterIds[j]!], 'tea', crypto.randomUUID()))
    expect(world.journal).toHaveLength(1); expect(world.activeEvent).toBeNull(); expect(world.neighborhood.bonds).toHaveLength(1)
  }
})
it('all five neighborhood duo activities finish for all 21 pairs in eligible templates and reject incompatible corners', () => {
  for (const layout of ['courtyard', 'reading', 'garden'] as const) for (const action of neighborhoodEvents.filter(e => e.count === 2)) {
    for (let i = 0; i < characterIds.length; i++) for (let j = i + 1; j < characterIds.length; j++) {
      let world = createHomeWorld(scene); world.actor.id = characterIds[i]!
      world.companions = [{ ...structuredClone(world.actor), id: characterIds[j]!, position: { x: 225, y: 340 }, safe: { x: 225, y: 340 } }]
      world = arrangeHome(world, scene, { ...world.home, positions: { ...homeTemplates[layout] } }, layout, 0)
      if ((action.id === 'shared-book' && layout !== 'reading') || (action.id === 'plant-care' && layout !== 'garden')) {
        expect(() => startNeighborhoodEvent(world, scene, action.id, [characterIds[i]!, characterIds[j]!], crypto.randomUUID())).toThrow('LAYOUT_REQUIRED')
        continue
      }
      world = finish(startNeighborhoodEvent(world, scene, action.id, [characterIds[i]!, characterIds[j]!], crypto.randomUUID()))
      expect(world.neighborhood.event).toBeNull(); expect(world.neighborhood.memories.map(m => m.id)).toEqual([action.story])
      expect(world.neighborhood.bonds).toHaveLength(1)
    }
  }
})
it('reading and watering reach the moved living corner without teleporting', () => {
  for (const [layout, action, story] of [['reading', 'read', 'read'], ['garden', 'water', 'water']] as const) {
    let world = createHomeWorld(scene)
    world = arrangeHome(world, scene, { ...world.home, positions: { ...world.home.positions, corner: 1 } }, layout, 0)
    const active = startNeighborhoodEvent(world, scene, action, ['bluewhale'], crypto.randomUUID())
    expect(() => arrangeHome(active, scene, active.home, layout, 1)).toThrow('EVENT_ACTIVE')
    world = finish(active); expect(world.neighborhood.memories[0]?.id).toBe(story); expect(world.actor.position.y).toBe(307)
  }
})
it('migrates in-flight schema5 tea losslessly and protects its exact saved bytes beyond retention', async () => {
  const old = createNeighborhoodWorld(scene); old.companions.push({ ...structuredClone(old.actor), id: 'claude', position: { x: 225, y: 340 }, safe: { x: 225, y: 340 } })
  const active = inviteOld(old, scene, ['bluewhale', 'claude'], 'tea', crypto.randomUUID()), raw = JSON.stringify(active)
  const migrated = migrateHomeWorld(active, scene); expect(neighborhoodProjection(migrated)).toEqual(active); expect(JSON.stringify(active)).toBe(raw)
  expect(finish(migrated).journal).toHaveLength(1)
  const dir = await mkdtemp(join(tmpdir(), 'village-v06-')), previous = await SaveStore.open(dir, scene, neighborhoodWorldCodec(scene))
  await previous.save(0, active, crypto.randomUUID()); const pointer = await readFile(join(previous.directory, 'current.json'), 'utf8'), file = JSON.parse(pointer).snapshot
  const bytes = await readFile(join(previous.directory, 'snapshots', file)), current = await SaveStore.open(dir, scene, homeWorldCodec(scene))
  let saved = (await current.read())!; expect(saved.world.schemaVersion).toBe(6)
  for (let i = 0; i < 42; i++) saved = await current.save(saved.revision, saved.world, crypto.randomUUID())
  expect(await readFile(join(previous.directory, 'snapshots', file))).toEqual(bytes)
  const protectedName = (await readdir(previous.directory)).find(n => n.startsWith('upgrade-v1-'))!
  expect(await readFile(join(previous.directory, protectedName), 'utf8')).toBe(pointer)
  expect((await current.readUpgrade(protectedName)).world.schemaVersion).toBe(6)
})
it('keeps seven residents deterministic for one hour in edited geometry and preserves pause', () => {
  const initial = createHomeWorld(scene), world = arrangeHome(initial, scene, { ...initial.home, positions: { ...homeTemplates.reading }, environment: 'twilight' }, 'reading', 0)
  const c = new HomeController(world, scene, () => {}); for (const id of characterIds) c.setCharacterPresent(id, true)
  expect(actors(c.world)).toHaveLength(7); c.pause('arrange', true); const paused = c.snapshot(); c.advance(.1); expect(c.snapshot()).toEqual(paused); c.pause('arrange', false)
  const a = c.snapshot(), b = validateHomeWorld(JSON.parse(JSON.stringify(a)), scene)
  for (let i = 0; i < 108000; i++) { stepHome(a, scene); stepHome(b, scene); if (i % 3000 === 0) validateHomeWorld(a, scene) }
  expect(a).toEqual(b)
})

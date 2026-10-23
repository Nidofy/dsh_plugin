import { expect, it } from 'vitest'
import { actors, createWorld, routeTo, reachable, step, validateWorld, seatAvailable } from '../src/core/world.ts'
import { WorldController } from '../src/core/controller.ts'
import { scene } from '../src/definitions.ts'
import { legacyCharacterIds as characterIds } from '../src/core/roster-policy.ts'

it('routes around the existing tables and keeps seven residents deterministic and live for an hour', () => {
  for (const h of scene.hotspots) {
    const route = routeTo(scene, scene.spawn, h.anchor)
    expect(route).not.toBeNull()
    let last = scene.spawn
    for (const p of route!) { expect(reachable(scene, last, p)).toBe(true); last = p }
    expect(last).toEqual(h.anchor)
  }
  const c = new WorldController(createWorld(scene), scene, () => {})
  for (const id of characterIds) c.setCharacterPresent(id, true)
  const other = structuredClone(c.world), activities = new Map(characterIds.map(id => [id, new Set<string>()]))
  const transitions = new Map(characterIds.map(id => [id, 0]))
  for (let i = 0; i < 108000; i++) {
    const before = actors(c.world).map(a => ({ id: a.id, behavior: a.behavior }))
    step(c.world, scene); step(other, scene)
    for (const a of actors(c.world)) {
      activities.get(a.id)!.add(a.behavior)
      if (before.find(b => b.id === a.id)!.behavior !== a.behavior) transitions.set(a.id, transitions.get(a.id)! + 1)
    }
    if (i % 300 === 0) expect(validateWorld(c.world, scene)).toEqual(c.world)
  }
  expect(c.world).toEqual(other)
  for (const id of characterIds) {
    expect(transitions.get(id)).toBeGreaterThan(20)
    expect([...activities.get(id)!].some(a => ['work', 'eat', 'rest'].includes(a))).toBe(true)
  }
})

it('preserves reservations across cold restore, rejects duplicate seats, and expires stalled journeys', () => {
  const world = createWorld(scene)
  for (let i = 0; i < 10000 && !world.actor.intent; i++) step(world, scene)
  expect(world.actor.intent).not.toBeNull()
  const restored = validateWorld(JSON.parse(JSON.stringify(world)), scene)
  for (let i = 0; i < 2000; i++) { step(world, scene); step(restored, scene) }
  expect(restored).toEqual(world)
  const c = new WorldController(createWorld(scene), scene, () => {}); c.setCharacterPresent('claude', true)
  const h = scene.hotspots[0]!, a = c.world.actor
  a.behavior = 'walk'; a.destination = routeTo(scene, a.position, h.anchor)![0]!
  a.intent = { furnitureId: h.id, seat: 'main', activity: 'work', stage: 'approach', route: routeTo(scene, a.position, h.anchor)!.slice(1), expires: 1 }
  expect(seatAvailable(c.world, h, 'claude')).toBe(false)
  c.world.companions[0]!.intent = structuredClone(a.intent)
  expect(() => validateWorld(c.world, scene)).toThrow()
  c.world.companions[0]!.intent = null
  step(c.world, scene)
  expect(a.intent).toBeNull(); expect(seatAvailable(c.world, h, 'claude')).toBe(true)
})

it('freezes held activity time, preserves a cancelled drag, and releases a successful moved reservation', () => {
  const c = new WorldController(createWorld(scene), scene, () => {}), h = scene.hotspots[0]!
  c.pointer({ type: 'down', id: 1, point: c.world.actor.position, css: c.world.actor.position })
  c.pointer({ type: 'up', id: 1, point: h.anchor, css: h.anchor })
  expect(c.world.actor.intent?.stage).toBe('use')
  const before = c.world.actor.remaining
  c.pointer({ type: 'down', id: 2, point: h.anchor, css: h.anchor })
  for (let i = 0; i < 2100; i++) step(c.world, scene, c.world.actor.id)
  expect(c.world.actor.remaining).toBe(before); expect(() => c.snapshot()).not.toThrow()
  c.cancelDrag(); expect(c.world.actor.behavior).toBe('work')
  c.pointer({ type: 'down', id: 3, point: h.anchor, css: h.anchor })
  c.pointer({ type: 'up', id: 3, point: { x: 180, y: 425 }, css: { x: 180, y: 425 } })
  expect(c.world.actor.intent).toBeNull()
})

it('migrates schema 2 activities without losing residents or altering source bytes', () => {
  const world = createWorld(scene), h = scene.hotspots[0]!
  const old = { ...world, schemaVersion: 2, actor: { ...world.actor, behavior: 'work', position: h.anchor, safe: h.anchor, remaining: 0 } }
  const bytes = JSON.stringify(old), migrated = validateWorld(old, scene)
  expect(migrated.schemaVersion).toBe(3); expect(migrated.actor.remaining).toBeGreaterThan(0)
  expect(migrated.actor.intent?.stage).toBe('use'); expect(JSON.stringify(old)).toBe(bytes)
})

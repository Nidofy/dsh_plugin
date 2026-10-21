import { it, expect } from 'vitest'
import { actors, createWorld, hitActor, step, validateWorld } from '../src/core/world.ts'
import { WorldController } from '../src/core/controller.ts'
import { characterIds } from '../src/core/roster.ts'
import { scene } from '../src/definitions.ts'
import { SaveStore } from '../src/host/save-store.ts'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

it('reads a real schema-1 snapshot and saves schema 2 while retaining exact old bytes and revision history', async () => {
  const profile = await mkdtemp(resolve('.build/ai-village-phase4/migration-'))
  const store = await SaveStore.open(profile, scene)
  const { companions: _, ...single } = createWorld(scene)
  const operationId = randomUUID(), name = randomUUID() + '.json'
  const bytes = JSON.stringify({ revision: 7, operationId, world: { ...single, schemaVersion: 1, ticks: 1200, userPaused: true } })
  await writeFile(join(store.directory, 'snapshots', name), bytes)
  const pointer = JSON.stringify({ schemaVersion: 1, revision: 7, operationId, snapshot: name, hash: createHash('sha256').update(bytes).digest('hex') })
  await writeFile(join(store.directory, 'current.json'), pointer)
  const old = (await store.read())!
  expect(old.world.schemaVersion).toBe(2); expect(old.world.ticks).toBe(1200)
  expect(await readFile(join(store.directory, 'current.json'), 'utf8')).toBe(pointer)
  const c = new WorldController(old.world, scene, () => {}); c.setCharacterPresent('claude', true)
  const saved = await store.save(7, c.snapshot(), randomUUID())
  expect(saved.revision).toBe(8)
  expect(await store.read()).toEqual(saved)
  expect((await store.read('previous.json'))!.revision).toBe(7)
  expect(await readFile(join(store.directory, 'snapshots', name), 'utf8')).toBe(bytes)
})

it('migrates schema 1 without resetting progress, rejects duplicate residents and occupied activities', () => {
  const current = createWorld(scene); current.ticks = 333; current.userPaused = true; current.actor.phase = 2.2
  const { companions: _, ...single } = current
  const legacy = { ...single, schemaVersion: 1 }, original = JSON.stringify(legacy)
  expect(validateWorld(legacy, scene)).toEqual(current)
  expect(JSON.stringify(legacy)).toBe(original)
  expect(() => validateWorld({ ...current, companions: [current.actor] }, scene)).toThrow('INVALID_WORLD')
  expect(() => validateWorld({ ...current, companions: {} }, scene)).toThrow()
  expect(() => validateWorld({ ...current, schemaVersion: 3 }, scene)).toThrow()
  const anchor = scene.hotspots.find(h => h.id === 'work')!.anchor
  const working = { ...current.actor, behavior: 'work', position: anchor, safe: anchor }
  expect(() => validateWorld({ ...current, actor: working, companions: [{ ...working, id: 'claude' }] }, scene)).toThrow()
})

it('keeps seven independent residents, changes focus without replacing them, and retains at least one', () => {
  const c = new WorldController(createWorld(scene), scene, () => {})
  for (const id of characterIds) c.setCharacterPresent(id, true)
  expect(actors(c.world)).toHaveLength(7)
  const before = structuredClone(actors(c.world)).sort((a, b) => a.id.localeCompare(b.id))
  c.selectCharacter('kimi')
  expect(c.world.actor.id).toBe('kimi')
  expect(actors(c.world).sort((a, b) => a.id.localeCompare(b.id))).toEqual(before)
  for (let i = 0; i < 18000; i++) step(c.world, scene)
  expect(() => validateWorld(c.world, scene)).not.toThrow()
  expect(actors(c.world).every(a => a.phase > 0)).toBe(true)
  c.setCharacterPresent('kimi', false)
  expect(actors(c.world).some(a => a.id === 'kimi')).toBe(false)
  for (const id of characterIds) c.setCharacterPresent(id, false)
  expect(actors(c.world)).toHaveLength(1)
  c.setCharacterPresent('__proto__', true)
  expect(actors(c.world)).toHaveLength(1)
})

it('picks by depth, freezes only the held resident and refuses an occupied desk', () => {
  const c = new WorldController(createWorld(scene), scene, () => {})
  c.setCharacterPresent('claude', true)
  const guest = c.world.companions[0]!
  guest.position = { x: 60, y: 420 }; guest.safe = { ...guest.position }
  const actor = c.world.actor, point = { x: actor.position.x, y: actor.position.y - 30 }
  c.pointer({ type: 'down', id: 1, point, css: point })
  c.pointer({ type: 'move', id: 1, point: { x: 190, y: 350 }, css: { x: 200, y: 200 } })
  expect(c.drag?.active).toBe(true)
  const heldPhase = actor.phase, guestPhase = guest.phase
  c.advance(.1)
  expect(actor.phase).toBe(heldPhase); expect(guest.phase).toBeGreaterThan(guestPhase)
  c.cancelDrag()
  const anchor = scene.hotspots.find(h => h.id === 'work')!.anchor
  guest.position = { ...anchor }; guest.safe = { ...anchor }; guest.behavior = 'work'
  c.pointer({ type: 'down', id: 2, point: actor.position, css: actor.position })
  c.pointer({ type: 'up', id: 2, point: anchor, css: anchor })
  expect(c.lastPlacement).toBe('rejected'); expect(guest.behavior).toBe('work')
  guest.behavior = 'idle'; guest.position = { x: actor.position.x, y: actor.position.y + 20 }; guest.safe = { ...guest.position }
  expect(hitActor(c.world, actor.position)?.id).toBe('claude')
})

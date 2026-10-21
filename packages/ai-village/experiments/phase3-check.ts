import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createWorld, step, validateWorld, reachable, walkable } from '../src/core/world.ts'
import { WorldController } from '../src/core/controller.ts'
import { SaveStore } from '../src/host/save-store.ts'
import type { Scene, World, Point } from '../src/core/world.ts'
export async function check(scene: Scene, root: string) {
  const results: string[] = []
  const one = createWorld(scene), two = createWorld(scene)
  for (let i = 0; i < 18000; i++) {
    step(one, scene); step(two, scene)
    assert.ok(walkable(scene, one.actor.position)); validateWorld(one, scene)
  }
  assert.deepEqual(one, two); assert.ok(one.ticks === 18000 && one.rng !== createWorld(scene).rng)
  assert.equal(reachable(scene, scene.spawn, { x: NaN, y: 300 }), false)
  assert.equal(reachable(scene, { x: 102, y: 283 }, { x: 102, y: 340 }), false)
  results.push('seeded 10-minute simulation stays within navigable ground; obstacle crossing and nonfinite destinations refused')
  let changes = 0
  const c = new WorldController(createWorld(scene), scene, () => changes++)
  const send = (type: 'down' | 'move' | 'up' | 'cancel', point: Point, css = point) => c.pointer({ type, id: 1, point, css })
  const initial = c.snapshot()
  send('down', { x: 173, y: 315 }); send('move', { x: 176, y: 315 }); send('up', { x: 176, y: 315 })
  assert.deepEqual(c.snapshot(), initial); assert.equal(changes, 0)
  for (const hotspot of scene.hotspots) {
    const origin = c.world.actor.position
    send('down', { x: origin.x, y: origin.y - 50 })
    send('move', { x: hotspot.anchor.x, y: hotspot.anchor.y - 50 })
    assert.deepEqual(c.snapshot().actor.position, origin)
    send('up', { x: hotspot.anchor.x, y: hotspot.anchor.y - 50 })
    send('cancel', { x: 0, y: 0 })
    assert.equal(c.world.actor.behavior, hotspot.id); assert.deepEqual(c.world.actor.position, hotspot.anchor)
    validateWorld(c.snapshot(), scene)
  }
  const rest = c.snapshot()
  send('down', { x: rest.actor.position.x, y: rest.actor.position.y - 40 })
  send('move', { x: -100, y: -100 }); send('up', { x: -100, y: -100 })
  assert.deepEqual(c.snapshot(), rest); assert.equal(c.lastPlacement, 'rejected')
  send('down', rest.actor.position); send('move', { x: 170, y: 350 })
  c.pause('hidden', true); c.advance(30); assert.equal(c.drag, null); assert.deepEqual(c.snapshot(), rest)
  c.pause('user', true); c.pause('hidden', false); c.advance(1); assert.equal(c.world.ticks, rest.ticks)
  assert.deepEqual([...c.pauseReasons], ['user'])
  c.pause('user', false); c.advance(1); assert.equal(c.world.ticks, rest.ticks + 3)
  const malformed: World = structuredClone(rest); malformed.actor.behavior = 'walk'; malformed.actor.destination = { x: Infinity, y: 300 }
  assert.throws(() => validateWorld(malformed, scene))
  assert.throws(() => validateWorld({ ...rest, schemaVersion: 3 }, scene))
  assert.throws(() => validateWorld({ ...rest, ticks: NaN }, scene))
  results.push('CSS drag threshold, offset, all three hotspots, invalid landing, post-up cancellation, hidden drag rollback, independent pause reasons, schema validation')
  const profile = await mkdtemp(join(root, 'store-')), store = await SaveStore.open(profile, scene)
  assert.equal(await store.read(), null)
  const op = randomUUID(), first = await store.save(0, initial, op)
  assert.equal(first.revision, 1); assert.deepEqual(await store.save(0, initial, op), first)
  await assert.rejects(store.save(0, initial, randomUUID()), /REVISION_CONFLICT/)
  await assert.rejects(store.save(1, rest, op), /OPERATION_MISMATCH/)
  await assert.rejects(store.save(1, rest, randomUUID(), () => false), /OWNER_LOST/)
  const outcomes = await Promise.allSettled([store.save(1, rest, randomUUID()), store.save(1, initial, randomUUID())])
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1)
  assert.deepEqual(await store.read('previous.json'), first)
  const reopened = await SaveStore.open(profile, scene)
  assert.equal((await reopened.read())!.revision, 2)
  const current = join(store.directory, 'current.json'), bad = '{"schemaVersion":999,"original":"preserve me"}'
  await writeFile(current, bad)
  await assert.rejects(store.read())
  await assert.rejects(store.save(2, initial, randomUUID()))
  assert.equal(await readFile(current, 'utf8'), bad)
  const recovered = await store.recover(() => true)
  assert.deepEqual(recovered.world, initial)
  const backup = (await readdir(store.directory)).find(name => name.startsWith('recovery-'))!
  assert.equal(await readFile(join(store.directory, backup), 'utf8'), bad)
  await writeFile(current, 'x'.repeat(65537)); await assert.rejects(store.read(), /SAVE_FILE_REFUSED/)
  results.push('durable roundtrip/reopen, idempotent ACK, CAS competing writers, owner loss, previous snapshot, invalid/future/oversize refusal and explicit recovery preserving original bytes')
  return results
}

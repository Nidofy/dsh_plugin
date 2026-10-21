import { it, expect } from 'vitest'
import { mkdtemp, readdir, readFile, writeFile, link } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SaveStore, retainedSnapshots } from '../src/host/save-store.ts'
import { createWorld } from '../src/core/world.ts'
import { scene } from '../src/definitions.ts'

it('bounds new snapshots while preserving legacy and unknown files and both recovery pointers', async () => {
  const profile = await mkdtemp(resolve('.build/ai-village-phase4/retention-')), store = await SaveStore.open(profile, scene)
  const snapshots = join(store.directory, 'snapshots'), world = createWorld(scene)
  const legacy = randomUUID() + '.json'; await writeFile(join(snapshots, legacy), 'legacy bytes')
  await writeFile(join(snapshots, 'user-checkpoint.json'), 'unknown')
  for (let i = 0; i < 80; i++) { world.ticks++; await store.save(i, world, randomUUID()) }
  expect((await readdir(snapshots)).filter(name => name.startsWith('managed-v1-'))).toHaveLength(retainedSnapshots)
  expect(await readFile(join(snapshots, legacy), 'utf8')).toBe('legacy bytes')
  expect((await store.read())!.revision).toBe(80); expect((await store.read('previous.json'))!.revision).toBe(79)
  expect((await (await SaveStore.open(profile, scene)).read())!.world.ticks).toBe(80)
  await writeFile(join(store.directory, 'current.json'), 'damaged')
  const recovered = await store.recover(() => true)
  expect(recovered.world.ticks).toBe(79)
  expect((await readdir(store.directory)).some(name => name.startsWith('recovery-'))).toBe(true)
})

it('keeps snapshots referenced by preserved recovery evidence even outside the recent window', async () => {
  const profile = await mkdtemp(resolve('.build/ai-village-phase4/recovery-retention-')), store = await SaveStore.open(profile, scene)
  const world = createWorld(scene)
  await store.save(0, world, randomUUID())
  const bytes = await readFile(join(store.directory, 'current.json'), 'utf8')
  await writeFile(join(store.directory, 'recovery-' + randomUUID() + '.json'), bytes)
  for (let i = 1; i < 40; i++) { world.ticks++; await store.save(i, world, randomUUID()) }
  expect(await readFile(join(store.directory, 'snapshots', JSON.parse(bytes).snapshot), 'utf8')).toContain('"revision":1')
  const operationId = randomUUID(); let checks = 0
  const saved = await store.save(40, world, operationId, () => ++checks <= 3)
  expect(saved.revision).toBe(41); expect(store.retention.diagnostic).toBe('OWNER_LOST')
  expect((await store.read())!.operationId).toBe(operationId)
  expect((await store.save(40, world, operationId)).revision).toBe(41)
})

it('refuses ambiguous cleanup without misreporting a durable save or replaying it', async () => {
  const profile = await mkdtemp(resolve('.build/ai-village-phase4/retention-refuse-')), store = await SaveStore.open(profile, scene)
  const world = createWorld(scene), first = await store.save(0, world, randomUUID())
  const p = JSON.parse(await readFile(join(store.directory, 'current.json'), 'utf8')) as { snapshot: string }
  await link(join(store.directory, 'snapshots', p.snapshot), join(store.directory, 'snapshots', 'external-alias'))
  // A linked current snapshot refuses publication before anything is overwritten.
  await expect(store.save(first.revision, world, randomUUID())).rejects.toThrow('SAVE_FILE_REFUSED')
})

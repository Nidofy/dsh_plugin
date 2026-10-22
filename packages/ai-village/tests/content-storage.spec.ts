import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { SaveStore } from '../src/host/save-store.ts'
import { contentWorldCodec, legacySceneV1 } from '../src/core/migrations.ts'
import { candidateScene } from '../experiments/content-ui/scene.ts'
import { completedContent } from './helpers/content.ts'

const fault = vi.hoisted(() => ({ target: '' as string, after: false }))
vi.mock('@nidofy/dsh-plugin-shared/durable-file', async importOriginal => {
  const actual = await importOriginal<typeof import('../../plugin-shared/src/durable-file.ts')>()
  return { ...actual, writeFileDurable: async (path: string, bytes: string) => {
    const hit = fault.target === 'snapshot' ? /[\\/]snapshots[\\/]/.test(path) : fault.target === 'upgrade' ? /[\\/]upgrade-v1-/.test(path) : fault.target && path.endsWith(fault.target)
    if (hit && !fault.after) { fault.target = ''; throw Error('INJECTED_WRITE_FAILURE') }
    await actual.writeFileDurable(path, bytes)
    if (hit) { fault.target = ''; throw Error('INJECTED_WRITE_FAILURE') }
  } }
})
beforeEach(() => { fault.target = ''; fault.after = false })
async function seeded(version = 3) {
  const base = resolve('.build/ai-village-v0.4-qa/m2'); await mkdir(base, { recursive: true })
  const profile = await mkdtemp(join(base, 'profile-')), store = await SaveStore.open(profile, candidateScene, contentWorldCodec(candidateScene))
  const bytes = await readFile(new URL(`./fixtures/legacy/saved-schema${version}.json`, import.meta.url)), saved = JSON.parse(bytes.toString())
  // Use a managed name, so only the upgrade reference (not legacy naming) protects it from pruning.
  const snapshot = 'managed-v1-' + randomUUID() + '.json', path = join(store.directory, 'snapshots', snapshot)
  await writeFile(path, bytes)
  const pointer = JSON.stringify({ schemaVersion: 1, revision: saved.revision, operationId: saved.operationId, snapshot, hash: createHash('sha256').update(bytes).digest('hex') })
  await writeFile(join(store.directory, 'current.json'), pointer)
  return { store, profile, path, bytes, pointer, revision: saved.revision as number }
}
describe('schema 4 durable migration', () => {
  for (const version of [1, 2, 3]) it(`reads and saves historical format ${version} without rewriting its bytes`, async () => {
    const f = await seeded(version), current = (await f.store.read())!
    expect(current.world.schemaVersion).toBe(4)
    expect(await readFile(join(f.store.directory, 'current.json'), 'utf8')).toBe(f.pointer)
    const saved = await f.store.save(f.revision, current.world, randomUUID())
    expect(saved.revision).toBe(f.revision + 1)
    expect(await readFile(f.path)).toEqual(f.bytes)
    const refs = (await readdir(f.store.directory)).filter(n => n.startsWith('upgrade-v1-'))
    expect(refs).toHaveLength(1); expect(await readFile(join(f.store.directory, refs[0]!), 'utf8')).toBe(f.pointer)
    expect((await f.store.read('previous.json'))!.world).toEqual(current.world)
    const oldReader = await SaveStore.open(f.profile, legacySceneV1)
    await expect(oldReader.read()).rejects.toThrow('INVALID_WORLD')
  })
  it('keeps the pre-upgrade snapshot past 40 saves and restores through a new CAS revision', async () => {
    const f = await seeded(), old = (await f.store.read())!, world = completedContent()
    let saved = await f.store.save(f.revision, world, randomUUID())
    for (let n = 0; n < 40; n++) { world.ticks++; saved = await f.store.save(saved.revision, world, randomUUID()) }
    const reference = (await readdir(f.store.directory)).find(n => n.startsWith('upgrade-v1-'))!
    expect(await readFile(f.path)).toEqual(f.bytes)
    const restored = await f.store.readUpgrade(reference)
    expect(restored.world).toEqual(old.world); expect(restored.world.journal).toHaveLength(0)
    const next = await f.store.save(saved.revision, restored.world, randomUUID())
    expect(next.revision).toBe(saved.revision + 1); expect((await f.store.read())!.world.journal).toHaveLength(0)
    expect((await f.store.read('previous.json'))!.world.journal).toHaveLength(1)
    await expect(f.store.readUpgrade('../current.json')).rejects.toThrow('SAVE_PATH_REFUSED')
  })
  it('recovers a legacy previous snapshot while preserving damaged current evidence', async () => {
    const f = await seeded()
    await f.store.save(f.revision, completedContent(), randomUUID())
    await writeFile(join(f.store.directory, 'current.json'), 'broken-current')
    const recovered = await f.store.recover(() => true)
    expect(recovered.world.schemaVersion).toBe(4); expect(recovered.world.journal).toHaveLength(0)
    const evidence = (await readdir(f.store.directory)).find(n => n.startsWith('recovery-'))!
    expect(await readFile(join(f.store.directory, evidence), 'utf8')).toBe('broken-current')
    expect(await readFile(f.path)).toEqual(f.bytes)
  })
  it('protects both legacy current and previous pointers before replacing either', async () => {
    const f = await seeded(), bytes = await readFile(new URL('./fixtures/legacy/saved-schema1.json', import.meta.url))
    const saved = JSON.parse(bytes.toString()), snapshot = 'managed-v1-' + randomUUID() + '.json'
    await writeFile(join(f.store.directory, 'snapshots', snapshot), bytes)
    const previous = JSON.stringify({ schemaVersion: 1, revision: saved.revision, operationId: saved.operationId, snapshot, hash: createHash('sha256').update(bytes).digest('hex') })
    await writeFile(join(f.store.directory, 'previous.json'), previous)
    await f.store.save(f.revision, completedContent(), randomUUID())
    const references = (await readdir(f.store.directory)).filter(n => n.startsWith('upgrade-v1-'))
    expect(references).toHaveLength(2)
    const preserved = await Promise.all(references.map(n => readFile(join(f.store.directory, n), 'utf8')))
    expect(preserved).toContain(f.pointer); expect(preserved).toContain(previous)
  })
  it('refuses publication when the owner is lost after writing a candidate snapshot', async () => {
    const f = await seeded(), directory = join(f.store.directory, 'snapshots')
    await expect(f.store.save(f.revision, completedContent(), randomUUID(), () => readdirSync(directory).length === 1)).rejects.toThrow('OWNER_LOST')
    expect((await f.store.read())!.world.progress.unlocked).toEqual([])
    expect(await readFile(join(f.store.directory, 'current.json'), 'utf8')).toBe(f.pointer)
    expect((await readdir(f.store.directory)).some(n => n.startsWith('upgrade-v1-'))).toBe(true)
  })
  for (const target of ['upgrade', 'snapshot', 'previous.json', 'current.json']) it(`does not announce rewards when writing ${target} fails before publication`, async () => {
    const f = await seeded(); fault.target = target
    await expect(f.store.save(f.revision, completedContent(), randomUUID())).rejects.toThrow('INJECTED_WRITE_FAILURE')
    const current = (await f.store.read())!
    expect(current.revision).toBe(f.revision); expect(current.world.progress.unlocked).toEqual([])
    expect(await readFile(f.path)).toEqual(f.bytes)
    expect(await readFile(join(f.store.directory, 'current.json'), 'utf8')).toBe(f.pointer)
  })
  it('reads an already published candidate after a post-publication failure and deduplicates the same operation', async () => {
    const f = await seeded(), operationId = randomUUID(), world = completedContent()
    fault.target = 'current.json'; fault.after = true
    await expect(f.store.save(f.revision, world, operationId)).rejects.toThrow('INJECTED_WRITE_FAILURE')
    expect((await f.store.read())!.operationId).toBe(operationId)
    const once = await f.store.save(f.revision, world, operationId)
    expect(once.revision).toBe(f.revision + 1); expect(once.world.journal).toHaveLength(1)
    await expect(f.store.save(f.revision, world, randomUUID())).rejects.toThrow('REVISION_CONFLICT')
  })
  it('stops pruning on damaged upgrade evidence without misreporting a committed save', async () => {
    const f = await seeded(), world = completedContent()
    let saved = await f.store.save(f.revision, world, randomUUID())
    saved = await f.store.save(saved.revision, world, randomUUID())
    const reference = (await readdir(f.store.directory)).find(n => n.startsWith('upgrade-v1-'))!
    await writeFile(join(f.store.directory, reference), '{}')
    const count = (await readdir(join(f.store.directory, 'snapshots'))).length
    saved = await f.store.save(saved.revision, world, randomUUID())
    expect(f.store.retention.diagnostic).toBe('UPGRADE_REFERENCE_MISMATCH')
    expect((await f.store.read())!.revision).toBe(saved.revision)
    expect((await readdir(join(f.store.directory, 'snapshots'))).length).toBe(count + 1)
    expect(await readFile(f.path)).toEqual(f.bytes)
  })
})

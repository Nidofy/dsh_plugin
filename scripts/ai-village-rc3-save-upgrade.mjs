/** Reopen a save written by the SHA-pinned rc.2 release with the rc.3 candidate. */
import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import * as tar from 'tar'
import { root, villageCompatibility } from './ai-village-compatibility.mjs'
const lane = villageCompatibility('rc3'), hash = b => createHash('sha256').update(b).digest('hex')
const oldFile = join(root, 'dist/nidofy-dsh-ai-village-0.13.0-preview.3.tgz')
assert.equal(hash(await readFile(oldFile)), '50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2')
const stage = await mkdtemp(join(root, '.build/ai-village-rc3-upgrade-')), extracted = join(stage, 'old')
await mkdir(extracted); await tar.x({ file: oldFile, cwd: extracted })
const old = await import(pathToFileURL(join(extracted, 'package/lib/service.mjs')).href)
const current = await import(pathToFileURL(join(lane.out, 'lib/service.mjs')).href)
const world = JSON.parse(await readFile(join(root, 'packages/ai-village/tests/fixtures/tea-ordinary-world14.json'), 'utf8'))
assert.equal(world.schemaVersion, 14)
const profile = join(stage, 'profile'), signal = new AbortController().signal
await mkdir(profile)
let host = await old.VillageHost.open(profile, join(extracted, 'package/assets'), join(extracted, 'package/lib'), signal)
const owner = await host.execute('acquire', { clientId: randomUUID() }), operationId = randomUUID()
try { await host.execute('save', { ...owner, expectedRevision: 0, world, operationId }) } finally { await host.close() }
const pointerPath = join(profile, 'nidofy-ai-village/current.json'), pointer = await readFile(pointerPath)
const snapshotPath = join(profile, 'nidofy-ai-village/snapshots', JSON.parse(pointer).snapshot), snapshot = await readFile(snapshotPath)
host = await current.VillageHost.open(profile, join(root, 'packages/ai-village/assets'), join(lane.out, 'lib'), signal)
try {
  const restored = await host.store.read()
  assert.deepEqual(restored.world, world); assert.equal(restored.revision, 1); assert.equal(restored.operationId, operationId)
  assert.equal(host.profileId, owner.profileId); assert.notEqual(host.epoch, owner.epoch)
  await assert.rejects(host.execute('heartbeat', owner), /OWNER_LOST/)
  assert.deepEqual(await readFile(pointerPath), pointer); assert.deepEqual(await readFile(snapshotPath), snapshot)
  const lease = await host.execute('acquire', { clientId: randomUUID() })
  const ack = await host.execute('save', { ...lease, expectedRevision: 1, world, operationId: randomUUID() })
  assert.equal(ack.revision, 2); assert.deepEqual(ack.world, world)
  assert.deepEqual(await readFile(snapshotPath), snapshot)
} finally { await host.close() }
const evidence = { status: 'PASS', oldPackageSha256: hash(await readFile(oldFile)), dsh: lane.config.dshVersion,
  world: 14, fixture: 'tea-ordinary-world14.json', fixtureSha256: hash(await readFile(join(root, 'packages/ai-village/tests/fixtures/tea-ordinary-world14.json'))),
  checks: ['rc.2 frozen Host wrote save', 'rc.3 Host restored identical world, revision, operation and profile identity', 'stale epoch rejected', 'opening did not rewrite old pointer or snapshot', 'continued CAS save retained old snapshot bytes'],
  candidateBundles: { index: hash(await readFile(join(lane.out, 'lib/index.js'))), service: hash(await readFile(join(lane.out, 'lib/service.mjs'))) } }
const version = JSON.parse(await readFile(join(root, 'packages/ai-village/package.json'), 'utf8')).version
const out = join(root, 'docs/ai-village/compatibility', version); await mkdir(out, { recursive: true })
await writeFile(join(out, 'save-upgrade.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify(evidence, null, 2))

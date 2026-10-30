/** Real packaged Hosts: old-format publication, read-only upgrade, explicit CAS and cold reopen.
 * Uses only repository QA observations and a fresh .build profile for each case. */
import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import * as tar from 'tar'
import { root } from './ai-village-compatibility.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const sourceRecord = join(root, 'docs/ai-village/afternoon/browser/pre6-all-dpr1-01/result.json')
const sourceBytes = await readFile(sourceRecord), source = JSON.parse(sourceBytes)
assert.equal(source.status, 'PASS')
const old15Sha = '34d723b00831408c5b1d178806aeadef3184e54cd20c5abad96f18bf40cc7098'
assert.equal(source.build.artifact.sha256, old15Sha)
const old14File = join(root, 'dist/nidofy-dsh-ai-village-0.13.0-preview.5.tgz')
const old15File = join(root, 'dist/nidofy-dsh-ai-village-0.14.0-preview.6.tgz')
const currentVersion = JSON.parse(await readFile(join(root, 'packages/ai-village/package.json'), 'utf8')).version
const candidate = resolve(root, arg('candidate') ?? `dist/nidofy-dsh-ai-village-${currentVersion}.tgz`)
assert.ok(candidate.startsWith(join(root, 'dist') + sep), 'Candidate must be a repository dist artifact')
const candidateBytes = await readFile(candidate), candidateSha = hash(candidateBytes)
const old14Bytes = await readFile(old14File), old15Bytes = await readFile(old15File)
assert.equal(hash(old14Bytes), 'c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760')
assert.equal(hash(old15Bytes), old15Sha)
const stage = await mkdtemp(join(root, '.build/ai-village-v016-save-upgrade-'))
async function unpack(file, name) {
  const dir = join(stage, name); await mkdir(dir); await tar.x({ file, cwd: dir })
  const pkg = join(dir, 'package'), manifest = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
  assert.equal(manifest.engines.dsh, '0.2.1-rc.3')
  return { pkg, manifest, module: await import(pathToFileURL(join(pkg, 'lib/service.mjs')).href) }
}
const old14 = await unpack(old14File, 'old14'), old15 = await unpack(old15File, 'old15'), current = await unpack(candidate, 'current')
assert.ok(current.manifest.version.startsWith('0.16.'))
const buildIdentity = JSON.parse(await readFile(join(current.pkg, 'lib/build-identity.json'), 'utf8'))
assert.equal(buildIdentity.version, current.manifest.version)
const namedObservation = name => {
  const observation = source.observations.find(item => item.name === name)
  assert.ok(observation?.world, `Missing QA observation ${name}`)
  assert.equal(observation.world.schemaVersion, 15)
  assert.ok(observation.receipt.status === 'committed' || observation.receipt.status === 'idle')
  return observation
}
const selected = [
  { name: 'world14-ordinary-tea', legacy: old14, world: JSON.parse(await readFile(join(root, 'packages/ai-village/tests/fixtures/tea-ordinary-world14.json'), 'utf8')), provenance: { file: 'packages/ai-village/tests/fixtures/tea-ordinary-world14.json' } },
  ...['bookmark-partial-cold', 'reflection-shapes-stage1-prop-canvas', 'reflection-shapes-hidden-keepsake-cold'].map(name => {
    const observation = namedObservation(name)
    return { name, legacy: old15, world: observation.world, provenance: { file: relative(root, sourceRecord).replaceAll('\\', '/'), sha256: hash(sourceBytes), observation: name, revision: observation.revision, receiptStatus: observation.receipt.status } }
  }),
]
assert.equal(selected[1].world.afternoon.active.stage, 1)
assert.equal(selected[1].world.afternoon.active.selection, 'leaf')
assert.equal(selected[2].world.afternoon.active.storyId, 'reflection-shapes')
assert.ok(selected[2].world.afternoon.memories.length > 0)
assert.equal(selected[3].world.afternoon.active, null)
assert.equal(selected[3].world.afternoon.memories.length, 2)
assert.equal(selected[3].world.afternoon.keepsakes['reflection-shapes'], null)
const evidence = { status: 'RUNNING', candidate: { file: relative(root, candidate).replaceAll('\\', '/'), sha256: candidateSha, version: current.manifest.version, bytes: candidateBytes.length }, dsh: '0.2.1-rc.3', stage: relative(root, stage).replaceAll('\\', '/'), oldPackages: { world14: hash(old14Bytes), world15: hash(old15Bytes) }, source: { file: relative(root, sourceRecord).replaceAll('\\', '/'), sha256: hash(sourceBytes) }, bundles: Object.fromEntries(await Promise.all(['service.mjs', 'client.js', 'frame.js', 'build-identity.json'].map(async name => [name, hash(await readFile(join(current.pkg, 'lib', name)))]))), cases: [], checks: [], limitations: ['Packaged Host storage verification; not a native Desktop or visual test', 'Legacy input worlds come from named repository QA observations and a frozen world14 fixture; no real user profiles are read'] }
const output = join(root, 'docs/ai-village/v015-v016/validation', `world16-save-upgrade-${current.manifest.version}-${Date.now()}-${randomUUID().slice(0, 8)}.json`)
await mkdir(join(root, 'docs/ai-village/v015-v016/validation'), { recursive: true })
const signal = new AbortController().signal
try {
  for (const test of selected) {
    const worldBytes = JSON.stringify(test.world), profile = join(stage, test.name)
    await mkdir(profile)
    let host = await test.legacy.module.VillageHost.open(profile, join(test.legacy.pkg, 'assets'), join(test.legacy.pkg, 'lib'), signal)
    let owner, operationId = randomUUID()
    try {
      owner = await host.execute('acquire', { clientId: randomUUID() })
      const oldAck = await host.execute('save', { ...owner, expectedRevision: 0, world: test.world, operationId })
      assert.equal(oldAck.revision, 1)
      assert.deepEqual(oldAck.world, test.world)
    } finally { await host.close() }
    const dir = join(profile, 'nidofy-ai-village'), pointerPath = join(dir, 'current.json')
    const pointer = await readFile(pointerPath), oldPointer = JSON.parse(pointer), snapshotPath = join(dir, 'snapshots', oldPointer.snapshot), snapshot = await readFile(snapshotPath)
    assert.equal(hash(snapshot), oldPointer.hash)
    host = await current.module.VillageHost.open(profile, join(current.pkg, 'assets'), join(current.pkg, 'lib'), signal)
    let migrated, savedOperation
    try {
      const restored = await host.store.read(); migrated = restored.world
      assert.equal(migrated.schemaVersion, 16); assert.equal(migrated.contentRevision, 12); assert.equal(migrated.afternoon.version, 2)
      assert.equal(restored.revision, 1); assert.equal(restored.operationId, operationId)
      assert.equal(host.profileId, owner.profileId); assert.notEqual(host.epoch, owner.epoch)
      await assert.rejects(host.execute('heartbeat', owner), /OWNER_LOST/)
      if (test.world.schemaVersion === 14) {
        const { afternoon, community, ...retained } = migrated
        assert.deepEqual({ ...retained, schemaVersion: 14, contentRevision: 10 }, test.world)
        assert.deepEqual(afternoon.memories, []); assert.deepEqual(community.recent, [])
      } else {
        const { afternoon, ...retained } = migrated
        const oldKeys = ['tea-bookmark', 'reflection-shapes']
        const active = afternoon.active ? (() => { const { step, ...rest } = afternoon.active; assert.equal(step, 0); return { ...rest, version: 1 } })() : null
        const retainedAfternoon = { version: 1, active, memories: afternoon.memories, lastEventIds: Object.fromEntries(oldKeys.map(id => [id, afternoon.lastEventIds[id]])), keepsakes: Object.fromEntries(oldKeys.map(id => [id, afternoon.keepsakes[id]])) }
        assert.deepEqual({ ...retained, schemaVersion: 15, contentRevision: 11, afternoon: retainedAfternoon }, test.world)
        for (const id of Object.keys(afternoon.lastEventIds).filter(id => !oldKeys.includes(id))) { assert.equal(afternoon.lastEventIds[id], null); assert.equal(afternoon.keepsakes[id], null) }
      }
      assert.deepEqual(await readFile(pointerPath), pointer); assert.deepEqual(await readFile(snapshotPath), snapshot)
      // Repeated reads must not publish an upgrade or change any active route.
      assert.deepEqual((await host.store.read()).world, migrated)
      assert.deepEqual(await readFile(pointerPath), pointer); assert.deepEqual(await readFile(snapshotPath), snapshot)
      const lease = await host.execute('acquire', { clientId: randomUUID() }); savedOperation = randomUUID()
      const ack = await host.execute('save', { ...lease, expectedRevision: 1, world: migrated, operationId: savedOperation })
      assert.equal(ack.revision, 2); assert.deepEqual(ack.world, migrated)
      const duplicate = await host.execute('save', { ...lease, expectedRevision: 1, world: migrated, operationId: savedOperation })
      assert.deepEqual(duplicate, ack)
      const publishedPointer = await readFile(pointerPath)
      await assert.rejects(host.execute('save', { ...lease, expectedRevision: 1, world: migrated, operationId: randomUUID() }), /REVISION_CONFLICT/)
      assert.deepEqual(await readFile(pointerPath), publishedPointer)
      assert.deepEqual(await readFile(join(dir, `upgrade-v1-${hash(pointer)}.json`)), pointer)
      assert.deepEqual(await readFile(snapshotPath), snapshot)
    } finally { await host.close() }
    host = await current.module.VillageHost.open(profile, join(current.pkg, 'assets'), join(current.pkg, 'lib'), signal)
    try {
      const reopened = await host.store.read()
      assert.equal(reopened.revision, 2); assert.equal(reopened.operationId, savedOperation); assert.deepEqual(reopened.world, migrated)
      assert.deepEqual(await readFile(snapshotPath), snapshot)
    } finally { await host.close() }
    assert.equal(JSON.stringify(test.world), worldBytes)
    evidence.cases.push({ name: test.name, status: 'PASS', provenance: test.provenance, fromSchema: test.world.schemaVersion, inputWorldSha256: hash(worldBytes), originalPointerSha256: hash(pointer), originalSnapshotSha256: hash(snapshot), upgradedWorldSha256: hash(JSON.stringify(migrated)), revision: 2, memories: migrated.afternoon.memories.map(memory => ({ storyId: memory.storyId, eventId: memory.eventId, count: memory.count, selection: memory.selection })), active: migrated.afternoon.active ? { storyId: migrated.afternoon.active.storyId, stage: migrated.afternoon.active.stage, phase: migrated.afternoon.active.phase, step: migrated.afternoon.active.step, selection: migrated.afternoon.active.selection } : null })
  }
  assert.equal(hash(await readFile(sourceRecord)), hash(sourceBytes))
  assert.equal(hash(await readFile(candidate)), candidateSha)
  evidence.status = 'PASS'
  evidence.checks = ['Frozen world14/world15 packaged Hosts write genuine old-format saves into fresh isolated profiles', 'Current packaged Host decodes world16 without rewriting original pointer or snapshot', 'Completed memory IDs, participants, replay counts, stored placement and active choices/routes survive', 'New story keys are empty and migration reads are idempotent', 'Old Host epoch rejected', 'One explicit CAS publishes revision2; duplicate operation returns identical ACK', 'Stale revision rejected without overwriting published pointer', 'Exact original pointer protected and original snapshot bytes retained', 'Cold packaged Host reopen preserves upgraded world and revision', 'Historical source evidence and candidate package remain byte-identical']
} catch (error) { evidence.status = 'FAIL'; evidence.error = String(error?.stack ?? error); throw error }
finally { await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: evidence.status, evidence: relative(root, output).replaceAll('\\', '/'), candidateSha256: candidateSha, cases: evidence.cases.map(test => ({ name: test.name, status: test.status })) }, null, 2)) }

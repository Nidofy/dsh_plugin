/** Install the three release tarballs offline, then exercise published rc.3 services. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, readdir, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname, delimiter } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { Script } from 'node:vm'
import yaml from 'js-yaml'
import * as tar from 'tar'
import { villageCompatibility, root } from './ai-village-compatibility.mjs'
const lane = villageCompatibility('rc3'), require = createRequire(import.meta.url)
const runtime = createRequire(join(lane.runtime, 'package.json'))
const extra = createRequire(join(root, '.build/rc3-coexistence-deps/package.json'))
const ui = createRequire(join(root, 'tools/notebook-rc3-deps/package.json'))
const names = ['runtime-adapter', 'working-notebook', 'source-control'].map(name => '@nidofy/dsh-' + name)
const compatibility = JSON.parse(await readFile(join(root, 'tools/compatibility/notebook-rc3.json'), 'utf8'))
assert.equal(compatibility.originalRevision, lane.baseline.revision)
assert.equal(compatibility.officialArchiveSha256, lane.baseline.archiveHash)
const artifacts = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8')).filter(item => names.includes(item.name))
assert.equal(artifacts.length, 3)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const stage = await mkdtemp(join(root, '.build/notebook-rc3-smoke-'))
const profile = join(stage, 'home/profiles/qualification'), store = join(stage, 'empty-store')
await mkdir(profile, { recursive: true }); await mkdir(store)
await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'notebook-rc3-qualification', private: true, type: 'module', dependencies: {}, dsh: { profile: { bundles: [] } } }))
await writeFile(join(profile, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
const peers = new Set(), checks = []
for (const item of artifacts) {
  const file = join(root, 'dist', item.file)
  assert.equal(hash(await readFile(file)), item.sha256)
  assert.equal(item.dsh, lane.config.dshVersion)
  const unpacked = join(stage, item.name.split('/')[1]); await mkdir(unpacked)
  await tar.x({ file, cwd: unpacked, strip: 1 })
  const pkg = JSON.parse(await readFile(join(unpacked, 'package.json'), 'utf8'))
  for (const section of ['dependencies', 'peerDependencies', 'devDependencies']) for (const version of Object.values(pkg[section] ?? {})) assert.doesNotMatch(version, /^(?:workspace|link|file):/)
  const identity = JSON.parse(await readFile(join(unpacked, 'lib/build-identity.json'), 'utf8'))
  assert.equal(identity.revision, lane.baseline.revision); assert.equal(identity.version, pkg.version)
  assert.equal(identity.archiveSha256, lane.baseline.archiveHash)
  assert.equal(identity.runtimeLockSha256, hash(await readFile(join(lane.runtime, 'package-lock.json'))))
  const source = join(root, 'packages', item.name.replace('@nidofy/dsh-', ''), 'src')
  assert.deepEqual(identity.source, Object.fromEntries(await Promise.all((await readdir(source, { recursive: true })).filter(file => /\.(?:ts|tsx|mts)$/.test(file)).map(async file =>
    [file.replaceAll('\\', '/'), hash(await readFile(join(source, file)))]))), 'Stale build: current source differs from tarball')
  for (const [id, version] of Object.entries(pkg.peerDependencies)) {
    if (id.startsWith('@deepseek-ai/dsh-')) assert.equal(version, lane.config.dshVersion)
    if (!id.startsWith('@nidofy/')) peers.add(id)
  }
  if (pkg.dependencies['@nidofy/dsh-plugin-shared']) {
    const shared = JSON.parse(await readFile(join(unpacked, 'node_modules/@nidofy/dsh-plugin-shared/package.json'), 'utf8'))
    assert.equal(shared.engines.dsh, lane.config.dshVersion)
    for (const [id, version] of Object.entries(shared.peerDependencies)) if (id.startsWith('@deepseek-ai/dsh-')) assert.equal(version, lane.config.dshVersion)
  }
  if (pkg.dsh.client) {
    let registration
    const code = await readFile(join(unpacked, 'lib/client.js'), 'utf8')
    new Script(code).runInNewContext({ window: { __ModuleLoader__: { load: value => { registration = value } } } })
    assert.equal(registration.id, pkg.name); assert.equal(typeof registration.factory, 'function')
    for (const [, id] of code.matchAll(/require\("([^"]+)"\)/g)) assert.ok(['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives'].includes(id), id)
  }
  for (const entry of (await readdir(unpacked, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())) {
    if (!/\.(?:js|cjs|mjs|json|ts|yml)$/.test(entry.name) || entry.parentPath.includes('node_modules')) continue
    assert.ok(!/[A-Z]:[\\/]Documents[\\/]/.test(await readFile(join(entry.parentPath, entry.name), 'utf8')), 'Development path in artifact: ' + entry.name)
  }
}
checks.push('Tarball hashes, rc.3 provenance, exports and browser factories; embedded shared peers aligned')
const pnpm = [process.env.PNPM_CLI, join(root, '.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs'), ...process.env.PATH.split(delimiter).flatMap(dir => [join(dir, 'node_modules/pnpm/bin/pnpm.mjs'), join(dir, 'node_modules/pnpm/bin/pnpm.cjs')])].filter(Boolean).find(existsSync)
assert.ok(pnpm, 'Set PNPM_CLI to an installed pnpm entry')
const { runProfilePnpm } = await import(pathToFileURL(runtime.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href)
assert.deepEqual(await readdir(store), [])
const installed = await runProfilePnpm({ profile: 'qualification', dir: profile, home: join(stage, 'home'), cwd: root, installAnchor: runtime.resolve('@deepseek-ai/dsh/package.json') },
  ['add', ...artifacts.map(item => join(root, 'dist', item.file)), '--offline', '--ignore-scripts', '--store-dir', store, '--registry=http://127.0.0.1:9'],
  { execution: 'service', command: process.execPath, args: [pnpm], env: { CI: '1', COREPACK_ENABLE_NETWORK: '0' }, outputBytes: 16384, activateNewBundles: false, idleTimeoutMs: 30000 })
assert.equal(installed.exitCode, 0, installed.output)
checks.push('Official rc.3 package manager: all three packages installed with empty cache, offline and scripts disabled')
// Supply only host peers, after the empty-store import; never link plugin source into the installed profile.
for (const id of peers) {
  const peer = id === '@deepseek-ai/dsh-client-ui-primitives' ? extra : id === '@deepseek-ai/dsh-client-store' ? ui : runtime
  const path = peer.resolve(id + '/package.json'), pkg = JSON.parse(await readFile(path, 'utf8'))
  if (id.startsWith('@deepseek-ai/dsh-')) assert.equal(pkg.version, lane.config.dshVersion, id)
  const destination = join(profile, 'node_modules', id); await mkdir(dirname(destination), { recursive: true })
  if (!existsSync(destination)) await symlink(dirname(path), destination, 'junction')
}
const run = (args, cwd = profile, env = {}) => {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, ...env } })
  assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout
}
await writeFile(join(profile, 'smoke.mjs'), `
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { Context } from '@deepseek-ai/cordis'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import Runtime from '@nidofy/dsh-runtime-adapter'
import * as Notebook from '@nidofy/dsh-working-notebook'
import * as Vcs from '@nidofy/dsh-source-control'
import Compaction from '@nidofy/dsh-runtime-adapter/compaction'
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import { NotebookStore } from '@nidofy/dsh-working-notebook/standard-store'
assert.equal(Notebook.name, 'nidofy-working-notebook'); assert.equal(Notebook.Config({}).maxActiveEntries, 64)
assert.equal(Vcs.name, 'nidofy-source-control'); assert.equal(Vcs.Config({}).includeWorkspaces, true)
assert.ok(Compaction.prototype instanceof BasicCompactionEngine)
const root = join(import.meta.dirname, 'data'), ctx = new Context()
await ctx.plugin(Runtime, { root, compression: 'none' })
const session = Session.create(SessionId('rc3-packed-worker'))
const writer = await ctx.sessionPersistence.create(session.header); await writer.flush()
const observation = await ctx.sessionPersistence.observeDurable(session.id)
assert.equal(observation.durableThrough, -1)
assert.equal(await ctx.sessionPersistence.withGeneration(session.id, observation.generation, async () => 'published'), 'published')
await writer.close()
const file = (await readdir(root, { recursive: true })).find(file => file.endsWith('.jsonl')); assert.ok(file)
const before = await readFile(join(root, file))
const worker = new Worker(new URL('./worker.cjs', import.meta.resolve('@nidofy/dsh-runtime-adapter')), { workerData: { path: join(root, file), compression: 'none', expectedId: session.id, expectedEventCount: 0 }, execArgv: [] })
await new Promise((resolve, reject) => { worker.once('message', value => value.ok ? resolve(value) : reject(Error(value.message))); worker.once('error', reject); worker.once('exit', code => { if (code) reject(Error('Worker exit ' + code)) }) })
await ctx.fiber.dispose()
const cold = new Context(); await cold.plugin(Runtime, { root, compression: 'none' })
assert.deepEqual(await cold.sessionPersistence.observeDurable(session.id), observation)
assert.deepEqual(await readFile(join(root, file)), before)
await cold.fiber.dispose()
const notes = new NotebookStore(join(root, 'notes'), { maxEntries: 8, maxBytes: 8192 })
assert.equal((await notes.read('smoke')).revision, 0); await notes.close()
console.log('PASS published Host imports, compaction inheritance, native locks, durable observation, cold reopen and real rc.3 worker')
`)
checks.push(run([join(profile, 'smoke.mjs')]).trim())
// The old release writes real JSONL and v2 notes; rc.3 reopens those same files.
const old = join(stage, 'old-release'); await mkdir(old)
const oldPeers = new Set()
for (const [name, version] of [['runtime-adapter', '0.1.1'], ['working-notebook', '0.2.0']]) {
  const dest = join(old, 'node_modules/@nidofy/dsh-' + name); await mkdir(dest, { recursive: true })
  const legacy = compatibility.legacyArtifacts.find(item => item.name === '@nidofy/dsh-' + name && item.version === version)
  assert.ok(legacy); assert.equal(hash(await readFile(join(root, 'dist', legacy.file))), legacy.sha256)
  await tar.x({ file: join(root, 'dist', legacy.file), cwd: dest, strip: 1 })
  const pkg = JSON.parse(await readFile(join(dest, 'package.json'), 'utf8')); assert.equal(pkg.engines.dsh, '0.2.1-rc.2')
  for (const id of Object.keys(pkg.peerDependencies)) if (!id.startsWith('@nidofy/') && !id.includes('client-') && !id.startsWith('react')) oldPeers.add(id)
}
const oldRuntime = createRequire(join(root, '.build/official-runtime/package.json'))
for (const id of oldPeers) {
  const peer = oldRuntime.resolve(id + '/package.json')
  if (id.startsWith('@deepseek-ai/dsh-')) assert.equal(JSON.parse(await readFile(peer, 'utf8')).version, '0.2.1-rc.2', id)
  const dest = join(old, 'node_modules', id); await mkdir(dirname(dest), { recursive: true }); await symlink(dirname(peer), dest, 'junction')
}
const upgradeData = join(stage, 'upgrade-data')
const upgradeRunner = `
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import Runtime from '@nidofy/dsh-runtime-adapter'
import { NotebookV2Store } from '@nidofy/dsh-working-notebook/notebook'
const home = ${JSON.stringify(upgradeData)}, create = process.argv[2] === 'create', ctx = new Context()
await ctx.plugin(Runtime, { root: join(home, 'sessions'), compression: 'none' })
const id = SessionId('upgrade-session')
if (create) {
  const session = Session.create(id), writer = await ctx.sessionPersistence.create(session.header)
  const event = session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Keep this pinned Chinese note: 保留笔记。' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  await writer.append([event]); await writer.close()
}
const observed = await ctx.sessionPersistence.observeDurable(id), scope = { sessionId: id, generation: observed.generation }
const store = new NotebookV2Store(join(home, 'notes'), { maxActiveEntries: 8, maxActiveBytes: 4096, maxDeltaBytes: 4096, maxEvidenceBytes: 2048, maxHistoryBytes: 524288 })
if (create) {
  const notes = await store.publish(0, scope, { cursors: { evidenceThrough: 0, commitThrough: 0 }, operations: [{ action: 'ADD', id: 'retained', kind: 'constraint', text: '保留笔记', seq: 0, quote: '保留笔记', pinned: true }] }, observed.events, 'user')
  await writeFile(join(home, 'expected.json'), JSON.stringify({ observed, notes }))
} else {
  const expected = JSON.parse(await readFile(join(home, 'expected.json'), 'utf8'))
  assert.deepEqual(observed, expected.observed)
  assert.deepEqual(await store.readCommitted(scope), expected.notes)
  assert.equal(expected.notes.active[0].pinned, true)
}
await store.close(); await ctx.fiber.dispose()
`
await writeFile(join(old, 'upgrade.mjs'), upgradeRunner); run([join(old, 'upgrade.mjs'), 'create'], old)
const inventory = async () => Object.fromEntries(await Promise.all((await readdir(upgradeData, { recursive: true, withFileTypes: true })).filter(item => item.isFile()).map(async item => [join(item.parentPath, item.name), hash(await readFile(join(item.parentPath, item.name)))])))
const beforeUpgrade = await inventory()
await writeFile(join(profile, 'upgrade.mjs'), upgradeRunner); run([join(profile, 'upgrade.mjs'), 'reopen'])
assert.deepEqual(await inventory(), beforeUpgrade)
checks.push('Frozen rc.2 packages wrote JSONL and pinned v2 note; rc.3 restored generation, events, notes and cursors without changing any saved bytes')
await writeFile(join(profile, 'consumer.ts'), `import type { Config } from '@nidofy/dsh-working-notebook'\nimport type { Config as Vcs } from '@nidofy/dsh-source-control'\nimport Compaction from '@nidofy/dsh-runtime-adapter/compaction'\nexport type Consumer = [Config, Vcs, typeof Compaction]\n`)
await writeFile(join(profile, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, noEmit: true }, files: ['consumer.ts'] }))
run([require.resolve('typescript/bin/tsc'), '-p', join(profile, 'tsconfig.json')]); checks.push('Installed public TypeScript declarations')
const pkg = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
pkg.dsh = { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...names] } }
await writeFile(join(profile, 'package.json'), JSON.stringify(pkg))
// CLI resolves the official bundles from its installation and plugins from this profile.
const dump = run([join(dirname(runtime.resolve('@deepseek-ai/dsh/package.json')), 'lib/bin.js'), '--profile', 'qualification', '--dump-config'], lane.runtime, { DSH_HOME: join(stage, 'home') })
const schema = yaml.JSON_SCHEMA.extend(new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: value => ({ __jsExpr: value }) }))
const rows = list => list.flatMap(row => [row, ...(row.group && Array.isArray(row.config) ? rows(row.config) : [])])
const all = rows(yaml.load(dump, { schema }))
assert.equal(all.find(row => row.id === 'session-persistence-jsonl').disabled, true)
for (const id of ['nidofy-runtime-jsonl', 'nidofy-working-notebook', 'nidofy-source-control', 'preset-notebook']) assert.ok(all.find(row => row.id === id), id)
assert.equal(rows(all.find(row => row.id === 'preset-notebook').config.plugins).find(row => row.id === 'compaction-basic').name, '@nidofy/dsh-runtime-adapter/compaction')
const standard = yaml.load(await readFile(join(lane.baseline.source, 'packages/bundle/web-app/presets/standard.patch.yml'), 'utf8'), { schema })[0].insert[0]
standard.id = 'preset-notebook'; standard.config.id = 'notebook'; standard.config.name = 'Notebook'; standard.config.order = 5
rows(standard.config.plugins).find(row => row.id === 'compaction-basic').name = '@nidofy/dsh-runtime-adapter/compaction'
const notebookPreset = yaml.load(await readFile(join(root, 'packages/runtime-adapter/notebook.preset.patch.yml'), 'utf8'), { schema })[0].insert[0]
assert.deepEqual(notebookPreset, standard, 'Notebook preset drifted from the official Standard preset')
await writeFile(join(stage, 'profile.yml'), dump)
checks.push('Official rc.3 CLI composition: single JSONL writer and Notebook compaction preset')
const evidence = { status: 'PASS', dsh: lane.config.dshVersion, revision: lane.baseline.revision, artifacts, checks, limitations: ['Native Desktop GUI not exercised by this script'], stage }
await writeFile(join(root, 'dist/notebook-rc3-verification.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify(evidence, null, 2))

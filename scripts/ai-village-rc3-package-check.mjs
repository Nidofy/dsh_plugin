/** Empty-store offline import through the actual rc.3 package-operation service. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, delimiter } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
import { villageCompatibility, root } from './ai-village-compatibility.mjs'
const lane = villageCompatibility('rc3'), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const pkg = JSON.parse(await readFile(join(root, 'packages/ai-village/package.json'), 'utf8'))
assert.equal(pkg.engines.dsh, lane.config.dshVersion)
const filename = `nidofy-dsh-ai-village-${pkg.version}.tgz`, file = join(root, 'dist', filename)
const bytes = await readFile(file), stage = await mkdtemp(join(root, '.build/ai-village-rc3-offline-'))
await mkdir(join(stage, 'unpacked')); await tar.x({ file, cwd: join(stage, 'unpacked') })
const unpacked = join(stage, 'unpacked/package'), manifest = JSON.parse(await readFile(join(unpacked, 'package.json'), 'utf8'))
const provenance = JSON.parse(await readFile(join(unpacked, 'lib/build-identity.json'), 'utf8'))
assert.equal(provenance.dsh, lane.config.dshVersion)
assert.equal(provenance.revision, lane.config.originalRevision)
assert.equal(provenance.archiveSha256, lane.config.officialArchiveSha256)
assert.equal(provenance.runtimeLockSha256, hash(await readFile(join(root, 'tools/official-runtime-rc3/package-lock.json'))))
assert.equal(provenance.version, pkg.version)
assert.equal(manifest.version, pkg.version)
const buildSource = {}
for (const directory of ['src', 'experiments/content-ui']) for (const name of (await readdir(join(root, 'packages/ai-village', directory), { recursive: true })).filter(n => /\.tsx?$/.test(n))) {
  buildSource[(directory + '/' + name).replaceAll('\\', '/')] = hash(await readFile(join(root, 'packages/ai-village', directory, name)))
}
assert.deepEqual(provenance.source, buildSource, 'Packed build no longer matches current source; rebuild before qualification')
assert.deepEqual(provenance.embeddedInputs, {
  'packages/plugin-shared/src/durable-file.ts': hash(await readFile(join(root, 'packages/plugin-shared/src/durable-file.ts'))),
  'official/packages/util/atomic-write/src/index.ts': hash(await readFile(join(lane.baseline.source, 'packages/util/atomic-write/src/index.ts'))),
}, 'Embedded Host inputs changed since build')
assert.equal(manifest.engines.dsh, lane.config.dshVersion)
assert.equal(JSON.parse(await readFile(join(unpacked, 'OFFLINE-DEPENDENCIES.json'), 'utf8')).host, 'DSH ' + lane.config.dshVersion)
for (const [name, version] of Object.entries(manifest.peerDependencies)) if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, lane.config.dshVersion)
const installedRuntime = createRequire(join(lane.runtime, 'package.json'))
const { runProfilePnpm } = await import(pathToFileURL(installedRuntime.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href)
const pnpm = [process.env.PNPM_CLI, join(root, '.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs'), ...process.env.PATH.split(delimiter).flatMap(p => [join(p, 'node_modules/pnpm/bin/pnpm.mjs'), join(p, 'node_modules/pnpm/bin/pnpm.cjs')])].filter(Boolean).find(existsSync)
assert.ok(pnpm, 'Set PNPM_CLI to the installed pnpm JavaScript entry')
const profile = join(stage, 'profile'), store = join(stage, 'empty-store')
await mkdir(profile); await mkdir(store); assert.deepEqual(await readdir(store), [])
await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'ai-village-rc3-offline-qualification', private: true, type: 'module', dependencies: {}, dsh: { bundles: [] } }))
await writeFile(join(profile, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
const result = await runProfilePnpm({ profile: 'qualification', dir: profile, home: join(stage, 'home'), cwd: root, installAnchor: installedRuntime.resolve('@deepseek-ai/dsh/package.json') },
  ['add', file, '--offline', '--ignore-scripts', '--store-dir', store, '--registry=http://127.0.0.1:9'],
  { execution: 'service', command: process.execPath, args: [pnpm], env: { CI: '1', COREPACK_ENABLE_NETWORK: '0' }, outputBytes: 16384, activateNewBundles: false, idleTimeoutMs: 30000 })
assert.equal(result.exitCode, 0, result.output)
const installed = join(profile, 'node_modules', pkg.name), requireInstalled = createRequire(join(installed, 'package.json'))
assert.ok(requireInstalled.resolve('koffi').startsWith(profile), 'Native dependency escaped offline installation')
assert.equal(requireInstalled('koffi').sizeof('int'), 4)
const files = {}, source = {}, bundles = {}
for (const entry of (await readdir(unpacked, { recursive: true, withFileTypes: true })).filter(e => e.isFile())) {
  const relative = join(entry.parentPath, entry.name).slice(unpacked.length + 1).replaceAll('\\', '/')
  files[relative] = hash(await readFile(join(unpacked, relative)))
  assert.equal(hash(await readFile(join(installed, relative))), files[relative], 'Installed bytes differ: ' + relative)
  if (relative.startsWith('lib/') || relative.startsWith('assets/')) assert.equal(hash(await readFile(join(root, 'packages/ai-village', relative))), files[relative], 'Source build differs: ' + relative)
}
for (const name of (await readdir(join(root, 'packages/ai-village/src'), { recursive: true })).filter(n => /\.tsx?$/.test(n))) source[name.replaceAll('\\', '/')] = hash(await readFile(join(root, 'packages/ai-village/src', name)))
for (const name of ['index.js', 'client.js', 'frame.js']) bundles[name] = files['lib/' + name]
const identity = { status: 'OFFLINE_IMPORT_PASS_NATIVE_DESKTOP_SEPARATE', version: pkg.version, file: filename, sha256: hash(bytes), bytes: bytes.length,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  dsh: lane.config.dshVersion, revision: lane.baseline.revision, archiveHash: lane.baseline.archiveHash,
  runtimeLockSha256: hash(await readFile(join(root, 'tools/official-runtime-rc3/package-lock.json'))),
  offline: true, emptyStore: true, lifecycleScripts: false, service: 'rc.3 runProfilePnpm', source, bundles, files }
const evidence = join(root, 'docs/ai-village/compatibility', pkg.version)
await mkdir(evidence, { recursive: true })
await writeFile(join(evidence, 'package-identity.json'), JSON.stringify(identity, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ version: pkg.version, file, sha256: identity.sha256, bytes: bytes.length, files: Object.keys(files).length, offline: 'PASS', evidence }, null, 2))

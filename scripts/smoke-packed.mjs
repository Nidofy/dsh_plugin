/** Load extracted artifacts without resolving either feature from the development source tree. */
import { mkdtemp, mkdir, readFile, writeFile, symlink, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Script } from 'node:vm'
import assert from 'node:assert/strict'
import * as tar from 'tar'
import yaml from 'js-yaml'
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url)
await mkdir(join(root, '.build'), { recursive: true })
const stage = await mkdtemp(join(root, '.build/installed-'))
await writeFile(join(stage, 'package.json'), '{"private":true,"type":"module"}\n')
const manifest = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'))
for (const item of manifest) {
  const dir = join(stage, 'node_modules', item.name)
  await mkdir(dir, { recursive: true })
  await tar.x({ file: join(root, 'dist', item.file), cwd: dir, strip: 1 })
}
const peers = new Set()
for (const item of manifest) {
  const dir = join(stage, 'node_modules', item.name), pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  for (const dep of [...Object.keys(pkg.peerDependencies ?? {}), ...Object.keys(pkg.dependencies ?? {})]) {
    if (dep.startsWith('@nidofy/')) continue
    peers.add(dep)
  }
  if (pkg.dsh) {
    const schema = yaml.JSON_SCHEMA.extend(new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: data => ({ __jsExpr: data }) }))
    for (const file of [pkg.dsh.bundle.patch].flat()) assert.ok(Array.isArray(yaml.load(await readFile(join(dir, file), 'utf8'), { schema })))
    if (!pkg.dsh.client) continue
    let registered
    const code = await readFile(join(dir, 'lib/client.js'), 'utf8')
    new Script(code).runInNewContext({ window: { __ModuleLoader__: { load: value => { registered = value } } } })
    assert.equal(registered.id, pkg.name)
    assert.equal(typeof registered.factory, 'function')
    const imports = [...code.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
    const allowed = new Set(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-store'])
    for (const imported of imports) assert.ok(allowed.has(imported), 'Unregistered browser external: ' + imported)
  }
}
// DSH peers belong to the host installation. Use its built public packages, never plugin source aliases.
for (const dep of peers) {
  const target = join(root, 'node_modules', dep), destination = join(stage, 'node_modules', dep)
  await mkdir(dirname(destination), { recursive: true })
  await symlink(target, destination, process.platform === 'win32' ? 'junction' : 'dir')
}
const runner = `import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Context } from '@deepseek-ai/cordis'
import { Worker } from 'node:worker_threads'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import Runtime from '@nidofy/dsh-runtime-adapter'
import * as Pets from '@nidofy/dsh-desktop-pets'
import * as Notebook from '@nidofy/dsh-working-notebook'
import { NotebookStore } from '@nidofy/dsh-working-notebook/standard-store'
import { PreferenceStore, defaults } from '@nidofy/dsh-plugin-shared/state'
assert.equal(Pets.name, 'nidofy-desktop-pets')
assert.equal(Notebook.name, 'nidofy-working-notebook')
assert.equal(Notebook.Config({}).maxActiveEntries, 64)
const ctx = new Context(); assert.ok(ctx); await ctx.fiber.dispose()
const home = await mkdtemp(join(tmpdir(), 'dsh-packed-data-'))
const store = new PreferenceStore(home); await store.open()
await store.save({ ...defaults(), pets: true }); await store.close()
const reread = new PreferenceStore(home); await reread.open(); assert.equal(reread.value.pets, true); await reread.close()
const notes = new NotebookStore(join(home, 'notes'), { maxEntries: 8, maxBytes: 8192 })
assert.equal((await notes.read('packed-smoke')).revision, 0); await notes.close()
const require = createRequire(import.meta.url)
assert.ok(require.resolve('@nidofy/dsh-desktop-pets/preload').endsWith('preload.cjs'))
const runtime = new Context()
await runtime.plugin(Runtime, { root: join(home, 'sessions'), compression: 'none' })
const session = Session.create(SessionId('packed-worker'))
const writer = await runtime.sessionPersistence.create(session.header); await writer.flush()
const observed = await runtime.sessionPersistence.observeDurable(session.id)
assert.equal(observed.durableThrough, -1)
assert.equal(await runtime.sessionPersistence.withGeneration(session.id, observed.generation, async () => 'published'), 'published')
await writer.close()
const file = (await readdir(join(home, 'sessions'), { recursive: true })).find(file => file.endsWith('.jsonl'))
assert.ok(file)
const worker = new Worker(new URL('./worker.cjs', import.meta.resolve('@nidofy/dsh-runtime-adapter')), {
  workerData: { path: join(home, 'sessions', file), compression: 'none', expectedId: session.id, expectedEventCount: 0 }, execArgv: [],
})
await new Promise((resolve, reject) => { worker.once('message', value => value.ok ? resolve(value) : reject(Error(value.message))); worker.once('error', reject); worker.once('exit', code => { if (code) reject(Error('Worker exit ' + code)) }) })
await runtime.fiber.dispose(); await rm(home, { recursive: true, force: true })
console.log('Packed Host imports, persistence, generation guard, real verifier worker and preload passed')
`
await writeFile(join(stage, 'smoke.mjs'), runner)
const run = spawnSync(process.execPath, [join(stage, 'smoke.mjs')], { cwd: stage, encoding: 'utf8' })
if (run.status !== 0) throw Error(run.stdout + run.stderr)
console.log(run.stdout.trim())
await writeFile(join(stage, 'consumer.ts'), `import type { Config } from '@nidofy/dsh-working-notebook'
import type { PetSettings } from '@nidofy/dsh-plugin-shared/state'
import { installPetDesktop } from '@nidofy/dsh-desktop-pets/electron'
export type Consumer = [Config, PetSettings, typeof installPetDesktop]
`)
await writeFile(join(stage, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, noEmit: true }, files: ['consumer.ts'] }))
const check = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(stage, 'tsconfig.json')], { cwd: stage, encoding: 'utf8' })
if (check.status !== 0) throw Error(check.stdout + check.stderr)
console.log('Packed browser factories, bundle declarations and TypeScript consumer passed')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const profile = join(stage, 'home/profiles/plugin-smoke')
await mkdir(profile, { recursive: true })
await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'plugin-smoke-profile', private: true,
  dependencies: { '@nidofy/dsh-desktop-pets': '0.1.0', '@nidofy/dsh-working-notebook': '0.1.0', '@nidofy/dsh-runtime-adapter': '0.1.0' },
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@nidofy/dsh-runtime-adapter', '@nidofy/dsh-desktop-pets', '@nidofy/dsh-working-notebook'] } },
}))
await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
const dump = spawnSync(process.execPath, ['--import', pathToFileURL(join(source, 'node_modules/tsx/dist/esm/index.mjs')).href,
  join(source, 'apps/cli/src/bin.ts'), '--profile', 'plugin-smoke', '--dump-config'],
  { cwd: source, encoding: 'utf8', timeout: 30000, env: { ...process.env, DSH_HOME: join(stage, 'home') } })
if (dump.status !== 0) throw Error(dump.stdout + dump.stderr)
for (const id of ['nidofy-desktop-pets', 'nidofy-working-notebook', 'nidofy-runtime-jsonl', 'preset-notebook']) assert.ok(dump.stdout.includes(id), 'Missing CLI composition: ' + id)
const schema = yaml.JSON_SCHEMA.extend(new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: data => ({ __jsExpr: data }) }))
const composed = yaml.load(dump.stdout, { schema })
const rows = list => list.flatMap(row => [row, ...(row.group && Array.isArray(row.config) ? rows(row.config) : [])])
const all = rows(composed)
assert.equal(all.find(row => row.id === 'session-persistence-jsonl').disabled, true)
assert.equal(all.find(row => row.id === 'nidofy-runtime-jsonl').name, '@nidofy/dsh-runtime-adapter')
const preset = all.find(row => row.id === 'preset-notebook')
assert.equal(preset.config.id, 'notebook')
assert.equal(rows(preset.config.plugins).find(row => row.id === 'compaction-basic').name, '@nidofy/dsh-runtime-adapter/compaction')
await writeFile(join(root, 'dist/profile-smoke.txt'), dump.stdout)
console.log('Actual dsh CLI composed full plugins, a single JSONL provider and Notebook preset in an isolated Web profile')

/** Install every artifact with a fresh store, offline mode and no lifecycle scripts. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, delimiter } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..')
const excludeSandbox = process.argv.includes('--exclude-sandbox')
const manifest = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8')).filter(p => !excludeSandbox || !p.name.startsWith('@dsh-extensions/windows-sandbox-'))
const stage = await mkdtemp(join(root, '.build/offline-check-'))
const candidates = [process.env.PNPM_CLI, ...process.env.PATH.split(delimiter).flatMap(p => [
  join(p, 'node_modules/pnpm/bin/pnpm.cjs'), join(p, 'node_modules/pnpm/bin/pnpm.mjs'),
  resolve(p, '../../node/node_modules/pnpm/bin/pnpm.mjs'),
])].filter(Boolean)
const pnpm = candidates.find(p => existsSync(p))
if (!pnpm) throw Error('Set PNPM_CLI to the installed pnpm JavaScript entry')
for (const item of manifest) assert.equal(createHash('sha256').update(await readFile(join(root, 'dist', item.file))).digest('hex'), item.sha256)
await writeFile(join(stage, 'package.json'), JSON.stringify({ name: 'offline-qualification', private: true, type: 'module',
  dependencies: Object.fromEntries(manifest.map(p => [p.name, 'file:' + join(root, 'dist', p.file).replaceAll('\\', '/')])) }, null, 2))
await writeFile(join(stage, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
const store = join(stage, 'empty-store')
await mkdir(store)
assert.deepEqual(await readdir(store), [])
const run = spawnSync(process.execPath, [pnpm, 'install', '--offline', '--ignore-scripts', '--store-dir', store,
  '--registry=http://127.0.0.1:9', '--reporter=append-only'], { cwd: stage, encoding: 'utf8', windowsHide: true,
  env: { ...process.env, CI: '1', COREPACK_ENABLE_NETWORK: '0', npm_config_update_notifier: 'false' } })
if (run.status !== 0) throw Error(run.stdout + run.stderr)
console.log(run.stdout.trim())
const verifier = `import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
const root = import.meta.dirname
for (const id of ['plugin-shared','runtime-adapter','desktop-pets','working-notebook','ai-village']) {
  const req = createRequire(join(root,'node_modules/@nidofy/dsh-'+id+'/package.json'))
  const native = req.resolve('koffi')
  assert.ok(native.startsWith(root), 'Dependency escaped offline install: '+native)
  assert.equal(req('koffi').sizeof('int'),4)
}
const req=createRequire(join(root,'node_modules/@nidofy/dsh-desktop-pets/package.json'))
assert.ok(req.resolve('sharp').startsWith(root))
const png=await req('sharp')({create:{width:2,height:2,channels:4,background:'#123456'}}).png().toBuffer()
assert.equal(png.subarray(1,4).toString(),'PNG')
if (${!excludeSandbox}) {
const doctor=JSON.parse(execFileSync(process.execPath,[join(root,'node_modules/@dsh-extensions/windows-sandbox-enhanced/lib/cli.js'),'doctor'],{encoding:'utf8',windowsHide:true,env:{...process.env,DOTNET_ROOT:join(root,'absent-dotnet'),DOTNET_MULTILEVEL_LOOKUP:'0'}}))
assert.equal(doctor.nativeHelper,'verified')
}
console.log('Offline installed runtime checks passed')
`
await writeFile(join(stage, 'verify.mjs'), verifier)
const verified = spawnSync(process.execPath, [join(stage, 'verify.mjs')], { cwd: stage, encoding: 'utf8', windowsHide: true })
if (verified.status !== 0) throw Error(verified.stdout + verified.stderr)
console.log(verified.stdout.trim())
const versions = [...new Set(manifest.map(item => item.dsh))]
await writeFile(join(root, 'dist/offline-validation.json'), JSON.stringify({ dsh: versions.length === 1 ? versions[0] : 'mixed-per-artifact', dshVersions: versions, platform: 'win32-x64',
  passed: true, packageManager: 'pnpm', emptyStore: true, offline: true, lifecycleScripts: false,
  nativeChecks: ['koffi', 'sharp PNG encoding', ...excludeSandbox ? [] : ['self-contained sandbox audit helper']], artifacts: manifest }, null, 2) + '\n')

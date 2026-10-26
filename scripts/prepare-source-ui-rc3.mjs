/** Reproduce the small third-party dependency set used by official rc.3 UI source tests. */
import assert from 'node:assert/strict'
import { readFile, mkdir, copyFile, realpath, writeFile } from 'node:fs/promises'
import { join, resolve, dirname, relative, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
const root = resolve(import.meta.dirname, '..')
const spec = join(root, 'tools/official-source-ui-rc3')
const output = join(root, '.build/official-source-ui-rc3')
assert.ok(process.argv.slice(2).every(value => value === '--verify-only'), 'Only --verify-only is supported')
const manifest = JSON.parse(await readFile(join(spec, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(join(spec, 'package-lock.json'), 'utf8'))
assert.deepEqual(manifest.dependencies, { clsx: '2.1.1', immer: '10.2.0', react: '18.3.1', zustand: '4.5.7' })
assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies)
for (const [name, version] of Object.entries(manifest.dependencies)) assert.equal(lock.packages['node_modules/' + name].version, version)
if (!process.argv.includes('--verify-only')) {
  await mkdir(output, { recursive: true })
  for (const file of ['package.json', 'package-lock.json']) await copyFile(join(spec, file), join(output, file))
  const result = spawnSync(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(root, '.build/npm-source-ui-rc3-cache')],
  { cwd: output, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  assert.equal(result.status, 0, 'Official-source UI dependency installation failed')
}
for (const file of ['package.json', 'package-lock.json']) assert.deepEqual(await readFile(join(spec, file)), await readFile(join(output, file)))
const require = createRequire(join(output, 'package.json'))
for (const [name, version] of Object.entries(manifest.dependencies)) {
  const installed = await realpath(require.resolve(name))
  const local = relative(await realpath(output), installed)
  assert.ok(local !== '..' && !local.startsWith('../') && !local.startsWith('..\\') && !isAbsolute(local), name + ' escaped isolated source UI dependencies')
  assert.equal(JSON.parse(await readFile(join(output, 'node_modules', name, 'package.json'), 'utf8')).version, version)
}
const identity = { purpose: 'AI_VILLAGE_RC3_SOURCE_UI_TEST_ONLY', lifecycleScripts: false,
  lockSha256: createHash('sha256').update(await readFile(join(spec, 'package-lock.json'))).digest('hex'), dependencies: manifest.dependencies }
await writeFile(join(output, 'identity.json'), JSON.stringify(identity, null, 2) + '\n')
console.log(JSON.stringify(identity, null, 2))

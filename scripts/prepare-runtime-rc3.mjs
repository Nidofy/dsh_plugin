/** Isolated AI Village rc.3 dependencies; never replaces the repository's rc.2 runtime. */
import assert from 'node:assert/strict'
import { readFile, mkdir, copyFile, writeFile, realpath } from 'node:fs/promises'
import { join, resolve, dirname, relative, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '..')
const specification = join(root, 'tools/official-runtime-rc3')
const runtime = join(root, '.build/official-runtime-rc3')
const version = '0.2.1-rc.3'
assert.ok(process.argv.slice(2).every(value => value === '--verify-only'), 'Only --verify-only is supported')
const verifyOnly = process.argv.includes('--verify-only')
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
const manifest = await readJson(join(specification, 'package.json'))
const lock = await readJson(join(specification, 'package-lock.json'))
assert.equal(manifest.dependencies['@deepseek-ai/dsh'], version)
assert.equal(lock.packages[''].dependencies['@deepseek-ai/dsh'], version)
assert.equal(lock.packages['node_modules/@deepseek-ai/dsh'].version, version)
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (/(?:^|\/)node_modules\/@deepseek-ai\/dsh(?:-[^/]+)?$/.test(path)) assert.equal(pkg.version, version, `Mixed DSH release in lock: ${path}`)
}
if (!verifyOnly) {
  await mkdir(runtime, { recursive: true })
  for (const file of ['package.json', 'package-lock.json']) await copyFile(join(specification, file), join(runtime, file))
  const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
  const result = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund',
    '--cache', join(root, '.build/npm-pack-cache-rc3')], { cwd: runtime, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
for (const file of ['package.json', 'package-lock.json']) assert.deepEqual(await readFile(join(runtime, file)), await readFile(join(specification, file)), `${file} differs from rc.3 specification`)

const require = createRequire(join(runtime, 'package.json'))
const runtimePath = await realpath(runtime)
const packages = {}
// Check actual installed package identities instead of only trusting the top-level release number.
for (const name of ['dsh', 'dsh-app-boot', 'dsh-atomic-write', 'dsh-client-connection', 'dsh-client-ui-renderer',
  'dsh-client-ui-conversation', 'dsh-client-ui-session', 'dsh-client-ui-layout', 'dsh-client-ui-slots',
  'dsh-client-locale', 'dsh-plugin-manager']) {
  const id = '@deepseek-ai/' + name
  const path = await realpath(require.resolve(id + '/package.json'))
  const local = relative(runtimePath, path)
  assert.ok(local !== '..' && !local.startsWith('..\\') && !local.startsWith('../') && !isAbsolute(local), `${id} escaped the isolated runtime`)
  const pkg = await readJson(path)
  assert.equal(pkg.version, version, `${id} version mismatch`)
  packages[id] = { version: pkg.version, packageJson: local.replaceAll('\\', '/') }
}
for (const [id, expected] of [['@deepseek-ai/cordis', '4.0.5'], ['react', '18.3.1'], ['react-dom', '18.3.1'], ['use-sync-external-store', '1.6.0']]) {
  const pkg = await readJson(require.resolve(id + '/package.json'))
  assert.equal(pkg.version, expected, `${id} version mismatch`)
  packages[id] = { version: pkg.version }
}
const lockSha256 = createHash('sha256').update(await readFile(join(specification, 'package-lock.json'))).digest('hex')
const identity = { purpose: 'AI_VILLAGE_RC3_QUALIFICATION_ONLY', dshVersion: version, node: process.version,
  lifecycleScripts: false, lockSha256, packages }
await writeFile(join(runtime, 'identity.json'), JSON.stringify(identity, null, 2) + '\n')
console.log('Isolated AI Village rc.3 runtime verified:', JSON.stringify(identity, null, 2))

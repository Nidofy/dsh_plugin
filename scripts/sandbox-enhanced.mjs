/** Independent official-source qualification lane; never installs into DSH_HOME. */
import { readFile, writeFile, mkdir, cp, readdir, lstat, symlink, rm } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { build } from 'tsdown'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/sandbox-enhanced')
const revision = '687f282e8625c6b8d11ff58211a90524be2e4317'
const archiveHash = '157903b22c2881d3678d846755afe957a48df834e747deda805a1195ce25a146'
const packages = ['windows-sandbox-enhanced', 'windows-sandbox-guard']
const command = process.argv[2] ?? 'check'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(out, { recursive: true })
function run(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: root, stdio: 'inherit', env: { ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false' }, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${program} failed (${result.status})`)
}
if (command === 'prepare') {
  const archive = process.env.DSH_SANDBOX_ARCHIVE
  if (!archive) throw new Error('Set DSH_SANDBOX_ARCHIVE to the official codeload archive for ' + revision)
  if (digest(await readFile(archive)) !== archiveHash) throw new Error('Official archive digest mismatch')
  const source = join(out, 'official')
  await mkdir(source, { recursive: true })
  await tar.x({ file: archive, cwd: source, strip: 1 })
  // Source aliases always come from the pinned OFFICIAL archive. Reuse only dependency
  // installation resolution; no desktop source is copied or added as a package dependency.
  try { await lstat(join(source, 'node_modules')) } catch (e) {
    if (e.code !== 'ENOENT') throw e
    await symlink(join(root, 'node_modules'), join(source, 'node_modules'), 'junction')
  }
  for (const family of ['packages', 'vendor']) {
    const directories = []
    for (const item of await readdir(join(source, family), { withFileTypes: true })) {
      if (!item.isDirectory()) continue
      const directory = join(source, family, item.name)
      if (family === 'vendor') directories.push(directory)
      else for (const child of await readdir(directory, { withFileTypes: true })) if (child.isDirectory()) directories.push(join(directory, child.name))
    }
    for (const directory of directories) {
      try {
        const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
        const dependencies = join(root, 'node_modules', pkg.name, 'node_modules')
        await lstat(dependencies)
        try { await lstat(join(directory, 'node_modules')) } catch (e) {
          if (e.code !== 'ENOENT') throw e
          await symlink(dependencies, join(directory, 'node_modules'), 'junction')
        }
      } catch (e) { if (e.code !== 'ENOENT') throw e }
    }
  }
  await writeFile(join(out, 'baseline.json'), JSON.stringify({ source, revision, archiveHash }, null, 2))
  console.log('Prepared official source', revision)
  process.exit(0)
}
if (command === 'typecheck' || command === 'check') {
  for (const name of packages) for (const face of name === 'windows-sandbox-enhanced' ? ['host', 'client'] : ['host'])
    run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `packages/${name}/tsconfig.${face}.json`, '--pretty', 'false'])
}
if (command === 'build' || command === 'check') {
  const native = join(root, 'packages/windows-sandbox-enhanced/native/runtime')
  run('dotnet', ['publish', 'packages/windows-sandbox-enhanced/native/SandboxAudit.csproj', '-c', 'Release', '--self-contained', 'false', '-o', native])
  const files = {}
  for (const file of await readdir(native)) {
    if (file.endsWith('.pdb')) { await rm(join(native, file)); continue }
    if (file !== 'manifest.json') files[file] = digest(await readFile(join(native, file)))
  }
  await writeFile(join(native, 'manifest.json'), JSON.stringify({ architecture: process.arch, files }, null, 2))
  for (const name of packages) {
    const directory = join(root, 'packages', name), pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    for (const file of await readdir(join(directory, 'lib')).catch(e => { if (e.code === 'ENOENT') return []; throw e }))
      if (/\.(?:js|cjs|mjs|map)$/.test(file)) await rm(join(directory, 'lib', file))
    await cp(join(root, 'LICENSE'), join(directory, 'LICENSE'))
    const entries = name === 'windows-sandbox-enhanced' ? ['index', 'cli', 'audit', 'journal', 'lifecycle'] : ['index']
    await build({ config: false, entry: Object.fromEntries(entries.map(entry => [entry, join(directory, `src/${entry}.ts`)])), outDir: join(directory, 'lib'),
      format: 'esm', platform: 'node', target: 'es2024', dts: false, clean: false, fixedExtension: false,
      deps: { neverBundle: id => Object.keys(pkg.peerDependencies).some(p => p === id || id.startsWith(p + '/')) } })
    if (name !== 'windows-sandbox-enhanced') continue
    const external = id => id === 'react' || id.startsWith('react/') || id.startsWith('@deepseek-ai/')
    await build({ config: false, entry: { client: join(directory, 'src/client/index.ts') }, outDir: join(directory, 'lib'),
      format: 'cjs', platform: 'browser', target: 'es2022', dts: false, clean: false, fixedExtension: false,
      deps: { neverBundle: external, alwaysBundle: id => !external(id) },
      outputOptions: { entryFileNames: 'client.js', banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
        intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });' } })
  }
}
if (command === 'test' || command === 'check') run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/sandbox-enhanced.vitest.mjs', '--reporter=default', '--reporter=json', '--outputFile=.build/sandbox-enhanced/tests.json'])
if (command === 'pack' || command === 'check') {
  await mkdir(join(root, 'dist'), { recursive: true })
  const manifest = []
  for (const name of packages) {
    const directory = join(root, 'packages', name), pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    for (const version of Object.values({ ...pkg.dependencies, ...pkg.peerDependencies }))
      if (/^(?:file|workspace|link):/.test(version)) throw new Error('Local dependency in artifact')
    const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
    const result = spawnSync(process.execPath, [npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', join(root, 'dist')], { cwd: directory, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr)
    const [packed] = JSON.parse(result.stdout), file = join(root, 'dist', packed.filename), names = []
    await tar.t({ file, onReadEntry: e => names.push(e.path) })
    if (names.some(p => /(?:node_modules|native\/obj|native\/bin|\.local|\.build)\//.test(p))) throw new Error('Unexpected artifact content')
    for (const value of Object.values(pkg.exports).flatMap(v => typeof v === 'string' ? [v] : Object.values(v)))
      if (!names.includes('package/' + value.slice(2))) throw new Error('Missing export ' + value)
    if (name === 'windows-sandbox-enhanced' && !names.includes('package/native/runtime/manifest.json')) throw new Error('Missing native helper')
    manifest.push({ name: pkg.name, version: pkg.version, file: packed.filename, sha256: digest(await readFile(file)), files: names.length })
  }
  await writeFile(join(root, 'dist/windows-sandbox-manifest.json'), JSON.stringify({ baseline: revision, qualification: 'preview-not-isolated', artifacts: manifest }, null, 2))
  console.log(manifest)
}
if (command === 'smoke' || command === 'check') run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/sandbox-enhanced.vitest.mjs', '--reporter=default', '--reporter=json', '--outputFile=.build/sandbox-enhanced/packed-tests.json'], {
  env: { ...process.env, DSH_SANDBOX_PACKED: '1' },
})
if (!['prepare', 'typecheck', 'build', 'test', 'pack', 'smoke', 'check'].includes(command)) throw new Error('Unknown command')

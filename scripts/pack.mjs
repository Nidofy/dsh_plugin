/** Build npm tarballs with the local shared library embedded, then verify their contents. */
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir, cp, mkdtemp, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import * as tar from 'tar'
import { bundleRuntimeDependencies } from './offline-dependencies.mjs'
import { approvedSceneAssets } from './ai-village-scene-assets.mjs'
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url)
const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
await mkdir(join(root, 'dist'), { recursive: true })
await mkdir(join(root, '.build'), { recursive: true })
const stage = await mkdtemp(join(root, '.build/pack-'))
const artifacts = []
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7)
if (only && !['plugin-shared', 'runtime-adapter', 'desktop-pets', 'working-notebook', 'source-control', 'live2d', 'ai-village', 'whale-skin', 'windows-sandbox-enhanced', 'windows-sandbox-guard'].includes(only)) throw Error('Unknown package selection')
async function copyPackage(name, dest) {
  const source = join(root, 'packages', name)
  for (const file of ['package.json', 'LICENSE', 'README.md', 'lib', ...(name === 'plugin-shared' ? [] : ['cordis.patch.yml']), ...(['desktop-pets', 'live2d', 'ai-village', 'whale-skin'].includes(name) ? ['assets'] : []), ...(name === 'ai-village' ? ['THIRD-PARTY-NOTICES.txt'] : []), ...(name === 'whale-skin' ? ['LICENSE-ARTWORK', 'UPSTREAM-NOTICE', 'NOTICE.md'] : []), ...(name === 'runtime-adapter' ? ['notebook.preset.patch.yml'] : []), ...(name === 'working-notebook' ? ['enhanced.patch.yml'] : []), ...(name === 'windows-sandbox-enhanced' ? ['native/runtime'] : [])]) {
    await cp(join(source, file), join(dest, file), { recursive: true, filter: path => !/\.(?:tsbuildinfo|log)$/.test(path) })
  }
}
for (const name of ['plugin-shared', 'runtime-adapter', 'desktop-pets', 'working-notebook', 'source-control', 'live2d', 'ai-village', 'whale-skin', 'windows-sandbox-enhanced', 'windows-sandbox-guard'].filter(name => (!only || name === only) && (!process.argv.includes('--sandbox') || name.startsWith('windows-sandbox-')) && (!process.argv.includes('--exclude-sandbox') || !name.startsWith('windows-sandbox-')))) {
  const dir = join(stage, name)
  await copyPackage(name, dir)
  let pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  if (pkg.dependencies?.['@nidofy/dsh-plugin-shared']) {
    const shared = JSON.parse(await readFile(join(root, 'packages/plugin-shared/package.json'), 'utf8'))
    Object.assign(pkg.peerDependencies, shared.peerDependencies)
  }
  pkg.files = [...new Set([...(pkg.files ?? []), 'OFFLINE-DEPENDENCIES.json'])]
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  pkg = await bundleRuntimeDependencies(root, dir, copyPackage)
  const run = spawnSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--cache', join(root, '.build/npm-pack-cache'), '--pack-destination', join(root, 'dist')], { cwd: dir, encoding: 'utf8', windowsHide: true })
  if (run.status !== 0) throw Error(run.stderr || run.stdout)
  const [result] = JSON.parse(run.stdout), file = join(root, 'dist', result.filename)
  const entries = []
  await tar.t({ file, onReadEntry: entry => entries.push(entry.path) })
  if (entries.some(path => /(?:^|\/)\.env|\.local\/|\.git\//.test(path))) throw Error('Unexpected packaged file')
  for (const value of Object.values(pkg.exports).flatMap(value => typeof value === 'string' ? [value] : Object.values(value))) {
    if (!entries.includes('package/' + value.replace(/^\.\//, ''))) throw Error('Missing export: ' + value)
  }
  if (pkg.dependencies?.['@nidofy/dsh-plugin-shared'] && !entries.includes('package/node_modules/@nidofy/dsh-plugin-shared/lib/state.js')) throw Error('Shared dependency missing')
  if (name === 'live2d') {
    for (const file of ['lib/frame.js', 'assets/manifest.json', 'assets/upperbody.png', 'assets/live2d/live2dcubismcore.min.js', 'assets/live2d/bluewhale-sdk.mjs', 'assets/live2d/CORE-LICENSE.md', 'assets/live2d/FRAMEWORK-LICENSE.md'])
      if (!entries.includes('package/' + file)) throw Error('Live2D runtime asset missing: ' + file)
    const closure = JSON.parse(await readFile(join(dir, 'assets/manifest.json'), 'utf8'))
    for (const [file, expected] of Object.entries(closure)) {
      if (!entries.includes('package/assets/' + file)) throw Error('Live2D closure missing: ' + file)
      if (createHash('sha256').update(await readFile(join(dir, 'assets', file))).digest('hex') !== expected) throw Error('Live2D asset changed without manifest update: ' + file)
    }
  }
  if (name === 'ai-village') {
      if (!entries.includes('package/lib/frame.js')) throw Error('Missing game renderer')
      for (const region of ['tea-square','bookhouse']) for (const resource of await approvedSceneAssets(join(dir,'assets'),region)) {
        if (!entries.includes('package/assets/'+resource.file)) throw Error('Missing approved scene asset: '+resource.file)
      }
      const map = JSON.parse(await readFile(join(dir, 'assets/community-map/manifest.json'), 'utf8'))
      if (map.status !== 'APPROVED' || !map.approvedForRelease || map.scope !== 'community-map-only' || map.files.length !== 6) throw Error('Unapproved community map')
      for (const entry of map.files) {
        const file = 'assets/community-map/' + entry.file
        if (!entries.includes('package/' + file)) throw Error('Missing map layer')
        const bytes = await readFile(join(dir, file))
        if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Map closure mismatch')
      }
      for (const id of ['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen', 'seedance', 'glm', 'minimax', 'llama', 'mistral']) {
        const closure = JSON.parse(await readFile(join(dir, `assets/characters/${id}/manifest.json`), 'utf8'))
        if (!closure.approvedForRelease) throw Error('Unreviewed character ' + id)
        for (const part of closure.parts) {
          const file = `assets/characters/${id}/${part.file}`
          if (!entries.includes('package/' + file) || createHash('sha256').update(await readFile(join(dir, file))).digest('hex') !== part.sha256) throw Error('Character closure mismatch: ' + file)
        }
      }
  }
  for (const section of ['dependencies', 'peerDependencies', 'devDependencies']) {
    if (Object.values(pkg[section] ?? {}).some(value => /^(?:workspace|link|file):/.test(value))) throw Error('Local dependency leaked into tarball')
  }
  artifacts.push({ name: pkg.name, version: pkg.version, file: result.filename, bytes: (await stat(file)).size,
    sha256: createHash('sha256').update(await readFile(file)).digest('hex'), files: entries.length, platform: 'win32-x64', dsh: pkg.engines.dsh, offline: true })
  console.log('Packed', result.filename, entries.length, 'files')
}
if (only) {
  const old = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8').catch(e => { if (e.code === 'ENOENT') return '[]'; throw e }))
  const names = new Set(artifacts.map(item => item.name))
  artifacts.unshift(...old.filter(item => !names.has(item.name)))
} else if (process.argv.includes('--sandbox')) {
  const old = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8').catch(e => { if(e.code === 'ENOENT') return '[]'; throw e }))
  artifacts.unshift(...old.filter(item => !item.name.startsWith('@dsh-extensions/windows-sandbox-')))
}
if (!only && process.argv.includes('--exclude-sandbox')) {
  const old = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8').catch(e => { if (e.code === 'ENOENT') return '[]'; throw e }))
  artifacts.push(...old.filter(item => item.name.startsWith('@dsh-extensions/windows-sandbox-')))
}
await writeFile(join(root, 'dist/manifest.json'), JSON.stringify(artifacts, null, 2) + '\n')
const baseline = JSON.parse(await readFile(join(root, 'compatibility.json'), 'utf8'))
if (!only && !process.argv.includes('--exclude-sandbox')) await writeFile(join(root, 'dist/windows-sandbox-manifest.json'), JSON.stringify({ baseline: baseline.originalRevision, qualification: 'preview-not-isolated', artifacts: artifacts.filter(p => p.name.startsWith('@dsh-extensions/')) }, null, 2) + '\n')

/** Build npm tarballs with the local shared library embedded, then verify their contents. */
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir, cp, mkdtemp, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url)
const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
await mkdir(join(root, 'dist'), { recursive: true })
await mkdir(join(root, '.build'), { recursive: true })
const stage = await mkdtemp(join(root, '.build/pack-'))
const artifacts = []
async function copyPackage(name, dest) {
  const source = join(root, 'packages', name)
  for (const file of ['package.json', 'LICENSE', 'README.md', 'lib', ...(name === 'plugin-shared' ? [] : ['cordis.patch.yml']), ...(['desktop-pets', 'live2d'].includes(name) ? ['assets'] : []), ...(name === 'runtime-adapter' ? ['notebook.preset.patch.yml'] : []), ...(name === 'working-notebook' ? ['enhanced.patch.yml'] : [])]) {
    await cp(join(source, file), join(dest, file), { recursive: true, filter: path => !/\.(?:tsbuildinfo|log)$/.test(path) })
  }
}
for (const name of ['plugin-shared', 'runtime-adapter', 'desktop-pets', 'working-notebook', 'source-control', 'live2d']) {
  const dir = join(stage, name)
  await copyPackage(name, dir)
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  if (pkg.dependencies?.['@nidofy/dsh-plugin-shared']) {
    await copyPackage('plugin-shared', join(dir, 'node_modules/@nidofy/dsh-plugin-shared'))
    pkg.bundledDependencies = ['@nidofy/dsh-plugin-shared']
    const shared = JSON.parse(await readFile(join(root, 'packages/plugin-shared/package.json'), 'utf8'))
    Object.assign(pkg.peerDependencies, shared.peerDependencies)
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  }
  const run = spawnSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', join(root, 'dist')], { cwd: dir, encoding: 'utf8' })
  if (run.status !== 0) throw Error(run.stderr || run.stdout)
  const [result] = JSON.parse(run.stdout), file = join(root, 'dist', result.filename)
  const entries = []
  await tar.t({ file, onReadEntry: entry => entries.push(entry.path) })
  if (entries.some(path => /(?:^|\/)\.env|\.local\/|node_modules\/(?!@nidofy\/dsh-plugin-shared)/.test(path))) throw Error('Unexpected packaged file')
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
  for (const section of ['dependencies', 'peerDependencies', 'devDependencies']) {
    if (Object.values(pkg[section] ?? {}).some(value => /^(?:workspace|link|file):/.test(value))) throw Error('Local dependency leaked into tarball')
  }
  artifacts.push({ name: pkg.name, version: pkg.version, file: result.filename, bytes: (await stat(file)).size,
    sha256: createHash('sha256').update(await readFile(file)).digest('hex'), files: entries.length })
  console.log('Packed', result.filename, entries.length, 'files')
}
await writeFile(join(root, 'dist/manifest.json'), JSON.stringify(artifacts, null, 2) + '\n')

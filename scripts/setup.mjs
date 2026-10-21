/** Link a local compatible DSH checkout without changing its files or installing lifecycle hooks. */
import { readFile, writeFile, mkdir, readdir, symlink, lstat, realpath, unlink } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const source = resolve(process.env.DSH_SOURCE ?? process.argv[2] ?? join(root, '../dshWinUi/electron'))
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const upstream = await json(join(source, 'package.json'))
if (upstream.name !== '@deepseek-ai/dsh-root') throw Error('DSH_SOURCE must point to a DSH source checkout')
const compatibility = await json(join(root, 'compatibility.json'))
// DSH_SOURCE supplies build tools; runtime identities come only from the official install.
const runtime = join(root, '.build/official-runtime')
const runtimePackage = await json(join(runtime, 'node_modules/@deepseek-ai/dsh/package.json'))
if (runtimePackage.version !== compatibility.dshVersion) throw Error('Install the pinned official DSH in .build/official-runtime first')
for (const [name, expected] of Object.entries(compatibility.tools)) {
  const installed = await json(join(source, 'node_modules', name, 'package.json'))
  if (installed.version !== expected) throw Error(`${name}: expected ${expected}, received ${installed.version}`)
}
async function link(target, destination) {
  await mkdir(dirname(destination), { recursive: true })
  try {
    const existing = await lstat(destination)
    if (await realpath(destination) !== await realpath(target)) {
      if (!existing.isSymbolicLink() || !resolve(destination).startsWith(join(root, 'node_modules') + '\\')) throw Error('Refusing to replace a real dependency directory: ' + destination)
      await unlink(destination)
      await symlink(target, destination, process.platform === 'win32' ? 'junction' : 'dir')
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await symlink(target, destination, process.platform === 'win32' ? 'junction' : 'dir')
  }
}
const packages = new Map()
for (const base of ['vendor', 'apps', 'packages', 'native']) {
  for (const group of await readdir(join(source, base), { withFileTypes: true })) {
    if (!group.isDirectory()) continue
    const dirs = base === 'packages' ? (await readdir(join(source, base, group.name), { withFileTypes: true })).filter(x => x.isDirectory()).map(x => join(base, group.name, x.name)) : [join(base, group.name)]
    for (const dir of dirs) try { const p = await json(join(source, dir, 'package.json')); packages.set(p.name, join(source, dir)) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}
for (const name of await readdir(join(root, 'packages'))) {
  const dir = join(root, 'packages', name), p = await json(join(dir, 'package.json'))
  packages.set(p.name, dir)
}
for (const name of await readdir(join(runtime, 'node_modules/@deepseek-ai'))) {
  packages.set('@deepseek-ai/' + name, join(runtime, 'node_modules/@deepseek-ai', name))
}
for (const [name, dir] of packages) await link(dir, join(root, 'node_modules', name))
for (const entry of await readdir(join(source, 'node_modules'), { withFileTypes: true })) {
  if (entry.name.startsWith('.')) continue
  if (entry.name.startsWith('@')) {
    for (const child of await readdir(join(source, 'node_modules', entry.name))) {
      const name = entry.name + '/' + child
      if (!packages.has(name)) await link(join(source, 'node_modules', name), join(root, 'node_modules', name))
    }
  } else if (!packages.has(entry.name)) await link(join(source, 'node_modules', entry.name), join(root, 'node_modules', entry.name))
}
// React and Electron are declared by desktop workspaces, rather than the upstream root.
for (const [name, owner] of [['react', 'apps/desktop'], ['react-dom', 'apps/desktop'], ['electron', 'apps/desktop'], ['sharp', 'packages/nidofy/desktop-extras'], ['@types/react', 'apps/desktop'], ['@types/react-dom', 'apps/desktop'], ['@deepseek-ai/node-addon-system', 'packages/session/session-persistence-jsonl'], ['koffi', 'packages/session/session-persistence-jsonl']]) {
  try { await lstat(join(root, 'node_modules', name)) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await link(join(source, owner, 'node_modules', name), join(root, 'node_modules', name))
  }
}
await mkdir(join(root, '.local'), { recursive: true })
await writeFile(join(root, '.local/environment.json'), JSON.stringify({ source, version: runtimePackage.version, toolchainDshVersion: upstream.version, officialRuntime: runtime }, null, 2) + '\n')
console.log('Build tools linked; official runtime:', runtimePackage.version)

/** Materialize the pinned original DSH source for compatibility tests; never reset the desktop checkout. */
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir, readdir, symlink, lstat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const revision = '639ed015397290b3745d163aafe02ffee4aa3f84'
const original = join(root, '.build/original-dsh'), archive = join(root, '.build/original-dsh.tar')
await mkdir(original, { recursive: true })
const run = spawnSync('git', ['archive', '--format=tar', '-o', archive, revision, 'packages', 'vendor', 'native', 'tsconfig.base.json', 'tsconfig.base.client.json'], { cwd: source, encoding: 'utf8' })
if (run.status !== 0) throw Error(run.stderr)
await tar.x({ file: archive, cwd: original })
async function link(target, dest) {
  try { await lstat(dest); return } catch (error) { if (error.code !== 'ENOENT') throw error }
  try { await lstat(target) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  await mkdir(dirname(dest), { recursive: true })
  await symlink(target, dest, process.platform === 'win32' ? 'junction' : 'dir')
}
await link(join(source, 'node_modules'), join(original, 'node_modules'))
for (const group of await readdir(join(original, 'packages'), { withFileTypes: true })) {
  if (!group.isDirectory()) continue
  for (const pkg of await readdir(join(original, 'packages', group.name), { withFileTypes: true })) {
    if (pkg.isDirectory()) await link(join(source, 'packages', group.name, pkg.name, 'node_modules'), join(original, 'packages', group.name, pkg.name, 'node_modules'))
  }
}
for (const pkg of await readdir(join(original, 'vendor'), { withFileTypes: true })) {
  if (pkg.isDirectory()) await link(join(source, 'vendor', pkg.name, 'node_modules'), join(original, 'vendor', pkg.name, 'node_modules'))
}
await writeFile(join(root, '.local/original.json'), JSON.stringify({ source: original, revision }, null, 2) + '\n')
console.log('Original DSH source prepared:', revision)

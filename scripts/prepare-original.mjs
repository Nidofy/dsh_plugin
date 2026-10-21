/** Select the hash-verified official archive shared by all compatibility lanes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
const compatibility = JSON.parse(await readFile(join(root, 'compatibility.json'), 'utf8'))
const file = join(root, '.build/sandbox-enhanced/baseline.json')
let baseline
try { baseline = JSON.parse(await readFile(file, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
  const prepared = spawnSync(process.execPath, ['scripts/sandbox-enhanced.mjs', 'prepare'], { cwd: root, stdio: 'inherit', windowsHide: true })
  if (prepared.status !== 0) throw Error('OFFICIAL_BASELINE_UNAVAILABLE')
  baseline = JSON.parse(await readFile(file, 'utf8'))
}
if (baseline.revision !== compatibility.originalRevision || baseline.archiveHash !== compatibility.officialArchiveSha256) throw Error('OFFICIAL_BASELINE_MISMATCH')
const pkg = JSON.parse(await readFile(join(baseline.source, 'package.json'), 'utf8'))
if (pkg.version !== compatibility.dshVersion) throw Error('OFFICIAL_VERSION_MISMATCH')
await mkdir(join(root, '.local'), { recursive: true })
await writeFile(join(root, '.local/original.json'), JSON.stringify(baseline, null, 2) + '\n')
console.log('Official DSH baseline:', pkg.version, baseline.revision)

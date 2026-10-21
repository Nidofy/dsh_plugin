/** Reproduce the published official runtime without touching any installed DSH profile. */
import { readFile, mkdir, copyFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..'), runtime = join(root, '.build/official-runtime')
await mkdir(runtime, { recursive: true })
for (const file of ['package.json', 'package-lock.json']) await copyFile(join(root, 'tools/official-runtime', file), join(runtime, file))
const npm = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const result = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(root, '.build/npm-pack-cache')],
  { cwd: runtime, stdio: 'inherit', windowsHide: true })
if (result.status !== 0) process.exit(result.status ?? 1)
const pkg = JSON.parse(await readFile(join(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'))
if (pkg.version !== JSON.parse(await readFile(join(root, 'compatibility.json'), 'utf8')).dshVersion) throw Error('OFFICIAL_RUNTIME_VERSION_MISMATCH')

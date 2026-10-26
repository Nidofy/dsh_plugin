/** Formal package output uses the explicitly selected, verified AI Village source lane. */
import { spawnSync } from 'node:child_process'
import { cp, copyFile, mkdir, readdir, unlink, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { villageCompatibility } from './ai-village-compatibility.mjs'
const compatibility = villageCompatibility()
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
if (JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8')).engines.dsh !== compatibility.config.dshVersion) throw Error('PACKAGE_COMPATIBILITY_LANE_MISMATCH')
const check = spawnSync(process.execPath, ['scripts/ai-village-phase4.mjs', 'build'], { cwd: root, stdio: 'inherit', windowsHide: true })
if (check.status !== 0) process.exit(check.status ?? 1)
await mkdir(join(pkg, 'lib'), { recursive: true })
for (const file of await readdir(join(pkg, 'lib'))) if (/^(index|service(?:-[\w-]+)?|client|frame)\.(?:m?js)$/.test(file)) await unlink(join(pkg, 'lib', file))
await cp(join(compatibility.out, 'lib'), join(pkg, 'lib'), { recursive: true })
await copyFile(join(compatibility.out, 'THIRD-PARTY-NOTICES.txt'), join(pkg, 'THIRD-PARTY-NOTICES.txt'))
await copyFile(join(root, 'LICENSE'), join(pkg, 'LICENSE'))
console.log('AI Village release output ready, including offline assets and native dependency notices')

/** Formal package output uses the pinned 0.2.1-rc.2 build, not the repository's older host baseline. */
import { spawnSync } from 'node:child_process'
import { cp, copyFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const check = spawnSync(process.execPath, ['scripts/ai-village-phase4.mjs', 'build'], { cwd: root, stdio: 'inherit', windowsHide: true })
if (check.status !== 0) process.exit(check.status ?? 1)
await mkdir(join(pkg, 'lib'), { recursive: true })
for (const file of await readdir(join(pkg, 'lib'))) if (/^(index|service(?:-[\w-]+)?|client|frame)\.(?:m?js)$/.test(file)) await unlink(join(pkg, 'lib', file))
await cp(join(root, '.build/ai-village-phase4/lib'), join(pkg, 'lib'), { recursive: true })
await copyFile(join(root, '.build/ai-village-phase4/THIRD-PARTY-NOTICES.txt'), join(pkg, 'THIRD-PARTY-NOTICES.txt'))
await copyFile(join(root, 'LICENSE'), join(pkg, 'LICENSE'))
console.log('AI Village release output ready, including offline assets and native dependency notices')

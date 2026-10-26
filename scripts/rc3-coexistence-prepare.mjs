/** Companion QA-only peer declarations; keeps the frozen AI Village runtime lock unchanged. */
import assert from 'node:assert/strict'
import { mkdir, copyFile, readFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..'), output = join(root, '.build/rc3-coexistence-deps')
await mkdir(output, { recursive: true })
for (const file of ['package.json', 'package-lock.json']) await copyFile(join(root, 'tools/rc3-coexistence-deps', file), join(output, file))
const result = spawnSync(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(root, '.build/npm-pack-cache-rc3')], { cwd: output, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
assert.equal(JSON.parse(await readFile(join(output, 'node_modules/@deepseek-ai/dsh-client-ui-primitives/package.json'), 'utf8')).version, '0.2.1-rc.3')
console.log('Independent rc.3 coexistence peer overlay ready')

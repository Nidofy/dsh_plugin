/** Generate declarations in dependency order while checking strict Host and Client programs. */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readdir, mkdir, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
const require = createRequire(import.meta.url)
for (const name of ['plugin-shared', 'runtime-adapter', 'desktop-pets', 'working-notebook', 'source-control', 'live2d']) {
  for (const face of (name === 'runtime-adapter' ? ['host'] : ['host', 'client'])) {
    const run = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', `packages/${name}/tsconfig.${face}.json`], { cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit' })
    if (run.status !== 0) process.exit(run.status ?? 1)
  }
  // TypeScript does not copy hand-authored declarations for legacy .mjs modules.
  const base = resolve(import.meta.dirname, '..', 'packages', name)
  for (const file of await readdir(join(base, 'src'), { recursive: true })) {
    if (!file.endsWith('.d.mts')) continue
    const output = join(base, 'lib/types', file)
    await mkdir(dirname(output), { recursive: true }); await copyFile(join(base, 'src', file), output)
  }
}

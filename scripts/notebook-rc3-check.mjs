/** Reproducible release gate for Runtime Adapter, Working Notebook and Source Control. */
import { spawnSync } from 'node:child_process'
import { root } from './ai-village-compatibility.mjs'
for (const args of [
  ['scripts/notebook-rc3-types.mjs'],
  ['scripts/test.mjs', '--config', 'scripts/notebook-rc3.vitest.mjs'],
  ['scripts/build.mjs', '--only=plugin-shared,runtime-adapter,working-notebook,source-control'],
  ...['runtime-adapter', 'working-notebook', 'source-control'].map(name => ['scripts/pack.mjs', '--only=' + name]),
  ['scripts/notebook-rc3-smoke.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

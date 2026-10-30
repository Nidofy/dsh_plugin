import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
const require = createRequire(import.meta.url)
const result = spawnSync(process.execPath, [join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', ...process.argv.slice(2)], { cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit' })
if (result.status === 0 && process.argv.length === 2) {
  const rc3 = spawnSync(process.execPath, [join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--config', 'scripts/notebook-rc3.vitest.mjs'], { cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit', windowsHide: true })
  process.exit(rc3.status ?? 1)
}
process.exit(result.status ?? 1)

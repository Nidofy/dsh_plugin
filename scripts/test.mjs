import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve, join } from 'node:path'
const require = createRequire(import.meta.url)
const result = spawnSync(process.execPath, [join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', ...process.argv.slice(2)], { cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit' })
process.exit(result.status ?? 1)

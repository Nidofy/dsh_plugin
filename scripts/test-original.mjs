import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const run = spawnSync(process.execPath, [join(root, 'scripts/test.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, DSH_TEST_ORIGINAL: '1' } })
process.exit(run.status ?? 1)

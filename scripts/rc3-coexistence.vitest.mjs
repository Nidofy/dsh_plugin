/** QA-only Git/Live2D copies against the pinned rc.3 source resolver. */
import assert from 'node:assert/strict'
import { join, relative, resolve } from 'node:path'
import official from './ai-village-rc3.vitest.mjs'
const root = resolve(import.meta.dirname, '..')
const stage = resolve(process.env.RC3_COEXISTENCE_STAGE ?? '')
const local = relative(join(root, '.build/rc3-coexistence'), stage)
assert.match(local, /^[a-z0-9-]+$/, 'RC3_COEXISTENCE_STAGE must be a dedicated QA child directory')
export default {
  ...official,
  test: { ...official.test,
    include: ['source-control', 'live2d'].map(name => relative(root, join(stage, 'work', name, 'tests/**/*.spec.{ts,tsx}')).replaceAll('\\', '/')),
    exclude: ['**/node_modules/**'],
    maxWorkers: 1,
  },
}

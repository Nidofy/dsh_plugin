/** Reuse the pinned official 0.2.1-rc.2 source resolver, not desktop declarations. */
import official from './sandbox-enhanced.vitest.mjs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const dependencies = createRequire(resolve(import.meta.dirname, '../.build/live2d-official-deps/package.json'))
export default {
  ...official,
  resolve: { alias: { 'use-sync-external-store/shim/with-selector': dependencies.resolve('use-sync-external-store/shim/with-selector') } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { ...official.test, include: ['packages/live2d/tests/**/*.spec.{ts,tsx}'], setupFiles: ['./tests/setup-dom.ts'] },
}

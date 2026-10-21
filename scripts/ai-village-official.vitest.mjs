import official from './live2d-official.vitest.mjs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const source = JSON.parse(readFileSync(resolve(import.meta.dirname, '../.local/environment.json'), 'utf8')).source
const dependencies = createRequire(resolve(source, 'packages/client/connection/package.json'))
export default {
  ...official,
  resolve: { alias: { ...official.resolve.alias, zod: dependencies.resolve('zod'), '@nidofy/dsh-plugin-shared/durable-file': resolve(import.meta.dirname, '../packages/plugin-shared/src/durable-file.ts') } },
  test: { ...official.test, include: ['packages/ai-village/tests/**/*.spec.{ts,tsx}', 'packages/live2d/tests/registration.client.spec.tsx', 'packages/live2d/tests/floating-layout.client.spec.ts'] },
}

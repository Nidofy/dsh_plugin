/** Targeted plugin qualification against the pinned official rc.3 source. */
import { mergeConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import official from './ai-village-rc3.vitest.mjs'
import { root } from './ai-village-compatibility.mjs'
const alias = {}
for (const name of ['plugin-shared', 'runtime-adapter', 'working-notebook', 'source-control', 'desktop-pets']) {
  const dir = join(root, 'packages', name), pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  for (const [key, target] of Object.entries(pkg.exports)) {
    if (typeof target === 'string' || !target.types) continue
    alias[pkg.name + (key === '.' ? '' : key.slice(1))] = join(dir, target.types.replace('./lib/types/', 'src/').replace(/\.d\.ts$/, '.ts')).replaceAll('\\', '/')
  }
}
const extra = createRequire(join(root, 'tools/notebook-rc3-deps/package.json'))
const config = mergeConfig(official, { resolve: { alias: { 'simple-icons': extra.resolve('simple-icons') } } })
config.plugins.unshift({ name: 'notebook-local-exports', enforce: 'pre', resolveId(id) { return alias[id] } })
config.plugins.unshift({ name: 'notebook-ui-dependencies', enforce: 'pre', resolveId(id) {
  if (id.startsWith('react') || id.startsWith('@deepseek-ai/') || id.startsWith('@nidofy/') || id.startsWith('.') || id.startsWith('node:')) return
  try { const path = extra.resolve(id); if (path.includes('tools') && path.includes('notebook-rc3-deps')) return path.replaceAll('\\', '/') } catch { /* Official resolver handles the other dependencies. */ }
} })
config.test.include = ['packages/{runtime-adapter,working-notebook,source-control,plugin-shared}/tests/**/*.spec.{ts,tsx}']
export default config

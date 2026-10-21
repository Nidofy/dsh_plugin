import { defineConfig } from 'vitest/config'
import ts from 'typescript'
import { readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
const root = import.meta.dirname
const { source } = JSON.parse(readFileSync(join(root, '.local/original.json'), 'utf8'))
const toolsSource = JSON.parse(readFileSync(join(root, '.local/environment.json'), 'utf8')).source
const runtimeRequire = createRequire(join(root, '.build/official-runtime/package.json'))
const browserRequire = createRequire(join(root, '.build/live2d-official-deps/package.json'))
const upstream = ts.parseConfigFileTextToJson('tsconfig.base.json', readFileSync(join(source, 'tsconfig.base.json'), 'utf8')).config
const normalize = path => path.replaceAll('\\', '/')
const aliases = Object.fromEntries(Object.entries(upstream.compilerOptions.paths).map(([key, paths]) => {
  let path = resolve(source, paths[0])
  try { if (statSync(path).isDirectory()) path = join(path, 'index.ts') } catch { /* Wildcard entries are not concrete files. */ }
  return [key, normalize(path)]
}))
for (const name of ['plugin-shared', 'runtime-adapter', 'desktop-pets', 'working-notebook', 'source-control', 'live2d']) {
  const dir = join(root, 'packages', name), pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  for (const [key, target] of Object.entries(pkg.exports)) {
    if (typeof target === 'string' || !target.types) continue
    aliases[pkg.name + (key === '.' ? '' : key.slice(1))] = normalize(join(dir, target.types.replace('./lib/types/', 'src/').replace(/\.d\.ts$/, '.ts')))
  }
}
export default defineConfig({
  plugins: [{ name: 'dsh-source-aliases', enforce: 'pre', resolveId(id, importer) {
    if (aliases[id]) return aliases[id]
    if (id === 'use-sync-external-store/shim/with-selector') return browserRequire.resolve(id)
    if (importer?.replaceAll('\\', '/').startsWith(normalize(source) + '/') && !id.startsWith('.') && !id.startsWith('@deepseek-ai/') && !id.startsWith('react')) {
      try { return runtimeRequire.resolve(id) } catch { /* Source-only UI dependencies come from the build toolchain. */ }
      try { return createRequire(importer.replace(normalize(source), normalize(toolsSource))).resolve(id) } catch { /* Let Vite diagnose missing dependencies. */ }
    }
  } },
    { name: 'standard-decorators', enforce: 'pre', transform(code, id) {
      if (!/\.[cm]?tsx?$/.test(id) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
      const result = ts.transpileModule(code, { fileName: id, compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, sourceMap: true } })
      return { code: result.outputText, map: result.sourceMapText }
    } }],
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['packages/*/tests/**/*.spec.{ts,tsx}', 'tests/**/*.spec.ts'], exclude: ['packages/windows-sandbox-*/**', 'tests/windows-sandbox-packed.spec.ts'], pool: 'forks',
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [], testTimeout: 30000, hookTimeout: 30000,
    setupFiles: ['./tests/setup-dom.ts'],
  },
})

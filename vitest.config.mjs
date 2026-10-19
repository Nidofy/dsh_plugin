import { defineConfig } from 'vitest/config'
import ts from 'typescript'
import { readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
const root = import.meta.dirname
const originalMode = process.env.DSH_TEST_ORIGINAL === '1'
const { source } = JSON.parse(readFileSync(join(root, originalMode ? '.local/original.json' : '.local/environment.json'), 'utf8'))
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
  plugins: [{ name: 'dsh-source-aliases', enforce: 'pre', resolveId(id) { return aliases[id] } },
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

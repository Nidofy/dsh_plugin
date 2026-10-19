import { defineConfig } from 'vitest/config'
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import ts from 'typescript'
const root = resolve(import.meta.dirname, '..')
const baseline = JSON.parse(readFileSync(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
if (baseline.revision !== '687f282e8625c6b8d11ff58211a90524be2e4317') throw new Error('Wrong official baseline')
const paths = ts.parseConfigFileTextToJson('tsconfig.base.json', readFileSync(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const aliases = Object.entries(paths).map(([key, values]) => [key, resolve(baseline.source, values[0])])
const bootDependencies = createRequire(join(realpathSync(join(root, 'node_modules/@deepseek-ai/dsh-app-boot')), 'package.json'))
const bootManifest = JSON.parse(readFileSync(join(baseline.source, 'packages/boot/app-boot/package.json'), 'utf8'))
for (const name of Object.keys(bootManifest.dependencies ?? {}))
  if (!name.startsWith('@deepseek-ai/')) aliases.push([name, bootDependencies.resolve(name)])
export default defineConfig({
  plugins: [{ name: 'pinned-official-source', enforce: 'pre', resolveId(id) {
    for (const [key, value] of aliases) {
      let path
      if (key === id) path = value
      else if (key.endsWith('*') && id.startsWith(key.slice(0, -1))) path = value.replace('*', id.slice(key.length - 1))
      if (!path) continue
      if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.ts')
      if (existsSync(path)) return path.replaceAll('\\', '/')
    }
  } }, { name: 'official-standard-decorators', enforce: 'pre', transform(code, id) {
    if (!/\.[cm]?tsx?$/.test(id) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
    const result = ts.transpileModule(code, { fileName: id, compilerOptions: {
      target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, sourceMap: true,
    } })
    return { code: result.outputText, map: result.sourceMapText }
  } }],
  test: { include: process.env.DSH_SANDBOX_PACKED === '1' ? ['tests/windows-sandbox-packed.spec.ts'] : ['packages/windows-sandbox-*/tests/**/*.spec.{ts,tsx}'], pool: 'forks', testTimeout: 30000, hookTimeout: 30000,
    env: { DSH_SANDBOX_OFFICIAL: baseline.source }, execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [] },
})

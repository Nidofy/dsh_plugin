/** Separate rc.3 source/runtime qualification; never changes the all-plugin rc.2 resolver. */
import { defineConfig } from 'vitest/config'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { villageCompatibility, root } from './ai-village-compatibility.mjs'
const lane = villageCompatibility('rc3')
const runtime = createRequire(join(lane.runtime, 'package.json'))
const sourceUi = createRequire(join(root, '.build/official-source-ui-rc3/package.json'))
const paths = ts.parseConfigFileTextToJson('tsconfig.base.json', readFileSync(join(lane.baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const aliases = Object.entries(paths).map(([key, values]) => [key, resolve(lane.baseline.source, values[0])])
const boot = JSON.parse(readFileSync(join(lane.baseline.source, 'packages/boot/app-boot/package.json'), 'utf8'))
for (const name of Object.keys(boot.dependencies ?? {})) if (!name.startsWith('@deepseek-ai/')) aliases.push([name, runtime.resolve(name)])
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'], alias: { clsx: sourceUi.resolve('clsx'), immer: sourceUi.resolve('immer'), zustand: join(root, '.build/official-source-ui-rc3/node_modules/zustand'), zod: runtime.resolve('zod'), 'use-sync-external-store/shim/with-selector': runtime.resolve('use-sync-external-store/shim/with-selector'), '@nidofy/dsh-plugin-shared/durable-file': join(root, 'packages/plugin-shared/src/durable-file.ts') } },
  plugins: [{ name: 'ai-village-rc3-source', enforce: 'pre', resolveId(id) {
    for (const [key, value] of aliases) {
      let file = key === id ? value : key.endsWith('*') && id.startsWith(key.slice(0, -1)) ? value.replace('*', id.slice(key.length - 1)) : null
      if (!file) continue
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.ts')
      if (existsSync(file)) return file.replaceAll('\\', '/')
    }
  } }, { name: 'official-standard-decorators', enforce: 'pre', transform(code, id) {
    if (!/\.[cm]?tsx?$/.test(id) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
    const result = ts.transpileModule(code, { fileName: id, compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, sourceMap: true } })
    return { code: result.outputText, map: result.sourceMapText }
  } }],
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['packages/ai-village/tests/**/*.spec.{ts,tsx}', 'packages/live2d/tests/registration.client.spec.tsx', 'packages/live2d/tests/floating-layout.client.spec.ts'],
    setupFiles: ['./tests/setup-dom.ts'], pool: 'forks', maxWorkers: 1, testTimeout: 30000, hookTimeout: 30000,
    env: { DSH_SANDBOX_OFFICIAL: lane.baseline.source, DSH_VILLAGE_BUILD: lane.out },
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [] },
})

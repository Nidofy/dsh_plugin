/** Emit separate ESM Host entries and DSH module-loader browser factories. */
import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, readdir, rm } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
// Re-materialize the pinned official revision before embedding any upstream worker code.
const prepared = spawnSync(process.execPath, [join(root, 'scripts/prepare-original.mjs')], { cwd: root, stdio: 'inherit' })
if (prepared.status !== 0) throw Error('OFFICIAL_WORKER_BASELINE_UNAVAILABLE')
const original = JSON.parse(await readFile(join(root, '.local/original.json'), 'utf8'))
if (original.revision !== JSON.parse(await readFile(join(root, 'compatibility.json'), 'utf8')).originalRevision) throw Error('OFFICIAL_WORKER_BASELINE_MISMATCH')
const upstream = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(original.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const officialWorker = { name: 'official-worker-source', resolveId(id) {
  for (const [key, paths] of Object.entries(upstream)) {
    let path
    if (key === id) path = resolve(original.source, paths[0])
    else if (key.endsWith('*') && id.startsWith(key.slice(0, -1))) path = resolve(original.source, paths[0].replace('*', id.slice(key.length - 1)))
    if (!path) continue
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.ts')
    if (existsSync(path)) return path.replaceAll('\\', '/')
  }
} }
const definitions = JSON.parse(await readFile(join(root, 'build.config.json'), 'utf8'))
for (const [name, definition] of Object.entries(definitions)) {
  if (name === 'ai-village') {
    const run = spawnSync(process.execPath, ['scripts/ai-village-release.mjs'], { cwd: root, stdio: 'inherit', windowsHide: true })
    if (run.status !== 0) throw Error('AI_VILLAGE_BUILD_FAILED')
    continue
  }
  const dir = join(root, 'packages', name)
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  // Only direct generated bundles; keep declaration output produced by typecheck.
  for (const file of await readdir(join(dir, 'lib')).catch(error => { if (error.code === 'ENOENT') return []; throw error })) {
    if (/\.(?:js|cjs|mjs|map)$/.test(file)) await rm(join(dir, 'lib', file))
  }
  for (const [entry, file] of Object.entries(definition.entries)) await build({ config: false,
    entry: { [entry]: join(dir, 'src', file) }, outDir: join(dir, 'lib'), format: 'esm', platform: 'node',
    target: 'es2024', dts: false, clean: false, fixedExtension: false,
    deps: { neverBundle: id => Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).some(name => id === name || id.startsWith(name + '/')),
      alwaysBundle: id => id.startsWith('@oxc-project/runtime/') },
  })
  if (name === 'runtime-adapter') await build({ config: false, entry: { worker: join(dir, 'src/jsonl/worker.ts') },
    outDir: join(dir, 'lib'), format: 'cjs', platform: 'node', target: 'es2024', dts: false, clean: false,
    plugins: [officialWorker, { name: 'worker-standard-decorators', transform(code, id) {
      if (!/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
      return { code: ts.transpileModule(code, { fileName: id, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, map: null }
    } }],
    deps: { neverBundle: ['koffi', '@deepseek-ai/node-addon-system'], alwaysBundle: [/^@deepseek-ai\/(?!node-addon-system)/] }, outputOptions: { entryFileNames: 'worker.cjs' } })
  if (definition.client === false) continue
  if (name === 'live2d') await build({ config: false, entry: { frame: join(dir, 'src/frame/index.ts') },
    outDir: join(dir, 'lib'), format: 'iife', platform: 'browser', target: 'es2022', dts: false, clean: false,
    outputOptions: { entryFileNames: 'frame.js' } })
  if (name === 'desktop-pets') await build({ config: false, entry: { preload: join(dir, 'src/preload.ts') },
    outDir: join(dir, 'lib'), format: 'cjs', platform: 'node', target: 'es2022', dts: false, clean: false,
    deps: { neverBundle: ['electron'] }, outputOptions: { entryFileNames: 'preload.cjs' } })
  if (name === 'plugin-shared') {
    await build({ config: false, entry: { client: join(dir, 'src/client/index.ts') }, outDir: join(dir, 'lib'), format: 'esm', platform: 'browser', dts: false, clean: false, fixedExtension: false })
    continue
  }
  const external = id => ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives'].includes(id)
    || /^@deepseek-ai\/dsh-client-(?:ui-|locale|connection|store)/.test(id)
  await build({ config: false, entry: { client: join(dir, 'src/client/index.ts') }, outDir: join(dir, 'lib'), format: 'cjs', platform: 'browser',
    target: 'es2022', dts: false, clean: false, fixedExtension: false,
    deps: { neverBundle: external, alwaysBundle: id => !external(id) },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"' },
    outputOptions: { entryFileNames: 'client.js', banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });' },
  })
}

const sandbox = spawnSync(process.execPath, ['scripts/sandbox-enhanced.mjs', 'build'], { cwd: root, stdio: 'inherit', windowsHide: true })
if (sandbox.status !== 0) throw Error('SANDBOX_BUILD_FAILED')

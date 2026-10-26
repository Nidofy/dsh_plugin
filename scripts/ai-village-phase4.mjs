import { readFile, writeFile, mkdir, readdir, cp, copyFile, mkdtemp, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { build } from 'tsdown'
import ts from 'typescript'
import assert from 'node:assert/strict'
import * as tar from 'tar'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { villageCompatibility } from './ai-village-compatibility.mjs'
const compatibility = villageCompatibility()
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village'), out = compatibility.out
const mode = process.argv[2] ?? 'check'
assert.ok(['types', 'build', 'check', 'serve'].includes(mode))
await mkdir(out, { recursive: true })
const baseline = compatibility.baseline
const generated = spawnSync(process.execPath, ['scripts/ai-village-resources.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true })
if (generated.status) throw Error(generated.stderr || generated.stdout)
const official = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const paths = Object.fromEntries(Object.entries(official).map(([k, v]) => [k, v.map(p => resolve(baseline.source, p))]))
paths['@nidofy/dsh-plugin-shared/durable-file'] = [join(root, 'packages/plugin-shared/src/durable-file.ts')]
paths['use-sync-external-store/shim/with-selector'] = [join(root, '.build/live2d-official-deps/node_modules/@types/use-sync-external-store/shim/with-selector.d.ts')]
const sources = (await readdir(join(pkg, 'src'), { recursive: true })).filter(n => /\.tsx?$/.test(n)).map(n => join(pkg, 'src', n))
// Keep the isolated content study under the same strict compiler settings as production.
sources.push(...(await readdir(join(pkg, 'experiments/content-ui'))).filter(n => /\.tsx?$/.test(n)).map(n => join(pkg, 'experiments/content-ui', n)))
const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx',
  strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true, types: ['node'], paths }, root)
const diagnostics = []
for (const face of ['host', 'client']) {
  const files = sources.filter(f => face === 'host' ? f === join(pkg, 'src/index.ts') || f.includes('\\host\\') : f !== join(pkg, 'src/index.ts') && !f.includes('\\host\\'))
  const program = ts.createProgram(files, options.options)
  diagnostics.push(...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics())
  for (const file of files) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
}
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
await mkdir(join(pkg, 'lib/types'), { recursive: true })
const declaration = ts.transpileDeclaration(await readFile(join(pkg, 'src/index.ts'), 'utf8'), {
  fileName: 'index.ts', compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext }, reportDiagnostics: true,
})
if (declaration.diagnostics?.length) throw Error(ts.formatDiagnostics(declaration.diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
await writeFile(join(pkg, 'lib/types/index.d.ts'), declaration.outputText)
if (mode === 'types') { console.log('AI Village pinned official Host/Client types and public declaration passed'); process.exit(0) }
const alias = { '@nidofy/dsh-plugin-shared/durable-file': paths['@nidofy/dsh-plugin-shared/durable-file'][0], '@deepseek-ai/dsh-atomic-write': paths['@deepseek-ai/dsh-atomic-write'][0] }
await mkdir(join(out, 'lib'), { recursive: true })
for (const file of await readdir(join(out, 'lib'))) if (/^(index|service(?:-[\w-]+)?|client|frame)\.(?:m?js)$/.test(file)) await unlink(join(out, 'lib', file))
await build({ config: false, entry: { index: join(pkg, 'src/index.ts'), service: join(pkg, 'src/host/service.ts') }, outDir: join(out, 'lib'),
  alias, format: 'esm', platform: 'node', target: 'es2024', clean: false, dts: false,
  inputOptions: { experimental: { attachDebugInfo: 'none' } },
  deps: { alwaysBundle: Object.keys(alias), neverBundle: ['koffi'] } })
await build({ config: false, entry: { client: join(pkg, 'src/client/index.ts') }, outDir: join(out, 'lib'),
  format: 'cjs', platform: 'browser', target: 'es2022', clean: false, dts: false,
  deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] }, define: { 'process.env.NODE_ENV': '\"production\"' },
  outputOptions: { entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: \"@nidofy/dsh-ai-village\", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });' } })
await build({ config: false, entry: { frame: join(pkg, 'src/frame/scene.ts') }, outDir: join(out, 'lib'),
  format: 'iife', platform: 'browser', target: 'es2022', clean: false, dts: false, minify: true, deps: { alwaysBundle: [/./] }, outputOptions: { entryFileNames: 'frame.js' } })
// Node entry extension must match DSH package exports.
await copyFile(join(out, 'lib/index.mjs'), join(out, 'lib/index.js'))
await cp(join(pkg, 'assets'), join(out, 'assets'), { recursive: true })
const notices = await readFile(join(root, '.build/ai-village-phase1/THIRD-PARTY-NOTICES.txt'), 'utf8')
  + '\n\nEmbedded official atomic-write, DSH ' + compatibility.config.dshVersion + ' revision ' + baseline.revision + '\n' + await readFile(join(baseline.source, 'LICENSE'), 'utf8')
  + '\n\nExternal native runtime dependency: Koffi 3.1.1\n' + await readFile(join(root, 'node_modules/koffi/LICENSE.txt'), 'utf8')
await writeFile(join(out, 'THIRD-PARTY-NOTICES.txt'), notices)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
await writeFile(join(out, 'lib/build-identity.json'), JSON.stringify({
  package: '@nidofy/dsh-ai-village', version: JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8')).version,
  dsh: compatibility.config.dshVersion, revision: baseline.revision, archiveSha256: baseline.archiveHash,
  runtimeLockSha256: digest(await readFile(join(root, compatibility.lane === 'rc3' ? 'tools/official-runtime-rc3/package-lock.json' : 'tools/official-runtime/package-lock.json'))),
  source: Object.fromEntries(await Promise.all(sources.map(async file => [file.slice(pkg.length + 1).replaceAll('\\', '/'), digest(await readFile(file))]))),
  embeddedInputs: {
    'packages/plugin-shared/src/durable-file.ts': digest(await readFile(paths['@nidofy/dsh-plugin-shared/durable-file'][0])),
    'official/packages/util/atomic-write/src/index.ts': digest(await readFile(join(baseline.source, 'packages/util/atomic-write/src/index.ts'))),
  },
}, null, 2) + '\n')
if (mode === 'build') { console.log('Phase 4 official types and build passed'); process.exit(0) }
if (mode === 'check') {
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', compatibility.lane === 'rc3' ? 'scripts/ai-village-rc3.vitest.mjs' : 'scripts/ai-village-official.vitest.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000 })
  console.log(result.stdout); if (result.status !== 0) throw Error(result.stderr || result.stdout)
}
const { runPreview } = await import('./ai-village-phase4-browser.mjs')
await runPreview({ root, pkg, out, serve: mode === 'serve' })
if (mode === 'check') {
  const staged = await mkdtemp(join(out, 'pack-'))
  await cp(join(out, 'lib'), join(staged, 'lib'), { recursive: true })
  await cp(join(out, 'assets'), join(staged, 'assets'), { recursive: true })
  for (const name of ['package.json', 'cordis.patch.yml', 'README.md']) await copyFile(join(pkg, name), join(staged, name))
  await copyFile(join(root, 'LICENSE'), join(staged, 'LICENSE'))
  await copyFile(join(out, 'THIRD-PARTY-NOTICES.txt'), join(staged, 'THIRD-PARTY-NOTICES.txt'))
  await tar.c({ file: join(out, 'phase4-integration.tgz'), cwd: staged, gzip: true }, await readdir(staged))
  const extracted = await mkdtemp(join(out, 'unpack-'))
  await tar.x({ file: join(out, 'phase4-integration.tgz'), cwd: extracted })
  const host = await import(pathToFileURL(join(extracted, 'lib/index.js')).href)
  assert.deepEqual(host.inject, ['connection', 'profileContext'])
  const packageInfo = JSON.parse(await readFile(join(extracted, 'package.json'), 'utf8'))
  assert.equal(packageInfo.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(packageInfo.dependencies.koffi, '3.1.1')
  let moduleRecord
  runInNewContext(await readFile(join(extracted, 'lib/client.js'), 'utf8'), { window: { __ModuleLoader__: { load: value => { moduleRecord = value } } } })
  assert.equal(moduleRecord.id, packageInfo.name)
  const client = moduleRecord.factory(createRequire(join(root, 'package.json')))
  assert.equal(client.name, 'nidofy-ai-village-client')
  assert.deepEqual([...client.inject], ['slots', 'locale', 'connection', 'uiSession'])
  const service = await import(pathToFileURL(join(extracted, 'lib/service.mjs')).href)
  const owner = await service.VillageHost.open(await mkdtemp(join(out, 'smoke-profile-')), join(extracted, 'assets'), join(extracted, 'lib'), new AbortController().signal)
  assert.equal(await owner.store.read(), null); await owner.close()
  console.log('Phase 4 integration archive extracted and Host owner smoke passed')
}

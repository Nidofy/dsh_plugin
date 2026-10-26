/** Rebuild isolated companion QA candidates; never edits official rc.2 packages or dist/. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, cp, readdir, symlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, relative, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { build } from 'tsdown'
import ts from 'typescript'
import * as tar from 'tar'
import { villageCompatibility, root } from './ai-village-compatibility.mjs'

const label = process.argv[2]
assert.match(label ?? '', /^[a-z0-9-]+$/, 'Use a fresh lowercase QA label')
const lane = villageCompatibility('rc3'), names = ['source-control', 'live2d']
const stage = join(root, '.build/rc3-coexistence', label)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const save = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n')
async function inventory(base) {
  const files = (await readdir(base, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
  return Object.fromEntries(await Promise.all(files.map(async entry => {
    const path = join(entry.parentPath, entry.name)
    return [relative(base, path).replaceAll('\\', '/'), hash(await readFile(path))]
  })))
}
async function protectedFiles() {
  const result = {}
  for (const name of names) {
    const base = join(root, 'packages', name), manifest = await json(join(base, 'package.json'))
    result[`packages/${name}/package.json`] = hash(await readFile(join(base, 'package.json')))
    result[`packages/${name}/README.md`] = hash(await readFile(join(base, 'README.md')))
    result[`packages/${name}/lib`] = await inventory(join(base, 'lib'))
    result[`packages/${name}/src`] = await inventory(join(base, 'src'))
    const artifact = `dist/${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
    assert.ok(existsSync(join(root, artifact)), 'Historical artifact must exist: ' + artifact)
    result[artifact] = hash(await readFile(join(root, artifact)))
  }
  result['dist/manifest.json'] = hash(await readFile(join(root, 'dist/manifest.json')))
  return result
}
await mkdir(dirname(stage), { recursive: true })
await mkdir(stage) // Never overwrite a previous qualification run.
await mkdir(join(stage, 'artifacts'))
await mkdir(join(stage, 'tmp'))
const before = await protectedFiles()
await save(join(stage, 'protected-before.json'), before)
await symlink(join(lane.runtime, 'node_modules'), join(stage, 'node_modules'), 'junction')
const runtime = createRequire(join(lane.runtime, 'package.json'))
const extraRoot = join(root, '.build/rc3-coexistence-deps')
for (const file of ['package.json', 'package-lock.json']) assert.deepEqual(await readFile(join(extraRoot, file)), await readFile(join(root, 'tools/rc3-coexistence-deps', file)), 'Run rc3-coexistence-prepare first')
const extra = createRequire(join(extraRoot, 'package.json'))
const official = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(lane.baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const paths = Object.fromEntries(Object.entries(official).map(([key, values]) => [key, values.map(file => resolve(lane.baseline.source, file))]))
paths['use-sync-external-store/shim/with-selector'] = [join(lane.runtime, 'node_modules/@types/use-sync-external-store/shim/with-selector.d.ts')]
const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx',
  strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noImplicitOverride: true,
  skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true, types: ['node'], paths }, root)
assert.deepEqual(options.errors, [])
const identities = [], typeResults = []
try {
  for (const name of names) {
    const original = join(root, 'packages', name), work = join(stage, 'work', name), output = join(stage, 'packed', name, 'package')
    await mkdir(work, { recursive: true }); await mkdir(output, { recursive: true })
    for (const directory of ['src', 'tests', ...(name === 'live2d' ? ['assets'] : [])]) await cp(join(original, directory), join(work, directory), { recursive: true })
    const pkg = await json(join(original, 'package.json')), originalVersion = pkg.version
    pkg.version += '-rc3-coexistence.qa.1'
    pkg.private = true
    pkg.description = '[LOCAL QA ONLY / AI Village coexistence] ' + pkg.description
    pkg.engines.dsh = lane.config.dshVersion
    const peers = {}
    for (const id of Object.keys(pkg.peerDependencies)) if (id.startsWith('@deepseek-ai/dsh')) {
      pkg.peerDependencies[id] = lane.config.dshVersion
      const peerRoot = id === '@deepseek-ai/dsh-client-ui-primitives' ? extraRoot : lane.runtime
      const actual = (id === '@deepseek-ai/dsh-client-ui-primitives' ? extra : runtime).resolve(id + '/package.json')
      assert.ok(actual.startsWith(peerRoot), 'Peer escaped rc.3 runtime: ' + id)
      assert.equal((await json(actual)).version, lane.config.dshVersion, id)
      peers[id] = { version: lane.config.dshVersion, packageJson: relative(root, actual).replaceAll('\\', '/'), sha256: hash(await readFile(actual)) }
    }
    await save(join(work, 'package.json'), pkg)
    await save(join(output, 'package.json'), pkg)
    await cp(join(original, 'cordis.patch.yml'), join(output, 'cordis.patch.yml'))
    await cp(join(root, 'LICENSE'), join(output, 'LICENSE'))
    await writeFile(join(output, 'README.md'), `# LOCAL QA ONLY — ${pkg.name} ${pkg.version}\n\nThis is a local rc.3 qualification candidate for AI Village coexistence only. It is rebuilt from source against official DSH ${lane.config.dshVersion} (${lane.baseline.revision}), not an official rc.3 release or a broad compatibility declaration. Install only in the isolated QA profile. Do not publish. Original package ${originalVersion}, its rc.2 declaration, files, and historical artifacts remain unchanged.\n\nFor Live2D, existing character/SDK authorization remains limited to personal local development; this candidate grants no redistribution rights. No new art or external model APIs are used.\n\n## Historical rc.2 usage notes (not rc.3 qualification claims)\n\n` + await readFile(join(original, 'README.md'), 'utf8'))
    const source = await inventory(join(work, 'src')), testSource = await inventory(join(work, 'tests'))
    assert.deepEqual(source, await inventory(join(original, 'src')))
    const sources = Object.keys(source).filter(file => /\.tsx?$/.test(file)).map(file => join(work, 'src', file))
    for (const face of ['host', 'client']) {
      const files = sources.filter(file => face === 'host' ? !/[\\/]client[\\/]|[\\/]frame[\\/]/.test(file) : /[\\/]client[\\/]|[\\/]frame[\\/]/.test(file))
      const program = ts.createProgram(files, options.options)
      const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
      for (const file of files) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
      if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
      typeResults.push({ name: pkg.name, face, files: files.length, strict: true, status: 'PASS', upstream: lane.baseline.revision })
      console.log('PASS strict rc.3 types', name, face, files.length)
    }
    // Emit only this package's checked declarations; upstream files remain external package references.
    const declarationProgram = ts.createProgram(sources, { ...options.options, noEmit: false, declaration: true, emitDeclarationOnly: true })
    for (const file of sources) {
      const outputs = []
      const result = declarationProgram.emit(declarationProgram.getSourceFile(file), (path, text) => outputs.push({ path, text }), undefined, true)
      if (result.emitSkipped || result.diagnostics.length) throw Error(ts.formatDiagnostics(result.diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
      const emitted = outputs.find(item => item.path.endsWith('.d.ts'))
      assert.ok(emitted, 'Missing declaration for ' + file)
      const destination = join(output, 'lib/types', relative(join(work, 'src'), file).replace(/\.tsx?$/, '.d.ts'))
      await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, emitted.text)
    }
    const lib = join(output, 'lib')
    const peer = id => Object.keys(pkg.peerDependencies).some(name => name === id || id.startsWith(name + '/'))
    await build({ config: false, entry: { index: join(work, 'src/index.ts') }, outDir: lib, format: 'esm', platform: 'node',
      target: 'es2024', dts: false, clean: false, fixedExtension: false,
      inputOptions: { experimental: { attachDebugInfo: 'none' } }, deps: { neverBundle: peer, alwaysBundle: id => id.startsWith('@oxc-project/runtime/') } })
    if (name === 'live2d') {
      await cp(join(work, 'assets'), join(output, 'assets'), { recursive: true })
      const closure = await json(join(output, 'assets/manifest.json'))
      for (const [file, expected] of Object.entries(closure)) assert.equal(hash(await readFile(join(output, 'assets', file))), expected, file)
      await build({ config: false, entry: { frame: join(work, 'src/frame/index.ts') }, outDir: lib, format: 'iife', platform: 'browser', target: 'es2022',
        dts: false, clean: false, inputOptions: { experimental: { attachDebugInfo: 'none' } }, outputOptions: { entryFileNames: 'frame.js' } })
    }
    const external = id => ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives'].includes(id) || /^@deepseek-ai\/dsh-client-(?:ui-|locale|connection|store)/.test(id)
    await build({ config: false, entry: { client: join(work, 'src/client/index.ts') }, outDir: lib, format: 'cjs', platform: 'browser', target: 'es2022', dts: false, clean: false, fixedExtension: false,
      inputOptions: { experimental: { attachDebugInfo: 'none' } }, deps: { neverBundle: external, alwaysBundle: id => !external(id) },
      define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"' },
      outputOptions: { entryFileNames: 'client.js', banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`, intro: 'var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });' } })
    const host = await import(pathToFileURL(join(lib, 'index.js')).href)
    assert.equal(host.name, 'nidofy-' + name); assert.deepEqual(host.inject, ['connection'])
    for (const target of Object.values(pkg.exports).flatMap(value => typeof value === 'string' ? [value] : Object.values(value))) assert.ok(existsSync(join(output, target)), 'Missing export ' + target)
    identities.push({ name: pkg.name, version: pkg.version, originalVersion, qaOnly: true, dsh: lane.config.dshVersion, source, testSource, peers, work, output })
  }
  await save(join(stage, 'types.json'), typeResults)
  const test = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'scripts/rc3-coexistence.vitest.mjs', '--reporter=default', '--reporter=json', '--outputFile=' + join(stage, 'tests.json')], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000,
    env: { ...process.env, RC3_COEXISTENCE_STAGE: stage, TEMP: join(stage, 'tmp'), TMP: join(stage, 'tmp') },
  })
  await writeFile(join(stage, 'tests.log'), (test.stdout ?? '') + (test.stderr ?? ''))
  console.log(test.stdout)
  if (test.error || test.status !== 0) throw test.error ?? Error(test.stderr || 'COEXISTENCE_TESTS_FAILED')
  const tests = await json(join(stage, 'tests.json'))
  for (const item of identities) {
    const file = join(stage, 'artifacts', item.name.replace('@', '').replace('/', '-') + '-' + item.version + '.tgz')
    await tar.c({ file, cwd: dirname(item.output), gzip: true, portable: true, mtime: new Date(0) }, ['package'])
    item.file = file; item.sha256 = hash(await readFile(file)); item.bytes = (await stat(file)).size
    item.files = await inventory(item.output)
    item.bundles = Object.fromEntries(Object.entries(item.files).filter(([key]) => /^lib\/(?:index|client|frame)\.js$/.test(key)))
    item.revision = lane.baseline.revision; item.archiveHash = lane.baseline.archiveHash
    item.runtimeLockSha256 = hash(await readFile(join(lane.runtime, 'package-lock.json')))
    item.extraPeerLockSha256 = hash(await readFile(join(extraRoot, 'package-lock.json')))
    item.sourceUiLockSha256 = hash(await readFile(join(root, '.build/official-source-ui-rc3/package-lock.json')))
    item.toolVersions = { node: process.version }
    for (const tool of ['typescript', 'tsdown', 'vitest']) item.toolVersions[tool] = (await json(join(root, 'node_modules', tool, 'package.json'))).version
    item.scripts = Object.fromEntries(await Promise.all(['rc3-coexistence-build.mjs', 'rc3-coexistence.vitest.mjs', 'rc3-coexistence-prepare.mjs', 'ai-village-rc3.vitest.mjs', 'ai-village-compatibility.mjs'].map(async file => [file, hash(await readFile(join(root, 'scripts', file)))])))
    item.tests = { suites: tests.numTotalTestSuites, total: tests.numTotalTests, passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests, reportSha256: hash(await readFile(join(stage, 'tests.json'))) }
    item.status = 'SOURCE_TYPES_TESTS_BUILD_PASS_NATIVE_COMBINATION_PENDING'
  }
  await save(join(stage, 'manifest.json'), identities)
  console.log('QA artifacts:', join(stage, 'manifest.json'))
} catch (error) {
  await save(join(stage, 'failure.json'), { status: 'FAIL', error: String(error.stack ?? error), typeResults })
  throw error
} finally {
  const after = await protectedFiles()
  await save(join(stage, 'protected-after.json'), after)
  assert.deepEqual(after, before, 'Formal rc.2 source/manifest/lib/artifact changed during QA')
  await save(join(stage, 'preservation.json'), { status: 'PASS', sourceAndFormalRc2FilesUnchanged: true, before: 'protected-before.json', after: 'protected-after.json' })
}

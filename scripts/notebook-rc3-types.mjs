/** Check and emit plugin declarations against official rc.3, without relinking other lanes. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises'
import { join, resolve, relative, dirname } from 'node:path'
import ts from 'typescript'
import { villageCompatibility, root } from './ai-village-compatibility.mjs'
const lane = villageCompatibility('rc3')
const upstream = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(lane.baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const paths = Object.fromEntries(Object.entries(upstream).map(([key, values]) => [key, values.map(file => resolve(lane.baseline.source, file))]))
const names = ['plugin-shared', 'runtime-adapter', 'working-notebook', 'source-control']
for (const name of names) {
  const base = join(root, 'packages', name), pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
  for (const [key, value] of Object.entries(pkg.exports)) if (typeof value !== 'string' && value.types) {
    paths[pkg.name + (key === '.' ? '' : key.slice(1))] = [join(base, value.types.replace('./lib/types/', 'src/').replace(/\.d\.ts$/, '.ts'))]
  }
}
paths['use-sync-external-store/shim/with-selector'] = [join(lane.runtime, 'node_modules/@types/use-sync-external-store/shim/with-selector.d.ts')]
const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true,
  noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noImplicitOverride: true, skipLibCheck: true,
  esModuleInterop: true, allowImportingTsExtensions: true, types: ['node'], paths, declaration: true, emitDeclarationOnly: true }, root)
assert.deepEqual(options.errors, [])
const format = errors => ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' })
for (const name of names) {
  const base = join(root, 'packages', name), source = join(base, 'src')
  const files = (await readdir(source, { recursive: true })).filter(file => /\.(?:ts|tsx|mts)$/.test(file)).map(file => join(source, file))
  for (const face of (name === 'runtime-adapter' ? ['host'] : ['host', 'client'])) {
  const selected = files.filter(file => face === 'client' ? /[\\/]client[\\/]/.test(file) : !/[\\/]client[\\/]/.test(file))
  const program = ts.createProgram(selected, options.options)
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
  // Upstream source is an immutable dependency; check every owned source and shared contract.
  for (const file of selected) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
  if (diagnostics.length) throw Error(format(diagnostics))
  for (const file of selected) {
    if (/\.d\.[cm]?ts$/.test(file)) {
      const output = join(base, 'lib/types', relative(source, file)); await mkdir(dirname(output), { recursive: true }); await copyFile(file, output); continue
    }
    const outputs = []
    const result = program.emit(program.getSourceFile(file), (path, text) => outputs.push({ path, text }), undefined, true)
    assert.ok(!result.emitSkipped && !result.diagnostics.length, format(result.diagnostics))
    const emitted = outputs.find(item => /\.d\.[cm]?ts$/.test(item.path)); assert.ok(emitted, file)
    const output = join(base, 'lib/types', relative(source, file).replace(/\.(tsx?|mts)$/, (_, extension) => extension === 'mts' ? '.d.mts' : '.d.ts'))
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, emitted.text)
  }
  console.log('PASS strict rc.3 declarations:', name, face, selected.length)
  }
}

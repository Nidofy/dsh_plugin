/** Validate companion packages before advertising the newer official host peer range. */
import ts from 'typescript'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
const baseline = JSON.parse(await readFile(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
const official = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
const paths = Object.fromEntries(Object.entries(official).map(([k, v]) => [k, v.map(p => resolve(baseline.source, p))]))
paths['use-sync-external-store/shim/with-selector'] = [join(root, '.build/live2d-official-deps/node_modules/@types/use-sync-external-store/shim/with-selector.d.ts')]
const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx',
  strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true, types: ['node'], paths }, root)
const diagnostics = []
for (const name of ['source-control', 'live2d']) {
  const src = join(root, 'packages', name, 'src')
  const sources = (await readdir(src, { recursive: true })).filter(n => /\.tsx?$/.test(n)).map(n => join(src, n))
  for (const face of ['host', 'client']) {
    const files = sources.filter(f => face === 'host' ? !f.includes('\\client\\') && !f.includes('\\frame\\') : f.includes('\\client\\'))
    const program = ts.createProgram(files, options.options)
    diagnostics.push(...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics())
    for (const file of files) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
  }
}
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
console.log('Git/Live2D strict types against official 0.2.1-rc.2 passed')
if (process.argv.includes('--types-only')) process.exit(0)
const test = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/source-control-official.vitest.mjs'], { cwd: root, stdio: 'inherit', windowsHide: true })
process.exit(test.status ?? 1)

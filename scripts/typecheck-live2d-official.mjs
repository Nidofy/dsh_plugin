/** Check plugin-owned files against the pinned official source contracts, not desktop .d.ts files. */
import ts from 'typescript'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const baseline = JSON.parse(readFileSync(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
if (baseline.revision !== '687f282e8625c6b8d11ff58211a90524be2e4317') throw Error('Wrong official baseline')
const official = ts.parseConfigFileTextToJson('tsconfig.base.json', readFileSync(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config
const local = JSON.parse(readFileSync(join(root, 'tsconfig.base.json'), 'utf8'))
const paths = Object.fromEntries(Object.entries(official.compilerOptions.paths).map(([name, values]) => [name, values.map(value => resolve(baseline.source, value))]))
paths['use-sync-external-store/shim/with-selector'] = [join(root, '.build/live2d-official-deps/node_modules/@types/use-sync-external-store/shim/with-selector.d.ts')]
const options = ts.convertCompilerOptionsFromJson({ ...local.compilerOptions, jsx: 'react-jsx', noEmit: true, declaration: false, emitDeclarationOnly: false, paths }, root)
if (options.errors.length) throw Error(ts.formatDiagnosticsWithColorAndContext(options.errors, diagnosticHost()))
const source = join(root, 'packages/live2d/src')
const files = readdirSync(source, { recursive: true }).filter(file => /\.tsx?$/.test(file)).map(file => join(source, file))
const hostFiles = [join(source, 'index.ts'), join(source, 'assets.ts')]
const diagnostics = []
// Host and Client deliberately have distinct Connection service types.
for (const face of ['host', 'client']) {
  const ownedFiles = face === 'host' ? hostFiles : files.filter(file => !hostFiles.includes(file))
  const program = ts.createProgram(ownedFiles, options.options)
  diagnostics.push(...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics())
  for (const file of ownedFiles) {
    const owned = program.getSourceFile(file)
    diagnostics.push(...program.getSyntacticDiagnostics(owned), ...program.getSemanticDiagnostics(owned))
  }
  if (face === 'client') for (const module of ['ui-session', 'ui-layout', 'ui-conversation', 'ui-renderer', 'connection']) {
    const expected = join(baseline.source, 'packages/client', module, 'src/client/index.ts')
    if (!program.getSourceFile(expected)) throw Error('Official contract not loaded: ' + expected)
  }
}
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost())); process.exit(1)
}
console.log('Live2D strict API check against official source passed:', baseline.revision, files.length, 'owned source files')
function diagnosticHost() { return { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' } }

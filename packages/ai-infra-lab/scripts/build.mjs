import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { build } from 'tsdown'
import ts from 'typescript'
import { generateStyleModule } from './style-module.mjs'

const base = resolve(import.meta.dirname, '..')
const repo = resolve(base, '../..')

await generateStyleModule(base)

const sourceCandidates = [
  process.env.DSH_SOURCE,
  join(repo, '.build/official-source-rc5'),
  join(repo, '../../.build/official-source-rc5'),
].filter(Boolean)

const sourcePath = sourceCandidates.find((p) => existsSync(p))
if (!sourcePath) {
  throw Error('DSH_SOURCE or .build/official-source-rc5 is required for strict TypeScript compilation')
}
const source = resolve(sourcePath)

const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: source,
  encoding: 'utf8',
  windowsHide: true,
}).trim()
assert.equal(
  revision,
  'b830ec950faba0a46dda564be3e2d854afed94f1',
  'DSH_SOURCE must match the verified official revision',
)

const upstreamPaths = ts.parseConfigFileTextToJson(
  'tsconfig.base.json',
  await readFile(join(source, 'tsconfig.base.json'), 'utf8'),
).config.compilerOptions.paths

const paths = Object.fromEntries(
  Object.entries(upstreamPaths).map(([key, values]) => [key, values.map((v) => resolve(source, v))]),
)

const options = ts.convertCompilerOptionsFromJson(
  {
    target: 'ES2024',
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    strict: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    types: ['node'],
    noEmit: true,
    paths,
  },
  repo,
)

const srcFiles = (await readdir(join(base, 'src'), { recursive: true }))
  .filter((f) => /\.tsx?$/.test(String(f)))
  .map((f) => join(base, 'src', String(f)))

const program = ts.createProgram(srcFiles, options.options)
const diagnostics = [
  ...program.getOptionsDiagnostics(),
  ...program.getGlobalDiagnostics(),
  ...srcFiles.flatMap((f) => [
    ...program.getSyntacticDiagnostics(program.getSourceFile(f)),
    ...program.getSemanticDiagnostics(program.getSourceFile(f)),
  ]),
]

if (diagnostics.length > 0) {
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => repo,
      getNewLine: () => '\n',
    }),
  )
}
console.log('PASS strict TypeScript check')

await mkdir(join(base, 'lib'), { recursive: true })
const external = (id) =>
  id.startsWith('@deepseek-ai/') || ['react', 'react/jsx-runtime', 'react-dom'].includes(id)

await build({
  config: false,
  entry: { index: join(base, 'src/index.ts') },
  outDir: join(base, 'lib'),
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
  fixedExtension: false,
  deps: { neverBundle: external },
})

await build({
  config: false,
  entry: { client: join(base, 'src/client.tsx') },
  outDir: join(base, 'lib'),
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  fixedExtension: false,
  deps: { neverBundle: external },
  define: { 'process.env.NODE_ENV': '"production"' },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-ai-infra-lab", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})

const trackedInputs = [
  ...srcFiles,
  ...(
    await Promise.all(
      ['content', 'runtime', 'scripts/cpu-image'].map(async (folder) =>
        (await readdir(join(base, folder), { recursive: true, withFileTypes: true }))
          .filter((f) => f.isFile())
          .map((f) => join(f.parentPath, f.name)),
      ),
    )
  ).flat(),
  ...[
    'package.json',
    'cordis.patch.yml',
    'scripts/build.mjs',
    'scripts/style-module.mjs',
    'scripts/prepare-image.ps1',
  ].map((f) => join(base, f)),
].sort()

const sourceHashes = {}
for (const file of trackedInputs) {
  const rel = relative(base, file).replaceAll('\\', '/')
  sourceHashes[rel] = createHash('sha256').update(await readFile(file)).digest('hex')
}

await writeFile(
  join(base, 'lib/build-identity.json'),
  JSON.stringify(
    {
      name: 'dsh-plugin-ai-infra-lab',
      revision,
      dshRange: '>=0.2.1-rc.2 <0.3.0-0',
      source: sourceHashes,
    },
    null,
    2,
  ) + '\n',
)
console.log('PASS bundled lib/index.js, lib/client.js, and lib/build-identity.json')

import { generateStyleModule } from './style-module.mjs'
import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
const base = resolve(import.meta.dirname, '..'),
  repo = resolve(base, '../..')
await generateStyleModule(base)
const source = resolve(
  process.env.DSH_SOURCE ??
    [join(repo, '.build/official-source-rc5'), join(repo, '../../.build/official-source-rc5')].find(
      existsSync,
    ) ??
    join(repo, '.build/official-source-rc5'),
)
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: source,
  encoding: 'utf8',
  windowsHide: true,
}).trim()
assert.equal(
  revision,
  'b830ec950faba0a46dda564be3e2d854afed94f1',
  'DSH_SOURCE must use the fixed rc.5 revision',
)
assert.equal(JSON.parse(await readFile(join(source, 'package.json'), 'utf8')).version, '0.2.1-rc.5')
const upstream = ts.parseConfigFileTextToJson(
  'tsconfig.base.json',
  await readFile(join(source, 'tsconfig.base.json'), 'utf8'),
).config.compilerOptions.paths
const paths = Object.fromEntries(
  Object.entries(upstream).map(([key, values]) => [key, values.map((v) => resolve(source, v))]),
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
const files = (await readdir(join(base, 'src'), { recursive: true }))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => join(base, 'src', f))
const program = ts.createProgram(files, options.options)
const diagnostics = [
  ...program.getOptionsDiagnostics(),
  ...program.getGlobalDiagnostics(),
  ...files.flatMap((f) => [
    ...program.getSyntacticDiagnostics(program.getSourceFile(f)),
    ...program.getSemanticDiagnostics(program.getSourceFile(f)),
  ]),
]
if (diagnostics.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => repo,
      getNewLine: () => '\n',
    }),
  )
console.log('PASS strict TypeScript against DSH rc.5')
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
    banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-neural-lab", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})
const inputs = [
  ...files,
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
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'scripts/prepare-image.ps1',
    'src/style.css',
  ].map((f) => join(base, f)),
]
await writeFile(
  join(base, 'lib/build-identity.json'),
  JSON.stringify(
    {
      dsh: '0.2.1-rc.5',
      revision,
      version: JSON.parse(await readFile(join(base, 'package.json'), 'utf8')).version,
      source: Object.fromEntries(
        await Promise.all(
          inputs.map(async (f) => [
            f.slice(base.length + 1).replaceAll('\\', '/'),
            createHash('sha256')
              .update(await readFile(f))
              .digest('hex'),
          ]),
        ),
      ),
    },
    null,
    2,
  ),
)

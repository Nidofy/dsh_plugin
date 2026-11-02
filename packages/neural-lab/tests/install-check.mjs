import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  symlink,
  rm,
  realpath,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const pkg = resolve(import.meta.dirname, '..'),
  repo = resolve(pkg, '../..')
const original = resolve(process.env.NEURAL_BUILD_ROOT ?? join(repo, '../..'))
const runtimeRoot = join(original, '.build/official-runtime-rc5')
const runtime = createRequire(join(runtimeRoot, 'package.json'))
const sourceManifest = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
const archive = join(
  pkg,
  `${sourceManifest.name.replace(/^@/, '').replaceAll('/', '-')}-${sourceManifest.version}.tgz`,
)
await mkdir(join(repo, '.build'), { recursive: true })
const stage = await mkdtemp(join(repo, '.build/neural-install-')),
  profile = join(stage, 'home/profiles/qualification')
let result
try {
  await mkdir(profile, { recursive: true })
  await writeFile(
    join(profile, 'package.json'),
    JSON.stringify({
      name: 'neural-offline-qualification',
      private: true,
      type: 'module',
      dependencies: {},
      dsh: { profile: { bundles: [] } },
    }),
  )
  await writeFile(
    join(profile, 'pnpm-workspace.yaml'),
    'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n',
  )
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n')
  const store = join(stage, 'empty-store')
  await mkdir(store)
  const pnpm =
    process.env.PNPM_CLI ??
    join(
      original,
      '.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs',
    )
  assert.ok(existsSync(pnpm), 'Set PNPM_CLI to pnpm entrypoint')
  const { runProfilePnpm } = await import(
    pathToFileURL(runtime.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href
  )
  const install = await runProfilePnpm(
    {
      profile: 'qualification',
      dir: profile,
      home: join(stage, 'home'),
      cwd: stage,
      installAnchor: runtime.resolve('@deepseek-ai/dsh/package.json'),
    },
    [
      'add',
      archive,
      '--offline',
      '--ignore-scripts',
      '--store-dir',
      store,
      '--registry=http://127.0.0.1:9',
    ],
    {
      execution: 'service',
      command: process.execPath,
      args: [pnpm],
      env: { CI: '1', COREPACK_ENABLE_NETWORK: '0' },
      outputBytes: 16384,
      activateNewBundles: false,
      idleTimeoutMs: 30000,
    },
  )
  assert.equal(install.exitCode, 0, install.output)
  const local = createRequire(join(profile, 'package.json')),
    installed = dirname(local.resolve('dsh-plugin-neural-lab/package.json'))
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert.equal(manifest.engines.dsh, '0.2.1-rc.5')
  assert.equal(manifest.version, sourceManifest.version)
  const identity = JSON.parse(await readFile(join(installed, 'lib/build-identity.json'), 'utf8'))
  assert.equal(identity.revision, 'b830ec950faba0a46dda564be3e2d854afed94f1')
  for (const [file, hash] of Object.entries(identity.source)) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(pkg, file)))
        .digest('hex'),
      hash,
      'Stale build input: ' + file,
    )
    if (!file.startsWith('src/'))
      assert.equal(
        createHash('sha256')
          .update(await readFile(join(installed, file)))
          .digest('hex'),
        hash,
        'Packaged input differs: ' + file,
      )
  }
  for (const group of ['dependencies', 'peerDependencies'])
    for (const version of Object.values(manifest[group] ?? {}))
      assert.doesNotMatch(version, /^(workspace|link|file):/)
  for (const file of [
    'lib/index.js',
    'lib/client.js',
    'content/catalog.json',
    'content/lectures.json',
    'runtime/controller.py',
    'runtime/student.py',
    'scripts/prepare-image.ps1',
    'scripts/cpu-image/Dockerfile',
    'scripts/cpu-image/requirements.lock',
    'cordis.patch.yml',
  ])
    assert.ok(existsSync(join(installed, file)), file)
  for (const name of await readdir(join(runtimeRoot, 'node_modules/@deepseek-ai'))) {
    const dest = join(profile, 'node_modules/@deepseek-ai', name)
    if (!existsSync(dest)) {
      await mkdir(dirname(dest), { recursive: true })
      await symlink(join(runtimeRoot, 'node_modules/@deepseek-ai', name), dest, 'junction')
    }
  }
  const { Context, Service } = await import(
    pathToFileURL(local.resolve('@deepseek-ai/cordis')).href
  )
  const shipped = await import(pathToFileURL(local.resolve('dsh-plugin-neural-lab')).href)
  const ctx = new Context()
  new Service(ctx, 'connection')
  try {
    await shipped.apply(ctx, { dataRoot: join(stage, 'learner'), image: 'dsh-neural-lab-cpu:0.1' })
  } finally {
    await ctx.fiber.dispose()
  }
  const engine = await shipped.Engine.open(join(stage, 'learner'))
  try {
    assert.equal(engine.overview().catalog.lessons.length, 12)
    assert.ok(engine.overview().catalog.lessons[0].body.length > 500)
  } finally {
    await engine.close()
  }
  result = {
    status: 'PASS',
    version: manifest.version,
    scope:
      'Official rc.5 plugin manager offline empty-store installation, shipped Cordis lifecycle and curriculum load',
    archive,
    sha256: createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    stage,
    limitations: ['Does not prove native Desktop GUI or configured real model invocation'],
  }
} finally {
  // Delete only this invocation's newly created directory, never shared runtime junction targets.
  const resolvedStage = await realpath(stage)
  const offset = relative(await realpath(join(repo, '.build')), resolvedStage)
  assert.ok(
    !isAbsolute(offset) && /^neural-install-[^/\\]+$/.test(offset),
    'Unsafe test cleanup target',
  )
  await rm(resolvedStage, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}
assert.ok(result)
result.temporaryProfileRemoved = !existsSync(stage)
assert.equal(result.temporaryProfileRemoved, true)
await mkdir(join(pkg, '.build'), { recursive: true })
await writeFile(join(pkg, '.build/install-result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))

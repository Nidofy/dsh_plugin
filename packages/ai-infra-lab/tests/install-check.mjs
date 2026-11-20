import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Script } from 'node:vm'

const pkg = resolve(import.meta.dirname, '..')
const repo = resolve(pkg, '../..')
const mainRepo = existsSync(join(repo, '.build/official-runtime-rc5'))
  ? repo
  : resolve(repo, '../..')

const sourceManifest = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
const archive = join(pkg, `${sourceManifest.name}-${sourceManifest.version}.tgz`)
assert.ok(existsSync(archive), `Missing packed tarball: ${archive}`)

const pnpm =
  process.env.PNPM_CLI ??
  join(
    mainRepo,
    '.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs',
  )
assert.ok(existsSync(pnpm), 'Set PNPM_CLI to pnpm entrypoint')

await mkdir(join(pkg, '.build'), { recursive: true })
const stage = await mkdtemp(join(pkg, '.build/install-check-'))

try {
  for (const [label, runtimeSub] of [
    ['0.2.1-rc.2', 'official-runtime'],
    ['0.2.1-rc.5', 'official-runtime-rc5'],
  ]) {
    const runtimeRoot = join(mainRepo, '.build', runtimeSub)
    const runtimeReq = createRequire(join(runtimeRoot, 'package.json'))
    const { runProfilePnpm } = await import(
      pathToFileURL(runtimeReq.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href
    )
    const boot = await import(pathToFileURL(runtimeReq.resolve('@deepseek-ai/dsh-app-boot')).href)

    const laneStage = join(stage, label)
    const profile = join(laneStage, 'home/profiles/qualification')
    const store = join(laneStage, 'empty-store')
    await mkdir(profile, { recursive: true })
    await mkdir(store, { recursive: true })

    await writeFile(
      join(profile, 'package.json'),
      JSON.stringify({
        name: 'ai-infra-lab-qualification',
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

    const install = await runProfilePnpm(
      {
        profile: 'qualification',
        dir: profile,
        home: join(laneStage, 'home'),
        cwd: laneStage,
        installAnchor: runtimeReq.resolve('@deepseek-ai/dsh/package.json'),
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
    assert.equal(install.exitCode, 0, `[${label}] install failed: ${install.output}`)

    const localReq = createRequire(join(profile, 'package.json'))
    const installedDir = dirname(localReq.resolve('dsh-plugin-ai-infra-lab/package.json'))
    const manifest = JSON.parse(await readFile(join(installedDir, 'package.json'), 'utf8'))

    // 1. Official compatibility check
    const compatIssue = boot.evaluatePluginCompatibility(manifest, {})
    assert.equal(compatIssue, undefined, `[${label}] rejected: ${JSON.stringify(compatIssue)}`)

    // 2. No workspace:/link:/file: or absolute dev paths
    for (const group of ['dependencies', 'peerDependencies', 'devDependencies']) {
      for (const ver of Object.values(manifest[group] ?? {})) {
        assert.doesNotMatch(String(ver), /^(?:workspace|link|file):/)
      }
    }
    const clientCode = await readFile(join(installedDir, 'lib/client.js'), 'utf8')
    const hostCode = await readFile(join(installedDir, 'lib/index.js'), 'utf8')
    assert.ok(!clientCode.includes('FeiyangChen') && !hostCode.includes('FeiyangChen'), 'Leaked local developer path in bundle')

    // 3. Verify browser module registration & external require allowlist
    let registered
    new Script(clientCode).runInNewContext({
      window: { __ModuleLoader__: { load: (val) => { registered = val } } },
    })
    assert.equal(registered?.id, 'dsh-plugin-ai-infra-lab')
    assert.equal(typeof registered?.factory, 'function')
    const browserRequires = [...clientCode.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1])
    const allowedBrowserExternals = new Set([
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@deepseek-ai/dsh-client-ui-primitives',
    ])
    for (const reqId of browserRequires) {
      assert.ok(allowedBrowserExternals.has(reqId), `Disallowed browser external require: ${reqId}`)
    }

    // 4. Verify build-identity hashes match source & packaged files
    const identity = JSON.parse(await readFile(join(installedDir, 'lib/build-identity.json'), 'utf8'))
    for (const [relFile, expectedHash] of Object.entries(identity.source)) {
      const srcBytes = await readFile(join(pkg, relFile))
      assert.equal(createHash('sha256').update(srcBytes).digest('hex'), expectedHash, `Stale build input: ${relFile}`)
      if (relFile.startsWith('content/') || relFile.startsWith('runtime/') || relFile === 'cordis.patch.yml') {
        const pkgBytes = await readFile(join(installedDir, relFile))
        assert.equal(createHash('sha256').update(pkgBytes).digest('hex'), expectedHash, `Packaged file mismatch: ${relFile}`)
      }
    }

    console.log(`PASS [${label}] empty-store offline install, compatibility, bundle audit, and build-identity verification`)

    // 5. Dynamically import installed Host bundle and run mount/dispose lifecycle against temporary profile dataRoot
    const hostMod = await import(pathToFileURL(join(installedDir, 'lib/index.js')).href)
    assert.equal(hostMod.name, 'ai-infra-lab')
    const disposers = []
    const fakeHostCtx = {
      get: (k) => (k === 'profileContext' ? { dir: profile } : undefined),
      on: () => {
        const off = () => {}
        disposers.push(off)
        return off
      },
      effect: (fn) => {
        disposers.push(fn())
      },
      logger: { warn() {} },
    }
    await hostMod.apply(fakeHostCtx, { image: 'dsh-ai-infra-lab-cpu:0.1' })
    for (const d of disposers.reverse()) await d()
    console.log(`PASS [${label}] installed lib/index.js host import & lifecycle smoke`)
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}

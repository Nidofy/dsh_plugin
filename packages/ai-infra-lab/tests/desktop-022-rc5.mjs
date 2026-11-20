import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { loadPlaywright, pkg } from './browser-runtime.mjs'

const target = '0.2.2-rc.5'
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

// Use Electron's own filesystem support for its installed ASAR. The package
// inspected here was extracted by Desktop's plugin installer into the new profile.
async function inspectRuntime(installedDir) {
  const runtime = join(dirname(process.execPath), 'resources/app.asar/dsh')
  const req = createRequire(join(runtime, 'package.json'))
  const { satisfies, intersects } = req('semver')
  const { release, sharedPackages } = await json(join(runtime, 'desktop-runtime.json'))
  const boot = await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-app-boot')).href)
  const manifest = await json(join(installedDir, 'package.json'))
  assert.equal(release.version, target)
  assert.equal(boot.getDshRuntimeVersion(), target)
  assert.equal(boot.evaluatePluginCompatibility(manifest, {}), undefined)
  assert.ok(satisfies(target, manifest.engines.dsh))
  const frontend = await json(join(runtime, 'node_modules/@deepseek-ai/dsh-web-frontend/package.json'))
  const peers = {}
  for (const [name, range] of Object.entries(manifest.peerDependencies)) {
    if (name === 'react' || name === 'react-dom') {
      // These browser modules are supplied by the bundled renderer.
      assert.ok(intersects(frontend.devDependencies[name], range), name)
      continue
    }
    const shared = sharedPackages.find(item => item.name === name)
    assert.ok(shared, 'Missing shared Desktop package: ' + name)
    peers[name] = (await json(join(runtime, shared.path, 'package.json'))).version
    assert.equal(peers[name], shared.version)
    assert.ok(satisfies(peers[name], range), name + ' ' + range)
  }
  for (const id of manifest.dsh.client.inject) {
    assert.ok(sharedPackages.some(item => item.name === id), 'Missing Desktop client module: ' + id)
  }
  return { release, peers }
}

async function checkDesktop() {
  const exe = process.env.DSH_DESKTOP_EXE ?? [
    join(parse(pkg).root, 'Software/DSH_Official/DeepSeek Harness.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs/DeepSeek Harness/DeepSeek Harness.exe'),
  ].find(path => path && existsSync(path))
  assert.ok(exe && existsSync(exe), 'Set DSH_DESKTOP_EXE to the official 0.2.2-rc.5 Desktop executable')
  const { name, version } = await json(join(pkg, 'package.json'))
  const archive = join(pkg, name + '-' + version + '.tgz')
  assert.ok(existsSync(archive), 'Run npm pack before the Desktop installation check')
  const { _electron } = await loadPlaywright()
  const build = join(pkg, '.build')
  await mkdir(build, { recursive: true })
  const stage = await mkdtemp(join(build, 'desktop-022-'))
  const home = join(stage, 'home')
  const data = join(stage, 'electron')
  const profile = join(home, 'profiles/desktop')
  const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: join(stage, 'agents'),
    DSH_TELEMETRY_DISABLED: '1', DEEPSEEK_API_KEY: '', npm_config_offline: 'true',
    npm_config_registry: 'http://127.0.0.1:9', npm_config_cache: join(stage, 'npm-cache'),
    COREPACK_ENABLE_NETWORK: '0' }
  delete env.ELECTRON_RUN_AS_NODE
  const electronNode = (...args) => promisify(execFile)(exe, ['--expose-internals', ...args], {
    cwd: stage, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 90000, windowsHide: true,
  })
  const cli = join(dirname(exe), 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js')
  let app
  async function launch() {
    app = await _electron.launch({ executablePath: exe, args: ['--user-data-dir=' + data], env, cwd: stage, timeout: 90000 })
    assert.equal(resolve(await app.evaluate(({ app }) => app.getPath('userData'))), resolve(data))
    const page = await app.firstWindow({ timeout: 90000 })
    await page.waitForFunction(() => document.body?.innerText.trim().length > 40, null, { timeout: 60000 })
    return page
  }
  async function close() {
    if (!app) return
    await app.close()
    app = undefined
  }
  try {
    assert.equal((await electronNode(cli, '--version')).stdout.trim(), target)
    await launch()
    await close()
    assert.ok(existsSync(join(profile, 'package.json')), 'Desktop initialized its isolated profile')
    const store = join(stage, 'pnpm-store')
    await mkdir(store)
    assert.deepEqual(await readdir(store), [])
    const install = await electronNode(cli, 'plugin', '--profile', 'desktop', 'add', archive,
      '--offline', '--ignore-scripts', '--store-dir', store)
    const installOutput = install.stdout + install.stderr
    assert.doesNotMatch(installOutput, /downloaded [1-9]\d*/i)
    const installerPeerWarning = /issues with peer dependencies/i.test(installOutput)
    const definition = await json(join(profile, 'package.json'))
    assert.ok(definition.dependencies[name])
    assert.equal(definition.dsh.profile.bundles.filter(id => id === name).length, 1)
    const installed = join(profile, 'node_modules', name)
    assert.equal((await json(join(installed, 'package.json'))).version, version)
    const runtime = JSON.parse((await electronNode(fileURLToPath(import.meta.url), '--runtime', installed)).stdout)
    console.log('PASS official Desktop ' + target + ' installed and enabled ' + name + '@' + version + ' offline')

    const page = await launch()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const entry = page.getByRole('button', { name: /^AI Infra Lab(?: · 算力与系统实验室)?$/ })
    const deadline = Date.now() + 45000
    while (!(await entry.isVisible())) {
      for (const action of [/^(继续|Continue)$/, /^(关闭|Close)$/]) {
        const button = page.getByRole('button', { name: action }).last()
        if (await button.isVisible()) await button.click({ timeout: 2000 })
      }
      if (Date.now() > deadline) throw Error('Missing lab panel in isolated Desktop: ' + (await page.locator('body').innerText()).slice(0, 1600))
      await page.waitForTimeout(200)
    }
    await entry.click()
    await page.locator('.ail-lesson-item').last().waitFor()
    const catalog = await json(join(installed, 'content/catalog.json'))
    assert.equal(await page.locator('.ail-lesson-item').count(), catalog.lessons.length)
    const code = catalog.lessons.flatMap(lesson => lesson.exercises).find(item => item.id === 'A00-code').reference
    const rpc = (method, ...args) => page.evaluate(async ({ method, args }) => {
      const response = await fetch('/api/ai-infra-lab/rpc', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, args }),
      })
      if (!response.ok) throw Error(method + ' HTTP ' + response.status)
      return response.json()
    }, { method, args })
    const overview = await rpc('overview')
    assert.equal(overview.catalog.version, catalog.version)
    assert.equal(overview.catalog.lessons.length, catalog.lessons.length)
    const { id } = await rpc('start', 'A00-code', code, { seed: 42 })
    const end = Date.now() + 100000
    let run
    do {
      run = await rpc('run', id)
      if (!['running', 'queued'].includes(run.run_status)) break
      await page.waitForTimeout(200)
    } while (Date.now() < end)
    assert.equal(run.check_status, 'passed', JSON.stringify(run.events?.slice(-3)))
    assert.deepEqual(pageErrors, [])
    await close()
    const report = { ...runtime, plugin: { name, version, sha256: sha256(await readFile(archive)) }, contentVersion: catalog.version,
      lessons: catalog.lessons.length, exercise: 'A00-code', checkStatus: run.check_status, installerPeerWarning, pageErrors }
    await writeFile(join(build, 'desktop-' + target + '-v' + version + '.json'), JSON.stringify(report, null, 2))
    console.log('PASS native Desktop panel, ' + report.lessons + ' lessons, authenticated RPC and Docker A00-code=' + run.check_status)
  } finally {
    try { await close() } finally {
      assert.equal(dirname(stage), build)
      await rm(stage, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
    }
  }
}

if (process.argv[2] === '--runtime') console.log(JSON.stringify(await inspectRuntime(process.argv[3])))
else await checkDesktop()

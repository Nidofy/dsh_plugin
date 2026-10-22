import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { build } from 'tsdown'

const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const source = join(pkg, 'experiments/content-ui'), out = join(root, '.build/ai-village-content-preview')
const qa = join(root, '.build/ai-village-v0.4-qa/m01'), mode = process.argv[2] ?? 'check'
assert.ok(['check', 'serve', 'build'].includes(mode))
await mkdir(out, { recursive: true }); await mkdir(qa, { recursive: true })
const types = spawnSync(process.execPath, ['scripts/ai-village-phase4.mjs', 'types'], { cwd: root, encoding: 'utf8', windowsHide: true })
if (types.status !== 0) throw Error(types.stdout + types.stderr)
for (const [name, file] of [['client', join(source, 'client.ts')], ['frame', join(pkg, 'src/frame/scene.ts')]]) {
  await build({ config: false, entry: { [name]: file }, outDir: out, format: 'iife', platform: 'browser', target: 'es2022',
    clean: false, dts: false, minify: true, deps: { alwaysBundle: [/./] }, outputOptions: { entryFileNames: name + '.js' } })
}
for (const file of ['index.html', 'style.css']) await copyFile(join(source, file), join(out, file))
if (mode === 'build') { console.log('M0/M1 content study built'); process.exit(0) }
const routes = new Map()
for (const file of ['index.html', 'style.css', 'client.js', 'frame.js']) routes.set('/' + (file === 'index.html' ? '' : file), join(out, file))
for (const file of await readdir(join(pkg, 'assets'), { recursive: true })) if (file.endsWith('.png')) routes.set('/assets/' + file.replaceAll('\\', '/'), join(pkg, 'assets', file))
const server = createServer(async (req, res) => {
  const file = routes.get(req.url)
  if (req.method !== 'GET' || !file) { res.writeHead(404).end(); return }
  try {
    const bytes = await readFile(file)
    res.writeHead(200, { 'Content-Type': file.endsWith('.png') ? 'image/png' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(bytes)
  } catch { res.writeHead(500).end() }
})
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(mode === 'serve' ? 18753 : 0, '127.0.0.1', resolve) })
const url = `http://127.0.0.1:${server.address().port}`
if (mode === 'serve') { console.log(`Memory-only M0/M1 study: ${url}`) }
else {
  let browser
  try {
    await build({ config: false, entry: { model: join(source, 'model.ts') }, outDir: out, format: 'esm', platform: 'node', target: 'es2024', clean: false, dts: false })
    const { ContentPreview } = await import(pathToFileURL(join(out, 'model.mjs')).href)
    const initial = new ContentPreview().controller.world, ids = [initial.actor, ...initial.companions].map(a => a.id), pairs = []
    for (const first of ids) for (const second of ids) if (first !== second) {
      const probe = new ContentPreview(), accepted = probe.invite([first, second], 'tea')
      for (let n = 0; n < 1200 && probe.active; n++) probe.advance(1 / 30)
      assert.equal(probe.active, false, 'The probe must always terminate')
      assert.equal(probe.journal.length, probe.stage === 'completed' ? 1 : 0)
      pairs.push({ pair: [first, second], accepted, stage: probe.stage, reason: probe.reason, ticks: probe.controller.world.ticks })
    }
    await writeFile(join(qa, 'pair-probe.json'), JSON.stringify(pairs, null, 2))
    const pairProbe = { total: pairs.length, completed: pairs.filter(p => p.stage === 'completed').length, blocked: pairs.filter(p => p.reason === 'blocked').length }
    const { source: desktop } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
    const pnpm = join(desktop, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
    const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
    let executablePath
    for (const relative of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
      const candidate = join(cache, folder, relative); if (await stat(candidate).catch(() => false)) { executablePath = candidate; break }
    }
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    const errors = [], external = [], checks = []
    await context.route('**/*', route => {
      if (route.request().url().startsWith(url + '/') || route.request().url().startsWith('blob:')) return route.continue()
      external.push(route.request().url()); return route.abort()
    })
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
    await page.goto(url)
    await page.waitForFunction(() => window.__contentStudy?.().frameReady, { timeout: 30000 })
    await page.waitForFunction(() => window.__contentStudy().ticks > 3)
    assert.equal((await page.evaluate(() => window.__contentStudy())).actors, 7)
    const originalFrame = page.frames().find(f => f !== page.mainFrame())
    await page.locator('#chat-draft').fill('保留这段聊天草稿 / Keep this draft')
    await page.locator('#pause').click()
    const paused = (await page.evaluate(() => window.__contentStudy())).ticks
    await page.waitForTimeout(250)
    assert.equal((await page.evaluate(() => window.__contentStudy())).ticks, paused)
    checks.push('user pause freezes simulation')
    await page.locator('#village').screenshot({ path: join(qa, 'expanded-light.png') })
    await page.locator('#mode').click()
    assert.equal((await page.locator('#village').boundingBox()).width, 340)
    await page.locator('#village').screenshot({ path: join(qa, 'compact-light.png') })
    await page.locator('#theme').click(); await page.locator('#language').click()
    await page.locator('#mode').click()
    await page.locator('#village').screenshot({ path: join(qa, 'expanded-dark-en.png') })
    assert.equal(page.frames().find(f => f !== page.mainFrame()), originalFrame)
    assert.equal(await page.locator('#chat-draft').inputValue(), '保留这段聊天草稿 / Keep this draft')
    checks.push('compact/expanded preserve iframe, world and chat draft; light/dark and Chinese/English')
    await page.locator('#theme').click(); await page.locator('#language').click()
    await page.locator('[data-page=wishes]').click()
    await page.locator('[data-action=invite]').click()
    assert.equal((await page.evaluate(() => window.__contentStudy())).stage, 'approaching')
    await page.locator('#pause').click()
    await page.waitForFunction(() => window.__contentStudy().stage === 'talking', { timeout: 10000 })
    await page.locator('#pause').click()
    await page.locator('#village').screenshot({ path: join(qa, 'tea-two-seats.png') })
    await page.locator('#pause').click()
    await page.waitForFunction(() => window.__contentStudy().stage === 'completed', { timeout: 12000 })
    assert.equal((await page.evaluate(() => window.__contentStudy())).journal, 1)
    checks.push('two residents walk to distinct seats, converse, unlock one journal and chime')
    await page.locator('[data-page=decor]').click()
    for (const slot of ['window', 'door', 'wall']) {
      await page.locator(`[data-slot=${slot}]`).click()
      assert.equal((await page.evaluate(() => window.__contentStudy())).placed, null)
      assert.equal((await page.evaluate(() => window.__contentStudy())).draft, slot)
    }
    await page.keyboard.press('Escape')
    assert.equal((await page.evaluate(() => window.__contentStudy())).draft, null)
    await page.locator('[data-slot=window]').click(); await page.locator('[data-action=confirm]').click()
    assert.equal((await page.evaluate(() => window.__contentStudy())).placed, 'window')
    await page.locator('#village').screenshot({ path: join(qa, 'wind-chime.png') })
    await page.locator('[data-page=journal]').click()
    await page.locator('#village').screenshot({ path: join(qa, 'journal.png') })
    checks.push('three slot drafts; Escape discards; confirmation updates memory and shows reaction')
    // Narrow viewport and DPR 2 use the same complete contain transform.
    await page.setViewportSize({ width: 800, height: 760 })
    assert.ok((await page.locator('#village').boundingBox()).width <= 752)
    await page.locator('#village').screenshot({ path: join(qa, 'expanded-800.png') })
    const metrics = await originalFrame.evaluate(() => window.__sceneMetrics())
    assert.equal(metrics.tickerStarted, false)
    await page.reload(); await page.waitForFunction(() => window.__contentStudy?.().frameReady)
    assert.equal((await page.evaluate(() => window.__contentStudy())).journal, 0)
    assert.equal((await page.evaluate(() => window.__contentStudy())).placed, null)
    assert.deepEqual(external, []); assert.deepEqual(errors, [])
    checks.push('reload intentionally resets sample; no outbound requests or browser errors')
    const hidpi = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    const high = await hidpi.newPage(); await high.goto(url)
    await high.waitForFunction(() => window.__contentStudy?.().frameReady)
    await high.locator('#mode').click(); await high.locator('#village').screenshot({ path: join(qa, 'compact-dpr2.png') })
    await hidpi.close()
    await writeFile(join(qa, 'validation.json'), JSON.stringify({ checks, errors, external, metrics, pairProbe, limitations: ['memory only', 'layout harness, not Desktop acceptance', 'provisional art', 'software WebGL timing, not GPU benchmark', 'crowded pair navigation is not yet release-ready'] }, null, 2))
    console.log(JSON.stringify({ checks, metrics, pairProbe, qa }, null, 2))
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
}

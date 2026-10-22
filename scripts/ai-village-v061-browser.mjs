import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/ai-village-phase4'), qa = join(root, '.build/ai-village-v0.6.1-qa/browser')
await mkdir(qa, { recursive: true })
const { runPreview } = await import('./ai-village-phase4-browser.mjs')
await runPreview({ root, pkg: join(root, 'packages/ai-village'), out, buildOnly: true })
const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href), plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
const h = await harness({ profile: await mkdtemp(join(qa, 'profile-')), plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
const browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), args: ['--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await context.newPage(), errors = [], external = [], checks = []
page.on('pageerror', e => errors.push(e.message))
await context.route('**/*', route => {
  if (route.request().url().startsWith(h.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
  external.push(route.request().url()); return route.abort()
})
const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
const ready = () => page.waitForFunction(() => window.__villageHostFixture.inspect().frameReady)
const click = name => page.getByRole('button', { name, exact: true }).click()
const frame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))
try {
  await page.goto(h.entry); await click('打开 AI 小院'); await ready(); await click('暂停'); await page.evaluate(() => window.__villageHostFixture.flush())
  await page.getByRole('tab', { name: '布置', exact: true }).click(); await click('编辑我的小院'); await click('阅读角落 · 模板')
  const original = (await inspect()).world, draft = (await inspect()).homeDraft, identity = (await inspect()).profileId
  const cdp = await context.newCDPSession(page), resourceSamples = []
  const resources = async cycle => {
    await cdp.send('HeapProfiler.collectGarbage')
    resourceSamples.push({ cycle, ...(await cdp.send('Memory.getDOMCounters')), frames: await page.locator('.village-canvas iframe').count(),
      textures: await frame().evaluate(() => window.__sceneMetrics().textures) })
  }
  await resources(0)
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => window.__villageHostFixture.sidebar(true))
    await page.locator('.village-card').waitFor({ state: 'detached' })
    assert.deepEqual((await inspect()).homeDraft, draft)
    await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await ready()
    assert.deepEqual((await inspect()).homeDraft, draft); assert.deepEqual((await inspect()).world, original)
    assert.equal(await page.locator('.village-canvas iframe').count(), 1)
    if ([9, 24, 49].includes(i)) await resources(i + 1)
  }
  const firstResources = resourceSamples[0], lastResources = resourceSamples.at(-1)
  assert.ok(lastResources.documents <= firstResources.documents + 1)
  assert.ok(lastResources.jsEventListeners <= firstResources.jsEventListeners + 32)
  assert.ok(lastResources.nodes <= firstResources.nodes + 50)
  assert.ok(resourceSamples.every(s => s.frames === 1 && s.textures === 32))
  checks.push('50 real sidebar unmount/remount cycles preserve draft and committed world')
  const stableFrame = frame()
  for (let i = 0; i < 50; i++) {
    await click('展开小院')
    const card = await page.locator('.village-card').boundingBox(), input = await page.locator('[data-composer-card]').boundingBox()
    assert.ok(card.y + card.height <= input.y || card.y >= input.y + input.height)
    assert.ok(card.x >= 200 && card.x + card.width <= 1440)
    await click('收起小院')
    assert.equal(frame(), stableFrame); assert.equal(await page.locator('.village-canvas iframe').count(), 1)
  }
  assert.equal((await inspect()).profileId, identity); assert.deepEqual((await inspect()).world, original)
  checks.push('50 compact/expanded cycles keep the same frame/profile and never cover the composer or navigation')
  for (const button of await page.locator('.village-header button').all()) {
    const box = await button.boundingBox(); assert.ok(box.width >= 40 && box.height >= 40)
  }
  assert.ok(await page.locator('.village-header svg').count() >= 5)
  assert.equal(await frame().evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }))), true)
  assert.deepEqual((await inspect()).homeDraft, draft)
  await frame().evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  await page.waitForFunction(() => !window.__villageHostFixture.inspect().homeDraft)
  assert.equal(await page.getByRole('button', { name: '编辑我的小院', exact: true }).evaluate(e => document.activeElement === e), true)
  checks.push('synthetic IME Escape preserved; ordinary frame Escape cancels once and returns focus')
  await click('编辑我的小院'); await click('阅读角落 · 模板'); await page.getByRole('tab', { name: '居民', exact: true }).click()
  assert.equal((await inspect()).homeDraft, null); assert.deepEqual((await inspect()).world, original)
  checks.push('explicit tab navigation cancels its draft without saving')
  await page.locator('.village-members summary').click(); await click('全员入住'); await page.locator('.village-members summary').click()
  await ready(); await frame().waitForFunction(() => window.__sceneMetrics().actors === 7); await click('继续')
  await page.waitForTimeout(22000)
  const metrics = await frame().evaluate(() => window.__sceneMetrics())
  assert.equal(metrics.textures, 128); assert.ok(metrics.paintSampleCount > 300 && metrics.paintSampleCount <= 600)
  assert.ok(metrics.p95PaintMs >= metrics.p50PaintMs)
  await click('暂停'); await page.evaluate(() => window.__villageHostFixture.flush())
  await page.locator('.village-card').screenshot({ path: join(qa, 'seven-residents.png') })
  await click('展开小院'); await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(250)
  await page.locator('.village-card').screenshot({ path: join(qa, 'narrow-expanded.png') })
  await page.setViewportSize({ width: 800, height: 440 })
  await page.waitForFunction(() => window.__villageHostFixture.inspect().reasons.includes('insufficient-space'))
  await page.getByText('当前空间不足，已暂停。切换展开／收起或调整窗口后继续；聊天输入区保持可用。', { exact: true }).waitFor()
  const small = await page.locator('.village-card').boundingBox(), composer = await page.locator('[data-composer-card]').boundingBox()
  assert.ok(small.y + small.height <= composer.y || small.y >= composer.y + composer.height)
  await page.locator('.village-card').screenshot({ path: join(qa, 'limited-space.png') })
  await page.setViewportSize({ width: 1440, height: 960 }); await ready(); await click('收起小院')
  checks.push('small expanded viewport pauses visibly, retains controls and leaves the chat composer usable')
  // A real HTTP failure must produce a recoverable local error, never a remote fallback.
  await page.reload(); await page.route('**/api/nidofy-ai-village/assets/**', route => route.fulfill({ status: 404, body: 'missing test asset' }))
  await click('打开 AI 小院'); await page.waitForFunction(() => !!window.__villageHostFixture.inspect().error)
  assert.equal((await inspect()).frameReady, false)
  await page.getByRole('alert').waitFor(); await page.locator('.village-card').screenshot({ path: join(qa, 'missing-resource.png') })
  await page.unroute('**/api/nidofy-ai-village/assets/**'); await page.reload(); await click('打开 AI 小院'); await ready()
  checks.push('missing resource fails visibly offline; intact resources restore without data reset')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  await writeFile(join(qa, 'validation.json'), JSON.stringify({ passed: true, checks, metrics, resourceSamples, errors, external,
    limitations: 'Synthetic composition events do not verify the physical Windows IME candidate window. Browser software-rendering timings are not native GPU completion.' }, null, 2))
  console.log(JSON.stringify({ passed: true, checks, p50: metrics.p50PaintMs, p95: metrics.p95PaintMs }))
  await cdp.detach()
} finally { await page.evaluate(() => window.__villageHostFixture?.dispose()).catch(() => {}); await browser.close(); await h.close() }

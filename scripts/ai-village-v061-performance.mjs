import { villageUI } from './ai-village-ui-v1-navigation.mjs'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/ai-village-phase4'), qa = join(root, '.build/ai-village-v0.6.1-qa/performance')
await mkdir(qa, { recursive: true })
const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href), plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
const browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), args: ['--enable-unsafe-swiftshader'] })
const results = [], errors = []
try {
  for (const scenario of ['closed-baseline', 'single', 'seven', 'seven-tea', 'seven-expanded', 'edited-seven', 'hidden-seven']) {
    const h = await harness({ profile: await mkdtemp(join(qa, 'profile-')), plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...(scenario === 'seven-tea' ? { recordVideo: { dir: join(qa, 'video'), size: { width: 960, height: 640 } } } : {}) })
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
    const {click,tab,settled}=villageUI(page);const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
    const ready = () => page.waitForFunction(() => window.__villageHostFixture.inspect().frameReady)
    try {
      await page.goto(h.entry)
      if (scenario !== 'closed-baseline') {
        await click('打开 AI 小院'); await ready(); await click('暂停')
        if (scenario === 'edited-seven') {
          await page.getByRole('tab', { name: '布置', exact: true }).click(); await click('编辑我的小院'); await click('阅读角落 · 模板')
          await page.getByLabel('环境主题', { exact: true }).selectOption('twilight'); await page.getByLabel('居民配饰', { exact: true }).selectOption('ribbon')
          await click('确认我的布置'); await page.waitForFunction(() => !window.__villageHostFixture.inspect().homeDraft)
        }
        if (scenario !== 'single') { await click('全员入住');await settled();await click('安排入住');await tab('居民'); await ready() }
        if (scenario === 'seven-tea') { await click('邀请同桌'); await page.waitForFunction(() => !!window.__villageHostFixture.inspect().world.activeEvent) }
        if (scenario === 'seven-expanded') await click('展开小院')
        await click('继续')
        if (scenario === 'hidden-seven') await click('关闭小院')
      }
      const session = await context.newCDPSession(page); await session.send('Performance.enable')
      const frame = page.frames().find(f => f.parentFrame() === page.mainFrame())
      await page.waitForTimeout(2000)
      const before = frame ? await frame.evaluate(() => window.__sceneMetrics()) : null
      const first = (await session.send('Performance.getMetrics')).metrics, start = Date.now(), beforeWorld = (await inspect()).world
      const parent = await page.evaluate(() => new Promise(resolve => {
        let count = 0, handle; const tick = () => { count++; handle = requestAnimationFrame(tick) }; handle = requestAnimationFrame(tick)
        setTimeout(() => { cancelAnimationFrame(handle); resolve(count) }, 20000)
      }))
      const seconds = (Date.now() - start) / 1000, after = frame ? await frame.evaluate(() => window.__sceneMetrics()) : null, last = (await session.send('Performance.getMetrics')).metrics
      const metric = (list, name) => list.find(m => m.name === name)?.value ?? null
      const row = { scenario, seconds, fps: after ? (after.frames - before.frames) / seconds : 0, parentRafFps: parent / seconds,
        p50PaintMs: after?.p50PaintMs ?? null, p95PaintMs: after?.p95PaintMs ?? null, maxPaintMs: after?.maxPaintMs ?? null,
        paintSampleCount: after?.paintSampleCount ?? 0, textures: after?.textures ?? 0,
        parentTaskPercentOfOneCore: 100 * (metric(last, 'TaskDuration') - metric(first, 'TaskDuration')) / seconds,
        parentHeapUsedBytes: metric(last, 'JSHeapUsedSize'), parentHeapTotalBytes: metric(last, 'JSHeapTotalSize'),
        parentNodes: metric(last, 'Nodes'), parentListeners: metric(last, 'JSEventListeners') }
      if (after) {
        assert.ok(row.fps >= 20 && row.fps <= 35, JSON.stringify(row)); assert.ok(row.paintSampleCount <= 600)
        assert.equal(row.textures, scenario === 'single' ? 32 : 128)
      } else { assert.equal(await page.locator('.village-canvas iframe').count(), 0); assert.deepEqual((await inspect()).world, beforeWorld) }
      await page.screenshot({ path: join(qa, scenario + '.png') }); results.push(row); console.log(JSON.stringify(row))
      await session.detach()
    } finally { await page.evaluate(() => window.__villageHostFixture?.dispose()).catch(() => {}); await context.close(); await h.close() }
  }
  assert.deepEqual(errors, [])
  await writeFile(join(qa, 'validation.json'), JSON.stringify({ passed: true, results, errors,
    textureEstimate: { singleBluewhaleRgbaBytes: 36553564, sevenRgbaBytes: 67084640 },
    limitations: 'Same Chromium/SwiftShader environment and viewport; 20s measurement after warmup. A new within-version workload baseline, not a historical-version regression percentage. JS render submission does not measure GPU completion. CDP TaskDuration and heap cover the parent target, not total native process memory; native process samples are in the separate soak report.' }, null, 2))
} finally { await browser.close() }

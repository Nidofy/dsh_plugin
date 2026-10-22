import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const fresh = process.argv.includes('--fresh'), restored = process.argv.includes('--restored')
const root = resolve(import.meta.dirname, '..'), qa = join(root, fresh ? '.build/ai-village-v0.6.1-qa/fresh-desktop' : '.build/ai-village-v0.6.1-qa/soak')
await mkdir(qa, { recursive: true })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP(fresh ? 'http://127.0.0.1:18761' : 'http://127.0.0.1:18759'), page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('dsh-app:'))
assert.ok(page)
const artifact = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8')).find(p => p.name === '@nidofy/dsh-ai-village')
assert.equal(artifact.version, '0.6.1')
const work = join(root, fresh ? '.build/ai-village-v0.6.1-fresh-desktop' : '.build/ai-village-v0.6-desktop')
const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village')
assert.equal(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).version, artifact.version)
for (const file of ['lib/index.js', 'lib/client.js', 'lib/frame.js']) assert.deepEqual(await readFile(join(installed, file)), await readFile(join(root, 'packages/ai-village', file)))
const click = name => page.getByRole('button', { name, exact: true }).click()
const state = () => page.evaluate(async () => { const r = await fetch('/api/nidofy-ai-village/state'); return r.ok ? r.json() : null })
const until = async fn => { for (let i = 0; i < 300; i++) { if (await fn()) return; await page.waitForTimeout(100) } throw Error('Timed out waiting for Desktop state') }
const frame = () => page.frames().find(f => f.parentFrame() === page.mainFrame())
const open = async () => { await click('Open AI Village'); await until(async () => frame() && await frame().evaluate(() => window.__sceneMetrics?.().frames > 0).catch(() => false)) }
const errors = [], samples = [], cycles = [], processSamples = []
page.on('pageerror', e => errors.push(e.message))
const session = await page.context().newCDPSession(page), system = await browser.newBrowserCDPSession()
await session.send('Performance.enable')
const processSample = async label => {
  const { processInfo } = await system.send('SystemInfo.getProcessInfo')
  const ids = processInfo.map(p => p.id).filter(Number.isSafeInteger)
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`])
  processSamples.push({ label, at: new Date().toISOString(), processes: JSON.parse(stdout), browser: processInfo })
}
const measure = async (label, milliseconds) => {
  const f = frame(), before = f ? await f.evaluate(() => window.__sceneMetrics()) : null
  const perf0 = (await session.send('Performance.getMetrics')).metrics
  const start = Date.now()
  await page.evaluate(ms => new Promise(resolve => {
    let count = 0, handle; const tick = () => { count++; handle = requestAnimationFrame(tick) }; handle = requestAnimationFrame(tick)
    setTimeout(() => { cancelAnimationFrame(handle); window.__qaParentFrames = count; resolve() }, ms)
  }), milliseconds)
  const elapsed = (Date.now() - start) / 1000, after = f ? await f.evaluate(() => window.__sceneMetrics()) : null
  samples.push({ label, elapsed, fps: after ? (after.frames - before.frames) / elapsed : 0, scene: after,
    parentFps: await page.evaluate(() => window.__qaParentFrames) / elapsed,
    performanceBefore: perf0, performanceAfter: (await session.send('Performance.getMetrics')).metrics })
  return after
}
try {
  if (await page.getByRole('button', { name: 'Close courtyard', exact: true }).count()) await click('Close courtyard')
  await page.getByRole('button', { name: 'New session', exact: true }).first().click(); await open()
  if (restored) {
    assert.deepEqual((await state()).saved.world, JSON.parse(await readFile(join(work, 'expected-lifecycle.json'), 'utf8')))
    await writeFile(join(qa, 'restart-validation.json'), JSON.stringify({ passed: true, artifact, exactPausedWorld: true }, null, 2))
    console.log('Fresh-world full process restart preserved the exact saved world'); await browser.close(); process.exit(0)
  }
  if (!(await state()).saved?.world.userPaused) { await click('Pause'); await until(async () => (await state()).saved?.world.userPaused) }
  const saved = (await state()).saved.world; assert.equal(saved.userPaused, true)
  for (let cycle = 0; cycle < 3; cycle++) {
    await click('Close courtyard')
    await click('Plugins'); const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true })
    await toggle.click(); await until(async () => await state() === null)
    assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 0)
    await until(async () => await toggle.getAttribute('aria-checked') === 'false'); await toggle.click()
    await until(async () => (await state())?.saved)
    await page.getByRole('button', { name: 'New session', exact: true }).first().click(); await open()
    assert.deepEqual((await state()).saved.world, saved); assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 1)
  }
  await writeFile(join(qa, 'lifecycle.json'), JSON.stringify({ passed: true, artifact, cycles: 3, worldUnchanged: true, profile: fresh ? 'fresh' : 'upgraded-from-0.5' }, null, 2))
  if (fresh) {
    await writeFile(join(work, 'expected-lifecycle.json'), JSON.stringify(saved))
    console.log('Fresh-world official install and three disable/enable cycles passed'); await browser.close(); process.exit(0)
  }
  await click('Close courtyard'); await processSample('closed-baseline'); await measure('closed-baseline', 10000)
  await open(); await page.locator('.village-members summary').click(); await click('Invite everyone'); await page.locator('.village-members summary').click()
  await until(async () => await frame().evaluate(() => window.__sceneMetrics().actors === 7))
  await click('Resume')
  const editor = page.locator('[contenteditable="true"]').first(), draft = '隔离验收草稿：不发送模型请求 / unsent soak-test draft'
  await editor.fill(draft)
  const started = Date.now(), startedAt = new Date().toISOString()
  // 30 real two-minute cycles. No accelerated simulation clock or paid model work.
  for (let cycle = 0; cycle < 30; cycle++) {
    const begin = Date.now(), before = (await state()).saved.world.ticks
    const metrics = await measure(`visible-${cycle}`, 90000)
    assert.equal(metrics.actors, 7); assert.equal(metrics.textures, 128); assert.ok(metrics.paintSampleCount <= 600)
    // Establish a durable checkpoint through real UI controls. A background-
    // throttled carrier may advance fewer than the 300-tick autosave interval.
    await click('Pause'); await until(async () => (await state()).saved.world.userPaused)
    await click('Resume'); await until(async () => !(await state()).saved.world.userPaused)
    await click('Close courtyard'); await page.waitForTimeout(1500)
    const frozen = (await state()).saved.world
    assert.equal(await page.locator('.village-canvas iframe').count(), 0)
    await measure(`hidden-${cycle}`, Math.max(1000, 120000 - (Date.now() - begin)))
    assert.deepEqual((await state()).saved.world, frozen); assert.ok(frozen.ticks > before)
    assert.equal(await editor.innerText(), draft)
    await processSample(`cycle-${cycle}`)
    cycles.push({ cycle, at: new Date().toISOString(), visibleTicks: frozen.ticks - before, hiddenFrozen: true, memories: frozen.neighborhood.memories.map(m => m.id) })
    await writeFile(join(qa, 'progress.json'), JSON.stringify({ startedAt, elapsedSeconds: (Date.now() - started) / 1000, cycles, samples, processSamples }, null, 2))
    console.log(`Native soak ${cycle + 1}/30; hidden ticks stable, 7 residents / 128 textures, chat draft preserved`)
    await open()
  }
  await click('Pause'); await until(async () => (await state()).saved.world.userPaused)
  const report = { passed: true, artifact, startedAt, endedAt: new Date().toISOString(), elapsedSeconds: (Date.now() - started) / 1000,
    cycles, samples, processSamples, errors, chatDraftPreserved: true, paidRequests: 0,
    limitations: 'One isolated Windows Desktop; background throttling disabled in test carrier. CPU and memory are whole carrier processes, not isolated plugin allocations. JS paint submission is not GPU completion. Main-work coexistence uses an unsent editor draft, no active agent task. Physical DPI, sleep/wake and IME candidates require onsite verification.' }
  assert.ok(report.elapsedSeconds >= 3600); assert.deepEqual(errors, [])
  await writeFile(join(qa, 'validation.json'), JSON.stringify(report, null, 2)); console.log('One-hour real Desktop soak passed')
} catch (e) {
  await writeFile(join(qa, 'failure.json'), JSON.stringify({ error: String(e), cycles, samples, processSamples, errors }, null, 2)); throw e
} finally { await session.detach().catch(() => {}); await system.detach().catch(() => {}); await browser.close().catch(() => {}) }

import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..'), work = join(root, '.build/ai-village-v0.4-desktop'), qa = join(root, '.build/ai-village-v0.4-qa/desktop')
await mkdir(qa, { recursive: true })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18755')
const pages = browser.contexts().flatMap(c => c.pages()), page = pages.find(p => p.url().startsWith('dsh-app:'))
assert.ok(page, 'Dedicated 0.4 Desktop required')
const mode = process.argv[2] ?? 'inspect'
const screenshotIssues = []
const capture = async file => {
  const session = await page.context().newCDPSession(page)
  try {
    const shot = await Promise.race([session.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
      new Promise((_, reject) => setTimeout(() => reject(Error('SCREENSHOT_TIMEOUT')), 8000))])
    await writeFile(join(qa, file), Buffer.from(shot.data, 'base64'))
  } catch (error) {
    screenshotIssues.push({ file, reason: error instanceof Error ? error.message : String(error) })
    console.log(`Screenshot unavailable in this Desktop session: ${file}`)
  } finally { await session.detach() }
}
const artifact = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8')).find(p => p.name === '@nidofy/dsh-ai-village')
assert.equal(artifact.version, '0.4.0')
assert.equal(createHash('sha256').update(await readFile(join(root, 'dist', artifact.file))).digest('hex'), artifact.sha256)
if (mode === 'install') {
  const close = page.getByRole('button', { name: 'Close', exact: true })
  if (await close.isVisible()) await close.click()
  const welcome = pages.find(p => p.url().includes('welcome.html'))
  if (welcome) {
    await welcome.getByRole('button', { name: 'Add API Key', exact: true }).click()
    await welcome.getByRole('button', { name: 'Set up later', exact: true }).click()
  }
  if (await page.getByRole('button', { name: 'Close courtyard', exact: true }).count()) await page.getByRole('button', { name: 'Close courtyard', exact: true }).click()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  const existing = page.getByRole('button', { name: 'View @nidofy/dsh-ai-village', exact: true })
  const profileFile = join(work, 'home/profiles/desktop/package.json')
  const isInstalled = async () => !!JSON.parse(await readFile(profileFile, 'utf8')).dependencies?.['@nidofy/dsh-ai-village']
  if (await isInstalled()) {
    await existing.waitFor()
    await existing.click()
    await page.getByRole('button', { name: 'Uninstall @nidofy/dsh-ai-village', exact: true }).click()
    await page.getByRole('button', { name: 'Uninstall', exact: true }).click()
    for (let i = 0; i < 300 && await isInstalled(); i++) await page.waitForTimeout(100)
    assert.equal(await isInstalled(), false, 'Official uninstall must finish before replacement')
    await existing.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Add plugin', exact: true }).click()
  await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', artifact.file))
  await page.getByRole('button', { name: 'Install', exact: true }).click()
  await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Enable now', exact: true }).click()
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  console.log('Official plugin manager installed and enabled AI Village 0.4.0 in dedicated profile')
}
if (mode === 'inspect' || mode === 'install') {
  console.log((await page.locator('body').innerText()).slice(0, 6000))
  await page.screenshot({ path: join(qa, 'desktop-' + mode + '.png') })
  process.exit(0)
}
const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village')
assert.equal(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).version, '0.4.0')
for (const file of ['lib/index.js', 'lib/client.js', 'lib/frame.js', 'README.md', 'assets/scenes/courtyard/scene.json'])
  assert.deepEqual(await readFile(join(installed, file)), await readFile(join(root, 'packages/ai-village', file)), 'Stale installed ' + file)
const errors = []; page.on('pageerror', error => errors.push(error.message))
const state = () => page.evaluate(async () => { const r = await fetch('/api/nidofy-ai-village/state'); return r.ok ? r.json() : null })
const until = async (fn, message, seconds = 15) => {
  for (let i = 0; i < seconds * 10; i++) { const value = await fn(); if (value) return value; await page.waitForTimeout(100) }
  throw Error(message)
}
const world = async () => (await state())?.saved?.world
if (await page.getByRole('button', { name: 'Close courtyard', exact: true }).count()) await page.getByRole('button', { name: 'Close courtyard', exact: true }).click()
await page.getByRole('button', { name: 'New session', exact: true }).first().click()
await page.getByRole('button', { name: 'Open AI Village', exact: true }).click()
await page.locator('.village-canvas iframe').waitFor()
const frame = await (await page.locator('.village-canvas iframe').elementHandle()).contentFrame()
await frame.waitForFunction(() => window.__sceneMetrics?.().frames > 0)
if (mode === 'restored') {
  const expected = JSON.parse(await readFile(join(work, 'expected-v04-world.json'), 'utf8'))
  assert.deepEqual(await world(), expected)
  await page.getByRole('tab', { name: 'Journal', exact: true }).click()
  await page.getByRole('heading', { name: 'Today, we shared a table' }).waitFor()
  await capture('desktop-cold-restored.png')
  await writeFile(join(qa, 'restart-validation.json'), JSON.stringify({ passed: true, artifact, exactWorld: true, schema: 4, journal: expected.journal.length, bell: expected.decorations.windChime, screenshotIssues }, null, 2) + '\n')
  console.log('Actual Desktop process restart restored exact paused schema-4 tea, journal, residents and bell state')
  process.exit(0)
}
assert.ok(['check', 'finish'].includes(mode))
if (mode === 'check') {
if (await page.getByRole('button', { name: 'Expand courtyard', exact: true }).count()) await page.getByRole('button', { name: 'Expand courtyard', exact: true }).click()
if (await page.getByRole('button', { name: 'Resume', exact: true }).count()) await page.getByRole('button', { name: 'Resume', exact: true }).click()
if (await page.getByRole('button', { name: 'Cancel gathering', exact: true }).count()) {
  await page.getByRole('button', { name: 'Cancel gathering', exact: true }).click()
  await until(async () => !(await world())?.activeEvent, 'Previous invitation did not cancel')
}
if (await page.getByRole('button', { name: 'Welcome a friend', exact: true }).count()) await page.getByRole('button', { name: 'Welcome a friend', exact: true }).click()
const priorCount = (await world())?.journal[0]?.count ?? 0
await page.getByRole('button', { name: 'Invite to the table', exact: true }).click()
await until(async () => (await world())?.activeEvent, 'Invitation was not committed')
// The durable 10-second checkpoint can legitimately skip a five-second talking phase.
await frame.waitForFunction(() => document.body.innerText.includes('A warm cup.'), {}, { timeout: 600000 })
await capture('desktop-tea.png')
await until(async () => (await world())?.journal[0]?.count === priorCount + 1, 'Reward was not committed', 120)
await page.getByRole('tab', { name: 'Decor', exact: true }).click()
await page.getByRole('button', { name: 'Choose a spot', exact: true }).click()
await page.getByRole('button', { name: 'Window', exact: true }).click()
await page.getByRole('button', { name: 'Keep this placement', exact: true }).click()
await until(async () => (await world())?.decorations.windChime?.slot === 'window', 'Decor was not committed')
await page.getByRole('button', { name: 'Pause', exact: true }).click()
}
const saved = await until(async () => { const value = await world(); return value?.userPaused && value }, 'Pause was not saved')
assert.deepEqual(saved.progress.unlocked, ['wind-chime']); assert.equal(saved.journal.length, 1)
await page.getByRole('tab', { name: 'Journal', exact: true }).click()
await page.getByRole('heading', { name: 'Today, we shared a table' }).waitFor()
await capture('desktop-journal.png')
const metrics = await frame.evaluate(() => window.__sceneMetrics())
assert.equal(metrics.textures, 130); assert.equal(metrics.tickerStarted, false)
await writeFile(join(work, 'expected-v04-world.json'), JSON.stringify(saved, null, 2) + '\n')
await writeFile(join(qa, 'validation.json'), JSON.stringify({ passed: true, artifact, metrics, errors, screenshotIssues,
  checks: ['Official plugin-manager local tgz installation', 'Installed bytes match release', 'Visible tea invitation and real arrival', 'Atomic first journal and chime', 'Confirmed placement', 'Paused snapshot ready for process restart'], viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })) }, null, 2) + '\n')
assert.deepEqual(errors, [])
console.log('Installed Desktop 0.4 playthrough passed; paused exact state saved for cold restart')
process.exit(0)

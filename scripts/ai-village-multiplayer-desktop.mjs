/** Behavioral acceptance against the installed official Electron UI and authenticated profile APIs. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18751')
// The isolated profile deliberately has no credentials. Finish the official optional
// onboarding before testing: a hidden workspace target can still accept DOM events.
const welcome = browser.contexts().flatMap(c => c.pages()).find(p => p.url().endsWith('/welcome.html'))
if (welcome) {
  const later = welcome.getByRole('button', { name: 'Set up later', exact: true })
  if (!await later.isVisible()) await welcome.getByRole('button', { name: 'Add API Key', exact: true }).click()
  await later.click()
}
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('dsh-app:'))
assert.ok(page, 'Isolated official Desktop required')
await page.bringToFront()
// Fix the test viewport rather than inheriting a previously saved narrow BrowserView layout.
// Native window resizing remains a separate manual acceptance item.
await page.setViewportSize({ width: 1400, height: 1000 })
const qa = join(root, '.build/ai-village-v0.3-qa/desktop'), work = join(root, '.build/ai-village-phase5')
await mkdir(qa, { recursive: true })
const errors = [], checks = []
const artifacts = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'))
  .filter(p => ['@nidofy/dsh-ai-village', '@nidofy/dsh-source-control', '@nidofy/dsh-live2d'].includes(p.name))
for (const artifact of artifacts) {
  assert.equal(createHash('sha256').update(await readFile(join(root, 'dist', artifact.file))).digest('hex'), artifact.sha256)
  const id = artifact.name.replace('@nidofy/dsh-', '')
  const installed = join(work, 'home/profiles/desktop/node_modules', artifact.name)
  for (const file of ['lib/index.js', 'lib/client.js', 'README.md', ...(id === 'source-control' ? [] : ['lib/frame.js'])]) {
    assert.deepEqual(await readFile(join(installed, file)), await readFile(join(root, 'packages', id, file)), `Stale installed file: ${id}/${file}`)
  }
}
page.on('pageerror', error => errors.push(error.message))
const state = () => page.evaluate(async () => {
  const r = await fetch('/api/nidofy-ai-village/state')
  if (!r.ok) return null
  return await r.json()
})
const until = async (fn, message) => {
  for (let i = 0; i < 100; i++) { const value = await fn(); if (value) return value; await page.waitForTimeout(100) }
  throw Error(message)
}
const world = async () => (await state())?.saved?.world
const open = async () => {
  const launcher = page.getByRole('button', { name: 'Open AI Village', exact: true })
  if (await launcher.getAttribute('aria-pressed') !== 'true') await launcher.click()
  await page.locator('.village-canvas iframe').waitFor()
  const frame = await (await page.locator('.village-canvas iframe').elementHandle()).contentFrame()
  assert.ok(frame)
  await frame.waitForFunction(() => typeof window.__sceneMetrics === 'function' && window.__sceneMetrics().frames > 0)
  return frame
}
const pause = async () => {
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await until(async () => (await world())?.userPaused, 'Pause was not saved')
  return world()
}
const resume = async () => { if (await page.getByRole('button', { name: 'Resume', exact: true }).count()) await page.getByRole('button', { name: 'Resume', exact: true }).click() }
const drag = async target => {
  const frozen = await pause(), position = frozen.actor.position
  await resume()
  const box = await page.locator('.village-canvas iframe').boundingBox()
  assert.ok(box)
  const scale = Math.min(box.width / 360, box.height / 480)
  const screen = p => ({ x: box.x + (box.width - 360 * scale) / 2 + p.x * scale, y: box.y + (box.height - 480 * scale) / 2 + (p.y - 45) * scale })
  const start = screen(position), end = screen(target)
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 15 }); await page.mouse.up()
  await page.waitForTimeout(300)
}
try {
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  if (await page.locator('.vcs-floating').count()) await page.getByRole('button', { name: 'Open Git / Hg tools', exact: true }).click()
  const frame = await open()
  if (process.argv[2] === 'restored') {
    const expected = JSON.parse(await readFile(join(work, 'expected-multiplayer-world.json'), 'utf8'))
    assert.deepEqual(await world(), expected)
    await frame.waitForFunction(() => window.__sceneMetrics().actors === 7)
    assert.equal(await page.getByRole('combobox', { name: 'Choose character' }).inputValue(), expected.actor.id)
    await page.screenshot({ path: join(qa, 'desktop-restarted.png') })
    console.log('Official Desktop process restart restored all seven residents and exact paused activities/positions/phases')
    await writeFile(join(qa, 'restart-validation.json'), JSON.stringify({ passed: true, character: expected.actor.id, behavior: expected.actor.behavior, artifacts }, null, 2) + '\n')
    process.exit(0)
  }
  await pause()
  await page.locator('.village-members summary').click()
  await page.getByRole('button', { name: 'Keep selected only', exact: true }).click()
  await page.locator('.village-members summary').click()
  await until(async () => (await world()).companions.length === 0, 'Residents not removed')
  const pixels = await page.locator('.village-card').evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
  assert.notEqual(pixels.color, pixels.background)
  assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 1)
  for (const id of ['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen']) {
    await pause()
    const previous = await world()
    await page.getByRole('combobox', { name: 'Choose character' }).selectOption(id)
    await until(async () => (await world())?.actor.id === id, 'Selection was not saved')
    assert.deepEqual(await world(), { ...previous, actor: { ...previous.actor, id } })
    for (const [behavior, target] of [['work', { x: 102, y: 283 }], ['eat', { x: 268, y: 283 }], ['rest', { x: 274, y: 411 }]]) {
      await drag(target)
      await until(async () => (await world())?.actor.behavior === behavior, 'Activity was not saved: ' + behavior)
      await pause()
      // Full target capture avoids element-stability RAF waits on an occluded Electron window.
      await page.screenshot({ path: join(qa, `${id}-${behavior}.png`), timeout: 15000 })
    }
  }
  checks.push('Seven installed characters preserve world on selection and perform all 21 desk/dining/rest placements')
  let saved = await pause()
  const metrics = await frame.evaluate(() => window.__sceneMetrics())
  assert.equal(metrics.textures, 130); assert.equal(metrics.tickerStarted, false)
  await page.screenshot({ path: join(qa, 'desktop-courtyard.png') })
  const gitButton = page.getByRole('button', { name: 'Open Git / Hg tools', exact: true })
  const stacked = async () => {
    await page.waitForFunction(() => {
      const git = document.querySelector('.vcs-floating')?.getBoundingClientRect(), game = document.querySelector('.village-card')?.getBoundingClientRect()
      return git && game && Math.abs(game.top - git.bottom - 12) < 2 && Math.abs(game.left - git.left) < 1
    })
    assert.equal(await page.locator('[data-nidofy-ai-village-space],[data-nidofy-vcs-space]').count(), 1)
  }
  await gitButton.click(); await stacked()
  const stackedTop = (await page.locator('.village-card').boundingBox()).y
  await gitButton.click()
  await until(async () => (await page.locator('.village-card').boundingBox()).y < stackedTop, 'Village did not expand')
  await page.getByRole('button', { name: 'Close courtyard', exact: true }).click()
  await gitButton.click(); await open(); await stacked()
  await page.getByRole('button', { name: 'Open right sidebar', exact: true }).click()
  await page.locator('.village-card').waitFor({ state: 'detached' })
  assert.equal(await page.locator('.vcs-floating,[data-nidofy-ai-village-space],[data-nidofy-vcs-space]').count(), 0)
  await page.getByRole('button', { name: 'Collapse right sidebar', exact: true }).click()
  await open(); await stacked(); assert.deepEqual(await world(), saved)
  await page.getByRole('button', { name: 'Open Live2D companion', exact: true }).click()
  await page.locator('.live2d-card').waitFor()
  assert.equal(await page.locator('.village-card,.vcs-floating').count(), 0)
  await open(); assert.equal(await page.locator('.live2d-card').count(), 0)
  assert.deepEqual(await world(), saved)
  checks.push('Git and village coexist in both opening orders with a 12px gap and one width reservation; close restores height; sidebar hides/restores both; Live2D excludes both')
  await page.locator('.village-members summary').click()
  await page.getByRole('button', { name: 'Invite everyone', exact: true }).click()
  await page.locator('.village-members summary').click()
  await until(async () => (await world()).companions.length === 6, 'Seven residents not saved')
  const members = w => [w.actor, ...w.companions]
  const all = await world()
  await page.getByRole('combobox', { name: 'Choose character' }).selectOption('gpt')
  await until(async () => (await world()).actor.id === 'gpt', 'Focus not saved')
  assert.deepEqual(members(await world()).sort((a,b) => a.id.localeCompare(b.id)), members(all).sort((a,b) => a.id.localeCompare(b.id)))
  await resume(); await page.waitForTimeout(800); await pause()
  for (const actor of members(await world())) assert.ok(actor.phase > members(all).find(a => a.id === actor.id).phase)
  for (const [activity, target] of [['work', {x:102,y:283}], ['eat',{x:268,y:283}], ['rest',{x:274,y:411}]]) {
    const w = await pause()
    if (members(w).some(a => a.behavior === activity)) continue
    const front = members(w).filter(a => !['work','eat','rest'].includes(a.behavior)).sort((a,b) => b.position.y - a.position.y || b.id.localeCompare(a.id))[0]
    await page.getByRole('combobox', { name: 'Choose character' }).selectOption(front.id)
    await until(async () => (await world()).actor.id === front.id, 'Focus not saved')
    await drag(target)
    await until(async () => (await world()).actor.behavior === activity, 'Concurrent activity not saved: ' + activity)
  }
  saved = await pause()
  assert.equal(new Set(members(saved).filter(a => ['work','eat','rest'].includes(a.behavior)).map(a => a.behavior)).size, 3)
  const multiFrame = await open()
  await multiFrame.waitForFunction(() => window.__sceneMetrics().actors === 7)
  metrics.actors = 7
  await gitButton.click(); await stacked()
  await page.screenshot({ path: join(qa, 'desktop-seven-residents-stacked.png') })
  await page.locator('.village-members summary').click()
  await page.screenshot({ path: join(qa, 'resident-picker.png'), timeout: 15000 })
  await page.locator('.village-members summary').click()
  await gitButton.click()
  checks.push('Seven installed residents independently animate; focus preserves all actors; three furniture activities coexist and persist')
  const editor = page.locator('[contenteditable="true"]').first()
  await editor.fill('阶段 5 验收草稿 / draft retained')
  await editor.press('Escape')
  assert.equal(await editor.innerText(), '阶段 5 验收草稿 / draft retained')
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  await page.waitForTimeout(250)
  assert.equal(await page.locator('.village-card').count(), 1)
  assert.deepEqual(await world(), saved)
  checks.push('Fresh-session navigation retains courtyard; editor focus/Escape preserves unsent draft')
  await page.reload(); await page.getByRole('button', { name: 'Open AI Village', exact: true }).waitFor()
  await open(); assert.deepEqual(await world(), saved)
  checks.push('Renderer reload restores selected character and exact durable paused world')
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByRole('button', { name: 'Plugins', exact: true }).click()
    const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true })
    await toggle.click()
    await until(async () => (await state()) === null, 'Host route still present after disabling')
    await until(async () => await toggle.getAttribute('aria-checked') === 'false', 'Plugin manager has not acknowledged disable')
    assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 0)
    await toggle.click()
    await until(async () => await toggle.getAttribute('aria-checked') === 'true', 'Plugin manager has not acknowledged enable')
    await until(async () => (await state())?.saved, 'Host did not re-enable')
    await page.getByRole('button', { name: 'New session', exact: true }).first().click()
    await open(); assert.deepEqual(await world(), saved)
    assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 1)
  }
  checks.push('Three official disable/enable cycles withdraw authenticated routes and restore a single instance with unchanged save')
  await writeFile(join(work, 'expected-multiplayer-world.json'), JSON.stringify(saved, null, 2) + '\n')
  assert.deepEqual(errors, [])
  await writeFile(join(qa, 'validation.json'), JSON.stringify({ carrier: 'Official Desktop 0.2.1-rc.2', buildCommit: '332895e0f7c9d4dbfb29729f5eb367fa263ff986',
    isolatedProfile: true, viewport: { width: 1400, height: 1000, emulated: true }, installation: 'Official plugin manager: local tgz in temporary profile',
    artifacts, checks, metrics, theme: pixels, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ checks, metrics, errors }))
} catch (error) { console.error(error); process.exit(1) }
process.exit(0)

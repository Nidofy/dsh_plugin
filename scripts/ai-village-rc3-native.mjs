/** Official rc.3 Desktop QA. Only the dedicated launcher/profile/port are accepted. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..'), work = join(root, '.build/ai-village-rc3-desktop')
const [mode, label] = process.argv.slice(2)
assert.ok(['inspect', 'prepare-legacy', 'prepare-coordination', 'install', 'reinstall', 'upgrade', 'coexistence-install', 'coordination-install', 'coexistence', 'coordination-space', 'coordination-lifecycle', 'coordination-restored', 'resume-restored', 'coordination-uninstall', 'drag', 'smoke', 'menus', 'regions', 'lifecycle', 'restored', 'uninstall'].includes(mode))
assert.match(label ?? '', /^[a-z0-9][a-z0-9-]{0,60}$/)
const evidence = join(work, 'evidence', label), json = async p => JSON.parse(await readFile(p, 'utf8'))
const hash = b => createHash('sha256').update(b).digest('hex')
await mkdir(join(work, 'evidence'), { recursive: true }); await mkdir(evidence)
const checks = [], observations = [], errors = [], requests = [], notCovered = [
  'Physical sleep/minimize and physical IME candidate selection', 'Long-duration foreground hardware performance',
  'Native full tea/story replay: separate authenticated browser gameplay suite covers the complete sequence',
]
let page, browser, protocol, artifact, launch, failure
const record = value => { checks.push(value); console.log('PASS ' + value) }
const bounded = async (promise, message, seconds = 20) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('NATIVE_PROTOCOL_TIMEOUT: ' + message)), seconds * 1000) })]) } finally { clearTimeout(timer) } }
const until = async (fn, message, seconds = 30) => { const deadline = Date.now() + seconds * 1000; while (Date.now() < deadline) { const result = await fn(); if (result) return result; await new Promise(r => setTimeout(r, 100)) } throw Error('TIMEOUT: ' + message) }
const state = () => page.evaluate(async () => { const r = await fetch('/api/nidofy-ai-village/state', { signal: AbortSignal.timeout(10000) }); return r.ok ? r.json() : null })
const world = async () => (await state())?.saved?.world ?? null
const direct = name => page.getByRole('button', { name, exact: true }).click()
const screenshot = async name => { let cdp; try { cdp = await bounded(page.context().newCDPSession(page), 'screenshot session', 5); const r = await bounded(cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }), 'screenshot ' + name, 10); await writeFile(join(evidence, name + '.png'), Buffer.from(r.data, 'base64')); return true } catch (error) { observations.push({ screenshot: name, status: 'NOT_CAPTURED', reason: String(error) }); return false } finally { await bounded(cdp?.detach(), 'screenshot detach', 5).catch(() => {}) } }
const frame = async () => (await page.locator('.village-canvas iframe').elementHandle())?.contentFrame()
const metrics = async () => (await frame())?.evaluate(() => window.__sceneMetrics?.())
const ready = region => until(async () => { const m = await metrics(); return m?.region === region && m.frames > 0 && await page.locator('.village-entry-ui[data-entered="true"]').count() === 1 }, 'actual first frame ' + region, 60)
const closePanel = async () => { const b = page.getByRole('button', { name: 'Close panel', exact: true }); if (await b.isVisible()) await b.click() }
const hud = async name => { const b = page.getByRole('button', { name, exact: true }); if (!await b.isVisible()) await page.locator('.village-card').getByRole('button', { name: 'More', exact: true }).click(); await b.click() }
const pause = async () => { await closePanel(); if (!(await world()).userPaused) { await hud('Pause'); await until(async () => (await world()).userPaused, 'pause committed') } }
const open = async () => {
  await page.getByRole('button', { name: 'Open AI Village', exact: true }).waitFor()
  if (!await page.locator('.village-card').count()) await direct('Open AI Village')
  const compact = page.getByRole('button', { name: 'Compact courtyard', exact: true })
  if (await compact.isVisible()) await compact.click()
  const enter = page.getByRole('button', { name: 'Open the doors and enter again', exact: true }); if (await enter.isVisible()) await enter.click()
  await ready((await until(world, 'durable world')).region.active)
}
const members = w => [w.actor, ...w.companions]
async function newBlank() {
  const response = page.waitForResponse(r => r.url().includes('/api/session/create') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  const value = (await (await response).json()).result
  assert.equal(value.ok, true); const id = value.value.sessionId
  await page.locator(`[data-conversation-session="${id}"] [data-composer-input][contenteditable="true"]`).waitFor()
  return id
}
async function travel(region) {
  await pause(); const before = await world(); if (before.region.active === region) return
  await direct('Community map'); await page.locator(`.village-map-places [data-place="${region}"]`).click()
  assert.equal(await page.locator('.village-map-travel').isDisabled(), false, 'Production region gate')
  await page.locator('.village-map-travel').click(); await until(async () => (await world()).region.active === region, 'travel commit'); await ready(region); await closePanel()
  const after = await world(); assert.equal(after.ticks, before.ticks); assert.equal(after.rng, before.rng); assert.equal(after.userPaused, true)
  assert.deepEqual(members(after).map(a => a.id).sort(), members(before).map(a => a.id).sort())
  observations.push({ region, metrics: await metrics() }); await screenshot(region)
}
async function identify() {
  const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village'), unpack = join(evidence, 'unpacked')
  await mkdir(unpack); await tar.x({ file: join(root, 'dist', artifact.file), cwd: unpack })
  const manifest = await json(join(installed, 'package.json')); assert.equal(manifest.version, artifact.version); assert.equal(manifest.engines.dsh, '0.2.1-rc.3')
  let count = 0
  for (const entry of await readdir(join(unpack, 'package'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const name = relative(join(unpack, 'package'), join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    if (!name.startsWith('lib/') && !name.startsWith('assets/')) continue
    assert.equal(hash(await readFile(join(installed, name))), hash(await readFile(join(unpack, 'package', name))), 'Installed bytes: ' + name); count++
  }
  record('Official manager installed exact package; ' + count + ' lib/assets files byte-match pinned tgz')
}
async function persisted() {
  const dir = join(work, 'home/profiles/desktop/nidofy-ai-village'), pointer = await json(join(dir, 'current.json'))
  const bytes = await readFile(join(dir, 'snapshots', pointer.snapshot)); assert.equal(hash(bytes), pointer.hash)
  return { pointer, saved: JSON.parse(bytes) }
}
async function coordinationPackages(identifyInstalled = false) {
  const path = resolve(process.env.AI_VILLAGE_COORDINATION_MANIFEST ?? '')
  assert.ok(path.startsWith(join(root, '.build') + '\\'), 'QA manifest must be inside repository .build')
  const manifest = await json(path), items = Array.isArray(manifest) ? manifest : manifest.packages
  assert.equal(items.length, 2)
  assert.deepEqual(items.map(i => i.name).sort(), ['@nidofy/dsh-live2d', '@nidofy/dsh-source-control'])
  for (const item of items) {
    assert.equal(item.qaOnly, true); assert.equal(item.dsh, '0.2.1-rc.3'); assert.match(item.sha256, /^[a-f0-9]{64}$/)
    item.file = resolve(root, item.file); assert.ok(item.file.startsWith(join(root, '.build') + '\\'))
    assert.equal(hash(await readFile(item.file)), item.sha256)
    if (identifyInstalled) {
      const dir = join(work, 'home/profiles/desktop/node_modules', item.name), installed = await json(join(dir, 'package.json'))
      assert.equal(installed.version, item.version); assert.equal(installed.engines.dsh, item.dsh)
      const unpack = join(evidence, item.name.split('/')[1]); await mkdir(unpack); await tar.x({ file: item.file, cwd: unpack })
      let count = 0
      for (const entry of await readdir(join(unpack, 'package'), { recursive: true, withFileTypes: true })) if (entry.isFile()) {
        const name = relative(join(unpack, 'package'), join(entry.parentPath, entry.name))
        assert.equal(hash(await readFile(join(dir, name))), hash(await readFile(join(unpack, 'package', name))), item.name + ' installed bytes ' + name); count++
      }
      record(item.name + ' QA-only candidate exact installed bytes: ' + count + ' files')
    }
  }
  observations.push({ coordinationPackages: items, scope: 'QA-only rc.3 rebuilds for floating coexistence; formal rc.2 release packages unchanged' })
  return items
}
async function installPackage(file) {
  await direct('Plugins'); await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(file); await direct('Install')
  await until(async () => {
    if (await page.getByRole('button', { name: 'Enable now', exact: true }).isVisible()) return true
    const message = await page.locator('body').innerText()
    if (/Failed to install|Installation failed|Unsupported engine|does not satisfy/i.test(message)) throw Error('Official manager rejected package: ' + message.slice(-6000))
    return false
  }, 'official installation acknowledgement', 120)
  await direct('Enable now')
}
const launcherIds = ['source-control', 'live2d', 'ai-village']
async function threeLaunchers() {
  for (const id of launcherIds) await until(async () => await page.locator(`[data-conversation-header-corner] [data-nidofy-header-launcher="${id}"]`).count() === 1 && await page.locator(`[data-nidofy-header-launcher="${id}"]`).count() === 1, 'one header launcher ' + id)
  assert.deepEqual(await page.locator('[data-conversation-header-corner] [data-nidofy-header-launcher]').evaluateAll(els => els.map(e => e.getAttribute('data-nidofy-header-launcher'))), launcherIds)
}
async function fixtureSession(file = 'session-fixture.json') {
  const fixture = await json(join(work, file)), row = page.locator(`[data-row-key="session:${fixture.id}"]`)
  if (!await row.isVisible()) await page.getByText('Ungrouped', { exact: true }).click()
  await row.click(); await page.getByText(fixture.message ?? 'Offline rc.3 UI qualification fixture. No model was called.', { exact: true }).waitFor()
}
async function coordination() {
  await coordinationPackages(true)
  const saved = await world(), editor = page.locator('[data-composer-input][contenteditable="true"]'), draft = 'rc.3 三插件共存 / 未发送草稿'
  await editor.fill(draft); await editor.press('Escape'); await threeLaunchers()
  await fixtureSession(); await threeLaunchers(); await ready(saved.region.active)
  await direct('More conversation views'); await screenshot('three-launchers-conversation-more'); await page.keyboard.press('Escape')
  await newBlank(); await until(async () => await editor.innerText() === draft, 'same blank draft after existing session'); await threeLaunchers()
  record('Three ordered single launchers survive existing/new session remount beside official conversation More; exact Chinese blank draft retained')
  const gitFixture = await json(join(work, 'coordination-session-fixture.json'))
  const created = await page.evaluate(async path => {
    const response = await fetch('/api/workspace/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'workspace/create', payload: { args: { request: { path } } } }) })
    return response.json()
  }, gitFixture.header.cwd)
  assert.equal(created.result.ok, true); observations.push({ temporaryWorkspace: created.result.value })
  await fixtureSession('coordination-session-fixture.json'); await newBlank(); await editor.fill(draft); await editor.press('Escape')
  await fixtureSession('coordination-session-fixture.json'); await ready(saved.region.active)
  const stack = async (selector, name) => {
    await until(async () => {
      const git = await page.locator('.vcs-floating').boundingBox(), companion = await page.locator(selector).boundingBox()
      if (!git || !companion || companion.y < git.y + git.height + 9) return false
      observations.push({ layout: name, git, companion }); return true
    }, name + ' stacking')
  }
  await direct('Open Git / Hg tools'); await page.locator('.vcs-floating').waitFor(); await stack('.village-card', 'git-village')
  await until(async () => await page.locator('.vcs-name').getAttribute('title') === gitFixture.header.cwd, 'Git reads only trusted temporary repository')
  const beforeHeight = (await page.locator('.vcs-floating').boundingBox()).height
  await page.locator('.vcs-floating').getByRole('button', { name: /Changes/ }).click(); await page.locator('.vcs-floating').getByRole('button', { name: 'coordination.txt', exact: true }).click()
  await until(async () => (await page.locator('.vcs-diff').innerText()).includes('+Changed line for real status and diff'), 'real temporary Git diff')
  const afterHeight = (await page.locator('.vcs-floating').boundingBox()).height; assert.ok(afterHeight > beforeHeight); await stack('.village-card', 'expanded-git-village')
  observations.push({ temporaryGitStatusAndDiff: await page.locator('.vcs-floating').innerText(), beforeHeight, afterHeight }); await screenshot('git-village-diff')
  record('Git reads actual status/diff from the registered isolated repository; expanding changes increases Git height and shifts Village downward')
  const liveReady = async () => { await page.locator('.live2d-stage[data-capability="animated"] iframe').waitFor({ timeout: 60000 }); assert.equal(await page.locator('.live2d-stage img').isVisible(), false); observations.push({ live2dCapability: await page.locator('.live2d-stage').getAttribute('data-capability'), fallbackImageVisible: false }) }
  await direct('Open Live2D companion'); await liveReady(); await page.locator('.village-card').waitFor({ state: 'detached' }); await stack('.live2d-card', 'git-live2d'); await screenshot('git-live2d')
  assert.equal(await page.locator('.village-canvas iframe').count(), 0); assert.equal(await page.locator('.vcs-floating').count(), 1)
  await newBlank(); await threeLaunchers(); await liveReady(); assert.equal(await page.locator('.village-card').count(), 0); assert.equal(await editor.innerText(), draft)
  record('Git stacks above either companion; explicit Live2D open releases Village iframe and passive session remount preserves the selected companion')
  await fixtureSession('coordination-session-fixture.json'); await direct('Open right sidebar'); await page.locator('.live2d-card').waitFor({ state: 'detached' }); await page.locator('.vcs-floating').waitFor({ state: 'detached' })
  assert.equal(await page.locator('.live2d-card iframe,.village-canvas iframe').count(), 0); assert.deepEqual(await world(), saved)
  await direct('Collapse right sidebar'); await liveReady(); await stack('.live2d-card', 'restored-git-live2d')
  await direct('Open AI Village'); await ready(saved.region.active); await page.locator('.live2d-card').waitFor({ state: 'detached' }); await stack('.village-card', 'restored-git-village')
  await direct('Open right sidebar'); await page.locator('.village-card').waitFor({ state: 'detached' }); await page.locator('.vcs-floating').waitFor({ state: 'detached' })
  assert.equal(await page.locator('.live2d-card iframe,.village-canvas iframe').count(), 0); await new Promise(r => setTimeout(r, 800)); assert.deepEqual(await world(), saved)
  await direct('Collapse right sidebar'); await ready(saved.region.active); await stack('.village-card', 'sidebar-restored-git-village'); await screenshot('sidebar-restored-git-village')
  record('Official Sidebar releases both floating cards and companion iframe, then restores Git with the previously selected companion; explicit Village open yields Live2D')
  await direct('Open Git / Hg tools'); await page.locator('.vcs-floating').waitFor({ state: 'detached' }); await ready(saved.region.active)
  await direct('Open Git / Hg tools'); await stack('.village-card', 'git-reopened'); assert.equal(await page.locator('.village-card').count(), 1)
  await newBlank(); await threeLaunchers(); assert.equal(await editor.innerText(), draft); assert.deepEqual(await world(), saved)
  record('Git close/reopen leaves Village active; no duplicate entry/owner, no clock/RNG/membership/world change, unsent draft intact')
}
async function coordinationLifecycle(uninstall = false) {
  const items = await coordinationPackages(true), saved = await world(), editor = page.locator('[data-composer-input][contenteditable="true"]'), draft = 'rc.3 启停撤销 / 未发送草稿'
  await editor.fill(draft); await editor.press('Escape'); await threeLaunchers()
  for (const item of [...items, ...(uninstall ? [] : [{ name: '@nidofy/dsh-ai-village' }])]) {
    const id = item.name.replace('@nidofy/dsh-', ''), overlay = id === 'source-control' ? 'vcs' : id
    await fixtureSession('coordination-session-fixture.json')
    if (id === 'source-control' && !await page.locator('.vcs-floating').count()) { await direct('Open Git / Hg tools'); await page.locator('.vcs-floating').waitFor() }
    if (id === 'live2d') { await direct('Open Live2D companion'); await page.locator('.live2d-stage[data-capability="animated"]').waitFor({ timeout: 60000 }) }
    if (id === 'ai-village') await open()
    await direct('Plugins')
    if (uninstall) {
      await direct('View ' + item.name); await direct('Uninstall ' + item.name); await direct('Uninstall')
      await until(async () => !(await json(join(work, 'home/profiles/desktop/package.json'))).dependencies?.[item.name], 'official dependency removed ' + id, 60)
    } else {
      const toggle = page.getByLabel('Enable ' + item.name, { exact: true }); assert.equal(await toggle.getAttribute('aria-checked'), 'true'); await toggle.click()
      await until(async () => await toggle.getAttribute('aria-checked') === 'false' && await toggle.isEnabled(), 'official disable settled ' + id, 60)
    }
    await newBlank()
    await until(async () => await page.locator(`[data-nidofy-header-launcher="${id}"]`).count() === 0 && await page.locator(`[data-nidofy-${overlay}-overlay]`).count() === 0, 'client revoked on actual conversation ' + id)
    assert.equal(await editor.innerText(), draft)
    if (id === 'ai-village') await until(async () => await state() === null, 'Village host revoked')
    assert.deepEqual((await persisted()).saved.world, saved)
    if (!uninstall) {
      await direct('Plugins')
      const toggle = page.getByLabel('Enable ' + item.name, { exact: true }); await toggle.click(); await until(async () => await toggle.getAttribute('aria-checked') === 'true' && await toggle.isEnabled(), 'official enable settled ' + id, 60)
      await newBlank(); await open(); await threeLaunchers(); assert.equal(await editor.innerText(), draft); assert.deepEqual(await world(), saved)
    }
    record('Official ' + (uninstall ? 'uninstall' : 'disable/enable') + ' revokes ' + item.name + ' resources and retains world/draft')
  }
  await screenshot(uninstall ? 'coordination-uninstalled' : 'coordination-lifecycle')
}
async function coordinationSpace() {
  await coordinationPackages(true)
  if (await page.locator('.vcs-floating').count()) await direct('Open Git / Hg tools')
  const saved = await world(), editor = page.locator('[data-composer-input][contenteditable="true"]'), draft = 'rc.3 空间回收 / 未发送草稿'
  await editor.fill(draft); await editor.press('Escape'); await fixtureSession('coordination-session-fixture.json'); await open()
  await direct('Open Git / Hg tools'); await page.locator('.vcs-name').waitFor(); await ready(saved.region.active)
  assert.equal(await page.locator('.vcs-name').getAttribute('title'), join(work, 'coordination-repo'))
  observations.push({ collapsed: { git: await page.locator('.vcs-floating').boundingBox(), village: await page.locator('.village-card').boundingBox(), metrics: await metrics() } }); await screenshot('collapsed-git-village-rendered')
  await page.locator('.vcs-floating').getByRole('button', { name: /Changes/ }).click(); await page.locator('.vcs-floating').getByRole('button', { name: 'coordination.txt', exact: true }).click()
  await until(async () => (await page.locator('.vcs-diff').innerText()).includes('+Changed line for real status and diff'), 'actual diff')
  await page.getByText('Paused for limited space. Resize or expand the courtyard. The chat composer remains available.', { exact: true }).waitFor()
  assert.equal(await page.locator('.village-canvas iframe').count(), 0); assert.deepEqual(await world(), saved)
  observations.push({ expanded: { git: await page.locator('.vcs-floating').boundingBox(), village: await page.locator('.village-card').boundingBox(), iframeCount: 0 } }); await screenshot('expanded-git-space-released')
  await page.locator('.vcs-floating').getByRole('button', { name: /Changes/ }).click(); await ready(saved.region.active); assert.deepEqual(await world(), saved)
  observations.push({ restored: { git: await page.locator('.vcs-floating').boundingBox(), village: await page.locator('.village-card').boundingBox(), metrics: await metrics() } }); await screenshot('collapsed-git-frame-restored')
  await newBlank(); assert.equal(await editor.innerText(), draft); await until(async () => await page.locator('.vcs-name').getAttribute('title') === join(work, 'coordination-repo'), 'Git remains in dedicated repository after new-session remount')
  record('Git Changes expansion causes documented limited-space pause and iframe release; collapsing Changes restores a real Village frame with exact world/draft, and Git stays in temporary root after session remount')
}
async function dragResident() {
  const editor = page.locator('[data-composer-input][contenteditable="true"]'), draft = 'rc.3 七人拖放 / 未发送草稿'
  await editor.fill(draft); await editor.press('Escape'); await fixtureSession(); await open(); await pause(); await travel('courtyard')
  const before = await state(), initial = before.saved.world; assert.equal(members(initial).length, 7)
  const responses = [], pendingResponses = []
  const capture = response => { if (response.url().split('?')[0].endsWith('/api/nidofy-ai-village/save')) pendingResponses.push((async () => {
    // Electron's dsh-app custom protocol does not expose response bodies to CDP.
    // Confirm the observed successful write through the production state readback.
    const attempt = response.request().postDataJSON(), observed = await state(), ack = observed?.saved
    responses.push({ status: response.status(), confirmation: 'official-state-readback-after-HTTP-response', expectedRevision: attempt.expectedRevision, requestedOperationId: attempt.operationId,
      confirmed: ack?.operationId === attempt.operationId && ack?.revision === attempt.expectedRevision + 1,
      revision: ack?.revision, operationId: ack?.operationId, epoch: observed?.epoch, profileId: observed?.profileId, actorId: ack?.world?.actor?.id, actor: ack?.world?.actor?.position })
  })().catch(error => observations.push({ saveReadbackError: String(error) }))) }
  page.on('response', capture)
  const position = async point => { const box = await page.locator('.village-canvas iframe').boundingBox(), m = await metrics(); assert.ok(box); const p = m.viewport.world; return { x: box.x + p.x + point.x * p.scale, y: box.y + p.y + point.y * p.scale } }
  const drag = async (from, feet, name) => {
    const a = await position({ x: from.x, y: from.y - 32 }), b = await position({ x: feet.x, y: feet.y - 32 }), cssDistance = Math.hypot(a.x - b.x, a.y - b.y)
    assert.ok(cssDistance > 20, 'Actual mouse path must decisively exceed the 5 CSS-pixel drag threshold')
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 })
    const gesture = (await metrics()).gesture; assert.equal(gesture?.type, 'actor', 'Production router recognized an actor drag'); assert.equal(gesture?.moved, true, 'Production router crossed the drag threshold')
    observations.push({ drag: { name, from, feet, cssStart: a, cssEnd: b, cssDistance, gesture, viewport: (await metrics()).viewport } }); await screenshot(name + '-held'); await page.mouse.up()
  }
  try {
    await hud('Resume'); await until(async () => !(await world()).userPaused, 'simulation resumed for drag'); await closePanel()
    // Pick the frontmost resident: the seven-resident portrait hitboxes overlap.
    // Using the selected actor's torso can legitimately pick a nearer companion.
    const awaitedWorld = await world(), picked = members(awaitedWorld).sort((a, b) => b.position.y - a.position.y || b.id.localeCompare(a.id))[0]
    const start = picked.position
    const target = [65, 110, 170, 230, 285].map(x => ({ x, y: 425 })).filter(p => Math.hypot(p.x - start.x, p.y - start.y) > 50 && members(awaitedWorld).every(a => a.id === picked.id || Math.hypot(a.position.x - p.x, a.position.y - p.y) > 30)).sort((a, b) => Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(a.x - start.x, a.y - start.y))[0]
    assert.ok(target, 'A distant, free courtyard ground target'); observations.push({ pickedResident: picked.id, target, tolerance: 6, toleranceReason: 'Live resident can move between durable-state sample and pointerdown; exact gesture and displacement are asserted separately' })
    await drag(start, target, 'legal-drag')
    // Host state is the last durable snapshot; a running resident can move a few
    // world pixels before pointerdown fixes its grab offset. Keep exact receipts.
    await until(async () => { const w = await world(); return Math.hypot(w.actor.position.x - target.x, w.actor.position.y - target.y) < 6 }, 'legal actual mouse drop committed', 12)
    await pause(); const accepted = await state(); assert.equal(accepted.saved.world.manualMove, null); assert.ok(accepted.saved.revision > before.saved.revision); assert.equal(accepted.profileId, before.profileId); assert.equal(accepted.epoch, before.epoch)
    assert.equal(accepted.saved.world.actor.id, picked.id); const displacement = Math.hypot(accepted.saved.world.actor.position.x - start.x, accepted.saved.world.actor.position.y - start.y); assert.ok(displacement > 20, 'Successful drop must actually move the resident'); observations.push({ actualDisplacement: displacement })
    await screenshot('legal-seven-resident-drop')
    record('Real pointer down/move/up moves the selected resident to legal courtyard ground and commits a newer CAS revision in the same profile/epoch')
    await hud('Resume'); await until(async () => !(await world()).userPaused, 'resume for rejected drop'); await closePanel()
    const original = (await world()).actor.position
    await drag(original, { x: 10, y: 90 }, 'unsafe-drag'); await pause(); const rejected = await state()
    assert.equal(rejected.saved.world.actor.id, picked.id)
    assert.ok(Math.hypot(rejected.saved.world.actor.position.x - original.x, rejected.saved.world.actor.position.y - original.y) < 6, 'Unsafe landing returns to original position within live sample tolerance')
    assert.deepEqual(members(rejected.saved.world).map(a => a.id).sort(), members(initial).map(a => a.id).sort()); assert.equal(rejected.saved.world.worldId, initial.worldId)
    for (const key of ['journal', 'progress', 'decorations', 'bookhouse', 'teaSquare']) assert.deepEqual(rejected.saved.world[key], initial[key], 'Preserved memory/content ' + key)
    assert.deepEqual((await persisted()).saved, rejected.saved); assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 1)
    await Promise.all(pendingResponses)
    assert.equal(responses.filter(r => r.status !== 200).length, 0); assert.ok(responses.some(r => r.confirmed && r.actor && Math.hypot(r.actor.x - target.x, r.actor.y - target.y) < 6), 'Successful save HTTP acknowledgement and exact CAS state readback for target')
    observations.push({ before: before.saved, accepted: accepted.saved, rejected: rejected.saved, saveAcknowledgements: responses, durable: (await persisted()).pointer, frame: await metrics() })
    await screenshot('unsafe-drop-rejected'); await newBlank(); await until(async () => await editor.innerText() === draft, 'drag did not alter blank draft')
    record('Unsafe real drag is rejected at the original feet; seven members, world ID, memories/keepsakes, one owner and Chinese draft retained; durable hash and save acknowledgements verified')
  } finally { observations.push({ saveAcknowledgements: responses }); page.off('response', capture); if (!(await world())?.userPaused) await pause() }
}
try {
  if (mode === 'prepare-coordination') {
    const path = join(work, 'coordination-repo'), fixtureFile = join(work, 'coordination-session-fixture.json')
    await assert.rejects(readFile(fixtureFile), e => e.code === 'ENOENT'); await mkdir(path)
    const git = args => execFileSync('git', args, { cwd: path, encoding: 'utf8', windowsHide: true })
    git(['init']); await writeFile(join(path, 'coordination.txt'), 'Original offline QA line\n'); git(['add', 'coordination.txt']); git(['-c', 'user.name=DSH isolated QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'Isolated coexistence fixture'])
    await writeFile(join(path, 'coordination.txt'), 'Original offline QA line\nChanged line for real status and diff\n'); await writeFile(join(path, 'untracked-qa.txt'), 'Untracked offline QA file\n')
    const require = createRequire(join(root, '.build/official-runtime-rc3/package.json')), module = id => import(pathToFileURL(require.resolve(id)).href)
    const { Context } = await module('@deepseek-ai/cordis'), { Session, SessionId, SESSION_FORMAT_VERSION } = await module('@deepseek-ai/dsh-session'), { createUserMessage, createSystemMessage } = await module('@deepseek-ai/dsh-llm'), persistence = await module('@deepseek-ai/dsh-session-persistence-jsonl')
    const ctx = new Context()
    try {
      await ctx.plugin(persistence, { root: join(work, 'home/sessions') })
      const id = SessionId('session-' + randomUUID()), header = { version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), cwd: path, isSeeded: false, delegationDepth: 0, agentPreset: 'standard' }, message = 'Offline rc.3 three-plugin QA in a temporary Git repository. No model was called.'
      const session = Session.create(id, [], header); session.append('turn/start', { turn: 1 }); session.append('step/start', { turn: 1, step: 1 }); session.append('system/message', { turn: 1, step: 1, message: createSystemMessage('') }, { surfaceOp: 'append' })
      const user = session.append('user/message', createUserMessage({ content: [{ type: 'text', text: message }], source: { kind: 'user' } }), { surfaceOp: 'append' })
      session.append('session/title', { title: 'rc.3 temporary Git coexistence fixture', messageSeqs: [user.seq], source: { kind: 'fallback' } }); session.append('step/end', { turn: 1, step: 1 }); session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      const handle = await ctx.sessionPersistence.create(header); await handle.append(session.snapshotEvents()); await handle.close()
      await writeFile(fixtureFile, JSON.stringify({ id, header, message, modelCalls: 0, gitStatus: git(['status', '--short']), writer: '@deepseek-ai/dsh-session-persistence-jsonl@0.2.1-rc.3' }, null, 2), { flag: 'wx' })
      observations.push(await json(fixtureFile)); record('Created isolated local Git changes and a closed no-model session fixture through official Session/JSONL APIs; no user repository touched')
    } finally { await ctx.fiber.dispose() }
  } else if (mode === 'prepare-legacy') {
    const old = join(root, '.build/ai-village-tea-qa-desktop-approved-pre3/home/profiles/desktop/nidofy-ai-village')
    const target = join(work, 'home/profiles/desktop/nidofy-ai-village')
    assert.equal(await stat(target).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e }), false, 'Never overwrite a test world')
    const oldPointer = await json(join(old, 'current.json')), oldBytes = await readFile(join(old, 'snapshots', oldPointer.snapshot)), saved = JSON.parse(oldBytes)
    assert.equal(hash(oldBytes), oldPointer.hash); assert.equal(saved.world.schemaVersion, 14); assert.equal(saved.world.userPaused, true)
    const files = {}
    for (const e of await readdir(old, { recursive: true, withFileTypes: true })) if (e.isFile() && !e.name.endsWith('.lock')) {
      const name = relative(old, join(e.parentPath, e.name)); files[name] = hash(await readFile(join(old, name)))
    }
    await cp(old, target, { recursive: true, errorOnExist: true, force: false, filter: source => !source.endsWith('.lock') })
    for (const [name, sha] of Object.entries(files)) { assert.equal(hash(await readFile(join(old, name))), sha); assert.equal(hash(await readFile(join(target, name))), sha) }
    await writeFile(join(work, 'legacy-checkpoint.json'), JSON.stringify({ source: old, sourceDsh: '0.2.1-rc.2', sourcePlugin: '0.13.0-preview.3', files, saved }, null, 2))
    record('Copied only paused prior isolated QA game data; original bytes unchanged, no sessions/accounts/profile configuration copied')
  } else {
    launch = await json(join(work, 'launch.json')); assert.equal(launch.port, 18783); assert.equal(launch.version, '0.2.1-rc.3'); assert.equal(launch.windowStyle, 'Hidden')
    assert.equal(launch.dshHome.replaceAll('\\', '/'), join(work, 'home').replaceAll('\\', '/'))
    assert.equal(launch.asarSha256, '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0')
    const identity = JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(launch.pid)}' | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }))
    const expectedCarrier = await json(join(work, 'carrier-location.json')).then(v => v.carrier, e => { if (e.code === 'ENOENT') return join(work, 'carrier/DeepSeek Harness.exe'); throw e })
    assert.equal(identity.ExecutablePath.toLowerCase(), expectedCarrier.toLowerCase()); assert.equal(launch.carrier.toLowerCase(), expectedCarrier.toLowerCase())
    assert.ok(identity.CommandLine.includes('--user-data-dir=' + join(work, 'electron-data').replaceAll('\\', '/')))
    if (mode !== 'inspect') {
      const version = process.env.AI_VILLAGE_EXPECTED_VERSION, sha256 = process.env.AI_VILLAGE_EXPECTED_SHA
      assert.match(version ?? '', /^0\.13\.\d+(?:-[a-z0-9.]+)?$/); assert.match(sha256 ?? '', /^[a-f0-9]{64}$/)
      artifact = { version, sha256, file: `nidofy-dsh-ai-village-${version}.tgz` }; assert.equal(hash(await readFile(join(root, 'dist', artifact.file))), sha256)
    }
    const { source } = await json(join(root, '.local/environment.json')), store = join(source, 'node_modules/.pnpm'), name = (await readdir(store)).find(n => n.startsWith('playwright@1.61.'))
    const { chromium } = await import(pathToFileURL(join(store, name, 'node_modules/playwright/index.mjs')).href)
    browser = await chromium.connectOverCDP('http://127.0.0.1:18783', { timeout: 15000 }); protocol = await browser.newBrowserCDPSession()
    const pages = browser.contexts().flatMap(c => c.pages()); page = pages.find(p => p.url().startsWith('dsh-app:')); assert.ok(page, 'Isolated official main page'); page.setDefaultTimeout(20000)
    if (mode !== 'inspect') {
      const welcome = pages.find(p => p.url().includes('welcome.html'))
      if (welcome) { const add = welcome.getByRole('button', { name: 'Add API Key', exact: true }); if (await add.isVisible()) await add.click(); await welcome.getByRole('button', { name: 'Set up later', exact: true }).click() }
      const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click()
    }
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('/api/nidofy-ai-village/')) requests.push({ path: r.url().split('/api/nidofy-ai-village/')[1].split('?')[0], method: r.method() }) })
    observations.push({ browser: await protocol.send('Browser.getVersion'), display: await page.evaluate(() => ({ visibility: document.visibilityState, dpr: devicePixelRatio, width: innerWidth, height: innerHeight })) })
    if (mode === 'inspect') {
      for (const p of pages) observations.push({ url: p.url().split('?')[0], buttons: await p.getByRole('button').allTextContents(), text: (await p.locator('body').innerText()).slice(0, 12000) })
      await screenshot('inspection'); record('Read-only inspected dedicated rc.3 Desktop')
    } else if (mode === 'install' || mode === 'upgrade' || mode === 'reinstall') {
      const upgradingWorld = mode === 'upgrade' ? await world() : null
      const retained = mode === 'reinstall' ? await persisted() : null
      const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click()
      await direct('Plugins'); await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', artifact.file)); await direct('Install')
      if (mode === 'install' || mode === 'reinstall') { await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 120000 }); await direct('Enable now') }
      else { await until(async () => (await json(join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village/package.json'))).version === artifact.version, 'official package replacement', 120); const enable = page.getByRole('button', { name: 'Enable now', exact: true }); if (await enable.isVisible()) await enable.click() }
      await identify(); await screenshot('installed')
      const legacy = await json(join(work, 'legacy-checkpoint.json')).catch(e => { if (e.code === 'ENOENT') return null; throw e })
      if (legacy && mode === 'install') { await until(async () => (await state())?.saved, 'host loads old world'); assert.deepEqual((await state()).saved, legacy.saved); record('First rc.3 Host read exactly preserves rc.2 paused world, revision and operation identity') }
      if (retained) { await until(async () => (await state())?.saved, 'Host loads retained world'); assert.deepEqual((await state()).saved, retained.saved); assert.deepEqual(await persisted(), retained); observations.push({ retained }); record('Official reinstall preserves exact latest world, revision, operation ID and snapshot hash') }
      if (mode === 'upgrade') { assert.deepEqual(await world(), upgradingWorld); await writeFile(join(work, 'native-checkpoint.json'), JSON.stringify({ pid: launch.pid, artifact, world: upgradingWorld }, null, 2)); record('Official in-place candidate upgrade retained exact world; distinct process restart required next') }
    } else if (mode === 'coordination-install') {
      const retained = await persisted(), items = await coordinationPackages()
      for (const item of items) {
        const current = await json(join(work, 'home/profiles/desktop/node_modules', item.name, 'package.json')).catch(e => { if (e.code === 'ENOENT') return null; throw e })
        if (current) { assert.equal(current.version, item.version); record('Already installed exact candidate version, no duplicate installation: ' + item.name) }
        else { await installPackage(item.file); await screenshot('installed-' + item.name.split('/')[1]); record('Official manager accepted QA-only rc.3 ' + item.name) }
      }
      await coordinationPackages(true); assert.deepEqual(await persisted(), retained); record('Installing coordination candidates retained exact AI Village save')
    } else if (mode === 'coexistence-install') {
      const inventory = await json(join(root, 'dist/manifest.json'))
      for (const id of ['source-control', 'live2d']) {
        const item = inventory.find(p => p.name === '@nidofy/dsh-' + id); assert.ok(item); assert.equal(item.dsh, '0.2.1-rc.2'); assert.equal(hash(await readFile(join(root, 'dist', item.file))), item.sha256)
        await direct('Plugins'); await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', item.file)); await direct('Install')
        await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 120000 }); await direct('Enable now')
        const installed = await json(join(work, 'home/profiles/desktop/node_modules', item.name, 'package.json')); assert.equal(installed.version, item.version); assert.equal(installed.engines.dsh, '0.2.1-rc.2')
        observations.push({ item, purpose: 'Floating coordination only; does not declare this plugin rc.3 compatible' }); record('Official manager accepted unchanged rc.2 ' + id + ' solely for coordination QA')
      }
    } else {
      await identify()
      if (mode === 'uninstall') {
        const saved = await state(); await direct('Plugins'); await direct('View @nidofy/dsh-ai-village'); await direct('Uninstall @nidofy/dsh-ai-village'); await direct('Uninstall')
        await until(async () => (await state()) === null, 'Host withdrawn after uninstall', 60)
        assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 0); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 0)
        const dir = join(work, 'home/profiles/desktop/nidofy-ai-village'), ptr = await json(join(dir, 'current.json'))
        assert.deepEqual(await json(join(dir, 'snapshots', ptr.snapshot)), saved.saved); record('Official uninstall withdraws Client/Host, retains exact saved world')
        if (process.env.AI_VILLAGE_VERIFY_ALL_UNINSTALLED === '1') {
          const routes = await page.evaluate(async () => { const result = []; for (const path of ['/api/nidofy-vcs/status', '/api/nidofy-live2d/frame', '/api/nidofy-ai-village/state']) result.push({ path, status: (await fetch(path)).status }); return result })
          for (const r of routes) assert.equal(r.status, 404, 'Removed Host route: ' + r.path)
          for (const id of launcherIds) assert.equal(await page.locator(`[data-nidofy-header-launcher="${id}"]`).count(), 0)
          assert.equal(await page.locator('[data-nidofy-vcs-overlay],[data-nidofy-live2d-overlay],[data-nidofy-ai-village-overlay]').count(), 0)
          observations.push({ finalRemovedRoutes: routes, retained: await persisted() }); record('All three uninstalled Host routes return 404 and all launcher/overlay registrations are gone; exact world retained')
        }
      } else {
        if (!(await state())?.saved) {
          await direct('Plugins'); const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true })
          if (await toggle.getAttribute('aria-checked') === 'false') await toggle.click()
          await until(async () => await toggle.getAttribute('aria-checked') === 'true' && await toggle.isEnabled() && (await state())?.saved, 'explicit enabled baseline', 60)
        }
        if (mode === 'regions') {
          const fixture = await json(join(work, 'session-fixture.json')), row = page.locator(`[data-row-key="session:${fixture.id}"]`)
          if (!await row.isVisible()) await page.getByText('Ungrouped', { exact: true }).click()
          await row.click(); await page.getByText('Offline rc.3 UI qualification fixture. No model was called.', { exact: true }).waitFor()
        }
        await newBlank(); await open(); await pause()
        if (mode === 'coexistence') {
          await coordination()
        } else if (mode === 'coordination-lifecycle' || mode === 'coordination-uninstall') {
          await coordinationLifecycle(mode === 'coordination-uninstall')
        } else if (mode === 'coordination-space') {
          await coordinationSpace()
        } else if (mode === 'coordination-restored' || mode === 'resume-restored') {
          if (mode === 'coordination-restored') { await coordinationPackages(true); await threeLaunchers() }
          else assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 1)
          const path = resolve(process.env.AI_VILLAGE_RECOVERY_EVIDENCE ?? ''); assert.ok(path.startsWith(join(work, 'evidence') + '\\'))
          const checkpoint = await json(path); assert.equal(checkpoint.status, 'PASS'); assert.equal(checkpoint.mode, 'drag'); assert.equal(checkpoint.artifact.sha256, artifact.sha256); assert.notEqual(checkpoint.launch.pid, launch.pid)
          const expected = checkpoint.observations.find(o => o.rejected)?.rejected; assert.ok(expected); assert.deepEqual((await state()).saved, expected); assert.deepEqual((await persisted()).saved, expected)
          observations.push({ recoveryFrom: relative(root, path), previousPid: checkpoint.launch.pid, currentPid: launch.pid, persisted: await persisted(), frame: await metrics() }); await screenshot('restored-after-drag-and-coordination')
          record('Distinct official Desktop process preserves the exact post-drag saved world, revision, operation ID, memories and seven residents; real frame and expected unique launchers restored')
        } else if (mode === 'drag') {
          await dragResident()
        } else if (mode === 'restored') {
          const expected = await json(join(work, 'native-checkpoint.json')); assert.notEqual(expected.pid, launch.pid); assert.equal(expected.artifact.sha256, artifact.sha256); assert.deepEqual(await world(), expected.world)
          await screenshot('cold-restored'); record('Distinct official Desktop process restored exact paused seven-resident world and region')
        } else {
          const legacy = await json(join(work, 'legacy-checkpoint.json')).catch(e => { if (e.code === 'ENOENT') return null; throw e })
          if (legacy && mode === 'smoke') { assert.deepEqual(await world(), legacy.saved.world); record('Opening actual rc.3 Client preserves prior rc.2 world including tea memory/keepsake') }
          const saved = await world(); assert.equal(saved.schemaVersion, 14); assert.equal(saved.region.version, 2); assert.equal(members(saved).length, 7)
          const editor = page.locator('[data-composer-input][contenteditable="true"]'); await editor.fill('rc.3 中文草稿 / unsent draft'); await editor.press('Escape'); assert.equal(await editor.innerText(), 'rc.3 中文草稿 / unsent draft')
          observations.push({ beforeInteractionDraft: await editor.innerText(), session: await editor.evaluate(el => el.closest('[data-conversation-session]')?.getAttribute('data-conversation-session')) })
          if (['smoke', 'menus'].includes(mode)) {
          const corner = page.locator('[data-conversation-header-corner]'); assert.equal(await corner.locator('[data-nidofy-header-launcher="ai-village"]').count(), 1)
          const launchBox = await page.locator('[data-nidofy-village-launcher]').boundingBox(); assert.ok(launchBox && launchBox.width > 0)
          const fixture = await json(join(work, 'session-fixture.json'))
          const fixtureRow = page.locator(`[data-row-key="session:${fixture.id}"]`)
          if (!await fixtureRow.isVisible()) await page.getByText('Ungrouped', { exact: true }).click()
          await fixtureRow.click(); await page.getByText('Offline rc.3 UI qualification fixture. No model was called.', { exact: true }).waitFor()
          const more = page.getByRole('button', { name: 'More conversation views', exact: true })
          await more.click(); await screenshot('conversation-more'); assert.equal(await page.locator('[data-nidofy-village-launcher]').count(), 1); await page.keyboard.press('Escape')
          await newBlank(); await until(async () => await editor.innerText() === 'rc.3 中文草稿 / unsent draft', 'blank draft restored after persisted session')
          assert.deepEqual(await world(), saved); record('Actual nonblank rc.3 conversation More coexists with one launcher; New session restores exact prior Chinese draft after the offline fixture session')
          const menus = page.getByRole('button', { name: 'More', exact: true }); observations.push({ officialMoreCount: await menus.count() })
          await menus.filter({ hasText: 'More' }).first().click(); await page.getByRole('menuitem', { name: 'Create your plugin', exact: true }).waitFor(); await screenshot('sidebar-more')
          await page.keyboard.press('Escape')
          assert.equal(await editor.innerText(), 'rc.3 中文草稿 / unsent draft'); assert.deepEqual(await world(), saved); assert.equal(await page.locator('[data-nidofy-village-launcher]').count(), 1); record('Official left More exposes plugin actions and preserves composer draft/world')
          await direct('Open right sidebar'); await page.locator('.village-card').waitFor({ state: 'detached' }); assert.equal(await page.locator('.village-canvas iframe').count(), 0); await new Promise(r => setTimeout(r, 1000)); assert.deepEqual(await world(), saved)
          const tools = page.getByRole('button', { name: 'More tools', exact: true }); if (await tools.isVisible()) { await tools.click(); await screenshot('right-more'); await page.keyboard.press('Escape') }
          await direct('Collapse right sidebar'); await ready(saved.region.active); assert.deepEqual(await world(), saved); record('Official Sidebar hides/releases game iframe and restores same paused world')
          }
          if (['smoke', 'regions'].includes(mode)) {
          const fixture = await json(join(work, 'session-fixture.json')), fixtureRow = page.locator(`[data-row-key="session:${fixture.id}"]`)
          if (!await fixtureRow.isVisible()) await page.getByText('Ungrouped', { exact: true }).click()
          await fixtureRow.click(); await ready(saved.region.active)
          await hud('Expand courtyard'); const bounds = await page.locator('.village-card').boundingBox(), composer = await page.locator('[data-composer-card]').boundingBox(); assert.ok(bounds && composer); assert.ok(bounds.y + bounds.height <= composer.y + 1 || bounds.y >= composer.y + composer.height - 1 || bounds.x + bounds.width <= composer.x || bounds.x >= composer.x + composer.width, 'Expanded game must not cover composer'); await screenshot('expanded-composer'); await hud('Compact courtyard')
          await hud('Expand courtyard'); await ready(saved.region.active); await page.getByRole('button', { name: 'Compact courtyard', exact: true }).focus()
          await page.locator('.village-card').dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true })
          assert.equal(await page.locator('.village-card').getAttribute('data-expanded'), 'true')
          await page.getByRole('button', { name: 'Compact courtyard', exact: true }).press('Escape'); await until(async () => await page.locator('.village-card').getAttribute('data-expanded') === 'false', 'Escape compacts stable running game')
          await hud('Close courtyard'); await page.locator('.village-card').waitFor({ state: 'detached' }); assert.equal(await page.locator('[data-nidofy-village-launcher]').evaluate(el => document.activeElement === el), true)
          record('Expanded card avoids composer; composing Escape is ignored, ordinary Escape compacts, and close returns focus to launcher')
          await newBlank(); await until(async () => await editor.innerText() === 'rc.3 中文草稿 / unsent draft', 'draft returns after actual blank session selection'); await open(); record('Expanded card avoids composer; composing Escape ignored, normal Escape compacts, close returns focus to launcher and retains Chinese draft')
          for (const region of ['courtyard', 'bookhouse', 'courtyard', 'tea-square', 'courtyard']) await travel(region)
          record('Seven residents travel through all three approved scenes via public map; paused clock/RNG and membership retained')
          assert.equal(await editor.innerText(), 'rc.3 中文草稿 / unsent draft')
          }
          if (['smoke', 'lifecycle'].includes(mode)) {
          const stable = await world()
          for (let i = 0; i < 3; i++) {
            await direct('Plugins'); const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true }); assert.equal(await toggle.getAttribute('aria-checked'), 'true'); await toggle.click(); await until(async () => await toggle.getAttribute('aria-checked') === 'false' && await toggle.isEnabled() && (await state()) === null, 'official disable settled', 60)
            assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 0); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 0)
            await toggle.click(); await until(async () => await toggle.getAttribute('aria-checked') === 'true' && await toggle.isEnabled() && (await state())?.saved, 'official enable settled', 60); await newBlank(); await open()
            assert.equal(await page.locator('[data-nidofy-ai-village-overlay]').count(), 1); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 1); assert.deepEqual(await world(), stable)
            assert.equal(await editor.innerText(), 'rc.3 中文草稿 / unsent draft')
          }
          record('Three official disable/enable cycles withdraw routes/DOM, retain draft/world and restore one owner/launcher')
          await writeFile(join(work, 'native-checkpoint.json'), JSON.stringify({ pid: launch.pid, artifact, world: stable }, null, 2)); await screenshot('checkpoint')
          }
        }
      }
    }
    assert.deepEqual(errors, [])
  }
} catch (error) { failure = String(error.stack ?? error); if (page) await screenshot('failed').catch(() => {}) }
finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', mode, artifact, launch, checks, observations, errors, requests, notCovered, failure, runnerSha256: hash(await readFile(new URL(import.meta.url))) }, null, 2) + '\n')
  await protocol?.detach().catch(() => {}); console.log(JSON.stringify({ status: failure ? 'FAIL' : 'PASS', evidence, checks, failure })); process.exit(failure ? 1 : 0)
}

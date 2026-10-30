/** World15 browser qualification: production UI/actions, authenticated Host, isolated legacy-copy profile. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'

const root = resolve(import.meta.dirname, '..'), [label, scale = '1'] = process.argv.slice(2), dpr = Number(scale)
const option = key => process.argv.find(value => value.startsWith('--' + key + '='))?.slice(key.length + 3)
const mode = option('mode') ?? 'b1'
assert.match(label ?? '', /^[a-z0-9][a-z0-9-]{0,80}$/); assert.ok([1, 2].includes(dpr)); assert.ok(['b1', 'all', 'migration'].includes(mode))
const out = join(root, '.build/ai-village-afternoon', label), qa = join(root, 'docs/ai-village/afternoon/browser', label)
await mkdir(join(root, '.build/ai-village-afternoon'), { recursive: true }); await mkdir(out)
await mkdir(join(root, 'docs/ai-village/afternoon/browser'), { recursive: true }); await mkdir(qa)
const pkg = join(out, 'packages/ai-village'), profile = join(out, 'profile'), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await readFile(file, 'utf8')), checks = [], observations = [], samples = [], writes = [], errors = [], external = []
const build = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), dpr, mode, source: {}, bundles: {} }
const fault = { story: null, count: null, operationId: null, blockState: false }
let page, browser, context, host, failure, legacy
const log = message => { checks.push(message); console.log('PASS ' + message) }
const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
const direct = name => page.getByRole('button', { name, exact: true }).click()
const until = async (fn, message, seconds = 30) => { const stop = Date.now() + seconds * 1000; while (Date.now() < stop) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 100)) } throw Error('TIMEOUT: ' + message) }
const settled = () => until(async () => { const s = await inspect(); if (s.error) throw Error(s.error); return s.ready && !s.preferencesSaving && !s.reasons.includes('commit-pending') && !['pending', 'unknown'].includes(s.saveReceipt.status) }, 'confirmed runtime state')
const entered = () => until(async () => { const s = await inspect(); if (s.error) throw Error(s.error); return s.frameReady && !s.entrance.blocking }, 'actual first frame', 60)
const close = async () => { const b = page.getByRole('button', { name: '关闭面板', exact: true }); if (await b.isVisible()) await b.click() }
const tab = async name => { await close(); await page.getByRole('tab', { name, exact: true }).click() }
const pause = async value => { await close(); if ((await inspect()).world.userPaused !== value) { await villageUI(page).click(value ? '暂停' : '继续'); await settled() } }
const members = world => [world.actor, ...world.companions]
const metrics = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))?.evaluate(() => window.__sceneMetrics())
const shot = async name => { await page.screenshot({ path: join(qa, name + '.png'), animations: 'disabled' }); const s = await inspect(); observations.push({ name, world: s.world, revision: s.revision, receipt: s.saveReceipt, reasons: s.reasons, diagnostics: s.diagnostics, metrics: await metrics() }) }
const storyPanel = () => page.locator('.village-afternoon')
const title = { 'tea-bookmark': '茶香书签', 'reflection-shapes': '倒影寻形' }
const casts = { 'tea-bookmark': ['bluewhale', 'claude'], 'reflection-shapes': ['gemini', 'grok'] }
const memory = (w, id) => w.afternoon.memories.find(m => m.storyId === id)
async function sourceHashes(path) {
  const result = {}
  for (const entry of await readdir(path, { recursive: true, withFileTypes: true })) if (entry.isFile()) {
    const name = relative(path, join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    if (!name.endsWith('.lock')) result[name] = hash(await readFile(join(path, name)))
  }
  return result
}
async function freeze() {
  await mkdir(join(out, 'packages'), { recursive: true }); await mkdir(profile)
  for (const id of ['ai-village', 'source-control', 'live2d']) {
    const source = join(root, 'packages', id), destination = join(out, 'packages', id)
    await mkdir(destination)
    const before = await sourceHashes(join(source, 'src'))
    await cp(join(source, 'src'), join(destination, 'src'), { recursive: true })
    assert.deepEqual(await sourceHashes(join(destination, 'src')), before); assert.deepEqual(await sourceHashes(join(source, 'src')), before, 'Source changed while freezing ' + id)
    build.source[id] = before
  }
  for (const name of ['lib', 'assets', 'experiments']) await cp(join(root, 'packages/ai-village', name), join(pkg, name), { recursive: true })
  await cp(join(root, 'packages/ai-village/package.json'), join(pkg, 'package.json'))
  const manifest = await json(join(pkg, 'package.json')); build.version = manifest.version
  assert.match(manifest.version, /^0\.14\./); assert.equal(manifest.engines.dsh, '0.2.1-rc.3')
  build.identity = await json(join(pkg, 'lib/build-identity.json')); assert.equal(build.identity.version, manifest.version)
  for (const [name, sha] of Object.entries(build.identity.source)) assert.equal(hash(await readFile(join(pkg, name))), sha, 'Production build source identity ' + name)
  for (const name of ['index.js', 'client.js', 'frame.js']) build.bundles[name] = hash(await readFile(join(pkg, 'lib', name)))
  const artifactPath = option('artifact')
  if (artifactPath) {
    const file = resolve(root, artifactPath), bytes = await readFile(file); build.artifact = { file: relative(root, file), bytes: bytes.length, sha256: hash(bytes) }
    if (process.env.AI_VILLAGE_EXPECTED_SHA) assert.equal(build.artifact.sha256, process.env.AI_VILLAGE_EXPECTED_SHA)
    const unpack = join(out, 'unpacked'); await mkdir(unpack); await tar.x({ file, cwd: unpack })
    const packed = join(unpack, 'package'); assert.equal((await json(join(packed, 'package.json'))).version, build.version)
    for (const directory of ['lib', 'assets']) assert.deepEqual(await sourceHashes(join(packed, directory)), await sourceHashes(join(pkg, directory)), 'Packed production bytes ' + directory)
  }
  const old = join(root, '.build/ai-village-rc3-desktop/home/profiles/desktop/nidofy-ai-village')
  const files = await sourceHashes(old), pointer = await json(join(old, 'current.json')), bytes = await readFile(join(old, 'snapshots', pointer.snapshot)), saved = JSON.parse(bytes)
  assert.equal(hash(bytes), pointer.hash); assert.equal(saved.world.schemaVersion, 14); assert.equal(saved.world.userPaused, true)
  await cp(old, join(profile, 'nidofy-ai-village'), { recursive: true, force: false, errorOnExist: true, filter: path => !path.endsWith('.lock') })
  legacy = { source: old, files, pointer, saved }; observations.push({ legacy: { pointer, source: old, filesChecked: Object.keys(files).length } })
  await cp(join(pkg, 'lib'), join(out, 'lib'), { recursive: true }); await cp(join(pkg, 'assets'), join(out, 'assets'), { recursive: true })
  await runPreview({ root, pkg, out, buildOnly: true })
  const runner = await readFile(new URL(import.meta.url)); build.runnerSha256 = hash(runner); await writeFile(join(qa, 'runner.mjs'), runner)
}
async function travel(id) {
  if ((await inspect()).world.region.active === id) return
  await pause(true); await direct('社区地图'); await page.locator(`.village-map-places [data-place="${id}"]`).click()
  const before = await inspect(); assert.equal(await page.locator('.village-map-travel').isEnabled(), true)
  await page.locator('.village-map-travel').click(); await settled(); await entered(); await close()
  const after = await inspect(); assert.equal(after.world.region.active, id); assert.equal(after.revision, before.revision + 1)
  assert.equal(after.world.ticks, before.world.ticks); assert.equal(after.world.rng, before.world.rng); assert.deepEqual(members(after.world).map(a => a.id).sort(), members(before.world).map(a => a.id).sort())
  await sceneResources(id)
}
const inventories = new Map()
async function sceneResources(id) {
  const s = await inspect(), m = await metrics(); assert.equal(m.region, id); assert.ok(m.frames > 0)
  assert.equal(m.textures, s.resourceKeys.length); assert.ok(s.resourceKeys.every(k => !k.startsWith('map/')))
  for (const other of ['bookhouse', 'tea-square'].filter(k => k !== id)) assert.ok(s.resourceKeys.every(k => !k.startsWith(other + '/')))
  if (id !== 'courtyard') assert.ok(!s.resourceKeys.includes('scene/background.png'))
  const current = { keys: [...s.resourceKeys].sort(), textures: m.textures, sources: m.textureSources, rgba: m.decodedRGBABytes, urls: m.urls }
  if (inventories.has(id)) assert.deepEqual(current, inventories.get(id), 'Roundtrip resource owner grew: ' + id)
  else inventories.set(id, current)
  observations.push({ sceneResources: id, ...current })
}
async function cold(name) {
  await pause(true); await page.evaluate(() => window.__villageHostFixture.flush()); await settled(); const saved = await inspect()
  await page.evaluate(() => window.__villageHostFixture.dispose()); await page.reload(); await direct('打开 AI 小院'); await entered()
  assert.deepEqual((await inspect()).world, saved.world); assert.equal((await inspect()).revision, saved.revision); await shot(name)
}
function sample(s) {
  const w = s.world, feet = members(w).map(a => ({ id: a.id, ...a.position, behavior: a.behavior, intent: a.intent?.furnitureId ?? null }))
  for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) assert.ok(Math.hypot(feet[i].x - feet[j].x, feet[i].y - feet[j].y) >= 23.99, 'Resident feet overlap')
  samples.push({ tick: w.ticks, region: w.region.active, story: w.afternoon.active, community: w.community, life: w.life, feet })
}
async function waitStage(stage) {
  return until(async () => {
    const s = await inspect(), e = s.world.afternoon.active; sample(s); assert.ok(e, 'Afternoon event ended before expected stage')
    if (e.stage !== stage || e.phase !== 'ready') return false
    for (let i = 0; i < e.participants.length; i++) { const actor = members(s.world).find(a => a.id === e.participants[i]); assert.ok(Math.hypot(actor.position.x - e.targets[i].x, actor.position.y - e.targets[i].y) < .1, 'Ready requires real arrival') }
    return e
  }, 'Real afternoon stage ' + stage, 70)
}
async function act(name) {
  const before = (await inspect()).world.afternoon.active; assert.ok(before)
  const button = storyPanel().getByRole('button', { name, exact: true }); await until(() => button.isEnabled(), 'React action becomes enabled: ' + name, 8); await button.click(); await settled()
  const after = (await inspect()).world.afternoon.active
  if (after) { assert.equal(after.id, before.id); assert.equal(after.serial, before.serial + 1) }
  return after
}
async function start(id) {
  await pause(false); await tab('居民'); const w = (await inspect()).world
  await storyPanel().getByRole('button', { name: `${memory(w, id) ? '重玩' : '开始'}：${title[id]}`, exact: true }).click(); await settled()
  const e = (await inspect()).world.afternoon.active; assert.equal(e.storyId, id); assert.deepEqual(e.participants, casts[id]); assert.equal(e.phase, 'approaching')
  return e
}
async function cancel(id) {
  await start(id); const before = (await inspect()).world.afternoon
  await direct('取消小插曲'); await settled(); const after = (await inspect()).world.afternoon
  assert.equal(after.active, null); assert.deepEqual(after.memories, before.memories); assert.deepEqual(after.keepsakes, before.keepsakes); assert.deepEqual(after.lastEventIds, before.lastEventIds)
  log(id + ': real approach cancelled without memory or award')
}
async function story(id, { replay = false, unknown = false } = {}) {
  const first = structuredClone(memory((await inspect()).world, id) ?? null), placement = (await inspect()).world.afternoon.keepsakes[id]
  await start(id); await waitStage(0); observations.push({ storyDialogue: id, text: await storyPanel().innerText() }); await shot(id + (replay ? '-replay-ready' : '-first-ready'))
  if (id === 'tea-bookmark') {
    await act('听完纸签里的话'); assert.equal(await storyPanel().getByRole('button', { name: '轻轻压平书签', exact: true }).isDisabled(), true)
    await act(replay ? '折一道波纹' : '折一枚叶子'); const chosen = (await inspect()).world.afternoon.active
    assert.equal(chosen.selection, replay ? 'wave' : 'leaf')
    if (!replay) { await cold('bookmark-partial-cold'); assert.deepEqual((await inspect()).world.afternoon.active, chosen); await pause(false); await tab('居民') }
    await act('轻轻压平书签')
  } else {
    await act(replay ? '从右边观察' : '从左边观察'); const before = (await inspect()).world.afternoon.active
    await act('试试原样重合'); const wrong = (await inspect()).world.afternoon.active
    assert.equal(wrong.stage, 1); assert.equal(wrong.attempts, before.attempts + 1); assert.deepEqual(memory((await inspect()).world, id) ?? null, first)
    assert.match(await storyPanel().innerText(), /还没有重合/); await act('左右镜像重合')
  }
  assert.equal((await inspect()).world.afternoon.active.stage, 2); assert.equal(await storyPanel().getByRole('button', { name: '记住这段小插曲', exact: true }).isDisabled(), true)
  await waitStage(2); await shot(id + (replay ? '-replay-closing' : '-first-closing'))
  if (unknown) {
    fault.story = id; fault.count = (first?.count ?? 0) + 1; await direct('记住这段小插曲')
    await until(async () => (await inspect()).saveReceipt.status === 'unknown', 'lost ACK enters unknown state'); assert.ok(fault.operationId)
    const count = writes.length; await new Promise(r => setTimeout(r, 600)); assert.equal(writes.length, count); assert.equal(writes.filter(w => w.operationId === fault.operationId).length, 1)
    await shot(id + '-unknown-ack'); fault.blockState = false; await direct('点击开门，重新进入'); await entered(); await settled()
    assert.equal(writes.filter(w => w.operationId === fault.operationId).length, 1); log('Committed afternoon ACK loss reconciles by read-only recovery, with exactly one write for the operation')
  } else await act('记住这段小插曲')
  await pause(true); const w = (await inspect()).world, now = memory(w, id); assert.ok(now); assert.equal(w.afternoon.active, null)
  if (replay) { assert.deepEqual({ ...now, count: first.count }, first); assert.equal(now.count, first.count + 1); assert.equal(w.afternoon.keepsakes[id], placement) }
  else { assert.equal(now.count, 1); assert.deepEqual(now.participants, casts[id]); assert.equal(w.afternoon.keepsakes[id], 'message-tree') }
  await shot(id + (replay ? '-replayed' : '-earned')); log(id + (replay ? ': replay preserves first source/choice and stored keepsake placement' : ': real movement, meaningful operation and first traceable memory/keepsake'))
}
async function b1() {
  await travel('tea-square'); assert.equal(members((await inspect()).world).length, 7)
  for (const id of ['tea-bookmark', 'reflection-shapes']) {
    await cancel(id); await story(id, { unknown: id === 'tea-bookmark' })
    await tab('布置'); await direct(id === 'tea-bookmark' ? '收起茶香书签' : '收起倒影小卡'); await settled(); assert.equal((await inspect()).world.afternoon.keepsakes[id], null)
    await story(id, { replay: true }); await cold(id + '-hidden-keepsake-cold')
    await tab('布置'); await direct(id === 'tea-bookmark' ? '挂起茶香书签' : '挂起倒影小卡'); await settled(); await close(); await shot(id + '-visible-keepsake')
  }
  await tab('手账'); for (const id of Object.keys(title)) await page.locator(`[data-notice-id="afternoon:${id}"]`).waitFor(); await shot('two-traceable-memories')
  const saved = structuredClone((await inspect()).world.afternoon)
  for (const id of ['courtyard', 'bookhouse', 'courtyard', 'tea-square', 'courtyard', 'bookhouse', 'courtyard', 'tea-square']) { await travel(id); assert.deepEqual((await inspect()).world.afternoon, saved) }
  log('Both distinct slices cancel, complete, replay and retain keepsakes across cold recovery and all three scene resource roundtrips')
}

try {
  await freeze()
  const { harness } = await import(pathToFileURL(join(out, 'harness.mjs'))), plugin = await import(pathToFileURL(join(out, 'lib/index.js')))
  host = await harness({ profile, plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
  const { source } = await json(join(root, '.local/environment.json')), store = join(source, 'node_modules/.pnpm'), name = (await readdir(store)).find(n => n.startsWith('playwright@1.61.'))
  const { chromium } = await import(pathToFileURL(join(store, name, 'node_modules/playwright/index.mjs'))), cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).filter(n => n.startsWith('chromium_headless_shell-')).sort().at(-1)
  browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), args: ['--enable-unsafe-swiftshader'] })
  context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: dpr }); page = await context.newPage(); page.setDefaultTimeout(30000)
  page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', async route => {
    const request = route.request(), url = request.url(), path = new URL(url).pathname
    if (!url.startsWith(host.url + '/') && !url.startsWith('blob:')) { external.push(url); return route.abort() }
    if (fault.blockState && path === '/api/nidofy-ai-village/state') return route.abort()
    if (path === '/api/nidofy-ai-village/save' && request.method() === 'POST') {
      const data = request.postDataJSON(); writes.push({ operationId: data.operationId, expectedRevision: data.expectedRevision, afternoon: data.world?.afternoon })
      if (fault.story && memory(data.world, fault.story)?.count === fault.count) { fault.story = null; fault.operationId = data.operationId; const response = await route.fetch(); assert.equal(response.ok(), true); fault.blockState = true; return route.abort() }
    }
    return route.continue()
  })
  await page.goto(host.entry); await direct('打开 AI 小院'); await entered(); await settled()
  const migrated = (await inspect()).world; assert.equal(migrated.schemaVersion, 15); assert.equal(migrated.contentRevision, 11)
  const { afternoon, community, ...old } = migrated; assert.deepEqual({ ...old, schemaVersion: 14, contentRevision: 10 }, legacy.saved.world); assert.equal(afternoon.memories.length, 0)
  await page.evaluate(() => window.__villageHostFixture.flush()); await settled()
  assert.equal(hash(await readFile(join(profile, 'nidofy-ai-village/snapshots', legacy.pointer.snapshot))), legacy.pointer.hash)
  log('Actual paused seven-resident world14 snapshot migrates without altering prior fields or original snapshot bytes')
  observations.push({ display: await page.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, height: innerHeight })), migrated })
  await shot('world14-migrated'); await sceneResources(migrated.region.active)
  if (mode !== 'migration') await b1()
  if (mode === 'all') throw Error('COMMUNITY_UI_CONTRACT_PENDING: B2/B3/B4 qualification is not implemented yet')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
} catch (error) { failure = String(error.stack ?? error); console.error(failure); if (page) await shot('failure').catch(() => {}) }
finally {
  fault.blockState = false
  await page?.evaluate(() => window.__villageHostFixture.dispose()).catch(() => {}); await context?.close(); await browser?.close(); await host?.close()
  if (legacy) { try { assert.deepEqual(await sourceHashes(legacy.source), legacy.files); log('Original A6 source game files remain byte-identical') } catch (error) { failure ??= String(error) } }
  await writeFile(join(qa, 'build.json'), JSON.stringify(build, null, 2) + '\n')
  await writeFile(join(qa, 'result.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', label, mode, build, checks, observations, samples, writes, errors, external, failure, notCovered: ['Native Desktop and physical IME/sleep', 'Hardware GPU performance', ...(!build.artifact ? ['Final tgz identity not supplied for this source-build run'] : [])] }, null, 2) + '\n')
}
if (failure) process.exitCode = 1

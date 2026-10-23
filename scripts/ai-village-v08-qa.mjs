/** 0.8 isolated real-component QA. Preparation is inert; execute only after candidate release approval. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'

const root = resolve(import.meta.dirname, '..')
const pkg = join(root, 'packages/ai-village')
const qa = join(root, 'docs/ai-village/v08-v09/qa')
const label = process.argv[2]
const scenario = process.argv.find(v => v.startsWith('--scenario='))?.slice(11) ?? 'all'
const execute = process.argv.includes('--execute')
const resumeLabel = process.argv.find(v => v.startsWith('--resume='))?.slice(9)
const resumeAlbumFix = process.argv.includes('--resume-album-fix')
if (resumeAlbumFix) assert.ok(resumeLabel, 'Album-fix continuation needs an explicit stopped source run')
if (resumeLabel) assert.ok(/^[a-z0-9][a-z0-9-]{0,64}$/.test(resumeLabel) && resumeLabel !== label)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await readFile(file, 'utf8'))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()

// Read-only projection is loaded from the source whose hash is recorded, never a clock/state mutator.
let currentEncounter
const encounterContract = {
  configured: true,
  ids: ['paper-rescue', 'leaves-gather'],
  maxWaitMs: 18 * 60 * 1000, // Includes pass, cancellation, two completions per kind and real approach time.
  offer: world => { const offer = currentEncounter(world); return offer ? { ...offer, id: offer.definitionId } : null },
  exercise: exerciseEncounter,
  collections: inspectCollections,
}
const encounterLabels = {
  'paper-rescue': ['展开这张留言', '写下我们的好消息', '留下这块留言牌'],
  'leaves-gather': ['看看叶子的形状', '选出今天的叶子', '收藏这阵风'],
}

async function exerciseEncounter(s, offer, action = 'complete') {
  const { page, inspect, settled, tab, closePanel, direct, screenshot, setPaused, observations, log } = s
  await tab('心愿'); if ((await inspect()).presentation.page === 'quick') await direct('此刻的小偶遇')
  const card = page.getByRole('article', { name: '此刻的小偶遇', exact: true })
  await card.waitFor(); await screenshot(`${offer.index}-${offer.id}-${action}-offer`)
  const before = (await inspect()).world, prior = before.neighborhood.memories.find(m => m.id === offer.id)
  if (action === 'expire') {
    await page.waitForFunction(tick => window.__villageHostFixture.inspect().world.ticks >= tick, offer.expiresTick, { timeout: 75000 })
    const after = (await inspect()).world
    assert.equal(currentEncounter(after), null); assert.equal(after.play.encounterWindow, before.play.encounterWindow)
    assert.deepEqual(after.neighborhood.memories, before.neighborhood.memories); assert.equal(await card.count(), 0)
    await screenshot(`${offer.index}-${offer.id}-naturally-expired`); await closePanel(); log('untouched offer expires through real simulation time without consuming or rewarding it'); return
  }
  if (action === 'pass') {
    await card.getByRole('button', { name: '这次先略过', exact: true }).click(); await settled()
    const after = (await inspect()).world
    assert.equal(after.play.encounterWindow, offer.index); assert.equal(currentEncounter(after), null)
    assert.deepEqual(after.neighborhood.memories, before.neighborhood.memories)
    await setPaused(true); const held = (await inspect()).world
    await page.evaluate(() => window.__villageHostFixture.sidebar(true)); await page.waitForTimeout(1000); assert.deepEqual((await inspect()).world, held)
    await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await s.entered(); assert.equal(currentEncounter((await inspect()).world), null)
    await closePanel(); await setPaused(false); log('pass consumes natural window without memory; hidden/user pause retains consumed window'); return
  }
  await card.getByRole('button', { name: '一起帮忙', exact: true }).click(); await settled()
  const started = (await inspect()).world
  assert.equal(started.play.active?.definitionId, offer.id, (await inspect()).actionError); assert.equal(started.play.encounterWindow, offer.index)
  const active = page.getByRole('article', { name: '正在进行的故事', exact: true })
  if (action === 'cancel') {
    await active.getByRole('button', { name: '取消这次活动', exact: true }).click(); await settled()
    assert.equal((await inspect()).world.play.active, null); assert.equal(currentEncounter((await inspect()).world), null)
    assert.deepEqual((await inspect()).world.neighborhood.memories, before.neighborhood.memories)
    await page.waitForTimeout(500); assert.equal(currentEncounter((await inspect()).world), null)
    await closePanel(); log('normal cancellation keeps natural window consumed and writes no memory'); return
  }
  for (let stage = 0; stage < 3; stage++) {
    await page.waitForFunction(({ id, stage }) => { const s = window.__villageHostFixture.inspect(), a = s.world.play.active; return a?.definitionId === id && a.stage === stage && a.phase === 'ready' && !s.reasons.includes('commit-pending') }, { id: offer.id, stage }, { timeout: 120000 })
    const state = (await inspect()).world, event = state.play.active, members = [state.actor, ...state.companions]
    for (let i = 0; i < event.participants.length; i++) assert.deepEqual(members.find(a => a.id === event.participants[i]).position, event.targets[i])
    await active.getByRole('heading').scrollIntoViewIfNeeded(); await screenshot(`${offer.index}-${offer.id}-stage-${stage + 1}`)
    await active.getByRole('button', { name: encounterLabels[offer.id][stage], exact: true }).click()
    await page.waitForFunction(previous => { const a = window.__villageHostFixture.inspect().world.play.active; return !a || a.stage > previous }, stage); await settled()
  }
  const after = (await inspect()).world, memory = after.neighborhood.memories.find(m => m.id === offer.id)
  assert.equal(after.play.active, null); assert.equal(memory.count, (prior?.count ?? 0) + 1)
  if (prior) { const { count: _old, ...first } = prior, { count: _new, ...again } = memory; assert.deepEqual(again, first) }
  observations.push({ completed: offer.id, window: offer.index, memory, elapsedTicks: after.ticks - before.ticks })
  await closePanel(); log(`${offer.id} three real stages, confirmed memory count ${memory.count}, first details retained`)
  if (!prior) {
    const [id, title, place, slot] = offer.id === 'paper-rescue' ? ['message-board', '好消息留言牌', '院墙', 'wall'] : ['leaf-pot', '风信叶子盆', '门旁', 'door']
    await setPaused(true); await tab('布置'); await direct('挂饰')
    await page.getByText(title, { exact: true }).locator('..').getByRole('button', { name: '选择位置', exact: true }).click()
    await page.getByRole('group', { name: title, exact: true }).getByRole('button', { name: place, exact: true }).click()
    await direct('确认保存位置'); await settled(); assert.equal((await inspect()).world.play.decorations[id], slot)
    await closePanel(); await screenshot(`${offer.id}-reward-placed`); await setPaused(false)
    log(`${id} unlocked by saved completion and placed through normal decor confirmation`)
  }
}

async function inspectCollections(s) {
  const { page, inspect, tab, direct, settled, screenshot, closePanel, setPaused, click, log } = s
  await setPaused(true); await tab('手账'); await direct('回忆')
  const region = page.getByRole('region', { name: '收藏分类', exact: true })
  await region.getByText('偶遇 · 2/2', { exact: true }).click()
  await region.getByText('飞走的留言', { exact: true }).waitFor(); await region.getByText('叶子的来信', { exact: true }).waitFor()
  assert.equal(await region.locator('details').count(), 8)
  await region.getByText('一起留下回忆的居民 · 2/7', { exact: true }).waitFor()
  const emptyStories = region.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^小故事 · 0\/3$/ }) })
  if (await emptyStories.getAttribute('open') === null) await emptyStories.locator('summary').click()
  await emptyStories.getByText('这里还没有已保存的收藏。', { exact: true }).waitFor()
  const snapshot = (await inspect()).world; await screenshot('collections-saved-facts')
  await direct('相册'); await page.getByText('还没有照片，拍一张留住小院的一刻。', { exact: true }).waitFor()
  assert.equal((await inspect()).albumError, ''); await screenshot('empty-album-successfully-read'); await direct('回忆')
  await region.getByText('照片 · 0', { exact: true }).waitFor(); assert.deepEqual((await inspect()).world, snapshot)
  await closePanel()
  if ((await inspect()).world.companions.length < 6) { await tab('居民'); await direct('全部居民'); await direct('安排入住'); await direct('全员入住'); await settled(); await closePanel() }
  await tab('手账'); await direct('回忆'); await region.getByText('一起留下回忆的居民 · 2/7', { exact: true }).waitFor()
  await screenshot('collections-seven-present-still-two-shared')
  await closePanel(); await tab('心愿'); await direct('一起活动')
  const goals = page.getByRole('region', { name: '慢慢积累的目标', exact: true }); assert.equal(await goals.getByRole('article').count(), 3)
  await goals.scrollIntoViewIfNeeded(); await screenshot('optional-goals-derived-from-facts'); await closePanel()
  await page.evaluate(() => window.__villageHostFixture.flush()); await settled(); const saved = (await inspect()).world
  await page.evaluate(() => window.__villageHostFixture.dispose()); await page.reload(); await direct('打开 AI 小院'); await s.entered(); assert.deepEqual((await inspect()).world, saved)
  await tab('手账'); await direct('回忆'); await page.getByRole('region', { name: '收藏分类', exact: true }).getByText('偶遇 · 2/2', { exact: true }).waitFor(); await screenshot('collections-cold-restored'); await closePanel()
  await click('展开小院')
  for (const [width, height] of [[340, 720], [580, 720], [1080, 760], [320, 360]]) for (const theme of ['light', 'dark']) {
    let viewportHeight = height + 236, matched = false
    for (let i = 0; i < 6; i++) {
      await page.setViewportSize({ width: width + 224, height: viewportHeight }); await page.waitForTimeout(180)
      const box = await page.locator('.village-card').boundingBox()
      if (Math.abs(box.width - width) < 1 && Math.abs(box.height - height) < 1) { matched = true; break }
      viewportHeight += Math.round(height - box.height)
    }
    assert.ok(matched, `Actual card dimensions ${width}x${height}`); await s.entered()
    await page.evaluate(theme => window.__villageHostFixture.preference(theme), theme); await settled(); await tab('手账'); if ((await inspect()).presentation.page === 'quick') await direct('回忆')
    const collection = page.getByRole('region', { name: '收藏分类', exact: true })
    await collection.getByRole('heading', { name: '收藏分类', exact: true }).scrollIntoViewIfNeeded(); await screenshot(`collections-${width}x${height}-${theme}-top`)
    await collection.locator('summary').last().scrollIntoViewIfNeeded(); await screenshot(`collections-${width}x${height}-${theme}-bottom`)
    await direct('返回'); assert.equal((await inspect()).presentation.page, 'quick'); await closePanel()
  }
  log('eight collection categories use saved facts; replays do not add types; presence alone does not add shared residents; empty album and cold restore')
}

if (!execute) {
  console.log('PREPARED / NOT RUN. Usage: node scripts/ai-village-v08-qa.mjs <new-label> --execute --scenario=all|encounters|performance|lifecycle|collections|decor [--resume=<stopped-label>] [--resume-album-fix]')
} else {
  assert.ok(label && /^[a-z0-9][a-z0-9-]{0,64}$/.test(label), 'A new append-only evidence label is required')
  assert.ok(['all', 'encounters', 'performance', 'lifecycle', 'collections', 'decor'].includes(scenario))
  if (scenario === 'all' || scenario === 'encounters') assert.ok(encounterContract.configured, 'Final encounter/UI contract has not been wired; do not guess selectors or mutate state')
  await run()
}

async function run() {
  const evidence = join(qa, label), generated = join(root, '.build/ai-village-v08-qa', label), out = join(generated, 'preview')
  await mkdir(qa, { recursive: true }); await mkdir(evidence); await mkdir(join(root, '.build/ai-village-v08-qa'), { recursive: true }); await mkdir(generated); await mkdir(out)
  const build = { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), dirty: git('status', '--short'), version: (await json(join(pkg, 'package.json'))).version, sourceHash: {}, bundles: {}, scenario }
  for (const file of (await readdir(join(pkg, 'src'), { recursive: true })).filter(f => /\.tsx?$/.test(f)).sort()) build.sourceHash[file.replaceAll('\\', '/')] = hash(await readFile(join(pkg, 'src', file)))
  for (const file of ['index.js', 'client.js', 'frame.js']) build.bundles[file] = hash(await readFile(join(pkg, 'lib', file)))
  if (resumeLabel) {
    const previous = await json(join(qa, resumeLabel, 'build.json'))
    if (resumeAlbumFix) {
      assert.equal(build.bundles['index.js'], previous.bundles['index.js']); assert.equal(build.bundles['frame.js'], previous.bundles['frame.js'])
      assert.deepEqual(Object.keys(build.sourceHash), Object.keys(previous.sourceHash))
      const changed = Object.keys(build.sourceHash).filter(file => build.sourceHash[file] !== previous.sourceHash[file])
      assert.ok(changed.length > 0 && changed.every(file => ['client/album-client.ts', 'client/CollectionPanel.tsx'].includes(file)), 'Only reviewed empty-album presentation fix may differ')
      build.resumeSourceDelta = changed.map(file => ({ file, previous: previous.sourceHash[file], current: build.sourceHash[file] }))
      build.resumePreviousBundles = previous.bundles
    } else { assert.deepEqual(build.bundles, previous.bundles); assert.deepEqual(build.sourceHash, previous.sourceHash) }
    await stat(join(qa, resumeLabel, 'validation.json')) // Only copy a stopped, finalized run.
    build.resumedFrom = resumeLabel
  }
  const checks = [], captures = [], errors = [], external = [], requests = [], observations = [], performanceSamples = [], lifecycle = []
  let browser, context, page, host, failure
  try {
    if (scenario === 'all' || scenario === 'encounters') ({ currentEncounter } = await import(pathToFileURL(join(pkg, 'src/core/encounter.ts'))))
    await cp(join(pkg, 'lib'), join(out, 'lib'), { recursive: true }); await cp(join(pkg, 'assets'), join(out, 'assets'), { recursive: true })
    await runPreview({ root, pkg, out, buildOnly: true })
    build.fixtureSha256 = hash(await readFile(join(out, 'fixture.js')))
    await writeFile(join(evidence, 'build.json'), JSON.stringify(build, null, 2) + '\n')
    const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')))
    const plugin = await import(pathToFileURL(join(out, 'lib/index.js')))
    const { source } = await json(join(root, '.local/environment.json')), pnpm = join(source, 'node_modules/.pnpm')
    const pw = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
    assert.ok(pw, 'Use existing pinned Playwright; no installation/download fallback')
    const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')))
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).filter(n => n.startsWith('chromium_headless_shell-')).sort().at(-1)
    const executablePath = join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'); await stat(executablePath)
    const profile = join(generated, 'profile'); await mkdir(profile)
    if (resumeLabel) await cp(join(root, '.build/ai-village-v08-qa', resumeLabel, 'profile'), profile, { recursive: true, filter: file => !file.endsWith('owner.lock') })
    host = await harness({ profile, plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
    context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(evidence, 'video'), size: { width: 960, height: 640 } } })
    await context.route('**/*', async route => {
      const url = route.request().url()
      if (!url.startsWith(host.url + '/') && !url.startsWith('blob:')) { external.push(new URL(url).origin); return route.abort() }
      const endpoint = new URL(url).pathname.split('/').at(-1)
      if (['save', 'state', 'heartbeat'].includes(endpoint)) requests.push({ endpoint, method: route.request().method(), elapsedMs: Math.round(performance.now()) })
      return route.continue()
    })
    page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message))
    const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
    const frame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))
    const entered = () => page.waitForFunction(() => { const s = window.__villageHostFixture.inspect(); return s.frameReady && !s.entrance.blocking && !s.error })
    const settled = () => page.waitForFunction(() => { const s = window.__villageHostFixture.inspect(); return !s.error && !s.preferencesSaving && !s.reasons.includes('commit-pending') && s.saveReceipt.status !== 'pending' })
    const { click } = villageUI(page), direct = name => page.getByRole('button', { name, exact: true }).click()
    const closePanel = async () => { const el = page.getByRole('button', { name: '关闭面板', exact: true }); if (await el.isVisible()) await el.click(); await page.waitForTimeout(240) }
    const tab = async name => {
      if ((await inspect()).presentation.overlay) await closePanel()
      const el = page.getByRole('tab', { name, exact: true })
      if ((await inspect()).presentation.drawer === 'closed' || await el.getAttribute('aria-selected') !== 'true') await el.click()
    }
    const log = name => { checks.push(name); console.log('PASS ' + name) }
    const screenshot = async name => {
      await page.waitForTimeout(220)
      await page.locator('.village-card').evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))) })
      const opacity = await page.locator('.village-surface,.village-panel').evaluateAll(els => els.map(el => Number(getComputedStyle(el).opacity)))
      assert.ok(opacity.every(n => n === 1)); await page.screenshot({ path: join(evidence, name + '.png') })
      const s = await inspect(); captures.push({ name, opacity, box: await page.locator('.village-card').boundingBox(), theme: s.preferences.theme, route: s.presentation, tick: s.world.ticks })
    }
    const setPaused = async value => { if ((await inspect()).world.userPaused !== value) { await click(value ? '暂停' : '继续'); await settled() } }
    const inviteAll = async () => { await setPaused(true); await tab('居民'); await direct('全部居民'); await direct('安排入住'); await direct('全员入住'); await settled(); assert.equal((await inspect()).world.companions.length, 6); await closePanel() }
    const session = { page, inspect, frame, entered, settled, click, direct, tab, closePanel, screenshot, setPaused, log, observations }

    await page.goto(host.entry); await page.getByRole('textbox', { name: '消息输入' }).fill('0.8 隔离验收草稿，不发送。'); await direct('打开 AI 小院'); await entered()
    build.contract = { schema: (await inspect()).world.schemaVersion, rules: (await inspect()).world.simulationRulesVersion, content: (await inspect()).world.contentRevision }
    await screenshot('initial')
    if (scenario === 'collections') { assert.ok(resumeLabel); await encounterContract.collections(session) }
    if (scenario === 'decor') {
      assert.ok(resumeLabel); await closePanel(); await click('展开小院'); await setPaused(false)
      const { keepsakePositions } = await import(pathToFileURL(join(pkg, 'src/core/keepsake-observation.ts')))
      const started = Date.now(); let clear = false
      while (Date.now() - started < 90000) {
        const world = (await inspect()).world, items = keepsakePositions(world).filter(item => ['message-board', 'leaf-pot'].includes(item.id))
        assert.equal(items.length, 2)
        clear = items.every(item => [world.actor, ...world.companions].every(a => Math.abs(a.position.x - item.x) > 38 || a.position.y < item.y - 20 || a.position.y > item.y + 135))
        if (clear) break
        await page.waitForTimeout(500)
      }
      await setPaused(true); observations.push({ decorClear: clear, world: (await inspect()).world })
      await screenshot('both-encounter-keepsakes-expanded'); assert.ok(clear, 'Natural movement did not clear the keepsakes within 90 seconds')
      log('both placed encounter keepsakes visible after natural movement, expanded view')
    }
    if (scenario === 'all' || scenario === 'encounters') {
      assert.equal((await inspect()).world.schemaVersion, 9); assert.equal((await inspect()).world.contentRevision, 6)
      await setPaused(true); await click('请一位朋友入住'); await settled(); await closePanel(); await setPaused(false)
      const counts = new Map(encounterContract.ids.map(id => [id, 0])), started = Date.now(); let previousSignature = '', expired = false, passed = false, cancelled = false, lastLog = 0
      while ([...counts.values()].some(n => n < 2)) {
        assert.ok(Date.now() - started < encounterContract.maxWaitMs, 'Natural encounter window exceeded; report NOT OBSERVED rather than inventing offers')
        const state = await inspect(), offer = encounterContract.offer(state.world), signature = JSON.stringify(offer)
        if (signature !== previousSignature) { observations.push({ elapsedMs: Date.now() - started, tick: state.world.ticks, offer }); previousSignature = signature }
        if (Date.now() - lastLog > 20000) { console.log(`WAIT natural tick=${state.world.ticks} elapsed=${Math.round((Date.now() - started) / 1000)}s completed=${JSON.stringify([...counts])}`); lastLog = Date.now() }
        if (offer && encounterContract.ids.includes(offer.id) && (counts.get(offer.id) < 2 || !expired || !passed || !cancelled)) {
          const action = counts.get(offer.id) === 0 ? 'complete' : !expired ? 'expire' : !passed ? 'pass' : !cancelled ? 'cancel' : 'complete'
          await encounterContract.exercise(session, offer, action)
          if (action === 'expire') expired = true; else if (action === 'pass') passed = true; else if (action === 'cancel') cancelled = true; else counts.set(offer.id, counts.get(offer.id) + 1)
        } else await page.waitForTimeout(500)
      }
      await encounterContract.collections(session)
      log('both natural encounter kinds and collection categories through actual UI')
    }
    if (scenario === 'all' || scenario === 'lifecycle') {
      await setPaused(true); await closePanel(); await page.evaluate(() => window.__villageHostFixture.flush()); await settled()
      const saved = (await inspect()).world, resources = (await inspect()).resourceKeys.length, cdp = await context.newCDPSession(page)
      for (let i = 1; i <= 50; i++) {
        await click('关闭小院'); await page.waitForFunction(() => !document.querySelector('.village-canvas iframe')); assert.deepEqual((await inspect()).world, saved)
        await direct('打开 AI 小院'); await entered(); assert.equal(await page.locator('.village-canvas iframe').count(), 1); assert.deepEqual((await inspect()).world, saved)
        assert.equal((await frame().evaluate(() => window.__sceneMetrics())).textures, resources)
        if (i % 10 === 0) { await page.mouse.move(1, 1); await page.waitForTimeout(350); await cdp.send('HeapProfiler.collectGarbage'); lifecycle.push({ cycle: i, ...await cdp.send('Memory.getDOMCounters') }); console.log('LIFECYCLE ' + i + '/50') }
      }
      assert.ok(lifecycle.every(row => row.jsEventListeners === lifecycle[0].jsEventListeners))
      await click('关闭小院'); await page.waitForFunction(() => !document.querySelector('.village-canvas iframe')); await cdp.send('HeapProfiler.collectGarbage'); lifecycle.push({ closed: true, ...await cdp.send('Memory.getDOMCounters') }); await cdp.detach()
      await direct('打开 AI 小院'); await entered(); log('50 actual close/reopen cycles, stable warm listeners, unchanged world and final frame release')
    }
    if (scenario === 'all' || scenario === 'performance') {
      await inviteAll(); assert.equal((await inspect()).world.play.active, null, 'Natural performance cannot run with a scripted activity freezing other residents'); await setPaused(false)
      for (const hidden of [false, true]) {
        if (hidden) { await page.evaluate(() => window.__villageHostFixture.sidebar(true)); await page.waitForFunction(() => !document.querySelector('.village-canvas iframe')) }
        const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable'); await page.waitForTimeout(2000)
        const f = frame(), before = f ? await f.evaluate(() => window.__sceneMetrics()) : null, first = (await cdp.send('Performance.getMetrics')).metrics, beforeWorld = (await inspect()).world, start = performance.now()
        await page.waitForTimeout(20000)
        const seconds = (performance.now() - start) / 1000, after = f ? await f.evaluate(() => window.__sceneMetrics()) : null, last = (await cdp.send('Performance.getMetrics')).metrics, metric = (list, name) => list.find(m => m.name === name)?.value ?? null
        const row = { scenario: hidden ? 'seven-natural-hidden' : 'seven-natural-visible', seconds, fps: after ? (after.frames - before.frames) / seconds : 0, p95PaintMs: after?.p95PaintMs ?? null, textures: after?.textures ?? 0, paintSampleCount: after?.paintSampleCount ?? 0, parentTaskPercentOfOneCore: 100 * (metric(last, 'TaskDuration') - metric(first, 'TaskDuration')) / seconds, beforeWorld, afterWorld: (await inspect()).world }
        performanceSamples.push(row); await writeFile(join(evidence, 'performance.json'), JSON.stringify({ backend: 'Chromium headless / SwiftShader', limitations: '20s software samples; parent CDP CPU and JS submission time are not native process/GPU hardware budgets', samples: performanceSamples }, null, 2) + '\n')
        if (after) { assert.ok(row.fps >= 20 && row.fps <= 35); assert.equal(row.textures, 128); assert.ok(row.paintSampleCount <= 600) } else assert.deepEqual((await inspect()).world, beforeWorld)
        console.log('MEASURED ' + row.scenario + ' ' + row.fps.toFixed(3) + 'FPS / ' + row.textures + ' textures'); await cdp.detach()
      }
      await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await entered(); await screenshot('performance-restored'); log('seven natural residents visible/hidden performance under unchanged limits')
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); log('zero page exceptions and external requests')
  } catch (error) {
    failure = String(error?.stack || error); console.error(failure)
    await page?.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {})
    const state = await page?.evaluate(() => window.__villageHostFixture?.inspect()).catch(() => null)
    if (state) await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ world: state.world, error: state.error, actionError: state.actionError, album: state.album, albumError: state.albumError, reasons: state.reasons, presentation: state.presentation, frameReady: state.frameReady, entrance: state.entrance, diagnostics: state.diagnostics }, null, 2))
  } finally {
    await writeFile(join(evidence, 'validation.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', build, checks, captures, observations, performanceSamples, lifecycle, errors, external, requests, failure, notRun: ['native GPU/DPI/IME', 'one-hour native use', 'human art approval'], scope: 'Isolated authenticated Host fixture; no normal DSH_HOME, no model request, no injected world or clock' }, null, 2) + '\n')
    await page?.evaluate(() => window.__villageHostFixture?.dispose()).catch(() => {})
    await context?.close(); await host?.close(); await browser?.close()
  }
  if (failure) process.exitCode = 1
}

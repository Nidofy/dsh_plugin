/** Isolated, append-only evidence from production components and the authenticated official Host fixture. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'

const root = resolve(import.meta.dirname, '..'), label = process.argv[2]
const extended = process.argv.includes('--extended')
const matrixOnly=process.argv.includes('--matrix-only')
const resumedFrom = process.argv.find(arg=>arg.startsWith('--resume='))?.slice(9)
if(resumedFrom)assert.match(resumedFrom,/^[a-z0-9][a-z0-9-]{0,64}$/)
assert.ok(label && /^[a-z0-9][a-z0-9-]{0,64}$/.test(label), 'Usage: node scripts/ai-village-living-qa.mjs <new-run-label>')
const pkg = join(root, 'packages/ai-village')
const evidence = join(root, 'docs/ai-village/living-v07-v09/qa', label)
const generated = join(root, '.build/ai-village-living-qa', label), out = join(generated, 'preview')
await mkdir(join(root, 'docs/ai-village/living-v07-v09/qa'), { recursive: true })
await mkdir(evidence) // Deliberately refuses to overwrite any previous run.
await mkdir(out, { recursive: true })
const hash = value => createHash('sha256').update(value).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
const sourceHash = {}
for (const file of (await readdir(join(pkg, 'src'), { recursive: true })).filter(f => /\.tsx?$/.test(f)).sort()) sourceHash[file.replaceAll('\\', '/')] = hash(await readFile(join(pkg, 'src', file)))
const build = { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), dirty: git('status', '--short'), version: JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8')).version, sourceHash, bundles: {} }
for (const file of ['index.js', 'client.js', 'frame.js']) build.bundles[file] = hash(await readFile(join(pkg, 'lib', file)))
if(resumedFrom){
  const previous=JSON.parse(await readFile(join(root,'docs/ai-village/living-v07-v09/qa',resumedFrom,'build.json'),'utf8'))
  assert.deepEqual(build.bundles,previous.bundles,'Cannot resume across different production bundles')
  assert.deepEqual(build.sourceHash,previous.sourceHash,'Cannot resume across different production sources')
  build.resumedFrom=resumedFrom
}
await cp(join(pkg, 'lib'), join(out, 'lib'), { recursive: true })
await cp(join(pkg, 'assets'), join(out, 'assets'), { recursive: true })
await runPreview({ root, pkg, out, buildOnly: true })
build.fixtureSha256 = hash(await readFile(join(out, 'fixture.js')))
await writeFile(join(evidence, 'build.json'), JSON.stringify(build, null, 2) + '\n')

const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')))
const plugin = await import(pathToFileURL(join(out, 'lib/index.js')))
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm')
const pw = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
assert.ok(pw, 'Existing approved Playwright dependency required; this script never downloads it')
const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')))
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
const folder = (await readdir(cache)).filter(n => n.startsWith('chromium_headless_shell-')).sort().at(-1)
const executablePath = join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe')
assert.ok(await stat(executablePath))
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
const profile = resumedFrom ? join(root,'.build/ai-village-living-qa',resumedFrom,'profile') : join(generated, 'profile')
if(resumedFrom)assert.ok((await stat(profile)).isDirectory());else await mkdir(profile)
const h = await harness({ profile, plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
const errors = [], external = [], checks = [], captures = [], performanceSamples = []
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(evidence, 'video'), size: { width: 960, height: 640 } } })
await context.route('**/*', route => {
  const url = route.request().url()
  if (url.startsWith(h.url + '/') || url.startsWith('blob:')) return route.continue()
  external.push(new URL(url).origin); return route.abort()
})
const page = await context.newPage()
page.setDefaultTimeout(20000)
page.on('pageerror', e => errors.push(e.message))
const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
const entered = () => page.waitForFunction(() => { const s = window.__villageHostFixture.inspect(); return s.frameReady && !s.entrance.blocking && !s.error })
const { click, settled } = villageUI(page)
const tab = async name => {
  const el=page.getByRole('tab',{name,exact:true}),p=(await inspect()).presentation
  if(p.drawer==='closed'||await el.getAttribute('aria-selected')!=='true')await el.click()
}
const direct = name => page.getByRole('button', { name, exact: true }).click()
const frame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))
const check = name => { checks.push(name); console.log('PASS ' + name) }
const screenshot = async name => {
  const beforeOpacity=await page.locator('.village-surface,.village-panel').evaluateAll(els=>els.map(el=>({className:el.className,opacity:getComputedStyle(el).opacity})))
  await page.waitForTimeout(220)
  await page.locator('.village-card').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})))})
  const settledOpacity=await page.locator('.village-surface,.village-panel').evaluateAll(els=>els.map(el=>({className:el.className,opacity:getComputedStyle(el).opacity})))
  for(const item of settledOpacity)assert.equal(Number(item.opacity),1,'Screenshot must capture fully visible surface and text')
  await page.screenshot({ path: join(evidence, name + '.png') })
  const s = await inspect()
  captures.push({ name, size: await page.locator('.village-card').boundingBox(), dpr: await page.evaluate(() => devicePixelRatio), route: s.presentation, language: s.preferences.language, theme: s.preferences.theme, ticks: s.world?.ticks, reasons: s.reasons, resourceCount: s.resourceKeys.length,beforeOpacity,settledOpacity })
}
const closePanel = async () => {
  const close = page.locator('.village-panel-header button').last()
  if (await close.isVisible()) await close.click()
}
const resize = async (width, height) => {
  let viewportHeight = height + 236
  for (let n = 0; n < 6; n++) {
    await page.setViewportSize({ width: width + 224, height: viewportHeight })
    await page.waitForTimeout(180)
    const box = await page.locator('.village-card').boundingBox()
    if (Math.abs(box.width - width) < 1 && Math.abs(box.height - height) < 1) { await entered(); return }
    viewportHeight += Math.round(height - box.height)
  }
  throw Error('Card size did not match ' + width + 'x' + height)
}
const sample = async scenario => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.waitForTimeout(2000)
  const f = frame(), before = f ? await f.evaluate(() => window.__sceneMetrics()) : null
  const beforeWorld = (await inspect()).world, first = (await cdp.send('Performance.getMetrics')).metrics
  const start = performance.now()
  await page.waitForTimeout(20000)
  const seconds = (performance.now() - start) / 1000
  const after = f ? await f.evaluate(() => window.__sceneMetrics()) : null, last = (await cdp.send('Performance.getMetrics')).metrics
  const metric = (list, name) => list.find(m => m.name === name)?.value ?? null
  const row = { scenario, seconds, fps: after ? (after.frames - before.frames) / seconds : 0, p50PaintMs: after?.p50PaintMs ?? null, p95PaintMs: after?.p95PaintMs ?? null, textures: after?.textures ?? 0, paintSampleCount: after?.paintSampleCount ?? 0, parentTaskPercentOfOneCore: 100 * (metric(last, 'TaskDuration') - metric(first, 'TaskDuration')) / seconds, parentHeapUsedBytes: metric(last, 'JSHeapUsedSize'), ...(await cdp.send('Memory.getDOMCounters')) }
  if (after) { assert.ok(row.fps >= 20 && row.fps <= 35, JSON.stringify(row)); assert.ok(row.paintSampleCount <= 600); assert.equal(row.textures, scenario === 'single' ? 32 : 128) }
  else { assert.deepEqual((await inspect()).world, beforeWorld); assert.equal(await page.locator('.village-canvas iframe').count(), 0) }
  performanceSamples.push(row)
  await writeFile(join(evidence, 'performance.json'), JSON.stringify({ backend: 'Chromium headless / SwiftShader', samples: performanceSamples, limitations: '20s software samples; JS submission p95 is not GPU completion, parent CDP CPU/heap is not process-wide. Not an uncontended hardware comparison.' }, null, 2))
  console.log('MEASURED ' + JSON.stringify(row))
  await cdp.detach()
}

const storyPanel = () => page.getByRole('article', { name: '正在进行的故事', exact: true })
const storiesPage = async () => {
  await tab('心愿')
  if (!await page.getByRole('heading', { name: '今天想一起做什么', exact: true }).isVisible()) await page.getByRole('button', { name: '一起活动', exact: true }).first().click()
}
const playReady = async id => {
  await page.waitForFunction(id => { const s = window.__villageHostFixture.inspect(); return s.world?.play?.active?.definitionId === id && s.world.play.active.phase === 'ready' && !s.reasons.includes('commit-pending') }, id, { timeout: 120000 })
}
const beginPlay = async (id, name) => {
  await storiesPage()
  await page.waitForFunction(() => { const w = window.__villageHostFixture.inspect().world; return w.ticks >= w.play.nextTick })
  await direct('开始 · ' + name); await settled()
  assert.equal((await inspect()).world.play.active?.definitionId, id, (await inspect()).actionError)
  await playReady(id)
}
const finishPlay = async (id, button) => {
  await playReady(id); await storyPanel().getByRole('button', { name: button, exact: true }).click(); await settled()
  await page.waitForFunction(id => { const w = window.__villageHostFixture.inspect().world; return !w.play.active && w.neighborhood.memories.some(m => m.id === id) }, id)
  const memory = (await inspect()).world.neighborhood.memories.find(m => m.id === id)
  assert.equal(memory.count, 1); await screenshot('completed-' + id)
}
const newGameplay = async () => {
  // All changes go through visible production controls; no profile or clock rewriting.
  await click('请一位朋友入住'); await closePanel(); await click('继续')
  await beginPlay('lost-rice', '蓝鲸丢失的白米饭')
  await screenshot('lost-rice-table-ready')
  const before = (await inspect()).world.play.active
  await page.evaluate(() => window.__villageHostFixture.sidebar(true))
  await page.waitForFunction(() => !document.querySelector('.village-canvas iframe'))
  await page.waitForTimeout(1200)
  assert.deepEqual((await inspect()).world.play.active, before)
  await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await entered(); await storiesPage()
  for (const [i, name] of ['问问刚才发生了什么', '查看纸条上的线索', '帮朋友完成花草标签'].entries()) {
    await playReady('lost-rice'); assert.equal((await inspect()).world.play.active.stage, i)
    await storyPanel().getByRole('button', { name, exact: true }).click(); await settled()
    assert.equal((await inspect()).world.play.active.stage, i + 1)
    await screenshot('lost-rice-stage-' + (i + 1))
  }
  await finishPlay('lost-rice', '记下这顿分享的午饭')
  check('lost-rice four live walking/observation stages, hidden pause, one confirmed persistent memory')

  await beginPlay('find-whale', '找找小鲸鱼')
  await storyPanel().getByRole('button', { name: '提示（最多两次）', exact: true }).click(); await settled()
  await screenshot('find-whale-hint')
  await closePanel()
  const metrics = await frame().evaluate(() => window.__sceneMetrics())
  const box = await page.locator('.village-canvas iframe').boundingBox(), target = metrics.playTarget, projection = metrics.viewport.world
  assert.ok(target, 'Renderer must expose a live playable whale target')
  await screenshot('find-whale-scene')
  await page.mouse.click(box.x + projection.x + target.x * projection.scale, box.y + projection.y + target.y * projection.scale)
  await settled()
  await page.waitForFunction(() => window.__villageHostFixture.inspect().world.play.active?.stage === 1)
  assert.equal((await inspect()).world.play.active.stage, 1)
  await storiesPage()
  await finishPlay('find-whale', '收藏这次发现')
  check('find-whale hint and actual scene pointer click complete a confirmed discovery')

  await beginPlay('tidy-desk', '书桌归位')
  const items = storyPanel().getByRole('group', { name: '待整理物品' }), slots = storyPanel().getByRole('group', { name: '物品位置' })
  await items.getByRole('button', { name: '书', exact: true }).click(); await slots.getByRole('button', { name: '笔筒 · 空', exact: true }).click(); await settled()
  assert.deepEqual((await inspect()).world.play.active.board, [-1,0,-1])
  await storyPanel().getByRole('button', { name: '重新整理', exact: true }).click(); await settled()
  assert.deepEqual((await inspect()).world.play.active.board, [-1,-1,-1])
  await items.getByRole('button', { name: '书', exact: true }).dragTo(slots.getByRole('button', { name: '书格 · 空', exact: true })); await settled()
  assert.equal((await inspect()).world.play.active.board[0], 0)
  for (const [item, slot] of [['笔','笔筒'], ['纸','纸盘']]) { await items.getByRole('button', { name: item, exact: true }).click(); await slots.getByRole('button', { name: slot + ' · 空', exact: true }).click(); await settled() }
  await finishPlay('tidy-desk', '记住整齐的小角落')
  check('tidy-desk wrong placement, reset, real drag/drop and keyboard alternative')

  await beginPlay('snack-table', '茶点轮到你')
  for (const name of ['米饭','热茶','水果']) { await storyPanel().getByRole('button', { name, exact: true }).click(); await settled(); await screenshot('snack-' + ({米饭:'rice',热茶:'tea',水果:'fruit'})[name]) }
  await finishPlay('snack-table', '记下茶点时光')
  check('three different snack choices and persistent shared memory')

  await beginPlay('quiet-page', '安静的一页')
  await storyPanel().getByRole('button', { name: '取消这次活动', exact: true }).click(); await settled()
  assert.equal((await inspect()).world.play.active, null)
  assert.equal((await inspect()).world.neighborhood.memories.some(m => m.id === 'quiet-page'), false)
  check('canceling a new story never records an unearned memory')

  await click('暂停'); await settled(); await tab('布置'); await direct('挂饰')
  const keepsake = page.locator('.village-play > div').filter({ has: page.getByText('团圆饭碗', { exact: true }) })
  await keepsake.getByRole('button', { name: '选择位置', exact: true }).click()
  await page.getByRole('group', { name: '团圆饭碗', exact: true }).getByRole('button', { name: '窗边', exact: true }).click()
  await direct('确认保存位置'); await settled()
  assert.equal((await inspect()).world.play.decorations['rice-bowl'], 'window')
  await closePanel(); await screenshot('visible-story-keepsake')
  await page.evaluate(() => window.__villageHostFixture.flush()); await settled()
  const saved = (await inspect()).world
  assert.equal(await page.getByRole('textbox', { name: '消息输入' }).inputValue(), 'QA 本地草稿：不发送，不调用模型。')
  await page.evaluate(() => window.__villageHostFixture.dispose())
  await page.reload(); await direct('打开 AI 小院'); await entered()
  assert.deepEqual((await inspect()).world, saved)
  // The synthetic host has no session persistence; seed a new unsent draft after full page reload.
  await page.getByRole('textbox', { name: '消息输入' }).fill('QA 本地草稿：不发送，不调用模型。')
  await screenshot('gameplay-cold-client-restored')
  check('four memories and placed keepsake restore exactly after fresh client runtime')
}

const extendedStories = async () => {
  await click('继续')
  for (const [id, name, actions] of [
    ['quiet-page', '安静的一页', ['听听这一句','留一会儿空白','夹好这枚书签']],
    ['wind-notes', '风带来的便笺', ['拾起第一张便笺','把两张便笺拼起来','留下风的问候']],
  ]) {
    if(resumedFrom&&(await inspect()).world.neighborhood.memories.some(m=>m.id===id)){check('retained verified completion from '+resumedFrom+': '+id);continue}
    await beginPlay(id,name)
    for (const action of actions.slice(0,-1)) { await playReady(id); await storyPanel().getByRole('button',{name:action,exact:true}).click(); await settled() }
    await finishPlay(id,actions.at(-1)); check('complete authored story ' + id)
  }
  await click('暂停'); await settled(); await tab('居民'); await direct('全部居民'); await direct('安排入住')
  if(!await page.getByLabel('入住 Gemini',{exact:true}).isChecked())await page.getByLabel('入住 Gemini',{exact:true}).click()
  await settled(); await page.waitForFunction(()=>{const w=window.__villageHostFixture.inspect().world;return [w.actor,...w.companions].some(a=>a.id==='gemini')}); await entered(); await closePanel(); await click('继续')
  await beginPlay('stargazing','三个人的星空')
  assert.equal((await inspect()).world.play.active.participants.length,3)
  for (const name of ['说说你想找的星星','把三颗星连起来']) { await playReady('stargazing');await storyPanel().getByRole('button',{name,exact:true}).click();await settled() }
  await finishPlay('stargazing','留下三人的星空')
  check('three actual residents walk through and complete stargazing')
  await click('暂停');await settled();await closePanel()
}
const observeLife = async () => {
  await closePanel()
  const observations=[], seen=new Set(), start=performance.now()
  while(performance.now()-start < 90000) {
    const w=(await inspect()).world,s=w.life.social
    if(s){
      const key=s.kind+':'+s.startTick, initiator=[w.actor,...w.companions].find(a=>a.id===s.pair[0])
      observations.push({tick:w.ticks,social:s,initiatorBehavior:initiator.behavior})
      if(!seen.has(key)&&initiator.behavior==='idle'){seen.add(key);await screenshot('autonomous-social-'+s.kind+'-'+s.startTick)}
    }
    await page.waitForTimeout(500)
  }
  const result={seconds:(performance.now()-start)/1000,observedInteractions:seen.size,observations,status:seen.size?'OBSERVED':'NOT_OBSERVED',note:'Natural 90s seven-resident run; no state placement, forced social command or simulation time acceleration.'}
  await writeFile(join(evidence,'autonomous-life.json'),JSON.stringify(result,null,2))
  console.log('OBSERVATION '+JSON.stringify({seconds:result.seconds,status:result.status,observedInteractions:seen.size}))
}

let failure
try {
  await page.goto(h.entry)
  await page.getByRole('textbox', { name: '消息输入' }).fill('QA 本地草稿：不发送，不调用模型。')
  const start = performance.now()
  await direct('打开 AI 小院'); await entered()
  captures.push({ coldOpenToEnteredMs: performance.now() - start })
  assert.equal((await inspect()).entrance.firstFrame, true)
  if(!resumedFrom){
    assert.equal((await inspect()).resourceKeys.length, 32)
    check('production entrance waits for acknowledged first frame; approved single resident assets only')
    await screenshot('single-default');await sample('single')
    await click('暂停'); await page.evaluate(() => window.__villageHostFixture.flush()); await settled()
    await newGameplay()
  }else{
    const w=(await inspect()).world
    for(const id of ['lost-rice','find-whale','tidy-desk','snack-table','quiet-page','wind-notes'])assert.equal(w.neighborhood.memories.find(m=>m.id===id)?.count,1)
    assert.equal(w.play.decorations['rice-bowl'],'window');assert.equal(w.userPaused,true)
    check('same-build isolated profile resumes all six confirmed memories and placed keepsake')
  }
  if(!matrixOnly){
    if(extended)await extendedStories()
    await click('全员入住'); await settled(); await click('安排入住'); await tab('居民'); await entered(); await closePanel()
    assert.equal((await inspect()).resourceKeys.length, 128)
    await click('继续'); await sample('seven'); if(extended)await observeLife(); await click('暂停'); await settled()
    check('seven resident production assets and visible software performance')
  }else assert.equal((await inspect()).resourceKeys.length,128)

  await click('展开小院')
  await page.evaluate(()=>{
    window.__livingMatrixTrace=[];const ids=new WeakMap();let next=0,last='';
    const capture=()=>{const f=document.querySelector('.village-canvas iframe');if(f&&!ids.has(f))ids.set(f,++next);const s=window.__villageHostFixture.inspect(),row={at:performance.now(),iframe:f?ids.get(f):null,reasons:s.reasons};const key=JSON.stringify([row.iframe,row.reasons]);if(key!==last){last=key;window.__livingMatrixTrace.push(row)}}
    window.__livingMatrixTimer=setInterval(capture,20);capture()
  })
  for (const [width, height] of [[340,720], [580,720], [1080,760], [320,360]]) {
    await resize(width, height)
    const identity = await page.locator('.village-canvas iframe').evaluate(el => (el.dataset.qaIdentity = 'living-same-iframe'))
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => window.__villageHostFixture.preference(t), theme); await settled()
      await storiesPage()
      assert.notEqual((await inspect()).presentation.drawer,'closed')
      assert.equal(await page.getByRole('heading',{name:'今天想一起做什么',exact:true}).isVisible(),true)
      await page.getByRole('heading',{name:'今天想一起做什么',exact:true}).scrollIntoViewIfNeeded()
      await screenshot(`wishes-${width}x${height}-${theme}`)
      if(matrixOnly){
        const last=page.getByRole('button',{name:'再体验一次 · 三个人的星空',exact:true});await last.scrollIntoViewIfNeeded();assert.equal(await last.isVisible(),true)
        await screenshot(`wishes-bottom-${width}x${height}-${theme}`)
        await page.getByRole('button',{name:'返回',exact:true}).click();assert.equal((await inspect()).presentation.page,'quick')
      }
      await closePanel()
      await tab('居民'); if(await page.getByRole('button',{name:'互动',exact:true}).isVisible())await direct('互动')
      assert.notEqual((await inspect()).presentation.drawer,'closed')
      assert.equal(await page.locator('.village-play').isVisible(),true)
      await screenshot(`residents-${width}x${height}-${theme}`)
      if(matrixOnly){await page.getByRole('button',{name:'返回',exact:true}).click();assert.equal((await inspect()).presentation.page,'quick')}
      await closePanel()
    }
    assert.equal(await page.locator('.village-canvas iframe').getAttribute('data-qa-identity'), identity)
  }
  const matrixTrace=await page.evaluate(()=>{clearInterval(window.__livingMatrixTimer);return window.__livingMatrixTrace})
  await writeFile(join(evidence,'matrix-lifecycle.json'),JSON.stringify(matrixTrace,null,2))
  const changedFrames=new Set(matrixTrace.filter(r=>r.iframe!==null).map(r=>r.iframe)).size
  if(changedFrames>1)assert.ok(matrixTrace.some(r=>r.reasons.includes('insufficient-space')),'Resize recreated frame without a recorded lifecycle suspension')
  check('four real card sizes, two themes, retained iframe and existing four-entry UI')
  if(matrixOnly)check('each new catalogue scrolls to final activity and returns to summary; all surface/text opacity equals 1')
  await resize(580, 720)
  if(!matrixOnly){const pausedWorld = (await inspect()).world
  await page.evaluate(() => window.__villageHostFixture.sidebar(true))
  await page.waitForFunction(() => !document.querySelector('.village-canvas iframe'))
  await sample('hidden-seven')
  assert.deepEqual((await inspect()).world, pausedWorld)
  await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await entered()
  assert.deepEqual((await inspect()).world, pausedWorld)
  await page.evaluate(() => window.__villageHostFixture.session()); await entered()
  assert.deepEqual((await inspect()).world, pausedWorld)
  check('hidden/sidebar/session preserve paused world and release frame')
  }
  assert.equal(await page.getByRole('textbox', { name: '消息输入' }).inputValue(), 'QA 本地草稿：不发送，不调用模型。')
  check('host composer draft retained without sending')
  await screenshot('seven-restored')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  check('zero page errors and external requests')
} catch (error) {
  failure = String(error?.stack || error)
  await page.screenshot({ path: join(evidence, 'failure.png') }).catch(() => {})
  const state = await inspect().catch(() => null)
  if (state) await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ world: state.world, presentation: state.presentation, reasons: state.reasons, error: state.error, actionError: state.actionError, frameReady: state.frameReady }, null, 2))
  console.error(failure)
} finally {
  await writeFile(join(evidence, 'validation.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', build, checks, captures, performanceSamples, errors, external, failure, scope: 'Production component story and three minigames, visible keepsake, client cold restoration, lifecycle and software performance. This is an authenticated Host fixture, not a native Desktop install.', notRun: ['hardware GPU', 'physical Windows DPI and IME', 'human art acceptance'], oneHour: 'DEFERRED' }, null, 2) + '\n')
  await page.evaluate(() => window.__villageHostFixture?.dispose()).catch(() => {})
  await context.close(); await h.close(); await browser.close()
}
if (failure) process.exitCode = 1

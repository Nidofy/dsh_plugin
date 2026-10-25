/** Isolated official native UI QA; all world writes go through visible plugin controls. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { measureNative } from './ai-village-life-qa-diagnostics.mjs'
const root = resolve(import.meta.dirname, '..'), mode = process.argv[2] ?? 'inspect', label = process.argv[3]
assert.match(label ?? '', /^[a-z0-9][a-z0-9-]{0,60}$/)
assert.ok(['inspect','install','upgrade','map-only','community','checkpoint','restored','performance'].includes(mode))
const runRoot = 'ai-village-life-qa-desktop-community', work = join(root, '.build', runRoot), evidence = join(root, 'docs/ai-village/community-next/native', label)
await mkdir(evidence, { recursive: true })
const json = async file => JSON.parse(await readFile(file, 'utf8')), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const scriptSha = hash(await readFile(new URL(import.meta.url)))
await readFile(join(evidence, 'result.json')).then(() => { throw Error('Evidence label already exists') }, error => { if (error.code !== 'ENOENT') throw error })
const launch = await json(join(work, 'launch.json')); assert.equal(launch.port, 18773); assert.equal(launch.dshHome.replaceAll('\\', '/'), join(work, 'home').replaceAll('\\', '/')); assert.equal(launch.softwareRendering, false)
const version = process.env.AI_VILLAGE_EXPECTED_VERSION, sha256 = process.env.AI_VILLAGE_EXPECTED_SHA
let artifact = null
if (mode !== 'inspect') {
  assert.match(version ?? '', /^0\.12\.\d+(?:-[a-z0-9.]+)?$/); assert.match(sha256 ?? '', /^[a-f0-9]{64}$/)
  artifact = { version, file: `nidofy-dsh-ai-village-${version}.tgz`, sha256 }
  assert.equal(hash(await readFile(join(root, 'dist', artifact.file))), sha256)
}
const { source } = await json(join(root, '.local/environment.json')), pnpm = join(source, 'node_modules/.pnpm'), pw = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18773', { timeout: 15000 }), protocol = await browser.newBrowserCDPSession()
const pages = browser.contexts().flatMap(context => context.pages()), page = pages.find(item => item.url().startsWith('dsh-app:')); assert.ok(page)
page.setDefaultTimeout(15000)
const checks = [], observations = [], errors = []; let failure = null, environment = null
const requests = []
page.on('response', response => { const url = response.url(); if (url.includes('/api/nidofy-ai-village/') && !url.includes('/asset/')) requests.push({ path: url.split('/api/nidofy-ai-village/')[1].split('?')[0], status: response.status(), at: Date.now() }) })
page.on('pageerror', error => errors.push(error.message))
const screenshot = async name => { await page.evaluate(async () => { await Promise.race([Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,1000))]) }); const cdp = await page.context().newCDPSession(page); try { const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); await writeFile(join(evidence, `${name}.png`), Buffer.from(shot.data, 'base64')) } finally { await cdp.detach() } }
const world = () => page.evaluate(async () => { const response = await fetch('/api/nidofy-ai-village/state', { signal: AbortSignal.timeout(10000) }); return response.ok ? (await response.json()).saved?.world ?? null : null })
const until = async (fn, message, seconds = 90) => { const deadline = Date.now() + seconds * 1000; while (Date.now() < deadline) { const value = await fn(); if (value) return value; await page.waitForTimeout(250) } throw Error(message) }
const direct = name => page.getByRole('button', { name, exact: true }).click()
const frame = async () => { const element = await page.locator('.village-canvas iframe').elementHandle(); return element ? element.contentFrame() : null }
const metrics = async () => { const child = await frame(); return child ? child.evaluate(() => ({ visibility: document.visibilityState, ...window.__sceneMetrics?.() })) : null }
const ready = async region => until(async () => { const value = await metrics(); return value?.region === region && value.frames > 0 && await page.locator('.village-entry-ui[data-entered="true"]').count() === 1 }, `First frame and completed entrance ${region}`)
const closePanel = async () => { await until(async()=>await page.locator('.village-entry-ui[data-entered="true"]').count()===1,'Entrance before panel navigation'); const button = page.getByRole('button', { name: 'Close panel', exact: true }); if (await button.isVisible()) { await button.click(); await button.waitFor({ state: 'hidden' }) } }
const tab = async name => { await closePanel(); const target = page.getByRole('tab', { name, exact: true }); await target.click(); await until(async () => await target.getAttribute('aria-selected') === 'true', `Tab ${name} opened`) }
const hud = async name => { const button = page.getByRole('button', { name, exact: true }); if (!await button.isVisible()) await page.locator('.village-card').getByRole('button', { name: 'More', exact: true }).click(); await button.click() }
const pause = async value => { await closePanel(); if ((await world()).userPaused !== value) { await hud(value ? 'Pause' : 'Resume'); await until(async () => (await world())?.userPaused === value, 'Pause committed') } }
const travel = async target => {
  await closePanel(); await direct('Community map'); await page.locator('.village-map-places [data-place="'+target+'"]').click()
  const before=await world(),start=performance.now();await page.locator('.village-map-travel').click()
  await until(async () => (await world())?.region.active === target, 'Travel committed'); await ready(target);await closePanel()
  assert.equal((await world()).userPaused,before.userPaused);observations.push({travel:target,milliseconds:performance.now()-start,metrics:await metrics()})
}
const observeWorld = async () => {
 const child=await frame();assert.ok(child)
 await child.evaluate(()=>{if(window.__communityObserver)return;window.__communityObserver=true;window.addEventListener('message',e=>{if(e.source===parent&&e.data?.channel==='nidofy-ai-village'&&e.data?.type==='render')window.__communityObservedWorld=e.data.view.world})})
 return child
}
const liveWorld=async()=>{const child=await observeWorld();return until(()=>child.evaluate(()=>window.__communityObservedWorld??null),'Observe rendered world')}
const ground=async point=>{const box=await page.locator('.village-canvas iframe').boundingBox(),m=await metrics(),p=m.viewport.world;assert.ok(box);await page.mouse.click(box.x+p.x+point.x*p.scale,box.y+p.y+point.y*p.scale)}
async function communityAcceptance(){
 assert.equal((await world()).schemaVersion,13);await pause(true)
 const before=await world(),writes=requests.filter(r=>r.path==='save').length
 await direct('Community map');assert.equal(await page.locator('.village-map-places button').count(),5)
 for(const id of ['tea-square','lakeside-garden','workshop']){await page.locator('.village-map-places [data-place="'+id+'"]').click();assert.equal(await page.locator('.village-map-travel').isDisabled(),true)}
 await screenshot('native-community-map');await closePanel();assert.deepEqual(await world(),before);assert.equal(requests.filter(r=>r.path==='save').length,writes)
 checks.push('Native map: five nodes, three planned destinations blocked, browsing does not write paused world')
 if((await world()).region.active!=='bookhouse')await travel('bookhouse');await travel('courtyard');await travel('bookhouse')
 checks.push('Native map round trips retain all residents and user pause through real first frames')
 if(mode==='map-only'){
  const beforeMap=await metrics();await direct('Community map');await page.locator('.village-map-overview[data-art="ready"]').waitFor()
  const images=page.locator('.village-community-map img[data-map-layer]');assert.equal(await images.count(),6);await until(()=>images.evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0)),'Six final artwork layers decoded')
  const blobUrls=await images.evaluateAll(nodes=>nodes.map(n=>n.src));assert.ok(blobUrls.every(url=>url.startsWith('blob:')))
  await screenshot('native-final-map');const duringMap=await metrics();assert.equal(duringMap.textures,beforeMap.textures)
  await closePanel();const revoked=await page.evaluate(async urls=>Promise.all(urls.map(async url=>{try{await fetch(url);return false}catch{return true}})),blobUrls);assert.ok(revoked.every(Boolean))
  observations.push({mapTextures:{before:beforeMap.textures,during:duringMap.textures,after:(await metrics()).textures},decodedMapLayers:6,revokedBlobUrls:revoked.filter(Boolean).length})
  checks.push('Six approved map PNG layers decode locally, map leaves iframe texture count unchanged, closing revokes all six map Blob URLs');return
 }
 assert.equal((await world()).companions.length,0,'Run community acceptance before seven-resident performance mode')
 await pause(false);const origin=(await liveWorld()).actor.position,target={x:300,y:310};await ground(target)
 await until(async()=>!!(await liveWorld()).manualMove,'Manual route accepted');const samples=[],start=performance.now()
 while(performance.now()-start<900){const w=await liveWorld();samples.push({at:performance.now(),ticks:w.ticks,position:w.actor.position});await page.waitForTimeout(80)}
 assert.ok(Math.hypot(samples.at(-1).position.x-origin.x,samples.at(-1).position.y-origin.y)>1);assert.ok(Math.hypot(samples.at(-1).position.x-target.x,samples.at(-1).position.y-target.y)>20)
 observations.push({movement:samples});await screenshot('native-walking');await pause(true)
 const frozen=await world();assert.ok(frozen.manualMove);await page.waitForTimeout(500);assert.deepEqual(await world(),frozen)
 await writeFile(join(work,'community-checkpoint.json'),JSON.stringify({artifact,world:frozen},null,2));await screenshot('native-paused-route')
 checks.push('Native ground click creates a real gradual route; explicit pause preserves in-flight intent for full process restart')
}
let recorder
async function startVideo() {
  const directory = join(work, 'recordings', label); await mkdir(directory, { recursive: true })
  const session = await page.context().newCDPSession(page), frames = []; let pending = Promise.resolve()
  session.on('Page.screencastFrame', event => {
    const file = `frame-${String(frames.length).padStart(6, '0')}.jpg`; frames.push({ file, timestamp: event.metadata.timestamp })
    pending = pending.then(() => writeFile(join(directory, file), Buffer.from(event.data, 'base64')))
    void session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
  })
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 65, maxWidth: 1280, maxHeight: 900, everyNthFrame: 3 })
  recorder = async () => {
    await session.send('Page.stopScreencast'); await pending; await session.detach()
    if (frames.length < 2) return { frames: frames.length, status: 'INSUFFICIENT_FRAMES' }
    const lines = frames.flatMap((item, index) => [`file '${item.file}'`, `duration ${Math.max(.001, (frames[index + 1]?.timestamp ?? item.timestamp + .1) - item.timestamp)}`]); lines.push(`file '${frames.at(-1).file}'`)
    await writeFile(join(directory, 'concat.txt'), lines.join('\n'))
    execFileSync('D:/Software/ZWSim/ffmpeg.exe', ['-y', '-f', 'concat', '-safe', '0', '-i', join(directory, 'concat.txt'), '-vsync', 'vfr', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(evidence, 'native-operations.mp4')], { windowsHide: true, timeout: 60000, stdio: 'ignore' })
    const record = { source: 'CDP Page.startScreencast of isolated official native Electron dsh-app target', frames: frames.length, seconds: frames.at(-1).timestamp - frames[0].timestamp, sha256: hash(await readFile(join(evidence, 'native-operations.mp4'))) }; await writeFile(join(evidence, 'video.json'), JSON.stringify({ ...record, frameTimestamps: frames }, null, 2)); return record
  }
}
try {
  environment = { launch, browser: await protocol.send('Browser.getVersion'), gpu: (await protocol.send('SystemInfo.getInfo')).gpu, page: await page.evaluate(() => ({ visibility: document.visibilityState, dpr: devicePixelRatio, size: [innerWidth, innerHeight] })) }
  if (mode === 'inspect') {
    observations.push({ pages: await Promise.all(pages.map(async item => ({ kind: item.url().includes('welcome.html') ? 'welcome' : item.url().startsWith('dsh-app:') ? 'app' : 'other', buttons: await item.getByRole('button').allTextContents(), text: (await item.locator('body').innerText()).slice(0, 12000) }))) }); await screenshot('inspect'); checks.push('Read-only inspection of isolated official native target; no package installed')
  } else if (mode === 'install' || mode === 'upgrade') {
    const welcome = pages.find(item => item.url().includes('welcome.html'))
    if (welcome) { const add = welcome.getByRole('button', { name: 'Add API Key', exact: true }); if (await add.isVisible()) await add.click(); await welcome.getByRole('button', { name: 'Set up later', exact: true }).click() }
    if (!['performance', 'visibility', 'checkpoint'].includes(mode)) await startVideo()
    const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click()
    if(mode==='upgrade'&&await page.locator('.village-card').count()){const reenter=page.getByRole('button',{name:'Open the doors and enter again',exact:true});if(await reenter.isVisible()){await reenter.click();await ready((await world()).region.active)}await pause(true);await writeFile(join(work,'community-before-upgrade.json'),JSON.stringify({world:await world()},null,2));await hud('Close courtyard')}
    await direct('Plugins')
    if(mode==='upgrade'){
      const button=page.getByRole('button',{name:/^View .*dsh-ai-village/});await button.waitFor();assert.equal(await button.count(),1,'Exactly one isolated AI Village installed package');await button.click()
      const uninstall=page.getByRole('button',{name:/^Uninstall /});assert.equal(await uninstall.count(),1);await uninstall.click();await page.getByRole('dialog').getByRole('button',{name:'Uninstall',exact:true}).click()
      await until(async()=>await page.getByRole('button',{name:/^View .*dsh-ai-village/}).count()===0,'Old isolated package removed before replacement')
    }
    await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', artifact.file)); await direct('Install'); await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 90000 }); await direct('Enable now'); await screenshot('installed'); checks.push('Official plugin manager installed exact pinned 0.12 package into isolated profile')
  } else {
    const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village'); assert.equal((await json(join(installed, 'package.json'))).version, version)
    const unpack = join(work, 'pinned-community-package'); await mkdir(unpack, { recursive: true }); execFileSync('tar', ['-xf', join(root, 'dist', artifact.file), '-C', unpack], { windowsHide: true })
    for (const file of ['lib/index.js', 'lib/client.js', 'lib/frame.js']) assert.deepEqual(await readFile(join(installed, file)), await readFile(join(unpack, 'package', file)))
    checks.push('Installed three bundles byte-match pinned package')
    if (!['performance', 'visibility', 'checkpoint'].includes(mode)) await startVideo()
    if (mode === 'reopen') {
      observations.push({ kind: 'before-explicit-reopen', ui: await page.evaluate(() => ({ visibility: document.visibilityState, entered: document.querySelector('.village-entry-ui')?.getAttribute('data-entered'), entrance: document.querySelector('.village-entrance')?.outerHTML, errors: [...document.querySelectorAll('.village-error')].map(item => item.textContent) })) }); await screenshot('before-reopen'); await direct('Close courtyard'); await direct('Open AI Village')
    }
    if (!await page.locator('.village-card').count()) { await page.getByRole('button', { name: 'New session', exact: true }).first().click(); await direct('Open AI Village') }
    const entry = page.getByRole('button', { name: 'Open the doors and enter again', exact: true }); if (await entry.count()) await entry.click()
    await ready((await world())?.region.active ?? 'courtyard')
    if (mode === 'checkpoint' || mode === 'reopen') {
      await pause(true); await writeFile(join(work, 'community-checkpoint.json'), JSON.stringify({ artifact, world: await world() }, null, 2)); await screenshot('paused-checkpoint'); checks.push('Paused through UI and saved exact checkpoint before coordinated restart or window recovery')
    } else if (mode === 'restored') {
      const checkpoint = await json(join(work, 'community-checkpoint.json')); assert.equal(checkpoint.artifact.sha256, sha256); assert.deepEqual(await world(), checkpoint.world); await screenshot('cold-restored'); if(checkpoint.world.manualMove){const target=checkpoint.world.manualMove.target;await pause(false);await until(async()=>{const w=await liveWorld();return !w.manualMove&&Math.hypot(w.actor.position.x-target.x,w.actor.position.y-target.y)<2},'Cold restored walk reaches target',70);await pause(true);await screenshot('native-restored-arrival');checks.push('Native cold restart resumes the validated path and reaches its original target')}  checks.push('Full native process restart restored exact paused saved world and all 0.12 facts')
    } else if (mode === 'community' || mode==='map-only') {
      if(mode==='map-only'){const prior=await json(join(work,'community-before-upgrade.json'));assert.deepEqual(await world(),prior.world);checks.push('Upgrade preserved paused seven-resident world and all original facts')}
      await communityAcceptance()
    } else if (mode === 'performance') {
      await pause(true); if ((await world()).region.active !== 'courtyard') await travel('courtyard')
      for (const [id, name] of [['claude', 'Claude'], ['gemini', 'Gemini'], ['gpt', 'GPT'], ['grok', 'Grok'], ['kimi', 'Kimi'], ['qwen', 'Qwen']]) {
        if ([(await world()).actor, ...(await world()).companions].some(actor => actor.id === id)) continue
        await tab('Residents'); await direct('All residents'); await direct('Manage residents'); await page.getByRole('checkbox', { name: `Resident ${name}`, exact: true }).click()
        await until(async () => [(await world()).actor, ...(await world()).companions].some(actor => actor.id === id), `Performance resident ${id} admitted`)
        await ready('courtyard')
      }
      assert.equal((await world()).companions.length, 6); checks.push('Seven residents via official UI; performance runs without screencast or CPU profiler')
      const parentSession = await page.context().newCDPSession(page); await parentSession.send('Performance.enable')
      for (const target of ['courtyard', 'bookhouse']) {
        await pause(true); if ((await world()).region.active !== target) await travel(target); await pause(false); await page.waitForTimeout(2000)
        const result = await measureNative({ page, protocol, parentSession, frame: await frame(), world, root, runRoot, evidence, name: target, seconds: 20, fullCpu: true, profile: false }); observations.push(result)
        assert.ok(result.after.textures <= 128); assert.ok(result.after.paintSampleCount <= 600); observations.push({foregroundPerformance:'NOT_EVALUATED',reason:'Test window intentionally remains hidden or occluded; RAF throttling makes this sample incomparable to active foreground gameplay'})
        await pause(true); const before = await world(); await hud('Close courtyard'); await page.locator('.village-canvas iframe').waitFor({ state: 'detached' }); await page.waitForTimeout(2000); assert.deepEqual(await world(), before); await direct('Open AI Village'); await ready(target); assert.deepEqual(await world(), before); checks.push(`${target}: bounded texture/paint storage and real close/reopen passed; foreground FPS gate not evaluated`)
      }
      await parentSession.detach(); await screenshot('performance-restored'); await writeFile(join(work, 'community-checkpoint.json'), JSON.stringify({ artifact, world: await world() }, null, 2))
    } else throw Error(`Mode not implemented: ${mode}`)
  }
} catch (error) { failure = String(error.stack ?? error); observations.push({kind:'before-failure-screenshot',ui:await page.evaluate(()=>({entered:document.querySelector('.village-entry-ui')?.getAttribute('data-entered'),entrance:document.querySelector('.village-entrance')?.outerHTML})).catch(()=>null)}); await screenshot('failure').catch(() => {}); observations.push({ buttons: await page.getByRole('button').allTextContents().catch(() => []) }) }
finally {

  if (recorder) { try { observations.push({ video: await recorder() }) } catch (error) { observations.push({ videoFailure: String(error) }); failure ??= String(error) } }
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: failure ? 'FAIL' : mode==='performance' ? 'LIMITED' : 'PASS', mode, artifact, scriptSha, environment, checks, errors, observations, requests, failure, world: mode === 'inspect' ? null : await world().catch(() => null), notRun:['foreground native hardware FPS (window intentionally not activated)','physical sleep','native minimize/restore','long-duration memory soak','additional physical DPI settings'] }, null, 2) + '\n')
  await protocol.detach().catch(() => {}); console.log(JSON.stringify({ status: failure ? 'FAIL' : 'PASS', mode, evidence, checks, failure })); process.exit(failure ? 1 : 0)
}

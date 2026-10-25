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
const runRoot = 'ai-village-life-qa-desktop-v011', work = join(root, '.build', runRoot), evidence = join(root, 'docs/ai-village/v011/native', label)
await mkdir(evidence, { recursive: true })
const json = async file => JSON.parse(await readFile(file, 'utf8')), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const scriptSha = hash(await readFile(new URL(import.meta.url)))
await readFile(join(evidence, 'result.json')).then(() => { throw Error('Evidence label already exists') }, error => { if (error.code !== 'ENOENT') throw error })
const launch = await json(join(work, 'launch.json')); assert.equal(launch.port, 18772); assert.equal(launch.dshHome.replaceAll('\\', '/'), join(work, 'home').replaceAll('\\', '/')); assert.equal(launch.softwareRendering, false)
const version = process.env.AI_VILLAGE_EXPECTED_VERSION, sha256 = process.env.AI_VILLAGE_EXPECTED_SHA
let artifact = null
if (mode !== 'inspect') {
  assert.match(version ?? '', /^0\.11\.\d+(?:-[a-z0-9.]+)?$/); assert.match(sha256 ?? '', /^[a-f0-9]{64}$/)
  artifact = { version, file: `nidofy-dsh-ai-village-${version}.tgz`, sha256 }
  assert.equal(hash(await readFile(join(root, 'dist', artifact.file))), sha256)
}
const { source } = await json(join(root, '.local/environment.json')), pnpm = join(source, 'node_modules/.pnpm'), pw = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18772', { timeout: 15000 }), protocol = await browser.newBrowserCDPSession()
const pages = browser.contexts().flatMap(context => context.pages()), page = pages.find(item => item.url().startsWith('dsh-app:')); assert.ok(page)
page.setDefaultTimeout(15000)
const checks = [], observations = [], errors = []; let failure = null, environment = null
const requests = []
page.on('response', response => { const url = response.url(); if (url.includes('/api/nidofy-ai-village/') && !url.includes('/asset/')) requests.push({ path: url.split('/api/nidofy-ai-village/')[1].split('?')[0], status: response.status(), at: Date.now() }) })
page.on('pageerror', error => errors.push(error.message))
const screenshot = async name => { await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))) }); const cdp = await page.context().newCDPSession(page); try { const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); await writeFile(join(evidence, `${name}.png`), Buffer.from(shot.data, 'base64')) } finally { await cdp.detach() } }
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
const travel = async target => { if (target === 'bookhouse') { await tab('Decor'); await direct('Furniture'); await direct('Go to AI Bookhouse') } else { await tab('Residents'); await direct('Return to courtyard') } await until(async () => (await world())?.region.active === target, 'Travel committed'); await ready(target); await closePanel() }
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
  } else if (mode === 'install') {
    const welcome = pages.find(item => item.url().includes('welcome.html'))
    if (welcome) { const add = welcome.getByRole('button', { name: 'Add API Key', exact: true }); if (await add.isVisible()) await add.click(); await welcome.getByRole('button', { name: 'Set up later', exact: true }).click() }
    if (!['performance', 'visibility', 'checkpoint'].includes(mode)) await startVideo()
    const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click()
    await direct('Plugins'); await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', artifact.file)); await direct('Install'); await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 90000 }); await direct('Enable now'); await screenshot('installed'); checks.push('Official plugin manager installed exact pinned 0.11 package into isolated profile')
  } else {
    const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village'); assert.equal((await json(join(installed, 'package.json'))).version, version)
    const unpack = join(work, 'pinned-v011-package'); await mkdir(unpack, { recursive: true }); execFileSync('tar', ['-xf', join(root, 'dist', artifact.file), '-C', unpack], { windowsHide: true })
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
      await pause(true); await writeFile(join(work, 'v011-checkpoint.json'), JSON.stringify({ artifact, world: await world() }, null, 2)); await screenshot('paused-checkpoint'); checks.push('Paused through UI and saved exact checkpoint before coordinated restart or window recovery')
    } else if (mode === 'restored') {
      const checkpoint = await json(join(work, 'v011-checkpoint.json')); assert.equal(checkpoint.artifact.sha256, sha256); assert.deepEqual(await world(), checkpoint.world); await screenshot('cold-restored'); checks.push('Full native process restart restored exact paused saved world and all 0.11 facts')
    } else if (mode === 'story') {
      assert.equal((await world()).schemaVersion, 12)
      await pause(false)
      if ((await world()).region.active !== 'courtyard') await travel('courtyard')
      const admit = async (id, name) => {
        if ([(await world()).actor, ...(await world()).companions].some(actor => actor.id === id)) return
        await tab('Residents'); await direct('All residents'); await direct('Manage residents')
        await page.getByRole('checkbox', { name: `Resident ${name}`, exact: true }).click()
        await until(async () => [(await world()).actor, ...(await world()).companions].some(actor => actor.id === id), `Admission ${id} committed`)
      }
      await admit('claude', 'Claude'); await admit('seedance', 'Seedance')
      if (!(await world()).neighborhood.memories.some(memory => memory.id === 'intro-seedance')) {
      await until(async () => (await world()).play.active?.definitionId === 'intro-seedance', 'Confirmed admission automatically starts introduction')
      for (const [stage, action] of ['Choose a lilting beat', 'Remember our first bar'].entries()) {
        await until(async () => await page.getByRole('button', { name: action, exact: true }).isEnabled().catch(() => false), `Real intro route stage ${stage}`, 180)
        const saved = await world(); observations.push({ kind: 'intro-stage', stage, event: saved.play.active, actors: [saved.actor, ...saved.companions] }); await screenshot(`intro-stage-${stage}`)
        await direct(action); await until(async () => stage === 1 ? (await world()).play.active === null : (await world()).play.active?.stage === stage + 1, `Intro stage ${stage} committed`)
      }
      assert.equal((await world()).neighborhood.memories.find(memory => memory.id === 'intro-seedance').count, 1); checks.push('Seedance initial admission, real movement and two player actions saved exactly one introduction')
      } else { assert.equal((await world()).neighborhood.memories.find(memory => memory.id === 'intro-seedance').count, 1); checks.push('Earlier native Seedance introduction remains once only; prior stage evidence retained separately') }
      await tab('Wishes')
      const allWishes = page.getByRole('button', { name: 'All wishes', exact: true }); if (await allWishes.isVisible()) await allWishes.click()
      const begin = page.getByRole('button', { name: 'Begin · A bookmark in the rice bowl', exact: true }); await until(() => begin.isEnabled(), 'Pair cooldown ends'); await begin.click()
      for (const [stage, action] of ['Ask about the unfinished line', 'Add the thought of saving lunch', 'Remember the bowl’s bookmark'].entries()) {
        await until(async () => await page.getByRole('button', { name: action, exact: true }).isEnabled().catch(() => false), `Real pair route stage ${stage}`, 180)
        const saved = await world(); observations.push({ kind: 'pair-stage', stage, event: saved.play.active, actors: [saved.actor, ...saved.companions] }); await screenshot(`pair-stage-${stage}`)
        await direct(action); await until(async () => stage === 2 ? (await world()).play.active === null : (await world()).play.active?.stage === stage + 1, `Pair stage ${stage} committed`)
      }
      const pairMemory = (await world()).neighborhood.memories.find(memory => memory.id === 'pair-bluewhale-claude'); assert.deepEqual([...pairMemory.participants].sort(), ['bluewhale', 'claude']); assert.equal(pairMemory.count, 1); checks.push('Authored Bluewhale/Claude three-stage story completed through native UI')
      await pause(true); await travel('bookhouse'); await pause(false); await tab('Wishes')
      await page.getByRole('combobox', { name: 'Reading companion', exact: true }).selectOption('seedance'); await direct('Explore the shelf puzzle')
      const puzzleReady = async stage => until(async () => { const active = (await world()).bookhouse.active; return active?.kind === 'puzzle' && active.stage === stage && active.phase === 'ready' }, `Real puzzle route stage ${stage}`, 180)
      await puzzleReady(0); await screenshot('puzzle-stage-0'); await direct('Bring the pages to the reading desk'); await puzzleReady(1); await screenshot('puzzle-stage-1')
      for (const [index, name] of ['Seed', 'Sprout', 'Flower'].entries()) {
        await page.getByRole('group', { name: 'Loose pages', exact: true }).getByRole('button', { name, exact: true }).click()
        await page.getByRole('group', { name: 'Page order', exact: true }).getByRole('button').nth(index).click()
        await until(async () => index === 2 ? (await world()).bookhouse.active?.stage === 2 : (await world()).bookhouse.active?.board[index] === index, `Puzzle item ${index} saved`)
      }
      await puzzleReady(2); await screenshot('puzzle-stage-2'); await direct('Remember arranging the pages'); await until(async () => (await world()).bookhouse.active === null, 'Puzzle completion saved')
      await pause(true); const completed = await world(); assert.deepEqual(completed.bookhouse.puzzleMemory.participants, ['bluewhale', 'seedance']); assert.equal(completed.bookhouse.puzzleMemory.count, 1); assert.equal(completed.bookhouse.memory, null); assert.equal(completed.bookhouse.keepsake, null); checks.push('Native shelf puzzle: three real locations, three UI page placements, independent memory and no fabricated bookmark')
      await tab('Journal'); await direct('Memories')
      const relations = page.getByRole('region', { name: 'Shared memory book', exact: true }); await relations.scrollIntoViewIfNeeded()
      assert.equal(await relations.getByRole('option').count(), 12); assert.equal(await relations.locator('details[data-relationship]').count(), 11)
      await relations.locator('[data-relationship="bluewhale/claude"] summary').click(); await screenshot('relationship-pair')
      await relations.locator('[data-relationship="bluewhale/seedance"] summary').click(); await screenshot('relationship-puzzle')
      await relations.getByRole('combobox').selectOption('gemini'); assert.equal(await relations.getByText('Source: the first saved bookhouse puzzle', { exact: true }).count(), 0); await screenshot('relationship-unseen')
      checks.push('Native relationship book: twelve residents, eleven collapsible pairs, accurate first puzzle cast and undiscovered resident')
      await closePanel(); await writeFile(join(work, 'v011-checkpoint.json'), JSON.stringify({ artifact, world: await world() }, null, 2)); await screenshot('completed-checkpoint')
    } else if (mode === 'visibility') {
      await pause(false); await closePanel(); const before = await world()
      await writeFile(join(evidence, 'armed.json'), JSON.stringify({ artifact, region: before.region.active, userPaused: before.userPaused }, null, 2)); console.log('VISIBILITY_ARMED: waiting for real native minimize by main-thread computer-use')
      await until(() => page.evaluate(() => document.visibilityState === 'hidden'), 'Waiting for real native minimize', 120)
      await page.waitForTimeout(1500); const hidden = await world(); assert.equal(await page.locator('.village-canvas iframe').count(), 0)
      await page.waitForTimeout(12000); assert.deepEqual(await world(), hidden); checks.push('Actual native hidden page: iframe released and unpaused world held exactly for 12 seconds')
      await writeFile(join(evidence, 'hidden-checkpoint.json'), JSON.stringify({ artifact, world: hidden }, null, 2)); console.log('HIDDEN_VERIFIED: ready for real native restore by main-thread computer-use')
      await until(() => page.evaluate(() => document.visibilityState === 'visible'), 'Waiting for real native restore', 180); await ready(hidden.region.active); await pause(true)
      const restored = await world(); assert.deepEqual(restored.neighborhood.memories, hidden.neighborhood.memories); assert.deepEqual(restored.bookhouse, hidden.bookhouse); checks.push('Actual native restore recreated frame in same region and preserved every story fact')
      await screenshot('native-window-restored'); await writeFile(join(work, 'v011-checkpoint.json'), JSON.stringify({ artifact, world: restored }, null, 2))
    } else if (mode === 'admission-race') {
      await pause(true); if ((await world()).region.active !== 'courtyard') await travel('courtyard')
      await page.evaluate(() => {
        const rows = []; const add = row => { if (rows.length < 3000) rows.push({ at: performance.now(), ...row }) }
        const receive = event => { const m = event.data; if (m?.channel === 'nidofy-ai-village' && ['ready','assets-ready','frame-resource-progress','first-frame-rendered','ready-to-render','failed'].includes(m.type)) add({ kind:'frame-message', type:m.type, token:m.token,bootAttemptId:m.bootAttemptId,assetRevision:m.assetRevision, viewRevision:m.viewRevision, sequence:m.sequence, progress:m.progress }) }
        window.addEventListener('message',receive)
        const click = event => { const element=event.target.closest?.('button'); if(element) add({kind:'click',type:event.type,name:element.getAttribute('aria-label')??element.textContent,selected:element.getAttribute('aria-selected'),inert:!!element.closest('[inert]')}) }; for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,click,true)
        const identities=new WeakMap();let identity=0; const nodeId=node=>{if(!node)return null;if(!identities.has(node))identities.set(node,++identity);return identities.get(node)}
        let previous=''; const observer=new MutationObserver(() => { const entry=document.querySelector('.village-entry-ui'), entrance=document.querySelector('.village-entrance'); const next=JSON.stringify({cardId:nodeId(document.querySelector('.village-card')),frameId:nodeId(document.querySelector('.village-canvas iframe')),entered:entry?.getAttribute('data-entered'),inert:entry?.hasAttribute('inert'),phase:entrance?.getAttribute('data-phase'),opacity:entrance?.style.opacity,progress:document.querySelector('[aria-label="Overall courtyard preparation"]')?.getAttribute('aria-valuenow'),drawer:document.querySelector('.village-management')?.getAttribute('data-snap')}); if(next!==previous) { previous=next;add({kind:'ui',state:JSON.parse(next)}) } }); observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-entered','inert','data-phase','style','aria-valuenow','data-snap']})
        window.__v011NativeObservation={rows,stop(){observer.disconnect();window.removeEventListener('message',receive);for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,click,true)}}
      })
      const manage = async () => { await tab('Residents'); await direct('All residents'); await direct('Manage residents') }
      for (let cycle=0;cycle<3;cycle++) {
        await manage(); await page.getByRole('checkbox',{name:'Resident Grok',exact:true}).click(); await until(async()=>!(await world()).companions.some(actor=>actor.id==='grok'),'Grok removal committed'); await ready('courtyard'); await screenshot(`removed-${cycle}`)
        await manage(); await page.getByRole('checkbox',{name:'Resident Grok',exact:true}).click(); await until(async()=>(await world()).companions.some(actor=>actor.id==='grok'),'Grok admission committed'); observations.push({kind:'admitted',cycle,tick:(await world()).ticks});
        await closePanel(); const target=page.getByRole('tab',{name:'Residents',exact:true}); await target.click(); await until(async()=>await target.getAttribute('aria-selected')==='true','Post-admission Residents tab opened',30); await ready('courtyard'); await screenshot(`readmitted-${cycle}`)
      }
      checks.push('Three paused Grok removal/readmission cycles with immediate post-save navigation completed')
    } else if (mode === 'performance') {
      await pause(true); if ((await world()).region.active !== 'courtyard') await travel('courtyard')
      for (const [id, name] of [['claude', 'Claude'], ['gemini', 'Gemini'], ['gpt', 'GPT'], ['grok', 'Grok'], ['kimi', 'Kimi']]) {
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
        assert.ok(result.after.textures <= 128); assert.ok(result.after.paintSampleCount <= 600); assert.ok(result.fps > 20 && result.fps <= 35)
        await pause(true); const before = await world(); await hud('Close courtyard'); await page.locator('.village-canvas iframe').waitFor({ state: 'detached' }); await page.waitForTimeout(2000); assert.deepEqual(await world(), before); await direct('Open AI Village'); await ready(target); assert.deepEqual(await world(), before); checks.push(`${target}: original 20–35 FPS gate and real close/reopen passed`)
      }
      await parentSession.detach(); await screenshot('performance-restored'); await writeFile(join(work, 'v011-checkpoint.json'), JSON.stringify({ artifact, world: await world() }, null, 2))
    } else throw Error(`Mode not implemented: ${mode}`)
  }
} catch (error) { failure = String(error.stack ?? error); observations.push({kind:'before-failure-screenshot',ui:await page.evaluate(()=>({entered:document.querySelector('.village-entry-ui')?.getAttribute('data-entered'),entrance:document.querySelector('.village-entrance')?.outerHTML})).catch(()=>null)}); await screenshot('failure').catch(() => {}); observations.push({ buttons: await page.getByRole('button').allTextContents().catch(() => []) }) }
finally {
  if(mode==='admission-race') { const trace=await page.evaluate(()=>{const observer=window.__v011NativeObservation;observer?.stop();return observer?.rows??[]}).catch(()=>[]);await writeFile(join(evidence,'frame-ui-observation.json'),JSON.stringify(trace,null,2)) }
  if (recorder) { try { observations.push({ video: await recorder() }) } catch (error) { observations.push({ videoFailure: String(error) }); failure ??= String(error) } }
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', mode, artifact, scriptSha, environment, checks, errors, observations, requests, failure, world: mode === 'inspect' ? null : await world().catch(() => null) }, null, 2) + '\n')
  await protocol.detach().catch(() => {}); console.log(JSON.stringify({ status: failure ? 'FAIL' : 'PASS', mode, evidence, checks, failure })); process.exit(failure ? 1 : 0)
}

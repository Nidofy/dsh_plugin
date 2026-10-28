/** World15 qualification on the actual official rc.3 Desktop. No model/session content is copied or submitted. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join, relative, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..'), work = join(root, '.build/ai-village-afternoon-desktop'), old = join(root, '.build/ai-village-rc3-desktop/home/profiles/desktop/nidofy-ai-village')
const [mode, label] = process.argv.slice(2)
assert.ok(['prepare', 'inspect', 'install', 'reinstall', 'cleanup-failed-upgrade', 'upgrade', 'upgraded', 'disable', 'visual', 'play', 'lifecycle', 'restored', 'uninstall'].includes(mode)); assert.match(label ?? '', /^[a-z0-9][a-z0-9-]{0,60}$/)
const evidence = join(work, 'evidence', label), json = async p => JSON.parse(await readFile(p, 'utf8')), hash = b => createHash('sha256').update(b).digest('hex')
await mkdir(join(work, 'evidence'), { recursive: true }); await mkdir(evidence)
const runnerBytes=await readFile(new URL(import.meta.url));await writeFile(join(evidence,'runner.mjs'),runnerBytes,{flag:'wx'})
const checks = [], observations = [], errors = [], requests = [], notCovered = ['Physical sleep/minimize, IME candidate selection and long-duration hardware performance', 'Unknown-ACK fault injection belongs to the separate authenticated browser and runtime suites', 'Git/Live2D coordination belongs to A6; these packages are not installed here']
let page, browser, protocol, artifact, launch, failure
const bounded=async(p,ms)=>{let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('BOUNDED_NATIVE_TIMEOUT')),ms)})])}finally{clearTimeout(t)}}
const record = v => { checks.push(v); console.log('PASS ' + v) }
const until = async (fn, message, seconds = 30) => { const stop = Date.now() + seconds * 1000; while (Date.now() < stop) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)) } throw Error('TIMEOUT: ' + message) }
const state = () => page.evaluate(async () => { const r = await fetch('/api/nidofy-ai-village/state', { signal: AbortSignal.timeout(10000) }); return r.ok ? r.json() : null })
const world = async () => (await state())?.saved?.world ?? null
const direct = name => page.getByRole('button', { name, exact: true }).click()
const members = w => [w.actor, ...w.companions]
async function hashes(dir) { const r = {}; for (const e of await readdir(dir, { recursive: true, withFileTypes: true })) if (e.isFile() && !e.name.endsWith('.lock')) { const name = relative(dir, join(e.parentPath, e.name)); r[name] = hash(await readFile(join(dir, name))) } return r }
async function persisted() { const dir = join(work, 'home/profiles/desktop/nidofy-ai-village'), pointer = await json(join(dir, 'current.json')), bytes = await readFile(join(dir, 'snapshots', pointer.snapshot)); assert.equal(hash(bytes), pointer.hash); return { pointer, saved: JSON.parse(bytes) } }
async function screenshot(name) {
  let session
  try { session = await page.context().newCDPSession(page); const r = await bounded(session.send('Page.captureScreenshot', { format: 'png', fromSurface: true }),10000); await writeFile(join(evidence, name + '.png'), Buffer.from(r.data, 'base64')) }
  catch (e) { observations.push({ screenshot: name, status: 'NOT_CAPTURED', reason: String(e) }) }
  finally { await bounded(session?.detach(),5000).catch(() => {}) }
}
const frame = async () => (await page.locator('.village-canvas iframe').elementHandle())?.contentFrame()
const metrics = async () => (await frame())?.evaluate(() => window.__sceneMetrics?.())
const ready = region => until(async () => { const m = await metrics(); return m?.region === region && m.frames > 0 && await page.locator('.village-entry-ui[data-entered="true"]').count() === 1 }, 'actual first frame ' + region, 60)
const closePanel = async () => { const b = page.getByRole('button', { name: 'Close panel', exact: true }); if (await b.isVisible()) await b.click() }
const hud = async name => { const b = page.getByRole('button', { name, exact: true }); if (!await b.isVisible()) await page.locator('.village-card').getByRole('button', { name: 'More', exact: true }).click(); await b.click() }
async function pause(value = true) { await closePanel(); if ((await world()).userPaused !== value) { await hud(value ? 'Pause' : 'Resume'); await until(async () => (await world()).userPaused === value, 'pause preference committed') } }
async function open() {
  await page.getByRole('button', { name: 'Open AI Village', exact: true }).waitFor()
  if (!await page.locator('.village-card').count()) await direct('Open AI Village')
  const enter = page.getByRole('button', { name: 'Open the doors and enter again', exact: true }); if (await enter.isVisible()) await enter.click()
  await ready((await until(world, 'durable world')).region.active)
}
async function newBlank() { await page.getByRole('button', { name: /^New session$/i }).first().click(); await page.locator('[data-composer-input][contenteditable="true"]').waitFor() }
async function travel(region) {
  await pause(); const before = await world(); if (before.region.active === region) return
  await direct('Community map'); await page.locator(`.village-map-places [data-place="${region}"]`).click(); assert.equal(await page.locator('.village-map-travel').isDisabled(), false)
  await page.locator('.village-map-travel').click(); await until(async () => (await world()).region.active === region, 'travel commit'); await ready(region); await closePanel()
  const after = await world(); assert.equal(after.ticks, before.ticks); assert.equal(after.rng, before.rng); assert.deepEqual(after.afternoon, before.afternoon)
  assert.deepEqual(members(after).map(a => a.id).sort(), members(before).map(a => a.id).sort()); observations.push({ region, frame: await metrics() }); await screenshot(region)
}
async function identify() {
  const dir = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village'), manifest = await json(join(dir, 'package.json'))
  assert.equal(manifest.version, artifact.version); assert.equal(manifest.engines.dsh, '0.2.1-rc.3')
  const unpack = join(evidence, 'unpacked'); await mkdir(unpack); await tar.x({ file: join(root, 'dist', artifact.file), cwd: unpack })
  let files = 0
  for (const e of await readdir(join(unpack, 'package'), { recursive: true, withFileTypes: true })) if (e.isFile()) { const name = relative(join(unpack, 'package'), join(e.parentPath, e.name)); assert.equal(hash(await readFile(join(dir, name))), hash(await readFile(join(unpack, 'package', name))), 'installed bytes ' + name); files++ }
  observations.push({ installedFiles: files, buildIdentity: await json(join(dir, 'lib/build-identity.json')) }); record('Official manager installed exact ' + files + ' package files from pinned tgz')
}
async function stage(n) {
  return until(async () => { const w = await world(), e = w.afternoon.active; assert.ok(e, 'Event must remain active'); if (e.stage !== n || e.phase !== 'ready') return false
    e.participants.forEach((id, i) => { const a = members(w).find(a => a.id === id); assert.ok(Math.hypot(a.position.x - e.targets[i].x, a.position.y - e.targets[i].y) < .1) }); return e
  }, 'real path/stay stage ' + n, 70)
}
async function action(name) {
  const before = (await world()).afternoon.active, button = page.locator('.village-afternoon').getByRole('button', { name, exact: true })
  await until(() => button.isEnabled(), 'enabled action ' + name, 10); await button.click()
  await until(async () => { const e = (await world()).afternoon.active; return !e || e.serial === before.serial + 1 }, 'action committed ' + name)
}
async function stories() {
  await travel('tea-square')
  for (const id of ['tea-bookmark', 'reflection-shapes']) {
    const title = id === 'tea-bookmark' ? 'A tea-scented bookmark' : 'Shapes in reflection'
    await pause(false); await page.getByRole('tab', { name: 'Residents', exact: true }).click()
    const before = await world(); assert.equal(before.afternoon.memories.some(m => m.storyId === id), false)
    await direct('Start: ' + title); await until(async () => (await world()).afternoon.active?.storyId === id, 'story start')
    const first = await stage(0); observations.push({ story: id, first, dialogue: await page.locator('.village-afternoon').innerText(), frame: await metrics() }); await screenshot(id + '-ready')
    if (id === 'tea-bookmark') {
      await action('Listen to the note'); assert.equal(await page.getByRole('button', { name: 'Press the bookmark gently', exact: true }).isDisabled(), true)
      await action('Fold a wave'); assert.equal((await world()).afternoon.active.selection, 'wave'); await action('Press the bookmark gently')
    } else {
      await action('Look from the right'); await action('Try the original shape'); assert.equal((await world()).afternoon.active.attempts, 1); assert.equal((await world()).afternoon.active.stage, 1)
      await action('Match the mirrored shape')
    }
    await stage(2); observations.push({ story: id, closingFrame: await metrics() }); await screenshot(id + '-closing'); await action('Remember this little story'); await pause()
    const after = await world(), memory = after.afternoon.memories.find(m => m.storyId === id); assert.ok(memory); assert.equal(memory.count, 1); assert.equal(memory.eventId, first.id); assert.equal(after.afternoon.keepsakes[id], 'message-tree')
    observations.push({ memory, saved: await persisted(), frame: await metrics() }); await screenshot(id + '-remembered'); record(id + ' completed through real official UI, real paths, distinct effective choices and one first reward')
  }
}
try {
  if (mode === 'prepare') {
    const target = join(work, 'home/profiles/desktop/nidofy-ai-village'); assert.equal(await stat(join(work, 'home')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e }), false, 'Never overwrite an existing QA profile')
    const pointer = await json(join(old, 'current.json')), bytes = await readFile(join(old, 'snapshots', pointer.snapshot)), saved = JSON.parse(bytes)
    assert.equal(pointer.revision, 147); assert.equal(hash(bytes), pointer.hash); assert.equal(saved.world.schemaVersion, 14); assert.equal(saved.world.userPaused, true)
    const files = await hashes(old); await cp(old, target, { recursive: true, force: false, errorOnExist: true, filter: p => !p.endsWith('.lock') }); assert.deepEqual(await hashes(target), files); assert.deepEqual(await hashes(old), files)
    await writeFile(join(work, 'legacy-checkpoint.json'), JSON.stringify({ source: old, files, pointer, saved, copied: 'game-only; no sessions, credentials, account settings or electron userData' }, null, 2), { flag: 'wx' })
    const profile = dirname(target)
    await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } } }, null, 2), { flag: 'wx' })
    await writeFile(join(profile, 'cordis.yml'), '[]\n', { flag: 'wx' }); await writeFile(join(profile, 'cordis.patch.yml'), '[]\n', { flag: 'wx' })
    const location = await json(join(root, '.build/ai-village-rc3-desktop/carrier-location.json'))
    assert.equal(hash(await readFile(join(dirname(location.carrier), 'resources/app.asar'))), '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0')
    await writeFile(join(work, 'carrier-location.json'), JSON.stringify(location, null, 2), { flag: 'wx' }); record('Copied only frozen A6 r147 game bytes and created empty independent profile; original A6 untouched')
  } else {
    launch = await json(join(work, 'launch.json')); assert.equal(launch.port, 18784); assert.equal(launch.windowStyle, 'Hidden'); assert.equal(launch.version, '0.2.1-rc.3'); assert.equal(launch.dshHome, join(work, 'home').replaceAll('\\', '/'))
    const identity = JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(launch.pid)}' | Select-Object ExecutablePath,CommandLine,@{Name='Created';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }))
    assert.equal(identity.ExecutablePath.toLowerCase(), launch.carrier.toLowerCase()); assert.equal(identity.Created, launch.processCreatedAt); assert.ok(identity.CommandLine.includes('--user-data-dir=' + join(work, 'electron-data').replaceAll('\\', '/'))); assert.ok(identity.CommandLine.includes('--remote-debugging-port=18784'))
    const expected = await json(join(work, 'carrier-location.json')); assert.equal(launch.carrier, expected.carrier); assert.equal(hash(await readFile(join(dirname(expected.carrier), 'resources/app.asar'))), '04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0')
    if (mode !== 'inspect') { const version = process.env.AI_VILLAGE_EXPECTED_VERSION, sha256 = process.env.AI_VILLAGE_EXPECTED_SHA; assert.match(version ?? '', /^0\.14\.\d+(?:-[a-z0-9.]+)?$/); assert.match(sha256 ?? '', /^[a-f0-9]{64}$/); artifact = { version, sha256, file: `nidofy-dsh-ai-village-${version}.tgz` }; assert.equal(hash(await readFile(join(root, 'dist', artifact.file))), sha256) }
    const { source } = await json(join(root, '.local/environment.json')), store = join(source, 'node_modules/.pnpm'), name = (await readdir(store)).find(n => n.startsWith('playwright@1.61.'))
    const { chromium } = await import(pathToFileURL(join(store, name, 'node_modules/playwright/index.mjs')).href)
    browser = await chromium.connectOverCDP('http://127.0.0.1:18784', { timeout: 15000 }); protocol = await browser.newBrowserCDPSession()
    const pages = browser.contexts().flatMap(c => c.pages()); page = pages.find(p => p.url().startsWith('dsh-app:')); assert.ok(page); page.setDefaultTimeout(20000)
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('/api/')) requests.push({ path: r.url().split('/api/')[1].split('?')[0], method: r.method() }) })
    observations.push({ browser: await protocol.send('Browser.getVersion'), display: await page.evaluate(() => ({ visibility: document.visibilityState, dpr: devicePixelRatio, width: innerWidth, height: innerHeight })) })
    if (mode === 'inspect') { observations.push({ buttons: await page.getByRole('button').allTextContents(), text: (await page.locator('body').innerText()).slice(0, 14000) }); await screenshot('inspect'); record('Read-only inspected exact new afternoon Desktop process') }
    else {
      const welcome = pages.find(p => p.url().includes('welcome.html')); if (welcome) { const add = welcome.getByRole('button', { name: 'Add API Key', exact: true }); if (await add.isVisible()) await add.click(); await welcome.getByRole('button', { name: 'Set up later', exact: true }).click() }
      const close = page.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click()
      if (mode === 'upgrade') {
        const before=(await state())?.saved??(await persisted()).saved;assert.ok(before.world.userPaused)
        await direct('Plugins');const viewInstall=page.getByRole('button',{name:'View installation',exact:true});if(await viewInstall.isVisible())await viewInstall.click()
        const retry=page.getByRole('button',{name:'Retry',exact:true});if(await retry.isVisible()){assert.ok((await page.locator('body').innerText()).includes(artifact.file));await retry.click()}else{await direct('Add plugin');await page.getByRole('textbox',{name:'Package name or address'}).fill(join(root,'dist',artifact.file));await direct('Install')}
        await until(async()=>(await json(join(work,'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village/package.json'))).version===artifact.version,'official upgrade',120)
        const enable=page.getByRole('button',{name:'Enable now',exact:true});if(await enable.isVisible())await enable.click();else{const toggle=page.getByLabel('Enable @nidofy/dsh-ai-village',{exact:true});if(await toggle.isVisible()&&await toggle.getAttribute('aria-checked')==='false')await toggle.click()}
        await identify();await newBlank();await open();await pause();assert.deepEqual((await state()).saved,before)
        record('Official package replacement preserves exact two-story world, revision and operation');await screenshot('upgraded')
      } else if (mode === 'install'||mode==='reinstall') {
        const retainedInstall=mode==='reinstall'?await persisted():null
        await direct('Plugins'); await direct('Add plugin'); await page.getByRole('textbox', { name: 'Package name or address' }).fill(join(root, 'dist', artifact.file)); await direct('Install')
        await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 120000 }); await direct('Enable now'); await identify(); await screenshot('installed')
        if(retainedInstall){await newBlank();await open();await pause();assert.deepEqual((await state()).saved,retainedInstall.saved);record('Official reinstall retains exact saved world, two story memories and revision')}else{
        const legacy = await json(join(work, 'legacy-checkpoint.json')); await newBlank(); await open(); await pause(); const w = await world(), { afternoon, community, ...rest } = w
        assert.equal(w.schemaVersion, 15); assert.deepEqual({ ...rest, schemaVersion: 14, contentRevision: 10 }, legacy.saved.world); assert.equal(afternoon.active, null); assert.deepEqual(afternoon.memories, []); assert.equal(community.active, null)
        assert.equal(hash(await readFile(join(work, 'home/profiles/desktop/nidofy-ai-village/snapshots', legacy.pointer.snapshot))), legacy.pointer.hash)
        record('Actual Host/Client migrated paused world14 to15 with exact prior fields/poses/clock/RNG and protected original r147 snapshot'); await screenshot('migrated')}
      } else {
        if(mode!=='disable'&&mode!=='cleanup-failed-upgrade')await identify()
        if(mode==='disable'){
          const retained=await persisted();await direct('Plugins');await writeFile(join(evidence,'manager-before-disable.txt'),await page.locator('body').innerText())
          const toggle=page.getByLabel('Enable @nidofy/dsh-ai-village',{exact:true});if(await toggle.getAttribute('aria-checked')==='true')await toggle.click()
          await until(async()=>(await state())===null,'disabled Host');assert.deepEqual(await persisted(),retained);observations.push({retained});record('Official disable preserves exact game data before process restart and package retry')
        } else if (mode === 'uninstall'||mode==='cleanup-failed-upgrade') {
          const retained = await persisted(); await direct('Plugins'); await direct('View @nidofy/dsh-ai-village'); await direct('Uninstall @nidofy/dsh-ai-village'); await direct('Uninstall')
          await until(async () => (await state()) === null, 'Host removed', 60); await newBlank(); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 0); assert.equal(await page.locator('.village-canvas iframe').count(), 0); assert.deepEqual(await persisted(), retained)
          observations.push({ retained }); record('Official uninstall removes Host/Client and retains exact current save including both new memories'); await screenshot('uninstalled')
        } else {
          await newBlank(); await open(); await pause()
          if(mode==='upgraded'){
            const prior=await json(join(work,'native-checkpoint.json'));assert.deepEqual((await state()).saved,prior.saved)
            record('Installed upgraded package cold UI retains exact prior revision, operation and two story memories');await screenshot('upgraded-restored')
          }
          if(mode==='visual'){
            await travel('tea-square');const memories=structuredClone((await world()).afternoon.memories)
            for(const id of ['tea-bookmark','reflection-shapes']){
              await pause(false);await page.getByRole('tab',{name:'Residents',exact:true}).click()
              await direct('Replay: '+(id==='tea-bookmark'?'A tea-scented bookmark':'Shapes in reflection'));await stage(0)
              await action(id==='tea-bookmark'?'Listen to the note':'Look from the left')
              if(id==='tea-bookmark')await action('Fold a leaf')
              await pause();await hud('Courtyard settings');await direct('Appearance and display');if(await page.getByLabel('Show speech bubbles',{exact:true}).isChecked())await page.getByLabel('Show speech bubbles',{exact:true}).click();await until(async()=>!await page.getByLabel('Show speech bubbles',{exact:true}).isChecked(),'speech preference off');await closePanel()
              await until(async()=>(await metrics()).afternoon.story===id,'prop frame');await screenshot(id+'-unoccluded-prop');observations.push({story:id,world:await world(),frame:await metrics()})
              await page.getByRole('tab',{name:'Residents',exact:true}).click();await direct('Cancel little story');await until(async()=>!(await world()).afternoon.active,'cancel visual replay');assert.deepEqual((await world()).afternoon.memories,memories)
            }
            await closePanel();await screenshot('two-visible-keepsakes');await hud('Courtyard settings');await direct('Appearance and display');if(!await page.getByLabel('Show speech bubbles',{exact:true}).isChecked())await page.getByLabel('Show speech bubbles',{exact:true}).click();await until(async()=>await page.getByLabel('Show speech bubbles',{exact:true}).isChecked(),'speech preference on');await closePanel()
            await writeFile(join(work,'native-checkpoint.json'),JSON.stringify({pid:launch.pid,artifact,saved:(await state()).saved},null,2))
            record('Both story props inspected on real paused canvas without speech overlays; cancelled replays leave first memories unchanged')
          }
          if (mode === 'play') { await stories(); for (const id of ['courtyard', 'bookhouse', 'courtyard', 'tea-square', 'courtyard']) await travel(id); record('All three actual scene frames restore through public map with same two memories and one paused clock'); await writeFile(join(work, 'native-checkpoint.json'), JSON.stringify({ pid: launch.pid, artifact, saved: (await state()).saved }, null, 2)) }
          if (mode === 'lifecycle') {
            const before = (await state()).saved
            for (let i = 0; i < 2; i++) { await direct('Plugins'); const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true }); await toggle.click(); await until(async () => await toggle.getAttribute('aria-checked') === 'false' && await toggle.isEnabled() && (await state()) === null, 'disabled', 60)
              await newBlank(); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 0); assert.equal(await page.locator('.village-canvas iframe').count(), 0)
              await direct('Plugins'); await page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true }).click(); await until(async () => (await state())?.saved, 're-enabled', 60); await newBlank(); await open(); assert.deepEqual((await state()).saved, before); assert.equal(await page.locator('[data-nidofy-header-launcher="ai-village"]').count(), 1)
            }
            await writeFile(join(work, 'native-checkpoint.json'), JSON.stringify({ pid: launch.pid, artifact, saved: before }, null, 2)); record('Two actual disable/enable cycles revoke resources and restore one launcher/owner with exact persisted state'); await screenshot('lifecycle')
          }
          if (mode === 'restored') { const expected = await json(join(work, 'native-checkpoint.json')); assert.notEqual(expected.pid, launch.pid); assert.equal(expected.artifact.sha256, artifact.sha256); assert.deepEqual((await state()).saved, expected.saved); observations.push({ priorPid: expected.pid, currentPid: launch.pid, saved: (await state()).saved, frame: await metrics() }); record('Distinct official Desktop process cold-restored exact revision/operation/world and actual first frame'); await screenshot('cold-restored') }
        }
      }
    }
    assert.deepEqual(errors, [])
    assert.equal(requests.some(r => /(?:completion|generate|turn\/start|chat\/send)/i.test(r.path)), false, 'No model generation request')
  }
  const baseline = await json(join(work, 'legacy-checkpoint.json')); assert.deepEqual(await hashes(old), baseline.files); record('Original A6 game/profile evidence remains byte-identical')
} catch (e) { failure = String(e.stack ?? e); if (page) await screenshot('failed').catch(() => {}) }
finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: failure ? 'FAIL' : 'PASS', mode, artifact, launch, checks, observations, errors, requests, notCovered, failure, runnerSha256: hash(runnerBytes) }, null, 2) + '\n')
  await protocol?.detach().catch(() => {}); console.log(JSON.stringify({ status: failure ? 'FAIL' : 'PASS', evidence, checks, failure })); process.exit(failure ? 1 : 0)
}

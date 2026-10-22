import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..'), work = join(root, '.build/ai-village-v0.6-desktop'), qa = join(root, '.build/ai-village-v0.6-qa/desktop')
await mkdir(qa, { recursive: true })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18759')
const pages = browser.contexts().flatMap(c => c.pages()), page = pages.find(p => p.url().startsWith('dsh-app:'))
assert.ok(page, 'Dedicated 0.6 Desktop required')
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
assert.equal(artifact.version, '0.6.0')
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
  console.log('Official plugin manager installed and enabled AI Village 0.6.0 in dedicated profile')
}
if (mode === 'inspect' || mode === 'install') {
  console.log((await page.locator('body').innerText()).slice(0, 6000))
  await capture('desktop-' + mode + '.png')
  process.exit(0)
}
const installed = join(work, 'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village')
assert.equal(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).version, '0.6.0')
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

const album = () => page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/album');return r.ok?r.json():null})
if(mode==='restored'){
 const expected=JSON.parse(await readFile(join(work,'expected-v06.json'),'utf8'))
 assert.deepEqual(await world(),expected.world);assert.deepEqual((await album()).saved,expected.album)
 await page.getByRole('tab',{name:'Journal',exact:true}).click();await page.getByText('Native 0.6 memory',{exact:true}).first().waitFor()
 await capture('desktop-cold-restored.png')
 await writeFile(join(qa,'restart-validation.json'),JSON.stringify({passed:true,artifact,exactWorld:true,exactAlbum:true,schema:6,screenshotIssues},null,2))
 console.log('Actual Desktop cold restart preserved schema6 world and PNG album');process.exit(0)
}
assert.ok(['check','finish'].includes(mode))
if(mode==='check'){
 const expand=page.getByRole('button',{name:'Expand courtyard',exact:true});if(await expand.count())await expand.click()
 if((await world()).home.revision>0){await page.getByRole('tab',{name:'Decor',exact:true}).click();await page.getByRole('button',{name:'Arrange my courtyard',exact:true}).click();await page.getByRole('button',{name:'Afternoon courtyard · template',exact:true}).click();await page.getByLabel('Environment',{exact:true}).selectOption('afternoon');await page.getByRole('button',{name:'Confirm my arrangement',exact:true}).click();await until(async()=>(await world()).home.positions.eat===0,'Reset test layout',30)}
 const current=await world();assert.equal(current.schemaVersion,6);assert.ok(current.neighborhood.memories.some(m=>m.id==='hello'),'migrated 0.5 memory');assert.ok((await album()).saved.world.photos.some(p=>p.title==='Native 0.5 memory'),'preserved 0.5 photo')
 if(!current.userPaused){await page.getByRole('button',{name:'Pause',exact:true}).click();await until(async()=>(await world())?.userPaused,'Pause did not save',30)}
 await page.getByRole('tab',{name:'Decor',exact:true}).click();await page.getByRole('button',{name:'Arrange my courtyard',exact:true}).click()
 await page.getByRole('button',{name:'Reading corner · template',exact:true}).click()
 await page.getByLabel('Environment',{exact:true}).selectOption('twilight');await page.getByLabel('Resident accessory',{exact:true}).selectOption('ribbon')
 await page.getByRole('button',{name:'Cancel my arrangement',exact:true}).click();assert.deepEqual(await world(),current)
 await page.getByRole('button',{name:'Arrange my courtyard',exact:true}).click();await page.getByRole('button',{name:'Reading corner · template',exact:true}).click()
 await page.getByLabel('Environment',{exact:true}).selectOption('twilight');await page.getByLabel('Resident accessory',{exact:true}).selectOption('ribbon');await page.getByRole('button',{name:'Confirm my arrangement',exact:true}).click()
 await until(async()=>(await world())?.home.environment==='twilight','Arrangement did not save',30)
 await frame.waitForFunction(()=>window.__sceneMetrics().geometry.find(h=>h.id==='eat').anchor.x===121)
 await page.getByRole('button',{name:'Photo mode',exact:true}).click()
 await page.getByRole('button',{name:'Take photo',exact:true}).click();await page.getByRole('img',{name:'Photo preview',exact:true}).waitFor({timeout:30000})
 const albumCount=(await album()).saved.world.photos.length
 await page.getByLabel('Photo title',{exact:true}).fill('Native 0.6 memory');await page.getByRole('button',{name:'Save to album',exact:true}).click()
 await until(async()=>(await album())?.saved?.world.photos.length===albumCount+1,'Native album write failed',30)
 await page.getByRole('button',{name:'Exit photo mode',exact:true}).click()
}
const snapshot=await world(),albumState=(await album()).saved
assert.equal(snapshot.schemaVersion,6);assert.equal(snapshot.userPaused,true);assert.equal(snapshot.neighborhood.layout,'reading');assert.ok(snapshot.neighborhood.memories.some(m=>m.id==='hello'));assert.ok(albumState.world.photos.length>=2);assert.equal(snapshot.home.positions.eat,1);assert.equal(snapshot.home.environment,'twilight')
const photo=albumState.world.photos.findLast(p=>p.title==='Native 0.6 memory'),response=await page.evaluate(async id=>{const r=await fetch('/api/nidofy-ai-village/photos/'+id);return [...new Uint8Array(await r.arrayBuffer())]},photo.id)
const png=Buffer.from(response);assert.equal(createHash('sha256').update(png).digest('hex'),photo.hash);await writeFile(join(qa,'native-postcard.png'),png)
await writeFile(join(work,'expected-v06.json'),JSON.stringify({world:snapshot,album:albumState},null,2))
await capture('desktop-journal.png')
assert.deepEqual(errors,[])
await writeFile(join(qa,'validation.json'),JSON.stringify({passed:true,artifact,checks:['official plugin-manager install','installed bytes match','schema5 migration and preserved memory/photo','cancelled draft without write','confirmed moved furniture/theme/accessory','actual renderer PNG and album','paused state for cold restart'],photo,errors,screenshotIssues},null,2))
console.log('Actual installed Desktop 0.6 greeting, layout and PNG album passed; ready for cold restart')
process.exit(0)

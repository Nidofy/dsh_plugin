import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/ai-village-phase4'), qa = join(root, 'packages/ai-village/art/QA/ui-v1/visual')
await mkdir(qa, { recursive: true })
const { runPreview } = await import('./ai-village-phase4-browser.mjs')
await runPreview({ root, pkg: join(root, 'packages/ai-village'), out, buildOnly: true })
const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href), plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
const h = await harness({ profile: await mkdtemp(join(root, '.build/ui-v1-browser-profile-')), plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
const browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), args: ['--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(root, '.build/ui-v1-video'),size:{width:960,height:640} } }), page = await context.newPage(), errors = [], external = [], checks = []
page.on('pageerror', e => errors.push(e.message))
await context.route('**/*', route => {
  if (route.request().url().startsWith(h.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
  external.push(route.request().url()); return route.abort()
})
const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
const ready = () => page.waitForFunction(() => window.__villageHostFixture.inspect().frameReady)
const click = name => page.getByRole('button', { name, exact: true }).click()
const frame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))

const build={version:'0.6.2',head:'2cab99ab8b78de49b3c444ee4df388bf7a246634',dirty:true,clientSHA256:createHash('sha256').update(await readFile(join(out,'lib/client.js'))).digest('hex'),frameSHA256:createHash('sha256').update(await readFile(join(out,'lib/frame.js'))).digest('hex')}
const metadata = [], captures = []
const shot = async name => { const box=await page.locator('.village-card').boundingBox(); await page.locator('.village-card img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{})))); await page.screenshot({path:join(qa,name+'.png')}); metadata.push({name,css:box,dpr:1,kind:'RUNTIME',build,theme:(await inspect()).preferences.theme,language:(await inspect()).preferences.language,state:(await inspect()).presentation}) }
const tab = name => page.getByRole('tab',{name,exact:true}).click()
const system = async name => { if (!await page.getByRole('button',{name,exact:true}).isVisible()) await click('更多'); await click(name) }
const settled = () => page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.preferencesSaving && !s.error && !s.reasons.includes('commit-pending') && s.saveReceipt.status !== 'pending'})
const frameIdentity = () => page.locator('.village-canvas iframe').evaluate(el => { el.dataset.identity ??= 'same-frame';return el.dataset.identity })
const resize = async (width,height) => { await page.setViewportSize({width:width+224,height:height+236}); await page.waitForFunction(w=>document.querySelector('.village-card')?.getBoundingClientRect().width===w,width); const box=await page.locator('.village-card').boundingBox(); if(box.height!==height)await page.setViewportSize({width:width+224,height:height+236+height-box.height});await page.waitForFunction(h=>document.querySelector('.village-card')?.getBoundingClientRect().height===h,height);await ready() }
try {
  await page.goto(h.entry); await click('打开 AI 小院'); await ready(); await click('暂停'); await page.evaluate(() => window.__villageHostFixture.flush());await settled()
  assert.equal((await inspect()).preferences.schemaVersion,2);assert.equal((await inspect()).world.schemaVersion,6)
  await page.getByLabel('消息输入',{exact:true}).fill('UI-v1 unsent draft — 保留输入')
  await shot('340x720-light-zh-default')
  const initial=await inspect(), identity=await frameIdentity()
  for (const name of ['居民','心愿','布置','手账']) { await tab(name);await shot('340x720-'+({'居民':'residents','心愿':'wishes','布置':'decor','手账':'journal'}[name]));await tab(name) }
  for(let i=0;i<50;i++){await tab('居民');await tab('居民');assert.equal(await frameIdentity(),identity)}
  assert.deepEqual((await inspect()).world,initial.world);checks.push('50 drawer open/close cycles preserve frame, frozen world and projection')
  await page.getByRole('button',{name:/^消息，/}).click();await shot('340x720-notifications');await page.getByRole('button',{name:'查看手账',exact:true}).press('Escape');await system('小院设置');await shot('340x720-settings')
  await page.getByLabel('界面主题',{exact:true}).selectOption('dark');await settled();await click('完成');await shot('340x720-dark-zh-default')
  await system('小院设置');await page.getByLabel('减少透明效果',{exact:true}).click();await settled();await page.getByLabel('减少动态',{exact:true}).click();await settled();await click('完成')
  assert.equal((await inspect()).preferences.reducedTransparency,true)
  await system('视角');await click('放大');await click('放大');assert.ok((await inspect()).presentation.camera.zoom>1);await page.getByRole('button',{name:'恢复全景',exact:true}).click();assert.equal((await inspect()).presentation.camera.zoom,1)
  await page.getByRole('button',{name:'恢复全景',exact:true}).press('Escape')
  await tab('居民');await click('安排入住');await click('全员入住');await settled();await ready();assert.equal((await inspect()).world.companions.length,6);await shot('340x720-seven-residents');await click('仅留当前');await settled();await ready()
  await tab('布置');await click('开始布置');assert.ok((await inspect()).homeDraft);await shot('340x720-arrange')
  const original=(await inspect()).world
  await page.getByRole('button',{name:'书桌 · 替代锚点',exact:true}).click();assert.equal((await inspect()).homeDraft.home.positions.work,1);assert.deepEqual((await inspect()).world,original)
  await click('撤销');assert.equal((await inspect()).homeDraft.home.positions.work,0)
  await frame().waitForFunction(()=>window.__sceneMetrics().arrangementObjects.find(o=>o.id==='work').rect.x===46)
  const beforeDrag=(await inspect()).homeDraft, metrics=await frame().evaluate(()=>window.__sceneMetrics()), frameBox=await page.locator('.village-canvas iframe').boundingBox(), object=metrics.arrangementObjects.find(o=>o.id==='work'), projection=metrics.viewport.world
  const xy=p=>({x:frameBox.x+projection.x+p.x*projection.scale,y:frameBox.y+projection.y+p.y*projection.scale})
  const from=xy({x:object.rect.x+object.rect.width/2,y:object.rect.y+object.rect.height/2}),target=xy(object.anchors[1])
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:100});assert.deepEqual((await inspect()).homeDraft,beforeDrag);await shot('340x720-arrange-legal');await page.mouse.up();await page.waitForFunction(()=>window.__villageHostFixture.inspect().homeDraft.home.positions.work===1);assert.equal((await inspect()).homeDraft.home.positions.work,1);await click('撤销');assert.equal((await inspect()).homeDraft.home.positions.work,0);assert.equal(await page.getByRole('button',{name:'撤销',exact:true}).isDisabled(),true)
  await frame().waitForFunction(()=>window.__sceneMetrics().arrangementObjects.find(o=>o.id==='work').rect.x===46);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(frameBox.x+10,frameBox.y+80,{steps:10});await shot('340x720-arrange-illegal');await page.mouse.up();assert.deepEqual((await inspect()).homeDraft,beforeDrag)
  checks.push('100 pointer moves do not mutate draft; valid drop is one undo; invalid drop preserves draft')
  const draft=(await inspect()).homeDraft
  for(let i=0;i<10;i++){await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.locator('.village-card').waitFor({state:'detached'});await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await ready();assert.deepEqual((await inspect()).homeDraft,draft)}
  await click('书桌 · 替代锚点');await click('保存布置');await page.waitForFunction(()=>!window.__villageHostFixture.inspect().homeDraft);assert.equal((await inspect()).world.home.positions.work,1);assert.ok((await inspect()).reasons.includes('user'));checks.push('Home draft preview, one undo, hidden recovery and explicit CAS save preserve user pause')
  await system('拍照');await page.waitForFunction(()=>window.__villageHostFixture.inspect().photoMode);await shot('340x720-photo')
  await click('拍摄照片');await page.getByAltText('照片预览',{exact:true}).waitFor();let dl=page.waitForEvent('download');await click('导出 PNG');let download=await dl;await download.saveAs(join(qa,'photo-narrow.png'));captures.push(await readFile(join(qa,'photo-narrow.png')))
  await click('保存到相册');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===1);await click('退出拍照');assert.ok((await inspect()).reasons.includes('user'))
  await system('展开小院');await resize(1080,760);await shot('1080x760-dark-default');await tab('居民');await shot('1080x760-dark-inspector');await tab('居民')
  assert.equal(await frameIdentity(),identity)
  await system('拍照');await click('拍摄照片');await page.getByAltText('照片预览',{exact:true}).waitFor();dl=page.waitForEvent('download');await click('导出 PNG');download=await dl;await download.saveAs(join(qa,'photo-wide.png'));captures.push(await readFile(join(qa,'photo-wide.png')));assert.deepEqual(captures[0],captures[1]);await click('返回取景');await click('退出拍照');checks.push('Canonical PNG byte equality at 340 and 1080 widths; album save; user pause retained')
  await system('小院设置');await page.getByLabel('界面主题',{exact:true}).selectOption('light');await settled();await click('完成');await shot('1080x760-light-default');await tab('手账');await click('相册');assert.equal(await page.getByRole('button',{name:'删除照片',exact:true}).count(),1);await shot('1080x760-album');await click('删除照片');await click('确认删除照片');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===0);await tab('手账')
  await resize(580,720);await system('拍照');await click('拍摄照片');await page.getByAltText('照片预览',{exact:true}).waitFor();dl=page.waitForEvent('download');await click('导出 PNG');download=await dl;await download.saveAs(join(qa,'photo-medium.png'));assert.deepEqual(captures[0],await readFile(join(qa,'photo-medium.png')));const textureCount=await frame().evaluate(()=>window.__sceneMetrics().textures);for(let i=0;i<20;i++){const src=await page.getByAltText('照片预览',{exact:true}).getAttribute('src');await click('拍摄照片');await page.waitForFunction(src=>{const img=document.querySelector('img[alt="照片预览"]');return img&&img.src!==src},src)}assert.equal(await frame().evaluate(()=>window.__sceneMetrics().textures),textureCount);assert.equal(await frame().evaluate(()=>window.__sceneMetrics().tickerStarted),false);await click('返回取景');await click('退出拍照');checks.push('340/580/1080 canonical photos match; 20 consecutive captures retain the same frame, asset texture count and stopped ticker');await system('小院设置');await page.getByLabel('语言',{exact:true}).selectOption('en');await settled();await click('Done');await shot('580x720-en-default');await tab('Journal');await shot('580x720-en-journal');await tab('Journal');await page.getByRole('button',{name:'Courtyard settings',exact:true}).click();await page.getByLabel('Theme',{exact:true}).selectOption('dark');await settled();await click('Done');await shot('580x720-en-dark-default')
  await page.getByRole('button',{name:'Courtyard settings',exact:true}).click();await page.getByLabel('Language',{exact:true}).selectOption('zh');await settled();await click('完成')
  await resize(320,360);await tab('居民');await shot('320x360-short');assert.equal((await inspect()).presentation.drawer,'full');await tab('居民')
  await tab('布置');await click('开始布置');await page.locator('.village-edit-options details summary').click();await shot('320x360-short-arrange-options');await click('阅读角落 · 模板');await click('取消');await resize(340,480);await shot('340x480-default')
  assert.equal(await page.getByLabel('消息输入',{exact:true}).inputValue(),'UI-v1 unsent draft — 保留输入')
  const composer=await page.locator('[data-composer-card]').boundingBox(), card=await page.locator('.village-card').boundingBox();assert.ok(card.y+card.height<=composer.y);checks.push('Composer draft retained and expanded geometry avoids full composer')
  assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  await writeFile(join(qa,'metadata.json'),JSON.stringify(metadata,null,2))
  await writeFile(join(qa,'validation.json'),JSON.stringify({status:'PASS',checks,errors,external,manual:'Windows scaling, IME, GPU, sleep NOT RUN; one hour DEFERRED'},null,2))
  console.log(JSON.stringify({status:'PASS',checks,screenshots:metadata.length}))
} catch(error) {
  await page.screenshot({path:join(qa,'failure.png')});await writeFile(join(qa,'failure.json'),JSON.stringify({error:String(error),checks,errors,external,state:await inspect()},null,2));throw error
} finally { const video=page.video();await context.close();if(checks.length>=6){await mkdir(join(qa,'../interaction'),{recursive:true});await video.saveAs(join(qa,'../interaction/ui-v1-runtime.webm'))}await browser.close();await h.close() }

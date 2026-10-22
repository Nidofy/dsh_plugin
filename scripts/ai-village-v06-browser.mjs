import { villageUI } from './ai-village-ui-v1-navigation.mjs'
import assert from 'node:assert/strict'
import { readFile,readdir,mkdir,mkdtemp,writeFile } from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
const root=resolve(import.meta.dirname,'..'),out=join(root,'.build/ai-village-phase4'),qa=join(root,'.build/ai-village-v0.6-qa/content')
await mkdir(qa,{recursive:true})
const {runPreview}=await import('./ai-village-phase4-browser.mjs');await runPreview({root,pkg:join(root,'packages/ai-village'),out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs')).href),plugin=await import(pathToFileURL(join(out,'lib/index.js')).href)
const h=await harness({profile:await mkdtemp(join(qa,'profile-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),name=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,name,'node_modules/playwright/index.mjs')).href),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(route.request().url().startsWith(h.url+'/')||route.request().url().startsWith('blob:'))return route.continue();external.push(route.request().url());return route.abort()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),ready=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady)
const {click,tab}=villageUI(page)

const frame = () => page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'))
const finish = async (name, story) => {
 await tab('居民'); await click(name)
 await page.waitForFunction(()=>!!window.__villageHostFixture.inspect().world.neighborhood.event||!!window.__villageHostFixture.inspect().actionError)
 assert.equal((await inspect()).actionError,'')
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.neighborhood.event?.phase==='acting',null,{timeout:65000})
 await page.locator('.village-card').screenshot({path:join(qa,story+'.png')})
 await page.waitForFunction(story=>window.__villageHostFixture.inspect().world.neighborhood.memories.some(m=>m.id===story),story,{timeout:20000});checks.push(name)
}
try {
 await page.goto(h.entry);await click('打开 AI 小院');await ready();await click('展开小院');await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush())
 const original=(await inspect()).world;assert.equal(original.schemaVersion,6)
 await tab('布置');await click('编辑我的小院');await click('阅读角落 · 模板')
 assert.deepEqual((await inspect()).world,original)
 await frame().waitForFunction(()=>window.__sceneMetrics().geometry.find(h=>h.id==='eat').anchor.x===121)
 await page.locator('.village-card').screenshot({path:join(qa,'layout-preview.png')})
 await click('撤销上一步');assert.equal((await inspect()).homeDraft.home.positions.eat,0)
 await click('餐桌 · 替代锚点');await page.keyboard.press('Escape');assert.equal((await inspect()).homeDraft,null);assert.deepEqual((await inspect()).world,original)
 await frame().waitForFunction(()=>window.__sceneMetrics().geometry.find(h=>h.id==='eat').anchor.x===175)
 checks.push('preview, undo and Escape without world mutation')
 await click('编辑我的小院');await click('阅读角落 · 模板');await page.getByLabel('环境主题',{exact:true}).selectOption('twilight');await page.getByLabel('居民配饰',{exact:true}).selectOption('ribbon')
 await click('确认我的布置');await page.waitForFunction(()=>!window.__villageHostFixture.inspect().homeDraft)
 let world=(await inspect()).world;assert.equal(world.home.revision,1);assert.equal(world.home.positions.work,1);assert.equal(world.home.positions.eat,1);assert.equal(world.home.positions.bench,1);assert.equal(world.home.environment,'twilight');assert.equal(world.home.accessories.bluewhale,'ribbon');assert.equal(world.userPaused,true)
 await page.locator('.village-card').screenshot({path:join(qa,'twilight-reading.png')});checks.push('confirmed geometry, twilight and accessory')
 await click('继续')
 const metrics=await frame().evaluate(()=>window.__sceneMetrics()),box=await page.locator('.village-canvas iframe').boundingBox(),actor=(await inspect()).world.actor,seat=metrics.geometry.find(h=>h.id==='bench'&&h.seat==='left'),projection=metrics.viewport.world
 const screen=p=>({x:box.x+projection.x+p.x*projection.scale,y:box.y+projection.y+p.y*projection.scale})
 const from=screen({x:actor.position.x,y:actor.position.y-40}),to=screen({x:seat.anchor.x,y:seat.anchor.y-40})
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up()
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.actor.intent?.furnitureId==='bench'&&window.__villageHostFixture.inspect().world.actor.intent?.seat==='left')
 checks.push('actual drag to bench beside moved desk')
 await finish('翻开一本书','read');await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush())
 await tab('布置');await click('编辑我的小院');await click('花草角落 · 模板');await page.getByLabel('环境主题',{exact:true}).selectOption('afternoon');await page.getByLabel('居民配饰',{exact:true}).selectOption('leaf');await click('确认我的布置');await page.waitForFunction(()=>!window.__villageHostFixture.inspect().homeDraft)
 assert.equal((await inspect()).world.home.positions.corner,1)
 await click('继续');await finish('照料盆栽','water');await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush())
 assert.equal((await inspect()).world.actor.position.y,307)
 await tab('布置');await click('编辑我的小院');await page.getByLabel('环境主题',{exact:true}).selectOption('twilight');await click('确认我的布置');await page.waitForFunction(()=>!window.__villageHostFixture.inspect().homeDraft)
 const saved=(await inspect()).world
 await click('拍照');await click('拍摄照片');await page.getByRole('img',{name:'照片预览',exact:true}).waitFor()
 const download=page.waitForEvent('download');await click('导出 PNG');await(await download).saveAs(join(qa,'postcard.png'))
 const png=await readFile(join(qa,'postcard.png'));assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),960)
 await page.getByLabel('照片标题',{exact:true}).fill('我的小院 · 暮色花草');await click('保存到相册');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===1)
 assert.deepEqual((await inspect()).world,saved);await click('退出拍照');await page.reload();await click('打开 AI 小院');await ready();assert.deepEqual((await inspect()).world,saved)
 await frame().waitForFunction(()=>window.__sceneMetrics().environment==='twilight'&&window.__sceneMetrics().geometry.some(h=>h.id==='plant'&&h.anchor.y===307))
 await tab('手账');await click('相册');await page.getByText('我的小院 · 暮色花草',{exact:true}).waitFor();await page.locator('.village-card').screenshot({path:join(qa,'cold-restored.png')})
 checks.push('actual PNG export, independent album and exact cold restore');assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 await writeFile(join(qa,'validation.json'),JSON.stringify({passed:true,checks,schema:6,geometry:true,photo:{width:720,height:960,bytes:png.length},coldRestore:true,errors,external},null,2));console.log('0.6 actual furniture preview/undo/confirm, moved reading/watering, themes/accessories, PNG and cold restore passed')
} catch(e) {await writeFile(join(qa,'failure.json'),JSON.stringify({error:String(e),state:await inspect().catch(()=>null),errors},null,2));await page.screenshot({path:join(qa,'failure.png')}).catch(()=>{});throw e}
finally {await browser.close();await h.close()}

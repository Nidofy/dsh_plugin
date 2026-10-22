import assert from 'node:assert/strict'
import { readFile,readdir,mkdir,mkdtemp,writeFile } from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
const root=resolve(import.meta.dirname,'..'),out=join(root,'.build/ai-village-phase4'),qa=join(root,'.build/ai-village-v0.6-qa/neighborhood')
await mkdir(qa,{recursive:true})
const {runPreview}=await import('./ai-village-phase4-browser.mjs');await runPreview({root,pkg:join(root,'packages/ai-village'),out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs')).href),plugin=await import(pathToFileURL(join(out,'lib/index.js')).href)
const h=await harness({profile:await mkdtemp(join(qa,'profile-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),name=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,name,'node_modules/playwright/index.mjs')).href),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(route.request().url().startsWith(h.url+'/')||route.request().url().startsWith('blob:'))return route.continue();external.push(route.request().url());return route.abort()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),ready=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady),tab=name=>page.getByRole('tab',{name,exact:true}).click()
const click=name=>page.getByRole('button',{name,exact:true}).click()
const layout=async name=>{await tab('布置');await click(name);await click('确认布局');await page.waitForFunction(()=>!document.querySelector('.village-neighborhood [role="status"]'));await ready()}
const run=async(name,story,duo=false)=>{
 await tab(duo?'心愿':'居民');await page.waitForFunction(()=>{const w=window.__villageHostFixture.inspect().world;return w.ticks>=w.neighborhood.nextInteractionTick})
 const before=(await inspect()).world.neighborhood.memories.find(m=>m.id===story)?.count??0
 await click(name)
 await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !!s.world.neighborhood.event||!!s.actionError})
 assert.equal((await inspect()).actionError,'',name)
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.neighborhood.event?.phase==='acting',null,{timeout:65000})
 if(['翻开一本书','照料盆栽','长椅小谈'].includes(name))await page.locator('.village-card').screenshot({path:join(qa,story+'.png')})
 await page.waitForFunction(({story,before})=>{const w=window.__villageHostFixture.inspect().world;return !w.neighborhood.event&&(w.neighborhood.memories.find(m=>m.id===story)?.count??0)>before},{story,before},{timeout:20000})
 checks.push(name);console.log('Completed:',name)
}
try{
 await page.goto(h.entry);await click('打开 AI 小院');await ready();await click('展开小院')
 const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame')),single=(await frame.evaluate(()=>window.__sceneMetrics())).textures
 assert.ok(single<40)
 await click('请一位朋友入住');await page.evaluate(()=>window.__villageHostFixture.flush());await ready()
 await click('邀请同桌');await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.journal.length===1,null,{timeout:65000});checks.push('首次同桌')
 await run('打个招呼','hello');await run('舒展一下','hello');await run('记下灵感','ideas');await run('整理书桌','tidy')
 await run('听一会儿风','listen');await run('看看天空','sky');await run('长椅小谈','bench',true);await run('交换小点子','idea-swap',true);await run('安静地坐一会儿','bench',true)
 await layout('阅读角落');await run('翻开一本书','read');await run('分享一页书','shared-book',true)
 await layout('花草角落');await run('照料盆栽','water');await run('聊聊花草','plant-care',true)
 assert.equal((await inspect()).world.neighborhood.memories.length,11)
 await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush())
 await tab('布置')
 for(const [name,slot] of [['纸灯笼','窗边'],['花叶挂饰','院墙']]){
  const choose=()=>page.getByText(name,{exact:true}).locator('..').getByRole('button',{name:'调整位置',exact:true}).click()
  await choose();await page.locator('.village-neighborhood').getByRole('button',{name:slot,exact:true}).click();await page.keyboard.press('Escape')
  assert.equal((await inspect()).world.neighborhood.decorations[name==='纸灯笼'?'lantern':'planter'],null)
  await choose();await page.locator('.village-neighborhood').getByRole('button',{name:slot,exact:true}).click();await click('保存装饰');await page.evaluate(()=>window.__villageHostFixture.flush())
 }
 assert.equal((await inspect()).world.neighborhood.decorations.lantern,'window');assert.equal((await inspect()).world.neighborhood.decorations.planter,'wall')
 await page.locator('.village-card').screenshot({path:join(qa,'decorations.png')})
 await tab('手账');await page.locator('.village-card').screenshot({path:join(qa,'journal.png')})
 await click('拍照');await page.getByRole('button',{name:'拍摄照片',exact:true}).waitFor()
 const beforePhoto=(await inspect()).world
 await page.getByLabel('取景缩放',{exact:true}).fill('1.25');await click('拍摄照片')
 await page.getByRole('img',{name:'照片预览',exact:true}).waitFor();await page.locator('.village-card').screenshot({path:join(qa,'photo-mode.png')})
 const downloaded=page.waitForEvent('download');await click('导出 PNG');await(await downloaded).saveAs(join(qa,'postcard.png'))
 const png=await readFile(join(qa,'postcard.png'));assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),960)
 await page.getByLabel('照片标题',{exact:true}).fill('邻里小日常 · 真实照片');await click('保存到相册')
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===1,null,{timeout:20000})
 assert.deepEqual((await inspect()).world,beforePhoto);await click('退出拍照');assert.equal((await inspect()).world.userPaused,true)
 const saved=(await inspect()).world;await page.reload();await click('打开 AI 小院');await ready();assert.deepEqual((await inspect()).world,saved)
 await tab('手账');await page.getByText('邻里小日常 · 真实照片',{exact:true}).waitFor();await page.locator('.village-card').screenshot({path:join(qa,'album-restored.png')})
 await click('删除照片');await click('确认删除照片');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===0)
 assert.deepEqual((await inspect()).world,saved)
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 await writeFile(join(qa,'validation.json'),JSON.stringify({passed:true,checks,singleTextures:single,memories:12,decorations:true,photo:{width:720,height:960,bytes:png.length},exactWorldAfterPhoto:true,coldRestore:true,deletePreservesWorld:true,errors,external},null,2))
 console.log('0.5 production UI, 13 events, layouts, actual PNG, album, deletion and exact cold restore passed')
}catch(e){await writeFile(join(qa,'failure.json'),JSON.stringify({error:String(e),state:await inspect().catch(()=>null),errors},null,2));await page.screenshot({path:join(qa,'failure.png')}).catch(()=>{});throw e}
finally{await browser.close();await h.close()}

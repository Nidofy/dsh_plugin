import assert from 'node:assert/strict'
import { readFile,readdir,mkdir,mkdtemp,writeFile } from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
const edited=process.argv.includes('--edited')
const root=resolve(import.meta.dirname,'..'), out=join(root,'.build/ai-village-phase4'), qa=join(root,edited?'.build/ai-village-v0.6-qa/performance-edited':'.build/ai-village-v0.6-qa/performance')
await mkdir(qa,{recursive:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs')).href), plugin=await import(pathToFileURL(join(out,'lib/index.js')).href)
const h=await harness({profile:await mkdtemp(join(qa,'profile-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),name=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,name,'node_modules/playwright/index.mjs')).href),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1}),page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect())
const ready=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady)
const getFrame=async()=>await(await page.locator('.village-canvas iframe').elementHandle()).contentFrame()
try{
 await page.goto(h.entry);await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click();await ready()
 if(edited){
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('tab',{name:'布置',exact:true}).click();await page.getByRole('button',{name:'编辑我的小院',exact:true}).click();await page.getByRole('button',{name:'阅读角落 · 模板',exact:true}).click();await page.getByLabel('环境主题',{exact:true}).selectOption('twilight');await page.getByLabel('居民配饰',{exact:true}).selectOption('ribbon');await page.getByRole('button',{name:'确认我的布置',exact:true}).click();await page.waitForFunction(()=>!window.__villageHostFixture.inspect().homeDraft);assert.equal((await inspect()).world.home.positions.eat,1);await page.getByRole('button',{name:'继续',exact:true}).click()
 }
 await page.locator('.village-members summary').click();await page.getByRole('button',{name:'全员入住',exact:true}).click();await page.evaluate(()=>window.__villageHostFixture.flush());await page.locator('.village-members summary').click()
 const frame=await getFrame();await frame.waitForFunction(()=>window.__sceneMetrics().actors===7)
 const before=await frame.evaluate(()=>window.__sceneMetrics()),started=Date.now()
 const parent=await page.evaluate(async()=>{let count=0;const start=performance.now();const f=()=>{count++;if(performance.now()-start<5000)requestAnimationFrame(f)};requestAnimationFrame(f);await new Promise(r=>setTimeout(r,5100));return{frames:count,seconds:(performance.now()-start)/1000}})
 const after=await frame.evaluate(()=>window.__sceneMetrics()),seconds=(Date.now()-started)/1000,fps=(after.frames-before.frames)/seconds
 assert.ok(fps>20&&fps<35,`Unexpected scene FPS ${fps}`);assert.equal(after.textures,128);assert.equal(after.tickerStarted,false)
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.evaluate(()=>window.__villageHostFixture.flush())
 const frozen=(await inspect()).world
 await page.getByRole('button',{name:'关闭小院',exact:true}).click();await page.waitForTimeout(1500)
 assert.deepEqual((await inspect()).world,frozen);assert.equal(await page.locator('.village-canvas iframe').count(),0)
 await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click();await ready()
 const cdp=await context.newCDPSession(page),scales=[]
 for(const dpr of [1,1.25,1.5,2]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:dpr,mobile:false});await page.waitForTimeout(200)
  const f=await getFrame(),metrics=await f.evaluate(()=>{const c=document.querySelector('canvas');return{dpr:devicePixelRatio,backingWidth:c.width,cssWidth:c.getBoundingClientRect().width,...window.__sceneMetrics()}})
  assert.equal(metrics.dpr,dpr);assert.ok(metrics.backingWidth>=metrics.cssWidth*1.99);scales.push(metrics)
  await page.locator('.village-card').screenshot({path:join(qa,`seven-dpr-${dpr}.png`)})
 }
 await cdp.send('Emulation.clearDeviceMetricsOverride')
 const layouts=[]
 for(const height of [744,564]){
  await page.setViewportSize({width:1440,height});await page.waitForTimeout(200);await ready()
  const box=await page.locator('.village-card').boundingBox();assert.equal(Math.round(box.width),340);assert.equal(Math.round(box.height),height-124)
  const scene=await page.locator('.village-canvas iframe').boundingBox();assert.ok(scene.height>=100)
  layouts.push({card:box,scene});await page.locator('.village-card').screenshot({path:join(qa,`compact-${Math.round(box.height)}.png`)})
 }
 await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'展开小院',exact:true}).click();await page.setViewportSize({width:800,height:600});await ready()
 await page.locator('.village-card').screenshot({path:join(qa,'expanded-800x600-seven.png')})
 assert.deepEqual((await inspect()).world,frozen);assert.deepEqual(errors,[])
 const report={edited,sampledAt:new Date().toISOString(),sevenResidents:{seconds,fps,parentRafFps:parent.frames/parent.seconds,meanPaintMs:after.meanPaintMs,maxPaintMs:after.maxPaintMs,textures:after.textures},closedStopsWorld:true,scales,layouts,errors,
 limitations:'Chromium headless with SwiftShader; 5-second animation sample. DPR is browser emulation, not Windows system-scale changes. Paint timing is JavaScript render submission, not GPU completion. No cross-device or long-duration GPU claim.'}
 await writeFile(join(qa,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}finally{await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await browser.close();await h.close()}

import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { runPreview } from './ai-village-phase4-browser.mjs'
const root=resolve(import.meta.dirname,'..'),out=join(root,'.build/ai-village-phase4'),qa=process.env.VILLAGE_QA_DIR?resolve(process.env.VILLAGE_QA_DIR):join(root,'packages/ai-village/art/QA/entrance-v1')
await mkdir(qa,{recursive:true});await runPreview({root,pkg:join(root,'packages/ai-village'),out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js')))
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const results=[],errors=[],build={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),dirty:execFileSync('git',['status','--short'],{cwd:root}).toString(),sha256:{}}
for(const name of ['fixture.js','lib/client.js','lib/frame.js'])build.sha256[name]=createHash('sha256').update(await readFile(join(out,name))).digest('hex')
const scenarios=process.argv.slice(2).length?process.argv.slice(2):['normal','slow-assets','slow-decode','ready-no-paint','skip','hide-loading','close-loading','unload-loading','missing-portrait','missing-core','hash-failure','render-failure','restore','reduced-motion','matrix']
try {for(const scenario of scenarios){
 const h=await harness({profile:await mkdtemp(join(root,'.build/entrance-profile-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:scenario==='reduced-motion'?'reduce':'no-preference',recordVideo:{dir:join(qa,'videos'),size:{width:960,height:640}}}),page=await context.newPage(),requests=[],trace=[]
 page.on('pageerror',e=>errors.push({scenario,error:e.message}))
 await context.addInitScript(({scenario})=>{
   window.__entranceEvents=[]
   window.addEventListener('message',event=>{const m=event.data;if(m?.channel==='nidofy-ai-village'&&['frame-resource-progress','ready-to-render','first-frame-rendered'].includes(m.type))window.__entranceEvents.push({at:performance.now(),type:m.type,progress:m.progress,assetRevision:m.assetRevision,viewRevision:m.viewRevision})})
   if(window!==parent&&['slow-decode','unload-loading'].includes(scenario)){const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=async function(){if(!window.__decodedOnce){window.__decodedOnce=true;await new Promise(resolve=>setTimeout(resolve,1800))}return decode.call(this)}}
   if(window!==parent&&['ready-no-paint','matrix'].includes(scenario))window.addEventListener('message',event=>{if(event.data?.type==='render'&&!window.__allowPaint)event.stopImmediatePropagation()})
   if(window!==parent&&scenario==='render-failure')for(const kind of [WebGLRenderingContext,WebGL2RenderingContext])for(const method of ['drawArrays','drawElements'])kind.prototype[method]=()=>{throw Error('INJECT_RENDER_FAILURE')}
 },{scenario})
 await context.route('**/*',async route=>{
   const url=route.request().url()
   if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:'))return route.abort()
   if(url.includes('/assets/'))requests.push(url.split('/assets/')[1])
   if(['slow-assets','skip','hide-loading','close-loading'].includes(scenario)){if(url.endsWith('/assets/scene/background.png'))await new Promise(resolve=>setTimeout(resolve,2000))}
   if(scenario==='missing-portrait'&&url.includes('/portraits/'))return route.fulfill({status:404,body:'missing'})
   if(scenario==='missing-core'&&url.endsWith('/assets/scene/background.png'))return route.fulfill({status:404,body:'missing'})
   if(scenario==='hash-failure'&&url.endsWith('/assets/scene/background.png'))return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('invalid')})
   return route.continue()
 })
 const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),shot=name=>page.screenshot({path:join(qa,scenario+'-'+name+'.png')}),entered=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false)
 try {
   await page.goto(h.entry);const start=Date.now();await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click()
   if(scenario==='matrix'){
     await page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady);await page.evaluate(()=>window.__villageHostFixture.entranceViewport())
     for(const [width,height]of [[320,360],[340,720],[580,720],[1080,760]])for(const theme of ['light','dark']){
       await page.evaluate(theme=>window.__villageHostFixture.preference(theme),theme)
       let viewportHeight=height+236,matched=false
       for(let i=0;i<5;i++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(100);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<.1&&Math.abs(box.height-height)<.1){matched=true;break}viewportHeight+=Math.round(height-box.height)}
       assert.ok(matched);await shot(`${width}x${height}-${theme}-loading`)
       const shape=await page.locator('.entrance-portraits').evaluate(el=>({bounds:el.getBoundingClientRect().toJSON(),portraits:[...el.children].map(img=>img.getBoundingClientRect().toJSON())}));trace.push({event:'viewport',width,height,theme,shape});assert.equal((await inspect()).entrance.firstFrame,false);assert.ok(shape.portraits.every(p=>p.width===(height<480?28:width>=580?36:32)))
     }
     const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));await frame.evaluate(()=>{window.__allowPaint=true});await page.getByRole('button',{name:'跳过动画',exact:true}).click()
   }
   if(['slow-assets','skip','slow-decode','ready-no-paint','hide-loading','close-loading','unload-loading'].includes(scenario)){
     await page.locator('.village-entrance').waitFor();await page.waitForTimeout(250)
     let state=await inspect();assert.equal(state.entrance.blocking,true);assert.ok(state.entrance.progress<1);trace.push({event:'held',state});await shot('waiting')
     if(scenario==='slow-assets'){
       await page.getByRole('button',{name:'跳过动画',exact:true}).evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true})));assert.equal((await inspect()).entrance.skipped,false)
       await page.getByRole('textbox',{name:'消息输入'}).fill('入口期间保留主聊天输入');assert.equal(await page.getByRole('textbox',{name:'消息输入'}).inputValue(),'入口期间保留主聊天输入')
       assert.equal(await page.locator('.village-entry-ui').evaluate(el=>el.inert),true)
     }
     if(scenario==='hide-loading'){await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForTimeout(200);assert.equal(await page.locator('.village-entrance').count(),0);await page.evaluate(()=>window.__villageHostFixture.sidebar(false));assert.equal((await inspect()).entrance.full,false)}
     if(scenario==='close-loading'){await page.locator('.entrance-actions').getByRole('button',{name:'关闭小院',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click();assert.equal((await inspect()).entrance.full,false)}
     if(scenario==='skip'){await page.getByRole('button',{name:'跳过动画',exact:true}).click();assert.equal((await inspect()).entrance.blocking,true);await shot('skipped-still-loading')}
     if(scenario==='ready-no-paint'){
       await page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady);state=await inspect();assert.equal(state.entrance.firstFrame,false);assert.equal(state.entrance.canReveal,false);assert.equal(state.world.ticks,0)
       const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));await frame.evaluate(()=>{window.__allowPaint=true});await page.getByRole('button',{name:'跳过动画',exact:true}).click()
     }
   }
   if(scenario==='unload-loading'){
     await page.evaluate(()=>window.__villageHostFixture.dispose());await page.waitForTimeout(1900);assert.equal(await page.locator('.village-entrance, .village-canvas iframe').count(),0);trace.push({event:'disposed-during-decode',state:await inspect()});await shot('disposed')
   } else if(['hash-failure','render-failure','missing-core'].includes(scenario)){
     await page.getByRole('alert').waitFor();const state=await inspect();assert.equal(state.entrance.blocking,true);assert.equal(state.entrance.canReveal,false);await shot('error');trace.push({event:'failure',state})
   } else {
     await entered();const elapsedMs=Date.now()-start,state=await inspect();await page.waitForTimeout(260);assert.equal(state.error,'');assert.equal(state.entrance.firstFrame,true);assert.equal(state.entrance.progress,1)
     assert.ok(requests.every(key=>!key.startsWith('entrance/')),'Production must not request ART_REVIEW layers');
     assert.equal(await page.locator('.entrance-camera').count(),0);
     assert.equal(state.resourceKeys.length,32);assert.ok(state.resourceKeys.every(key=>!key.startsWith('claude/')&&!key.startsWith('gpt/')))
     assert.equal(await page.locator('.village-canvas iframe').count(),1);await shot('entered');trace.push({event:'entered',elapsedMs,state})
     if(scenario==='restore'){
       await page.getByRole('button',{name:'暂停',exact:true}).click();await page.evaluate(()=>window.__villageHostFixture.flush());const before=(await inspect()).world
       await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForTimeout(120);await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered();assert.deepEqual((await inspect()).world,before);assert.equal((await inspect()).entrance.full,false);await shot('restored')
       await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'关闭小院',exact:true}).click();await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click();await entered();assert.equal((await inspect()).world.userPaused,true);assert.equal((await inspect()).entrance.full,false)
     }
     const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));trace.push({event:'metrics',metrics:await frame.evaluate(()=>window.__sceneMetrics())})
     assert.equal(await page.locator('.village-entrance').count(),0)
     await page.mouse.move(10,10);await page.waitForTimeout(500)
     assert.equal(await page.locator('.village-card').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0)
   }
   trace.push({event:'protocol',messages:await page.evaluate(()=>window.__entranceEvents)})
   results.push({scenario,status:'PASS',requests,trace,renderer:'SwiftShader',art:JSON.parse(await readFile(join(root,'packages/ai-village/assets/entrance/manifest.json'),'utf8')).status});console.log(scenario+' PASS')
 }catch(error){results.push({scenario,status:'FAIL',error:String(error),state:await inspect().catch(()=>null),requests,trace});await shot('failed').catch(()=>{});throw error}
 finally{
   await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});const video=page.video();await context.close();if(video)await copyFile(await video.path(),join(qa,scenario+'.webm'));await h.close();await writeFile(join(qa,'validation.json'),JSON.stringify({build,results,errors,gpu:'NOT RUN',visual:'USER_VISUAL_REVIEW',oneHour:'DEFERRED'},null,2))
 }
}assert.deepEqual(errors,[])}finally{await browser.close()}

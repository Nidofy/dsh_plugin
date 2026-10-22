import assert from 'node:assert/strict'
import { readFile,writeFile,mkdir,mkdtemp,readdir } from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {runPreview} from './ai-village-phase4-browser.mjs'
const fault=process.argv.includes('--missing-art')
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),out=join(root,'.build/entrance-integration-review'),evidence=join(root,'docs/ai-village/entrance-parallel/integration',fault?'preview-missing-art':'preview')
await mkdir(out,{recursive:true});await mkdir(evidence,{recursive:true})
await runPreview({root,pkg,out,buildOnly:true,entranceReview:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(pkg,'lib/index.js')))
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const results=[],errors=[]
try{for(const [width,height] of (fault?[[340,720]]:[[340,720],[580,720],[1080,760],[320,360]]))for(const theme of (fault?['light']:['light','dark']))for(const language of (fault?['zh']:['zh','en'])){
 const context=await browser.newContext({viewport:{width:width+224,height:Math.max(900,height+236)},recordVideo:{dir:join(out,'videos'),size:{width:960,height:720}}})
 const h=await harness({profile:await mkdtemp(join(out,'profile-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
 const page=await context.newPage(),artRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/entrance/'))artRequests.push(r.url().split('/assets/')[1])})
 await context.route('**/*',async r=>{if(fault&&r.request().url().endsWith('/assets/entrance/entrance-gate-left.png'))return r.fulfill({status:404,body:'missing art fixture'});if(width===340&&theme==='light'&&r.request().url().endsWith('/assets/scene/background.png'))await new Promise(resolve=>setTimeout(resolve,2200));return r.request().url().startsWith(h.url+'/')||r.request().url().startsWith('blob:')?r.continue():r.abort()})
 await page.addInitScript(()=>{
   window.__phases=[];window.__heldMessages=[]
   window.addEventListener('message',event=>{if(event.data?.type==='ready'&&event.data.token===''){window.__heldMessages=[];window.__heldAck=null}if(window===parent&&event.data?.channel==='nidofy-ai-village'&&!window.__allowAck&&(event.data.type==='first-frame-rendered'||window.__heldMessages.length)){const held={data:event.data,origin:event.origin,source:event.source};window.__heldMessages.push(held);if(event.data.type==='first-frame-rendered')window.__heldAck=held;event.stopImmediatePropagation()}},true)
   new MutationObserver(()=>{const el=document.querySelector('.village-entrance');if(el&&window.__phases.at(-1)?.phase!==el.dataset.phase)window.__phases.push({phase:el.dataset.phase,at:performance.now(),canReveal:window.__villageHostFixture?.inspect().entrance.canReveal})}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-phase']})
 })
 try{
   await page.goto(h.entry)
   await page.evaluate(()=>{window.__villageHostFixture.reviewMotion();window.__villageHostFixture.entranceViewport()})
   if(fault)await page.evaluate(()=>{window.__allowAck=true})
   await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click()
   if(fault){await page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false);const state=await page.evaluate(()=>window.__villageHostFixture.inspect());assert.equal(state.error,'');assert.equal(state.entrance.firstFrame,true);assert.ok(artRequests.some(p=>p.endsWith('entrance-gate-left.png')));await page.locator('.village-card').screenshot({path:join(evidence,'missing-art-entered.png')});results.push({case:'candidate door PNG 404',verdict:'PASS',firstFrame:true,fallback:'static entrance, real world remains usable'});continue}
   await page.waitForFunction(()=>window.__heldAck&&document.querySelector('.village-entrance')?.dataset.simple==='false')
   await page.evaluate(({theme,language})=>{window.__villageHostFixture.preference(theme);window.__villageHostFixture.reviewLanguage(language)},{theme,language})
   let vh=page.viewportSize().height
   for(let i=0;i<6;i++){await page.setViewportSize({width:width+224,height:vh});await page.waitForTimeout(80);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)break;vh+=Math.round(height-box.height)}
   const card=page.locator('.village-card'),box=await card.boundingBox();assert.ok(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1,JSON.stringify(box))
   await page.waitForFunction(()=>document.querySelector('.village-entrance')?.dataset.phase==='wait')
   const before=await page.evaluate(()=>window.__villageHostFixture.inspect());assert.equal(before.entrance.canReveal,false);assert.equal(before.world.ticks,0)
   const iframe=await page.locator('.village-canvas iframe').elementHandle()
   for(const fraction of [0,.25,.5,1]){
     await page.locator('[data-door]').evaluateAll((doors,f)=>doors.forEach(d=>d.style.transform=`rotateY(${82*f*(d.dataset.door==='left'?1:-1)}deg)`),fraction)
     await card.screenshot({path:join(evidence,`${width}x${height}-${theme}-${language}-door-${fraction*100}.png`)})
   }
   await page.locator('[data-door]').evaluateAll(doors=>doors.forEach(d=>d.style.transform='rotateY(0deg)'))
   await page.evaluate(()=>{window.__allowAck=true;for(const held of window.__heldMessages)window.dispatchEvent(new MessageEvent('message',held))})
   await page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false)
   assert.ok(await iframe.evaluate(el=>el.isConnected),'reveal must keep the same game frame')
   await card.screenshot({path:join(evidence,`${width}x${height}-${theme}-${language}-entered.png`)})
   const phases=await page.evaluate(()=>window.__phases)
   assert.equal(phases.filter(p=>p.phase==='approach').length,1,JSON.stringify(phases))
   assert.ok(phases.some(p=>p.phase==='open'&&p.canReveal));assert.ok(phases.some(p=>p.phase==='cross'&&p.canReveal))
   let warmReopenVerified=false
   if(width===340&&theme==='light'&&language==='zh'){
     const requestsBefore=artRequests.length
     await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.locator('.village-entrance').waitFor({state:'detached'});await page.waitForTimeout(100)
     await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false)
     assert.equal(await page.locator('.entrance-camera').count(),0);assert.equal(artRequests.length,requestsBefore);warmReopenVerified=true
   }
   results.push({width,height,theme,language,dpr:1,warmReopenVerified,artRequests,backend:'Chromium SwiftShader; harness explicitly opts into DOM motion',verdict:'PASS',held_first_frame_ack:true,keyframes:'Harness seeks door transforms while real world ACK is withheld; normal animation replay follows',phases})
 }catch(e){await writeFile(join(evidence,`${width}x${height}-${theme}-${language}-failure.json`),JSON.stringify(await page.evaluate(()=>({phases:window.__phases,state:window.__villageHostFixture.inspect()})),null,2));await page.screenshot({path:join(evidence,`${width}x${height}-${theme}-${language}-failure.png`)});throw e}
 finally{await context.close();await h.close()}
}}
finally{await browser.close();await writeFile(join(evidence,'validation.json'),JSON.stringify({status:results.length===(fault?1:16)&&!errors.length?'PASS':'FAIL',art_status:'ART_REVIEW',fixture_sha256:createHash('sha256').update(await readFile(join(out,'fixture.js'))).digest('hex'),errors,results},null,2)+'\n')}
assert.deepEqual(errors,[]);console.log(`ART_REVIEW preview: ${results.length} size/theme cases PASS`)

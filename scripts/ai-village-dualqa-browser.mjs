import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,mkdtemp} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {root,generated,evidence,source,git} from '../tools/ai-village-dualqa/env.mjs'
const out=join(generated,'preview'),shots=join(root,'packages/ai-village/art/QA/entrance-dual/qa/browser')
await mkdir(shots,{recursive:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.mjs')))
const pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const results=[],args=process.argv.slice(2),scenarios=args.length?args:['normal','late-paint','decode-reject','wrong-hash','truncated-png','missing-core','slow-skip','disconnect','reduced-motion','reduced-transparency','matrix','stress']
const report={baseSHA:git('rev-parse','HEAD'),build:JSON.parse(await readFile(join(out,'build.json'),'utf8')),command:['node',...process.argv.slice(1)].join(' '),node:process.version,backend:'Chromium headless / software rendering; inspect renderer metrics',performanceStatus:'CONTENDED',art:'ART_PENDING',results,notRun:['real Windows GPU / DPI','human art approval','formal uncontended performance baseline'],oneHour:'DEFERRED'}
try{for(const scenario of scenarios){
 const h=await harness({profile:await mkdtemp(join(generated,'profile-browser-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:scenario==='reduced-motion'?'reduce':'no-preference'}),page=await context.newPage(),errors=[],requests=[],trace=[]
 page.setDefaultTimeout(15000)
 page.on('pageerror',e=>errors.push(e.message))
 await context.addInitScript(({scenario})=>{
  window.__dualqa={messages:[],longtasks:[]}
  try{new PerformanceObserver(list=>window.__dualqa.longtasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})}catch{}
  window.addEventListener('message',e=>{const m=e.data;if(m?.channel==='nidofy-ai-village'&&['ready-to-render','frame-resource-progress','first-frame-rendered'].includes(m.type))window.__dualqa.messages.push({type:m.type,at:performance.now(),assetRevision:m.assetRevision,viewRevision:m.viewRevision,progress:m.progress})})
  if(window!==parent&&['late-paint','matrix'].includes(scenario))window.addEventListener('message',e=>{if(e.data?.type==='render'&&!window.__dualqaAllowPaint)e.stopImmediatePropagation()})
  if(window!==parent&&scenario==='decode-reject')HTMLImageElement.prototype.decode=async function(){throw Error('DUALQA_DECODE_REJECT')}
 },{scenario})
 await context.route('**/*',async route=>{
  const url=route.request().url()
  if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:'))return route.abort()
  if(url.includes('/assets/'))requests.push(url.split('/assets/')[1])
  if(url.endsWith('/assets/scene/background.png')){
   if(scenario==='slow-skip')await new Promise(r=>setTimeout(r,1800))
   if(scenario==='missing-core')return route.fulfill({status:404,body:'dualqa missing'})
   if(['wrong-hash','truncated-png'].includes(scenario)){const response=await route.fetch(),body=await response.body();const changed=Buffer.from(body);changed[changed.length-10]^=1;return route.fulfill({response,body:scenario==='wrong-hash'?changed:body.subarray(0,body.length-20)})}
  }
  return route.continue()
 })
 const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect())
 const entered=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false)
 const shot=async name=>{const file=scenario+'-'+name+'.png';await page.screenshot({path:join(shots,file)});return file}
 const safeState=async()=>{const s=await inspect();return {entrance:{blocking:s.entrance.blocking,full:s.entrance.full,firstFrame:s.entrance.firstFrame,progress:s.entrance.progress,canReveal:s.entrance.canReveal},errorCode:s.errorCode,reasons:s.reasons,ticks:s.world?.ticks,userPaused:s.world?.userPaused,revision:s.revision,resourceCount:s.resourceKeys.length}}
 try{
  await page.goto(h.entry);const startedAtInPage=await page.evaluate(()=>performance.now()),start=Date.now();await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click()
  if(['decode-reject','wrong-hash','truncated-png','missing-core'].includes(scenario)){
   await page.getByRole('alert').waitFor();const s=await inspect();assert.equal(s.entrance.canReveal,false);assert.equal(s.entrance.blocking,true);trace.push({failure:await safeState(),screenshot:await shot('error')})
  }else{
   if(scenario==='slow-skip'){await page.locator('.village-entrance').waitFor();await page.getByRole('button',{name:/^(跳过动画|Skip animation)$/,exact:true}).click();assert.equal((await inspect()).entrance.canReveal,false);assert.equal((await inspect()).world?.ticks??0,0);trace.push({waiting:await safeState(),screenshot:await shot('waiting')})}
   if(['late-paint','matrix'].includes(scenario)){
    await page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady);assert.equal((await inspect()).entrance.firstFrame,false);assert.equal((await inspect()).world.ticks,0)
    if(scenario==='matrix'){
     await page.evaluate(()=>window.__villageHostFixture.entranceViewport())
     for(const [width,height]of [[320,360],[340,720],[580,720],[1080,760]])for(const theme of ['light','dark'])for(const language of ['zh','en']){
      await page.evaluate(p=>window.__dualqaActions.preferences(p),{theme,language})
      let viewportHeight=height+236,matched=false
      for(let n=0;n<6;n++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(80);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1){matched=true;break}viewportHeight+=Math.round(height-box.height)}
      assert.ok(matched,'card target dimensions');trace.push({width,height,theme,language,DPR:1,screenshot:await shot(width+'x'+height+'-'+theme+'-'+language)})
      assert.equal((await inspect()).entrance.canReveal,false)
     }
    }
    const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));await frame.evaluate(()=>window.__dualqaAllowPaint=true);await page.getByRole('button',{name:/^(跳过动画|Skip animation)$/,exact:true}).click()
   }
   await entered();trace.push({startedAtInPage,coldElapsedMs:Date.now()-start,state:await safeState(),screenshot:await shot('entered')})
   if(scenario==='reduced-transparency'){await page.evaluate(()=>window.__dualqaActions.preferences({reducedTransparency:true}));await page.waitForFunction(()=>document.querySelector('.village-card').dataset.material==='reduced-transparency');trace.push({material:await page.locator('.village-card').getAttribute('data-material')})}
   const s=await inspect();assert.equal(s.error,'');assert.equal(s.entrance.firstFrame,true);assert.equal(s.resourceKeys.length,32)
   if(['disconnect','stress'].includes(scenario)){
    await page.getByRole('button',{name:'暂停',exact:true}).click();await page.evaluate(()=>window.__villageHostFixture.flush())
    const before=(await inspect()).world
    if(scenario==='disconnect'){await page.evaluate(()=>window.__villageHostFixture.connection(false));await page.waitForTimeout(100);await page.evaluate(()=>window.__villageHostFixture.connection(true));await entered();assert.equal((await inspect()).world.userPaused,true);assert.equal((await inspect()).entrance.full,false)}
    else{
     const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable')
     await page.mouse.move(1,1);await page.waitForTimeout(350);await cdp.send('HeapProfiler.collectGarbage')
     const initial=await cdp.send('Memory.getDOMCounters'),cycles=[],checkpoints=[]
     for(let i=0;i<100;i++){
      const t=Date.now();await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>document.querySelectorAll('.village-canvas iframe').length===0)
      await page.setViewportSize({width:[1000,1200,1440][i%3],height:[850,960][i%2]})
      await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered()
      const state=await inspect();assert.equal(state.entrance.full,false);assert.equal(state.world.userPaused,true);assert.equal(state.world.ticks,before.ticks);assert.equal(await page.locator('.village-canvas iframe').count(),1)
      cycles.push(Date.now()-t)
      if(i%20===19){await page.setViewportSize({width:1440,height:960});await page.mouse.move(1,1);await page.waitForTimeout(350);await cdp.send('HeapProfiler.collectGarbage');checkpoints.push({cycle:i+1,...await cdp.send('Memory.getDOMCounters')});console.log('stress '+(i+1)+'/100 '+JSON.stringify(checkpoints.at(-1)))}
     }
     await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Memory.getDOMCounters')
     await page.mouse.move(1,1);await page.waitForFunction(()=>document.querySelector('.village-card').getAnimations({subtree:true}).filter(a=>a.playState==='running').length===0,{},{timeout:3000})
     const animations=await page.locator('.village-card').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)
     assert.equal(animations,0);trace.push({cycles:100,warmMs:cycles,initialDOM:initial,checkpoints,afterGC:after,animations,initialListenerDelta:after.jsEventListeners-initial.jsEventListeners,leakVerdict:checkpoints.every(p=>p.jsEventListeners===checkpoints[0].jsEventListeners)&&after.jsEventListeners===checkpoints[0].jsEventListeners?'STABLE_AFTER_WARMUP':'FAIL'})
     assert.ok(checkpoints.every(p=>p.jsEventListeners===checkpoints[0].jsEventListeners)&&after.jsEventListeners===checkpoints[0].jsEventListeners,'listeners accumulated between warm checkpoints')
    }
   }
   const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));trace.push({metrics:await frame.evaluate(()=>window.__sceneMetrics())})
  }
  trace.push({protocol:await page.evaluate(()=>window.__dualqa),resources:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>({key:r.name.split('/assets/')[1],duration:r.duration,transferSize:r.transferSize,decodedBodySize:r.decodedBodySize})))})
  assert.deepEqual(errors,[])
  results.push({case:scenario,status:'PASS',trace,requests});console.log(scenario+' PASS')
 }catch(error){results.push({case:scenario,status:'FAIL',error:String(error),state:await safeState().catch(()=>null),trace,errors,requests,screenshot:await shot('failed').catch(()=>null)});console.log(scenario+' FAIL '+String(error))}
 finally{await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context.close();await h.close();await writeFile(join(evidence,'browser-'+(args.length?args.join('-').slice(0,100):'full')+'.json'),JSON.stringify(report,null,2));await writeFile(join(evidence,'browser-latest.json'),JSON.stringify(report,null,2))}
}}finally{await browser.close()}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1

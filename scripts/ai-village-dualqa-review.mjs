import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {root,generated,evidence,source,git,requireTool} from '../tools/ai-village-dualqa/env.mjs'
const out=join(generated,'preview-review'),build=JSON.parse(await readFile(join(out,'build.json'),'utf8'))
if(!build.reviewMode)throw Error('Build with --review first; never alter production approval')
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.mjs')))
const pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const shots=join(root,'packages/ai-village/art/QA/entrance-dual/qa/integrated-review');await mkdir(shots,{recursive:true})
const cases=[]
for(const [width,height]of [[320,360],[340,720],[580,720],[1080,760]])for(const theme of ['light','dark'])cases.push({kind:'keyframes',width,height,theme,language:theme==='dark'?'en':'zh'})
for(const kind of ['hide-approach','hide-open','hide-cross','resize-open','disconnect-open','art-404','seam-probe'])cases.push({kind,width:580,height:720,theme:'light',language:'zh'})
const rows=[]
const selected=process.argv.slice(2)
try{for(const test of cases.filter(t=>!selected.length||selected.includes(t.kind))){
 const id=test.kind+'-'+test.width+'x'+test.height+'-'+test.theme,h=await harness({profile:await mkdtemp(join(generated,'profile-review-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
 const context=await browser.newContext({viewport:{width:test.width+224,height:Math.max(900,test.height+236)}}),page=await context.newPage(),errors=[]
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
 await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:'))return route.abort();if(test.kind==='art-404'&&url.endsWith('/entrance-gate-left.png'))return route.fulfill({status:404,body:'dualqa missing art'});return route.continue()})
 await context.addInitScript(()=>{
  window.__dqPhases=[];window.__dqHeld=[];window.__dqAllow=false
  window.addEventListener('message',event=>{
   const m=event.data;if(window!==parent||m?.channel!=='nidofy-ai-village')return
   if(m.type==='ready'&&m.token===''){window.__dqHeld=[];window.__dqAck=false}
   if(!window.__dqAllow&&(m.type==='first-frame-rendered'||window.__dqHeld.length)){window.__dqHeld.push({data:m,origin:event.origin,source:event.source});if(m.type==='first-frame-rendered')window.__dqAck=true;event.stopImmediatePropagation()}
  },true)
  new MutationObserver(()=>{const e=document.querySelector('.village-entrance');if(e&&window.__dqPhases.at(-1)?.phase!==e.dataset.phase)window.__dqPhases.push({phase:e.dataset.phase,at:performance.now(),canReveal:window.__villageHostFixture?.inspect().entrance.canReveal})}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-phase']})
 })
 const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect())
 const phase=p=>page.waitForFunction(p=>document.querySelector('.village-entrance')?.dataset.phase===p,p)
 const release=()=>page.evaluate(()=>{window.__dqAllow=true;for(const held of window.__dqHeld)window.dispatchEvent(new MessageEvent('message',held));window.__dqHeld=[]})
 const shot=async suffix=>{const name=id+'-'+suffix+'.png';await page.locator('.village-card').screenshot({path:join(shots,name)});return name}
 const record={...test,id,A_SHA:git('rev-parse','HEAD'),buildHashes:build.hashes,backend:'SwiftShader + explicit reviewMotion DOM animation override; NOT hardware GPU',artStatus:'ART_REVIEW',screenshots:[]}
 try{
  await page.goto(h.entry);await page.evaluate(()=>{window.__villageHostFixture.reviewMotion();window.__villageHostFixture.entranceViewport()})
  await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click()
  await page.waitForFunction(()=>window.__dqAck)
  await page.evaluate(p=>window.__dualqaActions.preferences(p),{theme:test.theme,language:test.language})
  if(test.kind==='hide-approach')await phase('approach')
  else if(test.kind!=='art-404')await phase('wait')
  assert.equal((await inspect()).entrance.canReveal,false);assert.equal((await inspect()).world.ticks,0)
  if(test.kind==='keyframes'){
   let vh=page.viewportSize().height
   for(let i=0;i<6;i++){await page.setViewportSize({width:test.width+224,height:vh});await page.waitForTimeout(80);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-test.width)<1&&Math.abs(box.height-test.height)<1)break;vh+=Math.round(test.height-box.height)}
   const box=await page.locator('.village-card').boundingBox();assert.ok(Math.abs(box.width-test.width)<1&&Math.abs(box.height-test.height)<1)
   for(const amount of [0,.25,.5,.75,1]){
    await page.locator('[data-door]').evaluateAll((doors,f)=>doors.forEach(d=>d.style.transform='rotateY('+(82*f*(d.dataset.door==='left'?1:-1))+'deg)'),amount)
    record.screenshots.push(await shot('door-'+amount*100))
   }
   await page.locator('[data-door]').evaluateAll(doors=>doors.forEach(d=>d.style.transform='rotateY(0deg)'))
  }

  if(test.kind==='seam-probe'){
   const manifest=JSON.parse(await readFile(join(out,'assets/entrance/manifest.json'),'utf8')),r=manifest.safeApertureRect
   const bounds=await page.evaluate(r=>{const camera=document.querySelector('.entrance-camera').getBoundingClientRect(),card=document.querySelector('.village-card').getBoundingClientRect();const plane=document.createElement('div');plane.id='dualqa-plane';Object.assign(plane.style,{position:'absolute',inset:'0',zIndex:'24',pointerEvents:'none'});document.querySelector('.village-card').append(plane);return {x:camera.x-card.x+r.x*camera.width,y:camera.y-card.y+r.y*camera.height,width:r.width*camera.width,height:r.height*camera.height}},r)
   const images=[]
   for(const [name,color]of [['blue','rgb(13,97,173)'],['pink','rgb(219,43,111)']]){
    await page.evaluate(c=>document.getElementById('dualqa-plane').style.background=c,color)
    const bytes=await page.locator('.village-card').screenshot();const file=id+'-'+name+'.png';await writeFile(join(shots,file),bytes);record.screenshots.push(file)
    images.push(await requireTool('sharp')(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}))
   }
   const [a,b]=images;let changed=0,total=0,maxDelta=0
   for(let y=Math.ceil(bounds.y)+2;y<bounds.y+bounds.height-2;y++)for(let x=Math.ceil(bounds.x)+2;x<bounds.x+bounds.width-2;x++){
    total++;const i=(y*a.info.width+x)*4;let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(a.data[i+c]-b.data[i+c]));maxDelta=Math.max(maxDelta,delta);if(delta>2)changed++
   }
   record.seam={method:'Closed production DOM doors, two solid diagnostic colors beneath entrance; safe rectangle inset 2 screen px',bounds,testedPixels:total,changedOver2:changed,maxDelta,thresholdExplanation:'RGB difference >2 exceeds 8-bit screenshot rounding; art approval still human'}
   await page.evaluate(()=>document.getElementById('dualqa-plane').remove())
   assert.equal(changed,0,'Closed door seam transmits underlying scene color')
  }

  const originalFrame=await page.locator('.village-canvas iframe').elementHandle()
  if(test.kind==='hide-approach'){
   await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await release();await page.evaluate(()=>window.__villageHostFixture.sidebar(false))
  }else{
   await release()
   if(test.kind.endsWith('-open')||test.kind==='hide-cross'){
    await phase(test.kind==='hide-cross'?'cross':'open')
    if(test.kind.startsWith('hide')){await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await page.evaluate(()=>window.__villageHostFixture.sidebar(false))}
    if(test.kind==='resize-open')await page.setViewportSize({width:1200,height:900})
    if(test.kind==='disconnect-open'){await page.evaluate(()=>window.__villageHostFixture.connection(false));await page.waitForTimeout(100);await page.evaluate(()=>window.__villageHostFixture.connection(true))}
   }
  }
  await page.waitForFunction(()=>window.__villageHostFixture.inspect().entrance.blocking===false)
  const state=await inspect();assert.equal(state.error,'');assert.equal(state.entrance.firstFrame,true)
  if(test.kind==='keyframes'||test.kind==='resize-open')assert.ok(await originalFrame.evaluate(e=>e.isConnected),'same live game frame survives visual entrance')
  if(test.kind.startsWith('hide')||test.kind==='disconnect-open')assert.equal(state.entrance.full,false)
  record.phases=await page.evaluate(()=>window.__dqPhases)
  if(test.kind==='keyframes'){
   assert.equal(record.phases.filter(p=>p.phase==='approach').length,1)
   assert.ok(record.phases.some(p=>p.phase==='open'&&p.canReveal));assert.ok(record.phases.some(p=>p.phase==='cross'&&p.canReveal))
  }
  await page.mouse.move(1,1);await page.waitForFunction(()=>document.querySelector('.village-card').getAnimations({subtree:true}).every(a=>a.playState!=='running'),{},{timeout:3000})
  assert.deepEqual(errors,[]);record.screenshots.push(await shot('entered'));record.status='PASS'
 }catch(e){record.status='FAIL';record.error=String(e);record.phases=await page.evaluate(()=>window.__dqPhases).catch(()=>[]);record.screenshots.push(await shot('failure').catch(()=>null))}
 finally{rows.push(record);console.log(id+' '+record.status+(record.error?' '+record.error:''));await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context.close();await h.close();await writeFile(join(evidence,'integrated-review'+(selected.length?'-'+selected.join('-'):'')+'.json'),JSON.stringify({A_SHA:git('rev-parse','HEAD'),scope:'Independent QA with the committed local ART_REVIEW alias; keyframes manually seek DOM doors while valid ACK held',rows},null,2))}
}}finally{await browser.close()}
if(rows.some(r=>r.status==='FAIL'))process.exitCode=1

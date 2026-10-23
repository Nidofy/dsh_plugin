/** Actual recovery entrance QA; inert until --execute and always uses a new isolated label. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp,stat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),qa=join(root,'docs/ai-village/reentry-recovery/qa'),buildRoot=join(root,'.build/ai-village-reentry-qa')
const label=process.argv[2],hash=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'))
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim()
if(!process.argv.includes('--execute'))console.log('PREPARED / NOT RUN: node scripts/ai-village-reentry-qa.mjs <new-label> --execute')
else{assert.ok(label&&/^[a-z0-9][a-z0-9-]{0,64}$/.test(label));await run()}
async function run(){
 const evidence=join(qa,label),generated=join(buildRoot,label),out=join(generated,'preview'),profile=join(generated,'profile')
 await mkdir(qa,{recursive:true});await mkdir(evidence);await mkdir(buildRoot,{recursive:true});await mkdir(generated);await mkdir(out);await mkdir(profile)
 const build={head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),dirty:git('status','--short'),version:(await json(join(pkg,'package.json'))).version,sourceHash:{},bundles:{},qaScript:hash(await readFile(join(root,'scripts/ai-village-reentry-qa.mjs')))}
 for(const f of(await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)).sort())build.sourceHash[f.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',f)))
 for(const f of['index.js','client.js','frame.js'])build.bundles[f]=hash(await readFile(join(pkg,'lib',f)))
 const art=await json(join(pkg,'assets/entrance/manifest.json')),artFiles=[]
 for(const f of art.files){const bytes=await readFile(join(pkg,'assets',f.file)),original=execFileSync('git',['show','98c5383471781443176a73f21abb246053ecdcd2:packages/ai-village/assets/'+f.file],{cwd:root,windowsHide:true,maxBuffer:8*1024*1024});assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.bytes);assert.equal(bytes.readUInt32BE(16),f.width);assert.equal(bytes.readUInt32BE(20),f.height);assert.ok(bytes.equals(original),'Existing approved PNG must retain its exact historical bytes');artFiles.push({file:f.file,sha256:hash(bytes),bytes:bytes.length,width:f.width,height:f.height,unchangedFrom:'98c5383471781443176a73f21abb246053ecdcd2'})}
 build.art={status:art.status,manifest:hash(await readFile(join(pkg,'assets/entrance/manifest.json'))),layers:art.layers.length,compressedBytes:artFiles.reduce((n,f)=>n+f.bytes,0),decodedPixels:artFiles.reduce((n,f)=>n+f.width*f.height,0),files:artFiles}
 assert.ok(build.art.layers<=8&&build.art.compressedBytes<=4*1024*1024&&build.art.decodedPixels<=8000000)
 const checks=[],requests=[],captures=[],errors=[],external=[],observations=[]
 let host,browser,context,page,failure,heartbeatOffline=false,stateOffline=false,artOffline=false,artFailures=0,frameGate=null,releaseFrame=null
 const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),frame=()=>page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'))
 const direct=name=>page.getByRole('button',{name,exact:true}).click(),click=name=>villageUI(page).click(name)
 const log=name=>{checks.push(name);console.log('PASS '+name)}
 const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'})
 const entered=async region=>{await page.waitForFunction(region=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.error&&!s.entrance.blocking&&!s.entrance.reentry&&s.world.region.active===region},region);await frame().waitForFunction(region=>{const m=window.__sceneMetrics();return m.region===region&&m.frames>0},region);assert.equal(await page.locator('.village-canvas iframe').count(),1)}
 const gate=async()=>{await page.getByRole('button',{name:'点击开门，重新进入',exact:true}).waitFor();await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.entrance.reentry&&!s.entrance.doorOpened&&!document.querySelector('.village-canvas iframe')});if(art.status==='APPROVED'&&!artOffline)await page.locator('.village-recovery-door[data-art-ready="true"]').waitFor();if(artOffline)await page.locator('.recovery-door-frame').waitFor();assert.equal((await inspect()).entrance.canReveal,false)}
 const closePanel=async()=>{const el=page.getByRole('button',{name:'关闭面板',exact:true});if(await el.isVisible())await el.click();await page.waitForTimeout(240)}
 const tab=async name=>{if((await inspect()).presentation.overlay)await closePanel();const el=page.getByRole('tab',{name,exact:true});if((await inspect()).presentation.drawer==='closed'||await el.getAttribute('aria-selected')!=='true')await el.click()}
 const shot=async(name,settle=true)=>{
  if(settle)await page.waitForTimeout(150)
  await page.screenshot({path:join(evidence,name+'.png'),animations:'allow'});const s=await inspect()
  const hiddenUI=await page.locator('.village-entry-ui').evaluate(el=>({hidden:el.getAttribute('aria-hidden'),visibility:getComputedStyle(el).visibility,tooltips:[...el.querySelectorAll('.village-hud button[aria-label]')].map(b=>({label:b.getAttribute('aria-label'),visibility:getComputedStyle(b,'::after').visibility,opacity:getComputedStyle(b,'::after').opacity}))}))
  if(s.entrance.blocking){assert.equal(hiddenUI.visibility,'hidden');assert.ok(hiddenUI.tooltips.every(t=>t.visibility==='hidden'&&Number(t.opacity)===0),'Hidden HUD pseudo-tooltips must not paint above the gate/loading screen')}
  captures.push({name,box:await page.locator('.village-card').boundingBox(),theme:s.preferences.theme,reducedMotion:s.preferences.reducedMotion,entrance:s.entrance,region:s.world?.region?.active,error:s.errorCode,iframeCount:await page.locator('.village-canvas iframe').count(),portraits:await page.locator('.entrance-portrait').count(),hiddenUI,art:await page.locator('.recovery-art').evaluateAll(es=>es.map(e=>({visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,images:[...e.querySelectorAll('img')].map(i=>({path:new URL(i.src).pathname,width:i.naturalWidth,height:i.naturalHeight,complete:i.complete}))}))),door:await page.locator('.recovery-art>[data-door],.recovery-door-leaf').evaluateAll(es=>es.map(e=>({transform:getComputedStyle(e).transform,transition:getComputedStyle(e).transitionDuration})))})
 }
 const armFrame=()=>{assert.equal(frameGate,null);frameGate=new Promise(r=>{releaseFrame=r})}
 const release=()=>{releaseFrame?.();releaseFrame=null;frameGate=null}
 const openAndLoad=async(name,region,reduced=false)=>{
  const before=(await inspect()).world,pauseBox=await page.locator('.village-hud button[aria-label="继续"]').boundingBox();armFrame();await direct('点击开门，重新进入')
  if(!reduced){await page.waitForFunction(()=>document.querySelector('.village-recovery-door')?.getAttribute('data-opening')==='true');await page.waitForTimeout(200);await shot(name+'-opening',false);const transforms=captures.at(-1).door.map(d=>d.transform);assert.equal(transforms.length,2);assert.ok(transforms.every(t=>t.startsWith('matrix3d(')&&Math.abs(Number(t.slice(9).split(',')[0]))<.95),'Door leaves must visibly rotate at the middle of their opening transition')}
  await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.entrance.doorOpened&&document.querySelectorAll('.entrance-portrait').length===7})
  if(pauseBox)await page.mouse.move(pauseBox.x+pauseBox.width/2,pauseBox.y+pauseBox.height/2)
  await page.waitForTimeout(550);assert.equal((await inspect()).entrance.firstFrame,false);assert.equal((await inspect()).entrance.blocking,true)
  const clips=await page.locator('.entrance-portrait img:last-child').evaluateAll(es=>es.map(e=>getComputedStyle(e).clipPath))
  observations.push({loading:name,clips,entrance:(await inspect()).entrance});await shot(name+'-seven-loading')
  release();await entered(region);assert.deepEqual((await inspect()).world,before);await shot(name+'-revealed')
 }
 const fault=async()=>{const b=await page.locator('.village-hud button[aria-label="继续"]').boundingBox();if(b)await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(550);heartbeatOffline=true;await page.waitForFunction(()=>window.__villageHostFixture.inspect().errorCode==='CONNECTION_TEMPORARY');await gate()}
 try{
  await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true});build.fixtureSha256=hash(await readFile(join(out,'fixture.js')));await writeFile(join(evidence,'build.json'),JSON.stringify(build,null,2)+'\n')
  const{harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js'))),{source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'));assert.ok(pw)
  const{chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1),executablePath=join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe');await stat(executablePath)
  host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')});browser=await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']});context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:join(evidence,'video'),size:{width:960,height:640}}})
  await context.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(host.url+'/')&&!url.startsWith('blob:')){external.push(new URL(url).origin);return route.abort()}
   const endpoint=new URL(url).pathname.split('/').at(-1)
   if(artOffline&&new URL(url).pathname.includes('/assets/entrance/')&&endpoint.endsWith('.png')){artFailures++;return route.abort('failed')}
   if(['heartbeat','state','save','recover','preferences-recover'].includes(endpoint))requests.push({endpoint,method:route.request().method(),ms:Math.round(performance.now()),aborted:endpoint==='heartbeat'&&heartbeatOffline||endpoint==='state'&&stateOffline})
   if(endpoint==='heartbeat'&&heartbeatOffline||endpoint==='state'&&stateOffline)return route.abort('failed')
   if(endpoint==='frame'&&frameGate)await frameGate
   return route.continue()
  })
  page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message))
  await page.goto(host.entry);await page.getByRole('textbox',{name:'消息输入'}).fill('故障恢复验收草稿，不发送。');await direct('打开 AI 小院');await entered('courtyard');await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush());await settled();await shot('initial-paused')
  const initial=(await inspect()).world,writes=requests.filter(r=>r.endpoint==='save').length
  await fault();await shot('heartbeat-closed-door');heartbeatOffline=false
  await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);await page.waitForTimeout(1000);await gate();assert.deepEqual((await inspect()).world,initial);assert.equal(requests.filter(r=>r.endpoint==='save').length,writes);await shot('automatically-reconciled-still-closed')
  log('real heartbeat failure removes frame and returns to closed door; successful automatic read-only recovery still requires an explicit click')
  await openAndLoad('courtyard-reentry','courtyard');log('normal click opens doors, seven portraits load while real frame response is pending, and actual first paint reveals the same courtyard')
  await fault();stateOffline=true;heartbeatOffline=false
  await page.waitForFunction(()=>window.__villageHostFixture.inspect().recoveryState==='blocked')
  const stateErrors=requests.filter(r=>r.endpoint==='state'&&r.aborted).length
  await direct('点击开门，重新进入');await page.locator('.village-recovery-door[data-opening="false"]').waitFor();await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.entrance.reentry&&!s.entrance.doorOpened&&s.recoveryState==='blocked'})
  await gate();assert.ok(requests.filter(r=>r.endpoint==='state'&&r.aborted).length>stateErrors);assert.deepEqual((await inspect()).world,initial)
  await page.locator('.recovery-door-details summary').click();await page.getByText('CONNECTION_TEMPORARY',{exact:true}).waitFor();await shot('state-failed-closed-diagnostics');assert.equal(requests.filter(r=>r.endpoint.includes('recover')).length,0)
  observations.push({failedRetry:(await inspect()).diagnostics});await page.locator('.recovery-door-details summary').click();stateOffline=false
  await openAndLoad('retry-after-state-failure','courtyard');assert.equal(requests.filter(r=>r.endpoint==='save').length,writes);log('state-read failure closes the door again with diagnostics and unchanged world; no previous-version restore or replayed save')
  await click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption('dark');await settled();if(!(await inspect()).preferences.reducedMotion)await page.getByLabel('减少动态',{exact:true}).click();await settled();await closePanel();await click('展开小院')
  let height=596,matched=false;for(let i=0;i<6;i++){await page.setViewportSize({width:544,height});await page.waitForTimeout(180);const b=await page.locator('.village-card').boundingBox();if(Math.abs(b.width-320)<1&&Math.abs(b.height-360)<1){matched=true;break}height+=Math.round(360-b.height)}assert.ok(matched);await entered('courtyard')
  await fault();await shot('320-dark-reduced-closed-door');heartbeatOffline=false;await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);await gate();await openAndLoad('320-dark-reduced','courtyard',true);log('actual 320x360 dark/reduced-motion gate, seven portraits and successful first-frame reveal')
  await tab('布置');await direct('家具');await page.getByRole('region',{name:'AI 书屋 · 开发样板',exact:true}).getByRole('button',{name:'前往 AI 书屋',exact:true}).click();await settled();await entered('bookhouse');const book=(await inspect()).world
  await fault();await shot('bookhouse-closed-door');heartbeatOffline=false;await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);await gate();await openAndLoad('bookhouse-reentry','bookhouse',true);assert.deepEqual((await inspect()).world,book);log('bookhouse recovery uses the door and loading path, then restores the same bookhouse rather than traveling to the courtyard')
  artOffline=true;await fault();await page.waitForFunction(()=>!document.querySelector('.recovery-art'));assert.ok(artFailures>0);assert.equal(await page.locator('.recovery-door-leaf').count(),2);await shot('art-decode-failed-css-fallback');heartbeatOffline=false;await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);await gate();await openAndLoad('art-decode-failed-reentry','bookhouse',true);assert.deepEqual((await inspect()).world,book);artOffline=false;log('real entrance PNG request failures reject image decoding and retain an operable CSS door, seven portraits and same bookhouse recovery')
  assert.equal(requests.filter(r=>r.endpoint.includes('recover')).length,0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.getByRole('textbox',{name:'消息输入'}).inputValue(),'故障恢复验收草稿，不发送。');log('no automatic historical restore, page exception, external/model request, or composer change')
 }catch(error){failure=String(error?.stack||error);console.error(failure);await page?.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});const s=await inspect().catch(()=>null);if(s)await writeFile(join(evidence,'failure-state.json'),JSON.stringify({world:s.world,error:s.error,errorCode:s.errorCode,entrance:s.entrance,recoveryState:s.recoveryState,reasons:s.reasons,diagnostics:s.diagnostics,preferences:s.preferences},null,2))}
 finally{release();await page?.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context?.close();await host?.close();await browser?.close();await writeFile(join(evidence,'validation.json'),JSON.stringify({status:failure?'FAIL':'PASS',build,checks,captures,observations,requests,artFailures,errors,external,failure,scope:'Independent authenticated Host and real UI/frame, route failures only; no world/tick injection, no normal DSH_HOME, no model request',notRun:['native Desktop installation','GPU/performance resampling','all legacy gameplay']},null,2)+'\n')}
 if(failure)process.exitCode=1
}

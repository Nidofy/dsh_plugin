/** Isolated, pinned native QA. UI writes only; never inject world/ticks or use a normal profile. */
import assert from 'node:assert/strict'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {measureNative} from './ai-village-life-qa-diagnostics.mjs'
const root=resolve(import.meta.dirname,'..'),mode=process.argv[2]??'inspect',label=process.argv[3]
assert.match(label??'',/^[a-z0-9][a-z0-9-]{0,60}$/)
const runRoot=process.env.AI_VILLAGE_RUN_ROOT??'ai-village-life-qa-desktop-baseline'
assert.match(runRoot,/^ai-village-life-qa-desktop(?:-[a-z0-9-]+)?$/)
const work=join(root,'.build',runRoot),evidence=join(root,'docs/ai-village/life-content/QA-native',label)
await mkdir(evidence,{recursive:true})
try{await readFile(join(evidence,'result.json'));throw Error('Evidence label already has a result')}catch(e){if(e.code!=='ENOENT')throw e}
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex')
const bounded=async(p,label,ms=15000)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_TIMEOUT '+label+' '+ms+'ms')),ms)})])}finally{clearTimeout(timer)}}
const version=process.env.AI_VILLAGE_EXPECTED_VERSION??'0.9.0-preview.2',expectedSha=process.env.AI_VILLAGE_EXPECTED_SHA??'929d5be8cb72a2ad0c1e9a32b30fc90181c3ceab2d4a6755fd6e884ff19d5638'
assert.equal(!!process.env.AI_VILLAGE_EXPECTED_VERSION,!!process.env.AI_VILLAGE_EXPECTED_SHA,'Override requires both explicit version and SHA');assert.match(version,/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/);assert.match(expectedSha,/^[a-f0-9]{64}$/)
const artifact={version,file:`nidofy-dsh-ai-village-${version}.tgz`,sha256:expectedSha}
assert.equal(hash(await readFile(join(root,'dist',artifact.file))),artifact.sha256)
const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
assert.ok(pw);const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const port=Number(process.env.AI_VILLAGE_QA_PORT??18769);assert.ok(Number.isInteger(port)&&port>=18769&&port<=18779)
const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:15000}),protocol=await bounded(browser.newBrowserCDPSession(),'browser CDP')
const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>p.url().startsWith('dsh-app:'));assert.ok(page)
page.setDefaultTimeout(15000)
const checks=[],errors=[],observations=[],requests=[];page.on('pageerror',e=>errors.push(e.message))
const world=()=>bounded(page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/state',{signal:AbortSignal.timeout(10000)});return r.ok?(await r.json()).saved?.world:null}),'world state')
const direct=name=>page.getByRole('button',{name,exact:true}).click()
const until=async(fn,message,seconds=60)=>{const deadline=Date.now()+seconds*1000;while(Date.now()<deadline){const x=await bounded(fn(),message);if(x)return x;await page.waitForTimeout(200)}throw Error(message)}
const frame=async()=>{if(!await bounded(page.locator('.village-canvas iframe').count(),'iframe count'))return null;const el=await page.locator('.village-canvas iframe').elementHandle();return el?await bounded(el.contentFrame(),'content frame'):null}
const metrics=async()=>{const f=await frame();return f?await bounded(f.evaluate(()=>({visibility:document.visibilityState,...window.__sceneMetrics?.()})),'scene metrics'):null}
const shot=async name=>{const c=await bounded(page.context().newCDPSession(page),'screenshot session');try{const s=await bounded(c.send('Page.captureScreenshot',{format:'png',fromSurface:true}),'screenshot',8000);await writeFile(join(evidence,name+'.png'),Buffer.from(s.data,'base64'))}finally{await bounded(c.detach(),'detach screenshot',3000).catch(()=>{})}}
const ready=async region=>{await until(async()=>{const m=await metrics();return m?.region===region&&m.frames>0},'First painted frame '+region);assert.equal(await page.locator('.village-canvas iframe').count(),1)}
const closePanel=async()=>{const b=page.getByRole('button',{name:'Close panel',exact:true});if(await b.isVisible())await b.click();await page.waitForTimeout(200)}
const tab=async name=>{await closePanel();await page.getByRole('tab',{name,exact:true}).click()}
const hud=async name=>{const b=page.getByRole('button',{name,exact:true});if(!await b.isVisible())await page.locator('.village-card').getByRole('button',{name:'More',exact:true}).click();await b.click()}
const pause=async value=>{await closePanel();if((await world()).userPaused!==value){await hud(value?'Pause':'Resume');await until(async()=>(await world())?.userPaused===value,'Pause preference committed')}}
const travel=async target=>{if(target==='bookhouse'){await tab('Decor');await direct('Furniture');await direct('Go to AI Bookhouse')}else{await tab('Residents');await direct('Return to courtyard')}await until(async()=>(await world())?.region?.active===target,'Travel saved');await ready(target);await closePanel()}
const facts=w=>({journal:w.journal,progress:w.progress,memories:w.neighborhood.memories,bonds:w.neighborhood.bonds,home:w.home})
const rosterMode=process.env.AI_VILLAGE_QA_ROSTER??'legacy';assert.ok(['legacy','mixed'].includes(rosterMode))
const admitSeven=async()=>{
 if((await world()).region.active==='bookhouse')await travel('courtyard')
 await tab('Residents');await direct('All residents');await direct('Manage residents')
 if(rosterMode==='mixed'){
  await direct('Keep selected only');await until(async()=>(await world()).companions.length===0,'Keep selected resident committed')
  for(const [id,name] of [['claude','Claude'],['seedance','Seedance'],['glm','GLM'],['minimax','MiniMax'],['llama','Llama'],['mistral','Mistral']]){const cb=page.getByRole('checkbox',{name:'Resident '+name,exact:true});if(!await cb.isChecked())await cb.click();await until(async()=>{const w=await world();return [w.actor,...w.companions].some(a=>a.id===id)},'Resident arrival committed '+id)}
 }else{const all=page.getByRole('button',{name:'Invite everyone',exact:true});if(await all.count())await all.click();else{const boxes=page.locator('.village-admissions input[type=checkbox]');for(let i=0;i<await boxes.count()&&(await world()).companions.length<6;i++){if(!await boxes.nth(i).isChecked()){await boxes.nth(i).click();await page.waitForTimeout(500)}}}}
 await until(async()=>(await world()).companions.length===6,'Seven residents persisted');await closePanel();observations.push({rosterMode,ids:[(await world()).actor,...(await world()).companions].map(a=>a.id)})
}
let environment,failure,heartbeatOffline=false
const dismissWelcome=async()=>{const welcome=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('welcome.html'));if(!welcome)return;welcome.setDefaultTimeout(15000);const add=welcome.getByRole('button',{name:'Add API Key',exact:true}),later=welcome.getByRole('button',{name:'Set up later',exact:true});if(await add.isVisible())await add.click();await later.waitFor();await later.click();checks.push('Dismissed reappearing official welcome via Set up later, without credentials');await page.waitForTimeout(300)}
const scriptSha=hash(await readFile(new URL(import.meta.url)))
const diagnosticScriptHashes=Object.fromEntries(await Promise.all(['ai-village-life-qa-diagnostics.mjs','ai-village-life-qa-process-snapshot.ps1'].map(async name=>[name,hash(await readFile(join(root,'scripts',name)))])))
const status=()=>failure?'FAIL':mode==='pause'?'PAUSED':mode==='diagnose'?'DIAGNOSTIC':'PASS'
const report=async()=>writeFile(join(evidence,'result.json'),JSON.stringify({status:status(),mode,artifact,scriptSha,diagnosticScriptHashes,rosterMode,profile:'.build/'+runRoot,cdpPort:port,environment,checks,errors,observations,requests,failure,world:await world().catch(()=>null),metrics:await metrics().catch(()=>null)},null,2)+'\n')
try{
 await bounded(dismissWelcome(),'dismiss official welcome',20000)
 environment={gpu:(await bounded(protocol.send('SystemInfo.getInfo'),'GPU info')).gpu,window:await bounded(page.evaluate(()=>({dpr:devicePixelRatio,inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],screen:[screen.width,screen.height],visibility:document.visibilityState})),'window state'),browser:await bounded(protocol.send('Browser.getVersion'),'browser version')}
 if(mode==='activate'){
  observations.push({before:await metrics()});await page.bringToFront();await page.waitForTimeout(5000);observations.push({after:await metrics()});checks.push('Requested Page.bringToFront only on isolated native page; no world mutation or throttling flags');await shot('activated')
 }else if(mode==='inspect'){observations.push({pages:await Promise.all(pages.map(async p=>({kind:p.url().includes('welcome.html')?'welcome':p.url().startsWith('dsh-app:')?'app':'other',buttons:await p.getByRole('button').allTextContents()})))});await shot('inspect')}
 else if(mode==='install'){
  const close=page.getByRole('button',{name:'Close',exact:true});if(await close.isVisible())await close.click()
  await direct('Plugins');await direct('Add plugin');await page.getByRole('textbox',{name:'Package name or address'}).fill(join(root,'dist',artifact.file));await direct('Install');await page.getByRole('button',{name:'Enable now',exact:true}).waitFor({timeout:90000});await direct('Enable now');await shot('installed');checks.push('Official manager installed pinned '+artifact.version+' into new isolated profile')
 }else{
  const installed=join(work,'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village');assert.equal((await json(join(installed,'package.json'))).version,artifact.version)
  const unpack=join(work,'pinned-package');await mkdir(unpack,{recursive:true});execFileSync('tar',['-xf',join(root,'dist',artifact.file),'-C',unpack],{windowsHide:true})
  for(const f of ['lib/index.js','lib/client.js','lib/frame.js'])assert.deepEqual(await readFile(join(installed,f)),await readFile(join(unpack,'package',f)))
  checks.push('Installed three bundles match exact pinned package bytes')
  if(!await page.locator('.village-card').count()){await page.getByRole('button',{name:'New session',exact:true}).first().click();await direct('Open AI Village')}
  const entry=page.getByRole('button',{name:'Click to enter again',exact:false});if(await entry.count()){await entry.click();checks.push('Explicitly re-entered preserved native recovery entrance at start')}
  await ready((await world())?.region?.active??'courtyard');await pause(true)
  if(mode==='pause'){
   await writeFile(join(work,'checkpoint.json'),JSON.stringify({artifact,world:await world()},null,2));checks.push('User-requested safe pause committed and checkpoint preserved; no new acceptance scenario')
  }else if(mode==='restored'){
   const expected=await json(join(work,'checkpoint.json'));assert.deepEqual(await world(),expected.world);checks.push('Complete process restart restored exact paused checkpoint in '+expected.world.region.active);await shot('cold-restored');if(expected.world.region.active==='courtyard')await travel('bookhouse');await travel('courtyard');assert.deepEqual(facts(await world()),facts(expected.world));checks.push('Actual return to courtyard after cold restart')
  }else if(mode==='candidate-story'){
   assert.equal(rosterMode,'mixed');assert.equal((await world()).schemaVersion,11);assert.equal((await world()).companions.length,6)
   if((await world()).region.active!=='bookhouse')await travel('bookhouse')
   const before=await world(),oldCount=before.bookhouse.memory?.count??0;assert.equal(before.bookhouse.active,null)
   await pause(false);await tab('Wishes');await page.getByRole('combobox',{name:'Reading companion',exact:true}).selectOption('seedance');await direct(oldCount?'Read together again':'Find a little light together');await until(async()=>!!(await world()).bookhouse.active,'Story start saved')
   const buttons=['Remember the window light','Write our sentence','Keep the little-light bookmark']
   for(let stage=0;stage<3;stage++){
    await until(async()=>await page.getByRole('button',{name:buttons[stage],exact:true}).isEnabled().catch(()=>false),'Real participants reached stage '+stage,180)
    await pause(true);const at=await world(),e=at.bookhouse.active;assert.equal(e.stage,stage);assert.equal(e.phase,'ready');assert.equal(e.remainingTicks,0);for(let i=0;i<e.participants.length;i++){const a=[at.actor,...at.companions].find(a=>a.id===e.participants[i]);assert.ok(Math.hypot(a.position.x-e.targets[i].x,a.position.y-e.targets[i].y)<.01)}
    observations.push({stage,ticks:at.ticks,event:e,actors:[at.actor,...at.companions],metrics:await metrics()});await shot('native-story-stage-'+stage)
    await pause(false);await tab('Wishes');await direct(buttons[stage]);await until(async()=>{const e=(await world()).bookhouse.active;return stage===2?e===null:e?.stage===stage+1},'Story stage CAS saved '+stage)
   }
   await pause(true);const completed=await world();assert.equal(completed.bookhouse.memory.count,oldCount+1);assert.ok(completed.bookhouse.memory.participants.includes('seedance'));assert.equal(completed.bookhouse.keepsake,'bookhouse');assert.equal(completed.companions.length,6);await shot('native-story-completed')
   await writeFile(join(work,'checkpoint.json'),JSON.stringify({artifact,world:completed},null,2));checks.push('Seven mixed native residents: real Seedance/Bluewhale routes and all three 90-tick observations completed via UI; one durable memory and bookhouse bookmark saved')
  }else if(mode==='freeze'){
   const renderer=await bounded(page.context().newCDPSession(page),'freeze session'),frozen=await world();
   await bounded(renderer.send('Page.setWebLifecycleState',{state:'frozen'}),'freeze renderer');await new Promise(r=>setTimeout(r,15000));await bounded(renderer.send('Page.setWebLifecycleState',{state:'active'}),'restore renderer');await ready(frozen.region.active);assert.deepEqual(await world(),frozen);checks.push('15-second Chromium renderer frozen/active cycle preserves exact user-paused world; not physical OS sleep');await bounded(renderer.detach(),'freeze detach',3000);await shot('renderer-restored')
  }else if(mode==='recovery'){
   const renderer=await page.context().newCDPSession(page),target=(await renderer.send('Target.getTargetInfo')).targetInfo.targetId,windowInfo=await protocol.send('Browser.getWindowForTarget',{targetId:target})
   await pause(false);await protocol.send('Browser.setWindowBounds',{windowId:windowInfo.windowId,bounds:{windowState:'minimized'}})
   await until(async()=>await page.evaluate(()=>document.visibilityState==='hidden'),'Native minimized page becomes hidden')
   await page.waitForTimeout(1500);const hiddenWorld=await world();assert.equal(await page.locator('.village-canvas iframe').count(),0);await page.waitForTimeout(15000);assert.deepEqual(await world(),hiddenWorld)
   await protocol.send('Browser.setWindowBounds',{windowId:windowInfo.windowId,bounds:{windowState:'normal'}});await page.bringToFront();await ready(hiddenWorld.region.active);await pause(true);checks.push('Actual native minimize/restore: hidden iframe released; 15 seconds hidden world unchanged; same region re-enters')
   const frozen=await world();await renderer.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,15000));await renderer.send('Page.setWebLifecycleState',{state:'active'});await ready(frozen.region.active);assert.deepEqual(await world(),frozen);checks.push('15-second Chromium renderer frozen/active cycle preserves exact user-paused world; not physical OS sleep')
   observations.push({kind:'visibility-recovery',windowId:windowInfo.windowId,originalBounds:windowInfo.bounds,after:await page.evaluate(()=>({dpr:devicePixelRatio,visibility:document.visibilityState}))});await renderer.detach();await shot('native-restored')
  }else if(mode==='soak'){
   assert.equal((await world()).companions.length,6,'Use the already verified seven-resident baseline')
   if((await world()).region.active!=='bookhouse')await travel('bookhouse')
   const start=Date.now();await pause(false);let epoch=0,previous={metrics:await metrics(),world:await world()};const nativeSnapshot=()=>JSON.parse(execFileSync('pwsh',['-NoProfile','-File',join(root,'scripts/ai-village-life-qa-process-snapshot.ps1'),'-RunRoot',runRoot],{encoding:'utf8',windowsHide:true,timeout:15000}));const firstNative=nativeSnapshot();assert.ok(firstNative.windowVisible&&firstNative.mainWindowHandle,'Actual native window visible at start');observations.push({kind:'soak-start',epoch,native:firstNative});
   for(let minute=1;minute<=60;minute++){
    await page.waitForTimeout(60000);assert.ok(!browser.contexts().flatMap(c=>c.pages()).some(p=>p.url().includes('welcome.html')),'Unexpected welcome during soak');const m=await metrics(),w=await world(),native=nativeSnapshot();assert.ok(native.windowVisible&&native.mainWindowHandle,'Actual native window remains visible');assert.ok(m&&m.frames>previous.metrics.frames,'Frames advance within same iframe epoch');assert.ok(w.ticks>previous.world.ticks,'World ticks advance');assert.equal(m.visibility,'visible');assert.equal(m.actors,7);assert.ok(m.paintSampleCount<=600);assert.equal(m.textures,w.region.active==='bookhouse'?121:128);assert.equal(m.urls,m.textures);assert.equal(await page.locator('.village-canvas iframe').count(),1);assert.equal(w.userPaused,false)
    const record={minute,epoch,native,frameDelta:m.frames-previous.metrics.frames,tickDelta:w.ticks-previous.world.ticks,elapsedSeconds:(Date.now()-start)/1000,region:w.region.active,ticks:w.ticks,frame:m,errors:[...errors]};observations.push(record);await writeFile(join(evidence,'soak-progress.json'),JSON.stringify({status:'RUNNING',artifact,start:new Date(start).toISOString(),observations},null,2));console.log(JSON.stringify({minute,region:w.region.active,ticks:w.ticks,textures:m.textures,frames:m.frames,elapsedSeconds:record.elapsedSeconds}))
    previous={metrics:m,world:w};if(minute%10===0&&minute<60){await pause(true);const before=await world();await hud('Close courtyard');await page.locator('.village-canvas iframe').waitFor({state:'detached'});await page.waitForTimeout(1000);assert.deepEqual(await world(),before);await direct('Open AI Village');await ready(before.region.active);await travel(before.region.active==='bookhouse'?'courtyard':'bookhouse');await pause(false);epoch++;previous={metrics:await metrics(),world:await world()};observations.push({kind:'iframe-epoch',minute,epoch,region:previous.world.region.active,frames:previous.metrics.frames,ticks:previous.world.ticks})}
   }
   await pause(true);await writeFile(join(evidence,'soak-progress.json'),JSON.stringify({status:'PASS',artifact,start:new Date(start).toISOString(),observations},null,2));await writeFile(join(work,'checkpoint.json'),JSON.stringify({artifact,world:await world()},null,2));await shot('one-hour-finished');assert.deepEqual(errors,[]);checks.push('60 one-minute intervals with seven residents, bounded resources, five real close/reopen and region switches; concurrent builds allowed, not a performance benchmark')
  }else if(mode==='performance'||mode==='diagnose'){
   await admitSeven()
   const renderer=await page.context().newCDPSession(page);await renderer.send('Performance.enable')
   const measure=async(name,visible)=>{const item=await measureNative({page,protocol,parentSession:renderer,frame:await frame(),world,root,runRoot,evidence,name,seconds:20,fullCpu:process.env.AI_VILLAGE_FULL_CPU==='1',profile:visible&&mode==='diagnose'});observations.push(item);await writeFile(join(evidence,'samples-progress.json'),JSON.stringify(observations,null,2));console.log(JSON.stringify({name,fps:item.fps,cdpCpu:item.cdpCpuPercentOfOneCore,fullTreeCpu:item.fullTree?.cpuPercentOfOneCore,profile:item.profiling}));return item}
   for(const target of ['courtyard','bookhouse']){if((await world()).region.active!==target)await travel(target);await pause(false);await page.waitForTimeout(2000);const r=await measure(target,true);r.originalFpsGate=r.fps>20&&r.fps<=35;assert.ok(r.after.textures<=128);assert.ok(r.after.paintSampleCount<=600,'Original 600 sample bound');await pause(true);const frozen=await world();await hud('Close courtyard');await page.locator('.village-canvas iframe').waitFor({state:'detached'});const hidden=await measure(target+'-hidden',false);assert.equal(hidden.fps,0);assert.equal(hidden.worldUnchanged,true);await direct('Open AI Village');await ready(target);assert.deepEqual(await world(),frozen)}
   await renderer.detach();if(mode==='performance')assert.ok(observations.filter(o=>o.originalFpsGate!==undefined).every(o=>o.originalFpsGate),'Original 20–35 FPS gate, after collecting both regions');await shot('performance-restored');checks.push(mode==='diagnose'?'Diagnostic CPU profiles recorded; original FPS gate outcomes retained per scene, profiling overhead is not a benchmark':'Seven residents: original FPS/resource/sample bounds; closed scenes preserve exact world');await writeFile(join(work,'checkpoint.json'),JSON.stringify({artifact,world:await world()},null,2))
  }else if(mode==='check'){
   if(rosterMode==='mixed')await admitSeven()
   if((await world()).region.active==='bookhouse')await travel('courtyard')
   const before=await world();await travel('bookhouse');const entered=await world();assert.equal(entered.ticks,before.ticks);assert.equal(entered.rng,before.rng);assert.deepEqual(facts(entered),facts(before));await shot('bookhouse');checks.push('Actual paused travel keeps clock, RNG and shared facts')
   await page.route('**/api/nidofy-ai-village/**',async route=>{const endpoint=new URL(route.request().url()).pathname.split('/').at(-1);if(['heartbeat','state','save','recover'].includes(endpoint))requests.push({endpoint,method:route.request().method(),aborted:endpoint==='heartbeat'&&heartbeatOffline});if(endpoint==='heartbeat'&&heartbeatOffline)return route.abort('failed');return route.continue()})
   const lost=await (await frame()).evaluate(()=>{const c=document.querySelector('canvas'),gl=c?.getContext('webgl2')??c?.getContext('webgl');const ext=gl?.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true});assert.ok(lost,'Actual WebGL context loss extension available');await page.locator('.village-recovery-door').waitFor({timeout:60000});assert.equal(await page.locator('.village-canvas iframe').count(),0);await shot('fault-door')
   await page.waitForTimeout(5000);assert.equal(await page.locator('.village-canvas iframe').count(),0);await direct('Open the doors and enter again');await ready('bookhouse');assert.deepEqual(await world(),entered);checks.push('Actual WebGL context loss removes frame; explicit door click restores same paused bookhouse');await shot('reentered')
   await page.unroute('**/api/nidofy-ai-village/**');const w=await world();await hud('Close courtyard');await page.locator('.village-canvas iframe').waitFor({state:'detached'});await page.waitForTimeout(5000);assert.deepEqual(await world(),w);await direct('Open AI Village');await ready('bookhouse');assert.deepEqual(await world(),w);checks.push('Close/reopen releases iframe and preserves paused world (not OS sleep)')
   await writeFile(join(work,'checkpoint.json'),JSON.stringify({artifact,world:await world()},null,2));assert.equal(requests.filter(r=>r.endpoint==='recover').length,0);assert.deepEqual(errors,[])
  }else throw Error('Unsupported mode '+mode)
 }
}catch(e){failure=String(e.stack??e);if(mode==='soak')await writeFile(join(evidence,'soak-progress.json'),JSON.stringify({status:'FAIL',artifact,failure,observations},null,2));await shot('failure').catch(()=>{});observations.push({buttons:await bounded(page.getByRole('button').allTextContents(),'failure buttons',5000).catch(()=>[])})}
finally{heartbeatOffline=false;await bounded(report(),'final report',35000).catch(async e=>{failure=failure??String(e.stack??e);await writeFile(join(evidence,'report-timeout.json'),JSON.stringify({status:'FAIL',failure,reportFailure:e.message,checks,observations},null,2))});await bounded(protocol.detach(),'detach browser',3000).catch(()=>{});console.log(JSON.stringify({status:status(),mode,evidence,checks,failure}));process.exit(failure?1:0)}

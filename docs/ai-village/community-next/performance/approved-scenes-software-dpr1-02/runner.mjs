/** Independent bounded performance observation. Real authenticated UI; no world/tick/pose injection. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import * as tar from 'tar'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'

const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),label=process.argv[2]
const version='0.13.0-preview.3',expectedSha='50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2'
assert.match(label??'',/^[a-z0-9-]+$/);assert.ok(process.argv.includes('--run'),'Use --run only after parallel QA has finished')
const qa=join(root,'docs/ai-village/community-next/performance',label),out=join(root,'.build/ai-village-approved-scenes-perf',label)
await mkdir(join(root,'docs/ai-village/community-next/performance'),{recursive:true});await mkdir(qa);await mkdir(out,{recursive:true})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),identity={version,packageSha:expectedSha,source:{},bundles:{},scriptSha:hash(await readFile(new URL(import.meta.url)))}
await writeFile(join(qa,'runner.mjs'),await readFile(new URL(import.meta.url)))
const archive=join(root,'dist',`nidofy-dsh-ai-village-${version}.tgz`)
assert.equal(hash(await readFile(archive)),expectedSha);assert.equal(JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,version)
const unpack=join(out,'unpack');await mkdir(unpack);await tar.x({file:archive,cwd:unpack})
for(const file of ['index.js','client.js','frame.js']){
 const bytes=await readFile(join(pkg,'lib',file));identity.bundles[file]=hash(bytes)
 assert.equal(hash(await readFile(join(unpack,'package/lib',file))),identity.bundles[file],`Pinned package/lib mismatch: ${file}`)
}
for(const file of(await readdir(join(pkg,'src'),{recursive:true})).filter(file=>/\.tsx?$/.test(file)))identity.source[file.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',file)))
// The fixture compiles the recorded current client source, while Host/frame run copied pinned lib.
// Hash again after preparation and at teardown to reject concurrent source changes.
async function sourceUnchanged(){for(const[file,sha]of Object.entries(identity.source))assert.equal(hash(await readFile(join(pkg,'src',file))),sha,`Source changed during measurement: ${file}`)}
await cp(join(unpack,'package/lib'),join(out,'lib'),{recursive:true});await cp(join(unpack,'package/assets'),join(out,'assets'),{recursive:true})
await runPreview({root,pkg,out,buildOnly:true});await sourceUnchanged()
await mkdir(join(out,'profile'),{recursive:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js')))
const host=await harness({profile:join(out,'profile'),plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(name=>name.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(name=>name.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const browserCDP=await browser.newBrowserCDPSession(),context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1}),page=await context.newPage(),pageCDP=await context.newCDPSession(page)
await pageCDP.send('Performance.enable')
identity.browserVersion=await browser.version();identity.gpu=(await browserCDP.send('SystemInfo.getInfo')).gpu
identity.environment={headless:true,dpr:1,viewport:{width:1440,height:960},sampleSeconds:5,renderer:'software SwiftShader requested; actual GPU strings retained',fixture:'source client + pinned package Host/frame'}
await writeFile(join(qa,'identity.json'),JSON.stringify(identity,null,2)+'\n')
const errors=[],external=[],latencies=[],regions=[],trips=[],cpuSamples=[],ownPids=new Set(),checks=[]
page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message))
await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(host.url+'/')||url.startsWith('blob:'))return route.continue();external.push(url);return route.abort()})
await page.addInitScript(()=>{
 window.__scenePerfTrace={clicks:[],frames:[]}
 document.addEventListener('click',event=>{const button=event.target?.closest?.('button');if(button)window.__scenePerfTrace.clicks.push({at:performance.now(),text:button.textContent?.trim(),label:button.getAttribute('aria-label')})},true)
 window.addEventListener('message',event=>{const m=event.data;if(m?.channel==='nidofy-ai-village'&&m?.type==='first-frame-rendered')window.__scenePerfTrace.frames.push({at:performance.now(),version:m.version,assetRevision:m.assetRevision,viewRevision:m.viewRevision})})
})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),direct=name=>page.getByRole('button',{name,exact:true}).click()
const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'})
const entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&s.frameReady&&!s.entrance.blocking&&!s.error})
const frame=()=>page.frames().find(frame=>frame.url().includes('/api/nidofy-ai-village/frame'))
const metrics=()=>frame().evaluate(()=>window.__sceneMetrics())
const close=async()=>{const button=page.getByRole('button',{name:'关闭面板',exact:true});if(await button.isVisible())await button.click()}
const pause=async value=>{await close();if((await inspect()).world.userPaused!==value){await villageUI(page).click(value?'暂停':'继续');await settled()}}
const log=message=>{checks.push(message);console.log(message)}
async function processes(){const result=(await browserCDP.send('SystemInfo.getProcessInfo')).processInfo;for(const p of result){assert.ok(Number.isSafeInteger(p.id)&&p.id>0);ownPids.add(p.id)}return result}
function processRSS(ids){
 if(!ids.length)return[]
 // IDs come only from this owned browser's CDP session; no process enumeration or user-app metrics.
 const command=`Get-Process -Id ${[...new Set(ids)].join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress; exit 0`
 const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000}).trim()
 return raw?[JSON.parse(raw)].flat():[]
}
const cpuDelta=(before,after,elapsedMs)=>{
 const rows=after.filter(p=>before.some(q=>q.id===p.id)).map(p=>({id:p.id,type:p.type,cpuSeconds:p.cpuTime-before.find(q=>q.id===p.id).cpuTime}))
 return{elapsedMs,rows,cpuSeconds:rows.reduce((sum,p)=>sum+p.cpuSeconds,0),singleCorePercent:rows.reduce((sum,p)=>sum+p.cpuSeconds,0)*100000/elapsedMs,newPids:after.filter(p=>!before.some(q=>q.id===p.id)).map(p=>p.id),exitedPids:before.filter(p=>!after.some(q=>q.id===p.id)).map(p=>p.id)}
}
async function memorySnapshot(){
 const processInfo=await processes(),rss=processRSS(processInfo.map(p=>p.id)),raw=await pageCDP.send('Performance.getMetrics'),mainPage=Object.fromEntries(raw.metrics.map(m=>[m.name,m.value]))
 return{at:new Date().toISOString(),mainPage,processInfo,rss,rssTotalBytes:rss.reduce((sum,p)=>sum+p.WorkingSet64,0),privateTotalBytes:rss.reduce((sum,p)=>sum+p.PrivateMemorySize64,0),scope:'Performance metrics are main-page CDP target only; RSS is summed owned browser CDP PIDs and includes shared pages'}
}
async function confirmClick(locator,predicate,arg,kind){
 const traceIndex=await page.evaluate(()=>window.__scenePerfTrace.clicks.length);await locator.click()
 const observed=await page.waitForFunction(({predicate,arg})=>{const test=new Function('state','arg',predicate);return test(window.__villageHostFixture.inspect(),arg)?performance.now():false},{predicate,arg})
 const confirmedAt=await observed.jsonValue(),click=await page.evaluate(index=>window.__scenePerfTrace.clicks[index],traceIndex)
 assert.ok(click);const result={kind,click,confirmedAt,clickToObservedConfirmationMs:confirmedAt-click.at,confirmationSampling:'Playwright polling; includes observer scheduling latency'};latencies.push(result);return result
}
async function travel(region){
 await pause(true);await direct('社区地图');await page.locator('.village-community-map').waitFor();await page.locator(`.village-map-places [data-place="${region}"]`).click()
 const before=await inspect(),firstFrameIndex=await page.evaluate(()=>window.__scenePerfTrace.frames.length)
 const latency=await confirmClick(page.locator('.village-map-travel'),'return state.world.region.active===arg.region && state.revision===arg.revision+1 && state.saveReceipt.status!=="pending"',{region,revision:before.revision},'travel-'+region)
 await entered();const after=await inspect(),firstFrame=await page.evaluate(index=>window.__scenePerfTrace.frames.slice(index).find(row=>row.version===11),firstFrameIndex)
 assert.equal(after.world.region.active,region);assert.equal(after.world.userPaused,true);assert.ok(firstFrame)
 assert.equal(await page.locator('.village-canvas iframe').count(),1);assert.ok(after.resourceKeys.every(key=>!key.startsWith('map/')))
 const m=await metrics();assert.equal(m.region,region);assert.equal(m.actors,7);assert.equal(m.textures,after.resourceKeys.length)
 for(const other of ['bookhouse','tea-square'].filter(id=>id!==region))assert.ok(!after.resourceKeys.some(key=>key.startsWith(other+'/')))
 latency.clickToFirstRenderedFrameMs=firstFrame.at-latency.click.at;latency.frame=firstFrame
 const snapshot={region,latency,metrics:m,memory:await memorySnapshot()};trips.push(snapshot);return snapshot
}
async function sampleRegion(region){
 await pause(false);await entered();await page.waitForTimeout(350)
 const before=await metrics(),cpuBefore=await processes(),start=performance.now(),worldBefore=(await inspect()).world
 await page.waitForTimeout(5000)
 const after=await metrics(),elapsedMs=performance.now()-start,cpuAfter=await processes(),worldAfter=(await inspect()).world
 const result={region,elapsedMs,frameDelta:after.frames-before.frames,fps:(after.frames-before.frames)*1000/elapsedMs,tickDelta:worldAfter.ticks-worldBefore.ticks,windowMeanPaintMs:(after.meanPaintMs*after.frames-before.meanPaintMs*before.frames)/(after.frames-before.frames),rollingPaintP95Ms:after.p95PaintMs,paintScope:'Current iframe rolling last at most 600 paints; p95 includes entry/warmup paints',metrics:after,cpu:cpuDelta(cpuBefore,cpuAfter,elapsedMs),memory:await memorySnapshot()}
 assert.ok(result.tickDelta>0);assert.ok(result.frameDelta>0);assert.equal(after.actors,7);regions.push(result);cpuSamples.push({kind:region,...result.cpu});await pause(true)
 await page.screenshot({path:join(qa,region+'-seven.png'),animations:'disabled'});log(`Measured ${region}: ${result.fps.toFixed(2)} rendered FPS / rolling p95 ${result.rollingPaintP95Ms.toFixed(2)} ms`)
}
let failure,cleanup
try{
 await page.goto(host.entry)
 const opening=await confirmClick(page.getByRole('button',{name:'打开 AI 小院',exact:true}),'return state.ready && state.frameReady && !state.entrance.blocking',null,'initial-open')
 opening.firstFrame=await page.evaluate(()=>window.__scenePerfTrace.frames.at(-1));await pause(true)
 await page.getByRole('tab',{name:'居民',exact:true}).click();await direct('全部居民');await direct('安排入住')
 for(const name of ['Claude','Gemini','GPT','Grok','Kimi','Qwen']){const checkbox=page.getByLabel('入住 '+name,{exact:true});if(!await checkbox.isChecked()){await checkbox.click();await settled();await entered();assert.equal(await checkbox.isChecked(),true)}}
 await close();assert.equal(1+(await inspect()).world.companions.length,7)
 await sampleRegion('courtyard');await travel('bookhouse');await sampleRegion('bookhouse');await travel('courtyard');await travel('tea-square');await sampleRegion('tea-square')
 // A real host sidebar action hides/unmounts this app. Do not spoof document.hidden or freeze CDP execution.
 await pause(false);const visibleMetrics=await metrics();await direct('侧栏开合')
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().reasons.includes('sidebar'))
 assert.equal(await page.locator('.village-canvas iframe').count(),0)
 const hiddenWorld=(await inspect()).world,cpuBefore=await processes(),start=performance.now(),hiddenVisibility=await page.evaluate(()=>document.visibilityState)
 await page.waitForTimeout(5000)
 const elapsedMs=performance.now()-start,cpuAfter=await processes();assert.deepEqual((await inspect()).world,hiddenWorld);assert.equal(await page.locator('.village-canvas iframe').count(),0)
 const hidden={kind:'sidebar-hidden-app',documentVisibility:hiddenVisibility,elapsedMs,worldTicksBefore:hiddenWorld.ticks,worldTicksAfter:(await inspect()).world.ticks,iframeCountBefore:0,iframeCountAfter:0,lastVisibleFrameCount:visibleMetrics.frames,frameScope:'The iframe is disposed by the actual host sidebar UI; no renderer exists during this interval',cpu:cpuDelta(cpuBefore,cpuAfter,elapsedMs)}
 cpuSamples.push(hidden);await direct('侧栏开合');await entered();await pause(true);log('Five-second actual sidebar-hidden interval: exact world freeze, iframe absent, owned browser CPU delta recorded')
 let tripNumber=0
 for(let cycle=0;cycle<3;cycle++)for(const region of ['courtyard','bookhouse','courtyard','tea-square']){await travel(region);log(`Memory trend travel ${++tripNumber}: ${region}`)}
 for(const region of ['courtyard','bookhouse','tea-square']){
  const group=trips.filter(t=>t.region===region),base=group[0].metrics
  for(const trip of group)for(const key of ['textures','textureSources','decodedRGBABytes','urls'])assert.equal(trip.metrics[key],base[key],`${region} bounded ${key}`)
 }
 await sourceUnchanged();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);log('Per-region texture/source/RGBA/Blob inventory remains equal across twelve additional real map trips')
}catch(error){failure=String(error.stack||error);console.error(failure);await page.screenshot({path:join(qa,'failure.png'),animations:'disabled'}).catch(()=>{})}
finally{
 await page.evaluate(()=>window.__villageHostFixture.dispose()).catch(()=>{});await pageCDP.detach().catch(()=>{});await browserCDP.detach().catch(()=>{});await context.close();await browser.close();await host.close()
 let remaining=processRSS([...ownPids]);for(let i=0;i<3&&remaining.length;i++){await new Promise(resolve=>setTimeout(resolve,500));remaining=processRSS([...ownPids])}
 cleanup={ownedBrowserPids:[...ownPids],remaining,hostClosed:true,browserClosed:true};if(remaining.length)failure??='Owned browser processes remain after close; inspect cleanup record'
 await writeFile(join(qa,'result.json'),JSON.stringify({status:failure?'FAIL':'PASS',identity,checks,errors,external,latencies,regions,trips,cpuSamples,cleanup,failure,limits:['Software headless backend only; no native foreground hardware claim','Five-second FPS and CPU samples; twelve trips are a short trend, not a long-term leak guarantee','Paint p95 is current iframe rolling history (at most 600), not an isolated exact five-second distribution','Performance.getMetrics is main-page target only; not total iframe/OOPIF JS heap','Summed process RSS includes shared mappings; not exclusive physical memory','Hidden condition is the real host sidebar hiding/unmounting the app; document may remain visible; not physical sleep/minimization','No stories replayed; gameplay QA remains separate','Current source fixture is recorded; Host/frame bytes match pinned archive']},null,2)+'\n')
}
if(failure)process.exitCode=1

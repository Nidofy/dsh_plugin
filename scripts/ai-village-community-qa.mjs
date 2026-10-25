/** Community navigation and manual movement through real UI in an isolated authenticated Host. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),label=process.argv[2],dpr=Number(process.argv[3]??1),mapArt=process.argv.includes('--map-art')
assert.match(label??'',/^[a-z0-9-]+$/);assert.ok([1,2].includes(dpr))
const qa=join(root,'docs/ai-village/community-next/browser',label),out=join(root,'.build/ai-village-community',label),profile=join(out,'profile')
await mkdir(join(root,'docs/ai-village/community-next/browser'),{recursive:true});await mkdir(qa);await mkdir(profile,{recursive:true})
const hash=b=>createHash('sha256').update(b).digest('hex'),build={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),version:JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,dpr,source:{},bundles:{}}
if(mapArt){build.mapManifest=JSON.parse(await readFile(join(pkg,'assets/community-map/manifest.json'),'utf8'));assert.equal(build.mapManifest.approvedForRelease,true);for(const entry of build.mapManifest.files)assert.equal(hash(await readFile(join(pkg,'assets/community-map',entry.file))),entry.sha256)}
for(const f of ['index.js','client.js','frame.js'])build.bundles[f]=hash(await readFile(join(pkg,'lib',f)))
for(const f of(await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)))build.source[f]=hash(await readFile(join(pkg,'src',f)))
await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2));await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js'))),host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const browserCdp=await browser.newBrowserCDPSession();const {gpu}=await browserCdp.send('SystemInfo.getInfo');build.gpu=gpu;await browserCdp.detach();await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2))
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:dpr}),page=await context.newPage(),checks=[],errors=[],external=[],observations=[],mapRequests=[]
if(mapArt)await page.addInitScript(()=>{
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),state={created:[],revoked:[],active:[]}
 Object.assign(window,{__mapBlobQA:state})
 URL.createObjectURL=value=>{const url=create(value);state.created.push({url,bytes:value.size??null,type:value.type??null});state.active.push(url);return url}
 URL.revokeObjectURL=url=>{state.revoked.push(url);state.active=state.active.filter(value=>value!==url);return revoke(url)}
})
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message))
let blockMap=false
await context.route('**/*',r=>{const url=r.request().url();if(!url.startsWith(host.url+'/')&&!url.startsWith('blob:')){external.push(url);return r.abort()}if(url.includes('/api/nidofy-ai-village/assets/map/')){const blocked=blockMap&&url.endsWith('/terrain.png');mapRequests.push({path:new URL(url).pathname,blocked});if(blocked)return r.fulfill({status:503,body:'Map resource deliberately unavailable in isolated QA'})}return r.continue()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),direct=name=>page.getByRole('button',{name,exact:true}).click(),settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'}),entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error})
let en=false
const close=async()=>{const b=page.getByRole('button',{name:en?'Close panel':'关闭面板',exact:true});if(await b.isVisible())await b.click()}
const map=async(requireArt=mapArt)=>{await close();await direct(en?'Community map':'社区地图');await page.locator('.village-community-map').waitFor();if(requireArt)await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.village-map-overview img[data-map-layer]')];return document.querySelector('.village-map-overview')?.getAttribute('data-art')==='ready'&&images.length===6&&images.every(image=>image.complete&&image.naturalWidth>0)&&window.__mapBlobQA.active.length===6})}
const mapImages=()=>page.locator('.village-map-overview img[data-map-layer]').evaluateAll(images=>images.map(image=>({layer:image.dataset.mapLayer,url:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight,decodedRGBABytes:image.naturalWidth*image.naturalHeight*4,css:{width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height}})))
const releasedMap=async urls=>{
 await page.waitForFunction(urls=>urls.every(url=>window.__mapBlobQA.revoked.includes(url))&&window.__mapBlobQA.active.length===0,urls)
 assert.equal(await page.locator('.village-map-overview img').count(),0)
 const fetchable=await page.evaluate(urls=>Promise.all(urls.map(async url=>{try{await fetch(url);return true}catch{return false}})),urls)
 assert.deepEqual(fetchable,urls.map(()=>false))
}
const choose=async id=>page.locator(`.village-map-places [data-place="${id}"]`).click()
const metrics=async()=>page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame')).evaluate(()=>window.__sceneMetrics())
const shot=async name=>{await page.screenshot({path:join(qa,name+'.png'),animations:'disabled'});const state=await inspect();observations.push({name,world:state.world,revision:state.revision,presentation:state.presentation,actionError:state.actionError,reasons:state.reasons,saveReceipt:state.saveReceipt,metrics:await metrics()})},log=s=>{checks.push(s);console.log('PASS '+s)}
const pause=async value=>{await close();if((await inspect()).world.userPaused!==value){await villageUI(page).click(value?'暂停':'继续');await settled()}}
const travel=async(id,name)=>{await map();await choose(id);const before=await inspect(),urls=mapArt?(await mapImages()).map(image=>image.url):[],start=performance.now();await direct(name);await settled();await entered();const durationMs=performance.now()-start,after=await inspect();assert.equal(after.world.region.active,id);assert.equal(after.world.userPaused,before.world.userPaused);assert.equal(after.revision,before.revision+1);assert.equal(await page.locator('.village-canvas iframe').count(),1);if(mapArt){await releasedMap(urls);assert.ok(after.resourceKeys.every(key=>!key.startsWith('map/')))}observations.push({travel:id,durationMs,revision:after.revision,metrics:await metrics()})}
const position=async point=>{const frame=page.locator('.village-canvas iframe'),box=await frame.boundingBox(),m=await metrics(),p=m.viewport.world;assert.ok(box);return {x:box.x+p.x+point.x*p.scale,y:box.y+p.y+point.y*p.scale}}
const ground=async point=>{const p=await position(point);await page.mouse.click(p.x,p.y)}
const all=w=>[w.actor,...w.companions]
let failure
try{
 await page.goto(host.entry);await direct('打开 AI 小院');await entered();await pause(true);await page.evaluate(()=>window.__villageHostFixture.flush());await settled()
 await page.getByLabel('消息输入',{exact:true}).fill('地图测试：保留主聊天草稿')
 const before=await inspect(),beforeTextures=(await metrics()).textures;if(mapArt){assert.equal(mapRequests.length,0);assert.deepEqual(await page.evaluate(()=>window.__mapBlobQA.active),[])}await map();assert.equal(await page.locator('.village-map-places button').count(),5)
 const firstMap=mapArt?await mapImages():[]
 if(mapArt){
  assert.equal(mapRequests.length,6);assert.equal(new Set(mapRequests.map(r=>r.path)).size,6);assert.equal(await page.locator('.village-map-overview').getAttribute('data-art'),'ready');assert.doesNotMatch(await page.locator('.village-map-caption').innerText(),/导航示意|Navigation sketch/)
  assert.deepEqual((await inspect()).resourceKeys,before.resourceKeys);assert.equal((await metrics()).textures,beforeTextures)
  for(const image of firstMap){const expected=build.mapManifest.files.find(entry=>entry.file===`community-map-${image.layer}.png`);assert.ok(expected);assert.deepEqual([image.width,image.height],expected.size);assert.ok(image.url.startsWith('blob:'));assert.ok(image.css.width>0&&image.css.height>0)}
  const decodedBytes=firstMap.reduce((sum,image)=>sum+image.decodedRGBABytes,0),blobBytes=await page.evaluate(urls=>window.__mapBlobQA.created.filter(image=>urls.includes(image.url)).reduce((sum,image)=>sum+image.bytes,0),firstMap.map(image=>image.url));assert.equal(decodedBytes,build.mapManifest.totals.decodedRGBABytes);assert.equal(blobBytes,build.mapManifest.totals.bytes);assert.ok(decodedBytes<=build.mapManifest.budget.maxDecodedRGBABytes);assert.ok(blobBytes<=build.mapManifest.budget.maxCompressedBytes);observations.push({mapAssetBudget:{images:firstMap,decodedBytes,blobBytes,iframeTextures:beforeTextures}})
 }
 for(const id of ['tea-square','lakeside-garden','workshop']){await choose(id);assert.equal(await page.locator('.village-map-travel').isDisabled(),true);assert.match(await page.locator('.village-map-preview').innerText(),/建设中|尚未开放/)}
 await choose('bookhouse');assert.equal(await page.locator('.village-map-travel').isEnabled(),true);await shot('compact-map-bookhouse')
 const node=page.locator('.village-map-places [data-place="courtyard"]');await node.focus();await page.keyboard.press('Enter');assert.equal(await node.getAttribute('aria-pressed'),'true')
 await page.keyboard.press('Escape');assert.equal((await inspect()).presentation.overlay,null);const after=await inspect();assert.deepEqual(after.world,before.world);assert.equal(after.revision,before.revision);assert.equal(await page.getByLabel('消息输入',{exact:true}).inputValue(),'地图测试：保留主聊天草稿');log('Five destinations, planned entry blocked, keyboard selection/Escape, map browsing does not mutate world or revision, chat draft retained')
 if(mapArt){
  await releasedMap(firstMap.map(image=>image.url));await map();const reopened=await mapImages();assert.ok(reopened.every(image=>!firstMap.some(old=>old.url===image.url)));await close();await releasedMap(reopened.map(image=>image.url))
  const beforeFailure=await inspect();blockMap=true;await map(false);await page.waitForFunction(()=>document.querySelector('.village-map-overview')?.getAttribute('data-art')==='fallback');assert.equal(await page.locator('.village-map-overview img').count(),0);assert.deepEqual(await page.evaluate(()=>window.__mapBlobQA.active),[]);await choose('bookhouse');assert.equal(await page.locator('.village-map-travel').isEnabled(),true);await shot('map-art-fallback');const afterFailure=await inspect();assert.deepEqual(afterFailure.world,beforeFailure.world);assert.equal(afterFailure.revision,beforeFailure.revision);assert.equal(afterFailure.error,'');assert.ok(mapRequests.some(request=>request.blocked));await close();blockMap=false;await map();await shot('map-art-restored');const restored=await mapImages();await close();await releasedMap(restored.map(image=>image.url));log('Approved map loads six verified local images on demand, respects byte/decoded budget, releases all Blob URLs on close/travel, reloads, and falls back without world writes')
 }
 await travel('bookhouse','前往 AI 书屋');await map();assert.equal(await page.locator('.village-map-node[data-place="bookhouse"]').getAttribute('data-current'),'true');await close();await shot('bookhouse-arrival');await travel('courtyard','前往 白鲸小院');log('Map round trip uses one revision per journey, correct active place and preserved user pause')
 await villageUI(page).click('展开小院');await entered();await map();await shot('expanded-map');await close()
 // Actual input and real-time steps, never injected world or accelerated ticks.
 await travel('bookhouse','前往 AI 书屋');await pause(false)
 const origin=(await inspect()).world.actor.position,target={x:300,y:310};await ground(target)
 await page.waitForFunction(()=>!!window.__villageHostFixture.inspect().world.manualMove)
 let movement=(await inspect()).world;assert.ok(Math.hypot(movement.actor.position.x-target.x,movement.actor.position.y-target.y)>20);assert.ok(movement.manualMove.route.length>=2)
 await shot('manual-move-start');await page.waitForTimeout(700);movement=(await inspect()).world;assert.ok(Math.hypot(movement.actor.position.x-origin.x,movement.actor.position.y-origin.y)>1)
 await direct('侧栏开合');await page.waitForFunction(()=>window.__villageHostFixture.inspect().reasons.includes('sidebar'));const hidden=(await inspect()).world;await page.waitForTimeout(350);assert.deepEqual((await inspect()).world,hidden);await direct('侧栏开合');await entered();log('Sidebar-hidden world pauses the active manual route and resumes through the existing frame gate')
 await pause(true);const paused=(await inspect()).world;await page.waitForTimeout(400);assert.deepEqual((await inspect()).world,paused);await page.evaluate(()=>window.__villageHostFixture.flush());await settled();const saved=(await inspect()).world
 await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,saved);await shot('manual-move-cold-restored');await pause(false)
 await page.waitForFunction(target=>{const w=window.__villageHostFixture.inspect().world;return !w.manualMove&&Math.hypot(w.actor.position.x-target.x,w.actor.position.y-target.y)<2},target,{timeout:45000});await pause(true);await shot('manual-move-arrived');log('Ground click walks gradually to target, preserves explicit manual route during pause and cold recovery')
 // More than 5 CSS pixels still activates the retained drag path.
 const w=(await inspect()).world,actor=await position({x:w.actor.position.x,y:w.actor.position.y-32}),drop=await position({x:290,y:390});await pause(false)
 await page.mouse.move(actor.x,actor.y);await page.mouse.down();await page.mouse.move(drop.x,drop.y,{steps:12});await page.mouse.up();await page.waitForFunction(()=>{const a=window.__villageHostFixture.inspect().world.actor;return Math.hypot(a.position.x-290,a.position.y-422)<2});await settled();const dropped=(await inspect()).world;assert.equal(dropped.manualMove,null);assert.ok(Math.hypot(dropped.actor.position.x-290,dropped.actor.position.y-422)<2);await pause(true);await shot('drag-retained');log('Existing resident drag/drop remains distinct from ground movement')
 await travel('courtyard','前往 白鲸小院');await page.getByRole('tab',{name:'居民',exact:true}).click();await direct('全部居民');await direct('安排入住')
 for(const name of ['Claude','Gemini','GPT','Grok','Kimi','Qwen']){const box=page.getByLabel('入住 '+name,{exact:true});if(!await box.isChecked()){await box.click();await settled();await entered();assert.equal(await box.isChecked(),true)}}
 await close();assert.equal(all((await inspect()).world).length,7)
 await travel('bookhouse','前往 AI 书屋');await pause(false);await ground({x:180,y:250});await page.waitForFunction(()=>!!window.__villageHostFixture.inspect().world.manualMove)
 const sampleStart=performance.now();while(performance.now()-sampleStart<2500){const world=(await inspect()).world,members=all(world);for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)assert.ok(Math.hypot(members[i].position.x-members[j].position.x,members[i].position.y-members[j].position.y)>=23.99);await page.waitForTimeout(80)}
 const perfBefore=await metrics(),perfStart=performance.now();await page.waitForTimeout(1500);const perfAfter=await metrics();observations.push({softwareGpuSample:{elapsedMs:performance.now()-perfStart,fps:(perfAfter.frames-perfBefore.frames)*1000/(performance.now()-perfStart),metrics:perfAfter}});await pause(true);await shot('seven-residents');log('Seven residents stay separated during sampled real-time manual movement')
 for(let i=0;i<2;i++){await travel('courtyard','前往 白鲸小院');assert.ok((await metrics()).textures<=128);await travel('bookhouse','前往 AI 书屋');assert.ok((await metrics()).textures<=121)}log('Repeated trips keep one iframe and existing 128/121 texture ceilings')
 if(!(await inspect()).presentation.expanded){await villageUI(page).click('展开小院');await entered()}
 for(const [width,height]of [[320,360],[340,720],[580,720]])for(const theme of ['light','dark']){
  await close();let hostHeight=height+236
  for(let n=0;n<6;n++){await page.setViewportSize({width:width+224,height:hostHeight});await page.waitForTimeout(200);const box=await page.locator('.village-card').boundingBox();assert.ok(box);if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)break;hostHeight+=Math.round(height-box.height)}
  const box=await page.locator('.village-card').boundingBox();assert.ok(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)
  await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption(theme);await settled();await map();await choose('bookhouse');await shot(`${width}x${height}-${theme}-map`)
  assert.equal(await page.locator('.village-community-map').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
  assert.equal(await page.locator('.village-map-roads').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return Math.abs(a.width-b.width)<3&&Math.abs(a.height-b.height)<3}),true)
 }
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('文字大小',{exact:true}).selectOption('2');await settled();const motion=page.getByLabel('减少动态',{exact:true});if(!await motion.isChecked())await motion.click();await settled();assert.equal(await motion.isChecked(),true);await map();await shot('large-text-reduced-motion-map');assert.equal(await page.locator('.village-community-map').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('文字大小',{exact:true}).selectOption('1');await settled();await page.getByLabel('语言',{exact:true}).selectOption('en');await settled();en=true;await map();await choose('tea-square');await shot('english-map');assert.match(await page.locator('.village-map-preview').innerText(),/Planned; not open yet/);log('Actual 320×360 / 340×720 / 580×720 map, light/dark, English, 200% text/reduced motion, requested DPR')
 if(mapArt){const urls=(await mapImages()).map(image=>image.url);await close();await releasedMap(urls);observations.push({mapBlobLifecycle:await page.evaluate(()=>window.__mapBlobQA)})}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
}catch(e){failure=String(e.stack||e);console.error(failure);await shot('failure').catch(()=>{})}
finally{await page.evaluate(()=>window.__villageHostFixture.dispose()).catch(()=>{});await context.close();await browser.close();await host.close();await writeFile(join(qa,'result.json'),JSON.stringify({status:failure?'FAIL':'PASS',build,checks,errors,external,observations,mapArt,mapRequests,failure,notRun:['native hardware GPU','physical sleep/minimization','CPU process accounting','long-duration memory soak']},null,2))}
if(failure)process.exitCode=1

/** Third-region QA. Real authenticated UI only; never injects a world or bypasses a production gate. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),label=process.argv[2],dpr=Number(process.argv[3]??1)
const mode=process.argv.find(arg=>arg.startsWith('--mode='))?.slice(7)??'gate'
const approvedScenes=process.argv.includes('--approved-scenes')
assert.match(label??'',/^[a-z0-9-]+$/);assert.ok([1,2].includes(dpr));assert.ok(['gate','play'].includes(mode))
const qa=join(root,'docs/ai-village/community-next/tea-square/browser',label),out=join(root,'.build/ai-village-tea-square',label),profile=join(out,'profile')
await mkdir(join(root,'docs/ai-village/community-next/tea-square/browser'),{recursive:true});await mkdir(qa);await mkdir(profile,{recursive:true})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),build={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),version:JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,mode,dpr,source:{},bundles:{}}
const scriptBytes=await readFile(new URL(import.meta.url)),scriptSha=hash(scriptBytes);await writeFile(join(qa,'runner.mjs'),scriptBytes)
for(const file of ['index.js','client.js','frame.js'])build.bundles[file]=hash(await readFile(join(pkg,'lib',file)))
for(const file of(await readdir(join(pkg,'src'),{recursive:true})).filter(file=>/\.tsx?$/.test(file)))build.source[file]=hash(await readFile(join(pkg,'src',file)))
await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2));await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js'))),host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(name=>name.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(name=>name.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const cdp=await browser.newBrowserCDPSession();build.gpu=(await cdp.send('SystemInfo.getInfo')).gpu;await cdp.detach();await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2))
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:dpr}),page=await context.newPage(),checks=[],errors=[],external=[],observations=[],writes=[],samples=[]
page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message))
const fault={expectedMemoryCount:null,operationId:null,blockState:false,asset:null}
await context.route('**/*',async route=>{
 const request=route.request(),url=request.url()
 if(!url.startsWith(host.url+'/')&&!url.startsWith('blob:')){external.push(url);return route.abort()}
 if(fault.asset&&url.endsWith('/api/nidofy-ai-village/assets/'+fault.asset.key)){
  const injection=fault.asset;fault.asset=null
  if(injection.kind==='unavailable')return route.fulfill({status:503,body:'Isolated QA resource outage'})
  const response=await route.fetch(),body=Buffer.from(await response.body());body[body.length-1]^=1;return route.fulfill({response,body})
 }
 if(fault.blockState&&url.endsWith('/api/nidofy-ai-village/state'))return route.abort()
 if(url.endsWith('/api/nidofy-ai-village/save')&&request.method()==='POST'){
  const body=request.postDataJSON();writes.push({operationId:body.operationId,revision:body.revision??body.expectedRevision,teaSquare:body.world?.teaSquare})
  if(fault.expectedMemoryCount!==null&&body.world?.teaSquare?.memory?.count===fault.expectedMemoryCount){
   fault.expectedMemoryCount=null;fault.operationId=body.operationId
   const response=await route.fetch();assert.ok(response.ok(),'fault injection must follow a real successful Host write')
   fault.blockState=true;return route.abort()
  }
 }
 return route.continue()
})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),direct=name=>page.getByRole('button',{name,exact:true}).click()
const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'})
const entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error})
const close=async()=>{const button=page.getByRole('button',{name:'关闭面板',exact:true});if(await button.isVisible())await button.click()}
const tab=async name=>{await close();await page.getByRole('tab',{name,exact:true}).click()}
const pause=async value=>{await close();if((await inspect()).world.userPaused!==value){await villageUI(page).click(value?'暂停':'继续');await settled()}}
const map=async()=>{await close();await direct('社区地图');await page.locator('.village-community-map').waitFor()}
const choose=place=>page.locator(`.village-map-places [data-place="${place}"]`).click()
const metrics=()=>page.frames().find(frame=>frame.url().includes('/api/nidofy-ai-village/frame'))?.evaluate(()=>window.__sceneMetrics())
const shot=async name=>{await page.screenshot({path:join(qa,name+'.png'),animations:'disabled'});const state=await inspect();observations.push({name,world:state.world,revision:state.revision,actionError:state.actionError,saveReceipt:state.saveReceipt,metrics:await metrics()})}
const log=message=>{checks.push(message);console.log('PASS '+message)}
const members=world=>[world.actor,...world.companions]
let previousSample=null
const sample=state=>{
 const all=members(state.world)
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(Math.hypot(all[i].position.x-all[j].position.x,all[i].position.y-all[j].position.y)>=23.99,'resident feet overlap')
 if(previousSample?.region===state.world.region.active&&state.world.ticks>=previousSample.tick)for(const actor of all){const old=previousSample.feet.find(p=>p.id===actor.id);if(old)assert.ok(Math.hypot(actor.position.x-old.x,actor.position.y-old.y)<=(state.world.ticks-previousSample.tick)*17/30+.1,'resident exceeds 17/30 world units per tick')}
 previousSample={region:state.world.region.active,tick:state.world.ticks,feet:all.map(actor=>({id:actor.id,...actor.position}))}
 if(samples.length<5000)samples.push({region:state.world.region.active,tick:state.world.ticks,stage:state.world.teaSquare?.active?.stage,phase:state.world.teaSquare?.active?.phase,teaActivity:state.world.teaSquare?.activity,selected:{id:state.world.actor.id,behavior:state.world.actor.behavior,intent:state.world.actor.intent},feet:all.map(actor=>({id:actor.id,...actor.position}))})
}
const waitStage=async stage=>{
 const start=Date.now()
 while(Date.now()-start<120000){
  const state=await inspect(),event=state.world.teaSquare?.active;sample(state)
  assert.ok(event,'story ended before expected stage');assert.equal(event.participants.length,3)
  if(event.stage===stage&&event.phase==='ready'){
   for(let i=0;i<3;i++){const actor=members(state.world).find(actor=>actor.id===event.participants[i]);assert.ok(actor);assert.ok(Math.hypot(actor.position.x-event.targets[i].x,actor.position.y-event.targets[i].y)<.1,'ready requires real arrival')}
   return event
  }
  await page.waitForTimeout(100)
 }
 throw Error(`Tea story stage ${stage} did not become ready in real simulation time`)
}
const coldRestore=async()=>{
 await pause(true);await page.evaluate(()=>window.__villageHostFixture.flush());await settled();const saved=(await inspect()).world
 const started=performance.now();await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,saved)
 observations.push({coldRestoreMs:performance.now()-started,metrics:await metrics()})
 await shot('tea-mid-story-cold-restored');return saved
}
const photo=async name=>{
 await pause(true);const before=(await inspect()).world;await villageUI(page).click('拍照');await direct('拍摄照片');await page.getByRole('img',{name:'照片预览',exact:true}).waitFor()
 const pending=page.waitForEvent('download');await direct('导出 PNG');await(await pending).saveAs(join(qa,name+'.png'))
 const bytes=await readFile(join(qa,name+'.png'));assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960)
 await direct('返回取景');await direct('退出拍照');assert.deepEqual((await inspect()).world,before)
}
const travel=async id=>{
 await pause(true);await map();await choose(id)
 const before=await inspect(),started=performance.now();assert.equal(await page.locator('.village-map-travel').isEnabled(),true)
 await page.locator('.village-map-travel').click();await settled();await entered();const after=await inspect()
 assert.equal(after.world.region.active,id);assert.equal(after.world.userPaused,before.world.userPaused);assert.equal(after.revision,before.revision+1)
 assert.equal(await page.locator('.village-canvas iframe').count(),1);assert.ok(after.resourceKeys.every(key=>!key.startsWith('map/')))
 observations.push({travel:id,durationMs:performance.now()-started,metrics:await metrics()})
}
const residents=()=>tab('居民')
const tea=()=>page.locator('.village-tea-square')
const startStory=async(cast=['bluewhale','claude','gemini'])=>{
 await pause(false);await residents()
 for(const [index,label]of ['茶会伙伴一','茶会伙伴二','茶会伙伴三'].entries())await page.getByLabel(label,{exact:true}).selectOption(cast[index])
 await direct((await inspect()).world.teaSquare.memory?'再来一次茶会':'开始茶会');await settled()
 const event=(await inspect()).world.teaSquare.active;assert.ok(event);assert.deepEqual([...event.participants].sort(),[...cast].sort());return event
}
const hintOrder=async()=>{
 const hint=await tea().locator('[data-coaster-hint]').innerText(),order=hint.split('：').at(-1).split(' → ')
 assert.deepEqual([...order].sort(),['云','叶','星'].sort());return order
}
const place=async(shape,slot)=>{
 await tea().getByRole('group',{name:'杯垫图案',exact:true}).getByRole('button',{name:shape,exact:true}).click()
 await tea().getByRole('group',{name:'杯垫位置',exact:true}).getByRole('button').nth(slot).click();await settled()
}
const cancelStory=async()=>{
 const before=(await inspect()).world.teaSquare;await direct('取消茶会');await settled();const after=(await inspect()).world.teaSquare
 assert.equal(after.active,null);assert.deepEqual(after.memory,before.memory);assert.equal(after.keepsake,before.keepsake);assert.equal(after.lastEventId,before.lastEventId)
}
const sceneArt={
 'tea-square':{keys:['background','tea-table','tea-counter','message-tree'].map(name=>`tea-square/${name}.png`),bytes:2281183,rgba:4487424},
 bookhouse:{keys:['bookhouse-scene-atlas','bookhouse-activity-atlas'].map(name=>`bookhouse/${name}.png`),bytes:2468228,rgba:6586368},
}
const resourceBaselines=new Map()
async function resourceFailure(region,key,kind){
 await pause(true);await map();await choose(region);const before=await inspect(),count=writes.length;fault.asset={key,kind}
 await page.locator('.village-map-travel').click();await page.waitForFunction(()=>!!window.__villageHostFixture.inspect().error)
 const failed=await inspect();assert.equal(fault.asset,null);assert.match(failed.error,kind==='corrupt'?/ASSET_HASH_MISMATCH/:/ASSET_UNAVAILABLE/);assert.deepEqual(failed.world,before.world);assert.equal(failed.revision,before.revision);assert.equal(writes.length,count)
 await shot(region+'-asset-'+kind);await direct('点击开门，重新进入');await entered();await settled();assert.deepEqual((await inspect()).world,before.world)
 log(`${region} ${kind} resource rejected before world write; actual entrance retry restores the saved scene`)
}
async function assertSceneArt(region){
 if(!approvedScenes)return
 const spec=sceneArt[region],state=await inspect(),frame=await metrics();assert.equal(frame.region,region)
 assert.ok(state.resourceKeys.every(key=>!key.startsWith('map/')),'map must not enter renderer owner')
 if(spec){
  let bytes=0,rgba=0;const inventory=[]
  for(const key of spec.keys){assert.ok(state.resourceKeys.includes(key),`actual frame is missing ${key}`);const data=await readFile(join(out,'assets',key));const width=data.readUInt32BE(16),height=data.readUInt32BE(20);bytes+=data.length;rgba+=width*height*4;inventory.push({key,bytes:data.length,width,height,sha256:hash(data)})}
  assert.equal(bytes,spec.bytes);assert.equal(rgba,spec.rgba);observations.push({sceneArt:region,inventory,bytes,rgba})
 }
 for(const other of Object.keys(sceneArt).filter(id=>id!==region))assert.ok(!state.resourceKeys.some(key=>key.startsWith(other+'/')),`inactive ${other} textures retained`)
 if(region!=='courtyard')assert.ok(!state.resourceKeys.includes('scene/background.png'),'courtyard scenery retained')
 assert.equal(frame.textures,state.resourceKeys.length)
 const bounded={keys:[...state.resourceKeys].sort(),textures:frame.textures,textureSources:frame.textureSources,decodedRGBABytes:frame.decodedRGBABytes,urls:frame.urls}
 if(resourceBaselines.has(region))assert.deepEqual(bounded,resourceBaselines.get(region),'round-trip owner resource budget grew')
 else resourceBaselines.set(region,bounded)
 observations.push({ownerInventory:region,...bounded});log(`Actual ${region} textures, asset hashes and bounded owner inventory`)
}
async function waitBookhouse(check,message,ordinaryId){
 const end=Date.now()+120000
 while(Date.now()<end){const state=await inspect();sample(state);if(check(state.world))return state.world;assert.equal(state.actionError,'');if(ordinaryId)assert.equal(state.world.actor.intent?.furnitureId,ordinaryId,'explicit ordinary intent disappeared before arrival');await page.waitForTimeout(100)}
 throw Error('Bookhouse did not reach '+message)
}
async function assertBookhousePose(id,expected){
 const frame=await metrics();assert.equal(frame.bookhouseArtwork,'raster');const pose=frame.rigs.find(r=>r.id===id)?.bookhouse;assert.equal(pose?.mode,expected,`${id} actual Pixi pose`)
 assert.ok(pose.projectedFeet.every(Number.isFinite));if(expected==='seated'){assert.ok(pose.hip.every(Number.isFinite));assert.ok(pose.visualSole.every(Number.isFinite))}
 observations.push({actualBookhousePose:id,...pose})
}
async function assertTeaSeat(active){
 const state=await inspect(),frame=await metrics(),pose=frame.rigs.find(r=>r.id===state.world.actor.id)?.teaSeat
 assert.equal(pose?.active,active);assert.equal(pose.restingVisible,active);assert.equal(pose.standingVisible,!active)
 if(active){assert.deepEqual(pose.feet,[state.world.actor.position.x,state.world.actor.position.y]);assert.ok(pose.depth<pose.tableDepth);assert.equal(pose.source,'own-approved-rest-pose')}
 observations.push({actualTeaSeat:state.world.actor.id,...pose})
}
async function appearanceMatrix(region){
 await pause(true);const before=(await inspect()).world;await villageUI(page).click('展开小院');await entered()
 for(const [width,height,theme]of [[320,360,'light'],[340,720,'dark'],[580,720,'light']]){
  await close();let hostHeight=height+236
  for(let n=0;n<6;n++){await page.setViewportSize({width:width+224,height:hostHeight});await page.waitForTimeout(200);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)break;hostHeight+=Math.round(height-box.height)}
  const box=await page.locator('.village-card').boundingBox();assert.ok(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)
  await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption(theme);await settled();await residents();await shot(`${region}-${width}x${height}-${theme}`)
  assert.equal(await page.locator('.village-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
 }
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('文字大小',{exact:true}).selectOption('2');await page.getByLabel('减少动态',{exact:true}).check();await settled();await page.getByLabel('语言',{exact:true}).selectOption('en');await settled();await direct('Close panel');await page.getByRole('tab',{name:'Residents',exact:true}).click();await shot(region+'-english-large-reduced')
 await direct('Close panel');if(!await page.getByRole('button',{name:'Courtyard settings',exact:true}).isVisible())await direct('More');await direct('Courtyard settings');await direct('Appearance and display');await page.getByLabel('Language',{exact:true}).selectOption('zh');await settled();await page.getByLabel('文字大小',{exact:true}).selectOption('1');await page.getByLabel('减少动态',{exact:true}).uncheck();await page.getByLabel('界面主题',{exact:true}).selectOption('host');await settled();await close();await villageUI(page).click('收起小院');await page.setViewportSize({width:1440,height:960});await entered();assert.deepEqual((await inspect()).world,before)
 log(`${region} actual 320×360, 340×720, 580×720, light/dark, English/200%/reduced motion without world mutation`)
}
async function bookhousePlay(){
 await assertSceneArt('bookhouse');await residents();await page.getByLabel('当前居民',{exact:true}).selectOption('bluewhale');await settled()
 for(const [id,label,behavior]of [['bookcase','在书柜选书','read'],['reading-desk','在阅读桌写字','work'],['window-seat','在窗边坐下','sit']]){
  await pause(false);await residents();await direct(label);await settled();observations.push({ordinaryCommand:id,world:(await inspect()).world})
  await waitBookhouse(w=>w.actor.intent?.furnitureId===id&&w.actor.intent.stage==='use'&&w.actor.behavior===behavior,id+' ordinary pose',id)
  await pause(true);await assertBookhousePose('bluewhale',({read:'reading',work:'writing',sit:'seated'})[behavior]);await shot('bookhouse-ordinary-'+id);if(id==='window-seat')await photo('bookhouse-window-seat-photo')
  await residents();await direct('结束当前活动');await settled();assert.equal((await inspect()).world.actor.intent,null)
 }
 await pause(false);await residents();await page.getByLabel('一起读书的朋友',{exact:true}).selectOption('claude');await direct('一起寻找微光');await settled()
 for(const [stage,action]of ['记住窗边的光','写下我们的句子','收好这枚微光书签'].entries()){
  const w=await waitBookhouse(w=>w.bookhouse.active?.stage===stage&&w.bookhouse.active.phase==='ready','shared story stage '+stage),event=w.bookhouse.active
  assert.deepEqual(event.participants,['bluewhale','claude']);event.participants.forEach((id,index)=>{const actor=members(w).find(a=>a.id===id);assert.ok(Math.hypot(actor.position.x-event.targets[index].x,actor.position.y-event.targets[index].y)<.1)})
  await pause(true);for(const id of event.participants){const point=members(w).find(a=>a.id===id).position,expected=stage===1&&Math.abs(point.y-328)<.01&&point.x>=90&&point.x<=194?'writing':stage===2&&Math.abs(point.y-270)<.01&&point.x>=64&&point.x<=140?'seated':'reading';await assertBookhousePose(id,expected)}await shot('bookhouse-story-stage-'+stage);if(stage===2)await photo('bookhouse-shared-window-photo')
  await pause(false);await residents();await direct(action);await settled()
 }
 await pause(true);const world=(await inspect()).world;assert.equal(world.bookhouse.active,null);assert.equal(world.bookhouse.memory.count,1);assert.deepEqual(world.bookhouse.memory.participants,['bluewhale','claude'])
 await shot('bookhouse-first-memory');await appearanceMatrix('bookhouse');log('Seven-person bookhouse: three ordinary poses, three real shared-story arrivals and two actual photos')
}
async function playThrough(){
 // The only entry is the already enabled public map button. No developer hook changes world/gate state.
 await close();await residents();await direct('全部居民');await direct('安排入住')
 for(const name of ['Claude','Gemini','GPT','Grok','Kimi','Qwen']){const box=page.getByLabel('入住 '+name,{exact:true});if(!await box.isChecked()){await box.click();await settled();await entered();assert.equal(await box.isChecked(),true)}}
 await close();assert.equal(members((await inspect()).world).length,7)
 if(approvedScenes){await assertSceneArt('courtyard');await resourceFailure('bookhouse',sceneArt.bookhouse.keys[0],'corrupt');await travel('bookhouse');await bookhousePlay();await travel('courtyard');await assertSceneArt('courtyard');await resourceFailure('tea-square',sceneArt['tea-square'].keys[0],'unavailable')}
 await travel('tea-square');await assertSceneArt('tea-square');assert.equal((await inspect()).world.schemaVersion,14);assert.equal((await inspect()).world.region.version,2);await shot('tea-seven-arrival')
 const first=await startStory();assert.equal(first.phase,'approaching');assert.equal(await page.getByRole('button',{name:'一起摆好杯垫',exact:true}).isDisabled(),true)
 await page.waitForTimeout(600);const progress=await inspect();sample(progress);assert.ok(progress.world.ticks>0)
 await direct('侧栏开合');await page.waitForFunction(()=>window.__villageHostFixture.inspect().reasons.includes('sidebar'))
 const hidden=(await inspect()).world,hiddenMetrics=await metrics();await page.waitForTimeout(1000);assert.deepEqual((await inspect()).world,hidden);const hiddenAfter=await metrics();assert.equal(hiddenAfter?.frames??0,hiddenMetrics?.frames??0);observations.push({hiddenOneSecond:{before:hiddenMetrics,after:hiddenAfter,worldUnchanged:true},scope:'Frame/tick inactivity; no claim of system CPU utilization'});await direct('侧栏开合');await entered()
 await pause(true);const frozen=(await inspect()).world;await page.waitForTimeout(350);assert.deepEqual((await inspect()).world,frozen)
 await residents();await cancelStory();log('Seven residents enter through one map CAS; three-participant approach, pause/hide and cancellation preserve reward state')
 await startStory();await waitStage(0);await direct('一起摆好杯垫');await settled();await waitStage(1)
 const order=await hintOrder(),wrong=[order[1],order[2],order[0]]
 for(let slot=0;slot<3;slot++)await place(wrong[slot],slot)
 let event=(await inspect()).world.teaSquare.active;assert.equal(event.stage,1);assert.deepEqual(event.board.map(value=>['云','叶','星'][value]),wrong);assert.equal((await inspect()).world.teaSquare.memory,null)
 assert.match(await tea().innerText(),/还没有排成线索里的顺序/);const serial=event.serial;await direct('重排杯垫');await settled();event=(await inspect()).world.teaSquare.active
 assert.deepEqual(event.board,[-1,-1,-1]);assert.equal(event.serial,serial+1);await place(order[0],0);await shot('tea-partial-board')
 await coldRestore();assert.equal((await inspect()).world.teaSquare.active.stage,1);await pause(false);await residents();assert.deepEqual(await hintOrder(),order)
 for(let slot=1;slot<3;slot++)await place(order[slot],slot)
 event=(await inspect()).world.teaSquare.active;assert.equal(event.stage,2);assert.equal(await page.getByRole('button',{name:'记住这个下午',exact:true}).isDisabled(),true)
 await waitStage(2);await shot('tea-closing-ready');log('Seeded visible hint, wrong order, reset serial, partial-board cold recovery and three real closing arrivals')
 // The isolated Host commits once. Its reply and subsequent read are withheld; no save is retried.
 const revision=(await inspect()).revision;fault.expectedMemoryCount=1;await direct('记住这个下午')
 await page.waitForFunction(()=>window.__villageHostFixture.inspect().saveReceipt.status==='unknown');assert.ok(fault.operationId)
 await page.waitForTimeout(600);assert.equal(writes.filter(write=>write.operationId===fault.operationId).length,1);await shot('tea-save-unknown')
 fault.blockState=false;await direct('点击开门，重新进入');await entered();await settled();await pause(true)
 let world=(await inspect()).world;assert.equal(world.teaSquare.active,null);assert.equal(world.teaSquare.memory.count,1);assert.equal(world.teaSquare.keepsake,'message-tree');assert.ok((await inspect()).revision>=revision+1)
 assert.equal(writes.filter(write=>write.operationId===fault.operationId).length,1);const memory=structuredClone(world.teaSquare.memory);await shot('tea-first-memory');log('Unknown final ACK reconciles by read-only entry; one operation ID, one first memory and keepsake')
 await tab('布置');await direct('收起茶签');await settled();assert.equal((await inspect()).world.teaSquare.keepsake,null)
 await startStory(['bluewhale','gpt','grok']);await waitStage(0);await direct('一起摆好杯垫');await settled();await waitStage(1);const replayOrder=await hintOrder()
 for(let slot=0;slot<3;slot++)await place(replayOrder[slot],slot)
 await waitStage(2);await direct('记住这个下午');await settled();await pause(true);world=(await inspect()).world
 assert.deepEqual({...world.teaSquare.memory,count:1},memory);assert.equal(world.teaSquare.memory.count,2);assert.equal(world.teaSquare.keepsake,null)
 await tab('布置');await direct('挂在留言树上');await settled();assert.equal((await inspect()).world.teaSquare.keepsake,'message-tree');await photo('tea-keepsake-photo');log('Replay increments count while retaining first source and stored placement; real 720×960 keepsake photograph')
 await pause(false);await residents();await page.getByLabel('当前居民',{exact:true}).selectOption('gpt');await settled();await direct('选一杯茶，坐一会儿');await settled();observations.push({ordinaryCommand:'tea',world:(await inspect()).world})
 const activityStarted=Date.now(),stages=new Set();let hadActivity=false,waitingPhoto=false
 while(Date.now()-activityStarted<100000){const state=await inspect();sample(state);const activity=state.world.teaSquare.activity;if(!activity){assert.ok(hadActivity);break}hadActivity=true;stages.add(activity.stage);if(activity.stage==='waiting'&&!waitingPhoto){waitingPhoto=true;assert.equal(state.world.actor.behavior,'sit');assert.equal(state.world.actor.intent?.furnitureId,'tea-table');await pause(true);await assertTeaSeat(true);await shot('tea-ordinary-waiting-seated');await pause(false);await residents()}await page.waitForTimeout(100)}
 assert.equal((await inspect()).world.teaSquare.activity,null);assert.deepEqual([...stages].sort(),['counter','choosing','seat','waiting'].sort())
 await direct('选一杯茶，坐一会儿');await settled();const activityMemory=(await inspect()).world.teaSquare.memory;await direct('结束选茶');await settled();assert.equal((await inspect()).world.teaSquare.activity,null);assert.deepEqual((await inspect()).world.teaSquare.memory,activityMemory)
 await pause(true);await assertTeaSeat(false);await shot('tea-ordinary-activity-finished');log('Ordinary tea activity traverses counter, choosing, seat and waiting; actual seated renderer and explicit cancellation preserve memory')
 const permanent=(await inspect()).world.teaSquare;await travel('courtyard');await assertSceneArt('courtyard');await travel('bookhouse');await assertSceneArt('bookhouse');await map();await choose('tea-square');assert.equal(await page.locator('.village-map-travel').isDisabled(),true);await close()
 await travel('courtyard');await assertSceneArt('courtyard');await travel('tea-square');await assertSceneArt('tea-square');assert.deepEqual((await inspect()).world.teaSquare,permanent);await shot('tea-return-keepsake')
 await tab('手账');assert.match(await page.locator('.village-card').innerText(),/三杯不同的下午/);log('Courtyard/bookhouse/tea-square public map round trip preserves permanent memory and rejects nonadjacent travel')
 if(approvedScenes){for(let cycle=0;cycle<3;cycle++)for(const region of ['courtyard','bookhouse','courtyard','tea-square']){await travel(region);await assertSceneArt(region)}assert.deepEqual((await inspect()).world.teaSquare,permanent);await appearanceMatrix('tea-square');log('Twelve additional public travels retain exact bounded texture/Blob inventory for each owner')}
 const beforeMetrics=await metrics(),started=performance.now();await pause(false);await page.waitForTimeout(3000);const afterMetrics=await metrics()
 observations.push({softwareGpuSample:{elapsedMs:performance.now()-started,fps:(afterMetrics.frames-beforeMetrics.frames)*1000/(performance.now()-started),metrics:afterMetrics}});await pause(true)
}
let failure,notRunReason
try{
 await page.goto(host.entry);await direct('打开 AI 小院');await entered();await pause(true);await page.evaluate(()=>window.__villageHostFixture.flush());await settled()
 const before=await inspect();await map();await choose('tea-square');await shot(mode==='gate'?'tea-square-map-gate':'tea-square-map-available')
 const blocked=await page.locator('.village-map-travel').isDisabled()
 if(mode==='gate'){
  assert.equal(blocked,true);assert.match(await page.locator('.village-map-preview').innerText(),/建设中|尚未开放/)
  await close();const after=await inspect();assert.deepEqual(after.world,before.world);assert.equal(after.revision,before.revision);log('Planned tea square remains preview-only; no world write and no bypass travel')
 }else if(blocked){notRunReason='Production tea-square travel gate is closed; full story QA was not run.'}
 else{await playThrough()}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
}catch(error){failure=String(error.stack||error);console.error(failure);await shot('failure').catch(()=>{})}
finally{
 fault.blockState=false
 await page.evaluate(()=>window.__villageHostFixture.dispose()).catch(()=>{});await context.close();await browser.close();await host.close()
 await writeFile(join(qa,'result.json'),JSON.stringify({status:failure?'FAIL':notRunReason?'NOT_RUN':'PASS',mode,approvedScenes,scriptSha,build,checks,errors,external,observations,writes,samples,notRunReason,failure,notCovered:['native GPU','physical sleep/minimization','long-duration memory soak','new direction animation qualification']},null,2))
}
if(failure||notRunReason)process.exitCode=1

/** Prepared native 0.13 acceptance. Never launches Desktop, changes a gate or injects world state. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const root=resolve(import.meta.dirname,'..'),mode=process.argv[2],label=process.argv[3]
assert.ok(['inspect','install','gate','fullplay','checkpoint','restored','continuation','supplement','bookhouse-supplement','visible-replay','photo'].includes(mode))
assert.match(label??'',/^[a-z0-9][a-z0-9-]{0,60}$/)
const runTag=process.env.AI_VILLAGE_NATIVE_RUN_TAG??'';assert.match(runTag,/^(?:[a-z0-9][a-z0-9-]{0,40})?$/)
const runRoot='ai-village-tea-qa-desktop'+(runTag?'-'+runTag:''),work=join(root,'.build',runRoot),base=join(root,'docs/ai-village/community-next/tea-square/native'),evidence=join(base,label)
await mkdir(base,{recursive:true});await mkdir(evidence) // Never overwrite a prior evidence label.
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const expectedKeys=['background','tea-table','tea-counter','message-tree'].map(name=>`tea-square/${name}.png`)
const checks=[],observations=[],errors=[],requests=[],samples=[]
let browser,protocol,page,launch,artifact,environment,failure,notRunReason,checkpointReady=false
class NotRun extends Error{}
async function bounded(promise,message,seconds=20){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`NATIVE_PROTOCOL_TIMEOUT: ${message}`)),seconds*1000)})])}finally{clearTimeout(timer)}}
const record=message=>{checks.push(message);console.log('PASS '+message)}
const until=async(fn,message,seconds=90)=>{const end=Date.now()+seconds*1000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100))}throw Error(`TIMEOUT: ${message}; hidden/occluded scheduling may prevent native progress`)}
const direct=name=>page.getByRole('button',{name,exact:true}).click()
const world=()=>bounded(page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/state',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('STATE_UNAVAILABLE');return(await r.json()).saved?.world??null}),'world read')
const child=async()=>{const handle=await page.locator('.village-canvas iframe').elementHandle();return handle?.contentFrame()}
const metrics=async()=>{const frame=await child();return frame?.evaluate(()=>window.__sceneMetrics?.())}
const observed=async()=>{const frame=await child();return frame?.evaluate(()=>window.__teaNativeObserved??null)}
const liveWorld=async()=>until(async()=>(await observed())?.world,'actual frame render observation')
const members=w=>[w.actor,...w.companions]
const screenshot=async name=>{for(let attempt=1;attempt<=2;attempt++){const session=await page.context().newCDPSession(page);try{const result=await bounded(session.send('Page.captureScreenshot',{format:'png',fromSurface:true}),'screenshot '+name);await writeFile(join(evidence,name+'.png'),Buffer.from(result.data,'base64'));return}catch(error){observations.push({screenshot:name,attempt,error:String(error)});if(attempt===2)throw error}finally{await session.detach()}}}
const ready=async region=>until(async()=>{const m=await metrics();return m?.region===region&&m.frames>0&&await page.locator('.village-entry-ui[data-entered="true"]').count()===1},`first frame and entrance: ${region}`)
const closePanel=async()=>{const button=page.getByRole('button',{name:'Close panel',exact:true});if(await button.isVisible())await button.click()}
const activate=async button=>{await button.waitFor({state:'visible'});await until(()=>button.isEnabled(),'enabled keyboard action');await button.focus();await button.press('Enter')}
const hud=async name=>{const button=page.getByRole('button',{name,exact:true});if(!await button.isVisible())await activate(page.locator('.village-card').getByRole('button',{name:'More',exact:true}));await activate(button)}
const tab=async name=>{await closePanel();await page.getByRole('tab',{name,exact:true}).click()}
const pause=async value=>{await closePanel();if((await world()).userPaused!==value){await hud(value?'Pause':'Resume');await until(async()=>(await world()).userPaused===value,'pause saved')}}
const map=async()=>{await closePanel();await direct('Community map');await page.locator('.village-community-map').waitFor()}
const choose=id=>page.locator(`.village-map-places [data-place="${id}"]`).click()
async function installedIdentity(){
 const installed=join(work,'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village'),unpack=join(work,'packages',artifact.sha256)
 await mkdir(unpack,{recursive:true});execFileSync('tar',['-xf',join(root,'dist',artifact.file),'-C',unpack],{windowsHide:true})
 assert.equal((await json(join(installed,'package.json'))).version,artifact.version)
 for(const file of ['lib/index.js','lib/client.js','lib/frame.js']){const bytes=await readFile(join(installed,file));assert.deepEqual(bytes,await readFile(join(unpack,'package',file)));observations.push({installedBundle:file,bytes:bytes.length,sha256:hash(bytes)})}
 record('Installed Host/client/frame bundles byte-match the explicitly pinned 0.13 package')
 return {installed,unpack}
}
async function assertArtFiles(identity){
 for(const key of [...expectedKeys,'bookhouse/bookhouse-scene-atlas.png','bookhouse/bookhouse-activity-atlas.png']){
  let bytes;try{bytes=await readFile(join(identity.unpack,'package/assets',key))}catch{throw new NotRun('Pinned package has no complete tea art resource set; no gate or world bypass was attempted.')}
  assert.deepEqual(await readFile(join(identity.installed,'assets',key)),bytes)
  observations.push({resource:key,bytes:bytes.length,sha256:hash(bytes)})
 }
}
async function controlledSchedulingPreflight(){
 assert.equal(runTag,'approved-pre3')
 const visible=launch.visibleQa===true
 if(visible){assert.equal(launch.windowStyle,'Normal');assert.equal(launch.unthrottledQa,false);assert.equal(launch.schedulingCondition,'user-authorized-visible-qa')}
 else{assert.equal(launch.unthrottledQa,true);assert.equal(launch.schedulingCondition,'controlled-offscreen-scheduling');for(const flag of ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion'])assert.ok(launch.arguments.includes(flag),'explicit dedicated QA process scheduling flag')}
 await pause(false);await until(async()=>(await liveWorld()).userPaused===false,'actual resumed frame before scheduling observation')
 const before={world:await liveWorld(),metrics:await metrics()},start=performance.now();await new Promise(resolve=>setTimeout(resolve,3000));const after={world:await liveWorld(),metrics:await metrics()},elapsed=performance.now()-start
 const measurement={condition:launch.schedulingCondition,elapsedMs:elapsed,tickDelta:after.world.ticks-before.world.ticks,frameDelta:after.metrics.frames-before.metrics.frames,before,after}
 observations.push({schedulingPreflight:measurement});await writeFile(join(evidence,'scheduling-preflight.json'),JSON.stringify(measurement,null,2))
 if(measurement.tickDelta<45||measurement.frameDelta<20)throw new NotRun('The recorded QA scheduling condition did not establish adequate progress in the one three-second observation; no activity supplement or repeat was attempted.')
 record('One three-second actual-frame observation established progress in '+launch.schedulingCondition+'; this is not a long-duration hardware FPS benchmark')
}
async function ordinaryTea(){
 await pause(false);await tab('Residents');await direct('Choose a tea and sit a while');samples.length=0
 await until(async()=>{const w=await liveWorld();sample(w);return w.teaSquare.activity?.stage==='waiting'&&w.actor.behavior==='sit'},'ordinary tea actual seat arrival',mode==='continuation'?300:150)
 await pause(true);const w=await world(),frame=await metrics(),pose=frame.rigs.find(r=>r.id===w.actor.id)?.teaSeat
 assert.equal(pose?.active,true);assert.equal(pose.restingVisible,true);assert.equal(pose.standingVisible,false);assert.equal(pose.source,'own-approved-rest-pose');assert.deepEqual(pose.feet,[w.actor.position.x,w.actor.position.y]);assert.ok(pose.depth<pose.tableDepth)
 observations.push({ordinaryTea:{world:w,metrics:frame}});await screenshot('native-ordinary-tea-seated')
 await tab('Residents');await direct('Stop tea activity');await until(async()=>(await world()).teaSquare.activity===null,'ordinary tea cancellation')
 await until(async()=>{const m=await metrics(),p=m?.rigs.find(r=>r.id===w.actor.id)?.teaSeat;return p?.active===false&&p.restingVisible===false&&p.standingVisible===true},'actual seated sprite reset after cancellation')
 assert.deepEqual((await world()).actor.position,w.actor.position);record('Ordinary tea reaches its real seat, shows own approved seated sprite behind table, and cancellation restores standing without moving feet')
}
async function assertArtFrame(){
 const seen=await until(async()=>{const s=await observed();return s?.region==='tea-square'&&expectedKeys.every(key=>s.textureKeys.includes(key))?s:null},'four real tea texture keys received by iframe')
 assert.equal(seen.frameVersion,11);const m=await metrics();assert.equal(m.region,'tea-square');assert.equal(m.textures,seen.textureKeys.length)
 assert.ok(!seen.textureKeys.includes('scene/background.png'));assert.ok(!seen.textureKeys.some(k=>k.startsWith('map/')))
 observations.push({actualFrameKeys:seen.textureKeys,metrics:m});record('Real protocol11 iframe received all four tea textures and released courtyard scenery')
}
async function travel(id){
 await pause(true);await map();await choose(id)
 if(await page.locator('.village-map-travel').isDisabled())throw new NotRun(`Public travel to ${id} is unavailable; this script never bypasses the production gate.`)
 const before=await world(),start=performance.now();await page.locator('.village-map-travel').click()
 await until(async()=>(await world()).region.active===id,'public map travel commit');await ready(id);await closePanel()
 const after=await world();assert.equal(after.userPaused,before.userPaused);assert.equal(after.ticks,before.ticks);assert.equal(after.rng,before.rng)
 assert.deepEqual(members(after).map(a=>a.id).sort(),members(before).map(a=>a.id).sort());observations.push({travel:id,milliseconds:performance.now()-start,metrics:await metrics()})
}
async function checkGate(){
 await pause(true);const before=await world(),writes=requests.filter(r=>r.path==='save').length
 await map();await choose('tea-square');const disabled=await page.locator('.village-map-travel').isDisabled();await screenshot('native-tea-map-gate')
 await closePanel();assert.deepEqual(await world(),before);assert.equal(requests.filter(r=>r.path==='save').length,writes)
 return !disabled
}
function sample(w){
 const all=members(w),previous=samples.at(-1)
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(Math.hypot(all[i].position.x-all[j].position.x,all[i].position.y-all[j].position.y)>=23.99,'overlapping resident feet')
 if(previous&&w.ticks>=previous.tick)for(const a of all){const old=previous.feet.find(p=>p.id===a.id);if(old)assert.ok(Math.hypot(a.position.x-old.x,a.position.y-old.y)<=(w.ticks-previous.tick)*17/30+.1,'movement exceeded real walking speed')}
 if(samples.length<6000)samples.push({tick:w.ticks,stage:w.teaSquare.active?.stage,phase:w.teaSquare.active?.phase,feet:all.map(a=>({id:a.id,...a.position}))})
}
async function waitStage(stage){
 return until(async()=>{const w=await liveWorld();sample(w);const e=w.teaSquare.active;assert.ok(e,'story ended before requested phase');if(e.stage!==stage||e.phase!=='ready')return null
  e.participants.forEach((id,i)=>{const a=members(w).find(a=>a.id===id);assert.ok(Math.hypot(a.position.x-e.targets[i].x,a.position.y-e.targets[i].y)<.1,'phase advanced before arrival')});return e
 },`three real arrivals at stage ${stage}`,mode==='continuation'?300:180)
}
async function selectCast(cast){for(const [index,name]of ['Tea companion one','Tea companion two','Tea companion three'].entries())await page.getByLabel(name,{exact:true}).selectOption(cast[index])}
async function startStory(cast=['bluewhale','claude','gemini']){await pause(false);await tab('Residents');await selectCast(cast);await direct((await world()).teaSquare.memory?'Share tea again':'Start tea gathering');await until(async()=>(await liveWorld()).teaSquare.active,'three-person event saved');samples.length=0}
const tea=()=>page.locator('.village-tea-square')
async function order(){const text=await tea().locator('[data-coaster-hint]').innerText(),parts=text.split(':').at(-1).trim().split(' → ');assert.deepEqual([...parts].sort(),['Cloud','Leaf','Star'].sort());return parts}
async function place(shape,slot){const before=(await liveWorld()).teaSquare.active;await tea().getByRole('group',{name:'Coaster shapes',exact:true}).getByRole('button',{name:shape,exact:true}).click();await tea().getByRole('group',{name:'Coaster places',exact:true}).getByRole('button').nth(slot).click();await until(async()=>{const e=(await liveWorld()).teaSquare.active;return e?.serial>before.serial},'coaster serial committed')}
async function puzzleCheckpoint(){
 await startStory();assert.equal(await page.getByRole('button',{name:'Arrange the coasters together',exact:true}).isDisabled(),true)
 await waitStage(0);await direct('Arrange the coasters together');await waitStage(1);const hint=await order(),wrong=[hint[1],hint[2],hint[0]]
 for(let slot=0;slot<3;slot++)await place(wrong[slot],slot)
 assert.equal((await liveWorld()).teaSquare.active.stage,1);assert.equal((await liveWorld()).teaSquare.memory,null)
 const serial=(await liveWorld()).teaSquare.active.serial;await direct('Reset coasters');await until(async()=>(await liveWorld()).teaSquare.active.serial===serial+1,'reset token committed')
 assert.deepEqual((await liveWorld()).teaSquare.active.board,[-1,-1,-1]);await place(hint[0],0)
 await pause(true);const checkpoint={artifact,launchPid:launch.pid,world:await world(),hint,at:new Date().toISOString()}
 assert.equal(checkpoint.world.schemaVersion,14);assert.equal(checkpoint.world.region.version,2);assert.equal(checkpoint.world.teaSquare.active.stage,1)
 await writeFile(join(work,'tea-native-checkpoint.json'),JSON.stringify(checkpoint,null,2));await screenshot('native-partial-board-checkpoint')
 await new Promise(resolve=>setTimeout(resolve,500));assert.deepEqual(await world(),checkpoint.world)
 record('Three real arrivals, wrong order, reset token, and paused partial-board checkpoint');return checkpoint
}
async function finishStory(checkpoint){
 await pause(false);await tab('Residents');assert.deepEqual(await order(),checkpoint.hint)
 for(let slot=1;slot<3;slot++)await place(checkpoint.hint[slot],slot)
 assert.equal(await page.getByRole('button',{name:'Remember this afternoon',exact:true}).isDisabled(),true)
 await waitStage(2);await screenshot('native-closing-arrivals');await direct('Remember this afternoon')
 await until(async()=>(await world()).teaSquare.memory?.count===1,'first memory saved');await pause(true)
 const w=await world();assert.equal(w.teaSquare.active,null);assert.equal(w.teaSquare.keepsake,'message-tree');assert.deepEqual(w.teaSquare.memory.participants,['bluewhale','claude','gemini'])
 record('Three actual closing arrivals and explicit completion yield one durable first memory and placed tea tag')
 return w.teaSquare.memory
}
async function photo(name='native-tea-keepsake-photo'){
 await pause(true);const before=await world();await hud('Photo mode');await direct('Take photo');const preview=page.getByRole('img',{name:'Photo preview',exact:true});await preview.waitFor()
 // Read the exact photo blob displayed by the real capture UI; do not reconstruct an image.
 const bytes=await preview.evaluate(async img=>{const r=await fetch(img.src);return Array.from(new Uint8Array(await r.arrayBuffer()))}),png=Buffer.from(bytes)
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),960)
 await writeFile(join(evidence,name+'.png'),png);await screenshot(name+'-ui');await direct('Back to camera');await direct('Exit photo mode');assert.deepEqual(await world(),before)
 observations.push({photo:{width:720,height:960,bytes:png.length,sha256:hash(png)}});record('Actual 720×960 scene capture preserves the paused world')
}
async function admitSeven(){
 assert.equal((await world()).region.active,'courtyard');await pause(true)
 for(const [id,name]of [['claude','Claude'],['gemini','Gemini'],['gpt','GPT'],['grok','Grok'],['kimi','Kimi'],['qwen','Qwen']]){
  if(members(await world()).some(a=>a.id===id))continue
  await tab('Residents');await direct('All residents');await direct('Manage residents');await page.getByRole('checkbox',{name:`Resident ${name}`,exact:true}).click()
  await until(async()=>members(await world()).some(a=>a.id===id),'resident admission');await ready('courtyard')
 }
 assert.equal(members(await world()).length,7);await closePanel()
}
async function cancelledAndReplay(memory){
 await tab('Decor');await direct('Put the tag away');await until(async()=>(await world()).teaSquare.keepsake===null,'tag put away')
 await startStory();await direct('Cancel tea gathering');await until(async()=>(await world()).teaSquare.active===null,'explicit cancellation')
 assert.deepEqual((await world()).teaSquare.memory,memory);assert.equal((await world()).teaSquare.keepsake,null)
 await startStory(['bluewhale','gpt','grok']);await waitStage(0);await direct('Arrange the coasters together');await waitStage(1);const hint=await order();for(let slot=0;slot<3;slot++)await place(hint[slot],slot)
 await waitStage(2);await direct('Remember this afternoon');await until(async()=>(await world()).teaSquare.memory?.count===2,'replay saved');await pause(true)
 const w=await world();assert.deepEqual(w.teaSquare.memory,{...memory,count:2});assert.equal(w.teaSquare.keepsake,null)
 await tab('Decor');await direct('Hang on the message tree');await until(async()=>(await world()).teaSquare.keepsake==='message-tree','tag placed')
 record('Explicit cancellation yields no reward; replay retains first facts and stored keepsake placement')
}
async function bookhouseVisit({remainingOnly=false}={}){
 const permanent=(await world()).teaSquare;if((await world()).region.active!=='bookhouse'){await travel('courtyard');await travel('bookhouse')}samples.length=0
 const keys=['bookhouse/bookhouse-scene-atlas.png','bookhouse/bookhouse-activity-atlas.png'],seen=await observed();assert.ok(keys.every(k=>seen.textureKeys.includes(k)));assert.ok(!seen.textureKeys.some(k=>k.startsWith('tea-square/')||k.startsWith('map/')))
 observations.push({bookhouseTextureKeys:seen.textureKeys,metrics:await metrics()})
 for(const [id,label,behavior]of [['bookcase','Read at the bookcase','read'],['reading-desk','Write at the reading desk','work'],['window-seat','Sit by the window','sit']]){
  if(remainingOnly&&id==='bookcase')continue
  await pause(true);const actual=await world(),anchor=({bookcase:{x:276,y:268},'reading-desk':{x:142,y:328},'window-seat':{x:92,y:270}})[id],occupant=members(actual).find(a=>a.intent?.furnitureId===id&&a.intent.stage==='use')??members(actual).find(a=>Math.hypot(a.position.x-anchor.x,a.position.y-anchor.y)<24),selected=occupant?.id??'bluewhale'
  await tab('Residents');await page.getByLabel('Current resident',{exact:true}).selectOption(selected);await until(async()=>(await world()).actor.id===selected,'selected actual hotspot user');observations.push({ordinaryBookhouseSelection:{hotspot:id,selected,reason:occupant?'actual occupant':'unoccupied'}})
  await pause(false);await tab('Residents');await direct(label)
  await until(async()=>{const w=await liveWorld();return w.actor.id===selected&&w.actor.intent?.furnitureId===id},'ordinary intent accepted: '+id,20);observations.push({ordinaryIntentAccepted:{hotspot:id,world:await liveWorld()}})
  await until(async()=>{const w=await liveWorld();sample(w);return w.actor.intent?.furnitureId===id&&w.actor.intent.stage==='use'&&w.actor.behavior===behavior},'bookhouse ordinary '+id,mode==='continuation'?300:120)
  await pause(true);const frame=await metrics();assert.equal(frame.bookhouseArtwork,'raster');assert.equal(frame.rigs.find(r=>r.id===selected)?.bookhouse?.mode,({read:'reading',work:'writing',sit:'seated'})[behavior]);await screenshot('native-bookhouse-'+id);observations.push({ordinaryBookhouse:id,world:await world(),metrics:frame});if(id==='window-seat')await photo('native-bookhouse-window-photo')
  await tab('Residents');await direct('Stop current activity');await until(async()=>(await world()).actor.intent===null,'ordinary cancellation')
 }
 await map();await choose('tea-square');assert.equal(await page.locator('.village-map-travel').isDisabled(),true);await closePanel();await travel('courtyard');await travel('tea-square');await assertArtFrame();assert.deepEqual((await world()).teaSquare,permanent)
 record(remainingOnly?'Remaining native bookhouse desk and window poses plus real photo passed; round trip releases scene textures and retains tea fact':'Native approved bookhouse has three actual ordinary poses and a real photo; round trip releases scene textures and retains tea fact')
}
try{
 launch=await json(join(work,'launch.json'));assert.equal(launch.port,18774);assert.equal(launch.windowStyle,launch.visibleQa===true?'Normal':'Hidden');assert.equal(launch.dshHome.replaceAll('\\','/'),join(work,'home').replaceAll('\\','/'));assert.ok(launch.arguments.some(v=>v.replaceAll('\\','/')===`--user-data-dir=${join(work,'electron-data').replaceAll('\\','/')}`))
 if(mode!=='inspect'){const version=process.env.AI_VILLAGE_EXPECTED_VERSION,sha256=process.env.AI_VILLAGE_EXPECTED_SHA;assert.match(version??'',/^0\.13\.\d+(?:-[a-z0-9.]+)?$/);assert.match(sha256??'',/^[a-f0-9]{64}$/);artifact={version,sha256,file:`nidofy-dsh-ai-village-${version}.tgz`};assert.equal(hash(await readFile(join(root,'dist',artifact.file))),sha256)}
 const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
 const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')).href);browser=await chromium.connectOverCDP('http://127.0.0.1:18774',{timeout:15000});protocol=await browser.newBrowserCDPSession()
 const pages=browser.contexts().flatMap(c=>c.pages());page=pages.find(p=>p.url().startsWith('dsh-app:'));assert.ok(page);page.setDefaultTimeout(20000)
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/api/nidofy-ai-village/'))requests.push({path:request.url().split('/api/nidofy-ai-village/')[1].split('?')[0],method:request.method(),at:Date.now()})})
 environment={launch,browser:await protocol.send('Browser.getVersion'),gpu:(await protocol.send('SystemInfo.getInfo')).gpu,page:await page.evaluate(()=>({visibility:document.visibilityState,dpr:devicePixelRatio,size:[innerWidth,innerHeight]}))}
 if(mode==='inspect'){observations.push({buttons:await page.getByRole('button').allTextContents()});await screenshot('inspect');record('Read-only inspection of the isolated native target')}
 else if(mode==='install'){
  const welcome=pages.find(p=>p.url().includes('welcome.html'));if(welcome){const add=welcome.getByRole('button',{name:'Add API Key',exact:true});if(await add.isVisible())await add.click();await welcome.getByRole('button',{name:'Set up later',exact:true}).click()}
  const close=page.getByRole('button',{name:'Close',exact:true});if(await close.isVisible())await close.click();await direct('Plugins');await direct('Add plugin');await page.getByRole('textbox',{name:'Package name or address'}).fill(join(root,'dist',artifact.file));await direct('Install');await page.getByRole('button',{name:'Enable now',exact:true}).waitFor({timeout:90000});await direct('Enable now');await screenshot('installed');await installedIdentity();record('Official manager installed and enabled the pinned package in the dedicated tea profile')
 }else{
  const identity=await installedIdentity()
  // Passive observation installed before the real UI reopens its iframe; never sends a frame command.
  await page.addInitScript(()=>{window.__teaNativeObserved={frameVersion:null,textureKeys:[],world:null,region:null};window.addEventListener('message',event=>{const m=event.data;if(event.source!==parent||m?.channel!=='nidofy-ai-village')return;const s=window.__teaNativeObserved;s.frameVersion=m.version;if(m.type==='init'||m.type==='assets'){s.textureKeys=Object.keys(m.images??{}).slice(0,160);if(m.region)s.region=m.region}if(m.type==='render'){s.world=m.view?.world;s.region=s.world?.region?.active??s.region}})})
  const cold=mode==='restored'?await json(join(work,'tea-native-checkpoint.json')):null
  if(cold){assert.equal(cold.artifact.sha256,artifact.sha256);assert.notEqual(cold.launchPid,launch.pid,'restored mode requires a real dedicated process restart');assert.deepEqual(await world(),cold.world)}
  if(mode==='continuation')observations.push({continuationBeforeReentry:{world:await world(),recoveryDetails:await page.locator('.recovery-door-details').textContent().catch(()=>null),wallBudgetPerStageSeconds:300,priorLabel:'native-approved-pre3-restored-01'}})
  if(await page.locator('.village-card').count()){
   const entry=page.getByRole('button',{name:'Open the doors and enter again',exact:true});if(await entry.isVisible()){await entry.click();await ready((await world()).region.active)}
   await closePanel();await hud('Close courtyard')
  }
  await page.getByRole('button',{name:'New session',exact:true}).first().click();await direct('Open AI Village');const bootWorld=await until(()=>world(),'initial saved world');await ready(bootWorld.region.active)
  const initial=await world();assert.equal(initial.schemaVersion,14);assert.equal(initial.region.version,2)
  if(mode==='gate'){assert.equal(await checkGate(),false,'gate mode requires the still-planned destination');record('Planned destination stays disabled and map browsing leaves the saved world unchanged')}
  else if(mode==='restored'){
   assert.deepEqual(await world(),cold.world);record('Paused world after the distinct native process restart exactly matches its checkpoint')
   if(cold.kind==='gate-world'){
    assert.equal(await checkGate(),false);assert.deepEqual(await world(),cold.world);assert.equal((await bounded(observed(),'passive frame observation')).frameVersion,11);await screenshot('native-gate-cold-restored');record('Full native process restart preserved the exact paused seven-resident world14/region2; tea remains planned and frame11 is real')
   }else{
    await assertArtFiles(identity);await assertArtFrame();await screenshot('native-cold-restored');record('Full native process restart preserved the exact paused partial board and all seven residents')
    const memory=await finishStory(cold);await cancelledAndReplay(memory);await ordinaryTea();await photo();await bookhouseVisit()
   }
  }else if(mode==='continuation'){
   await assertArtFiles(identity);await assertArtFrame();const before=await liveWorld();assert.equal(before.teaSquare.active?.stage,2);assert.equal(before.teaSquare.memory,null);observations.push({continuationActualStart:before});await pause(false);await tab('Residents');await waitStage(2);await screenshot('native-continuation-closing-arrivals');await direct('Remember this afternoon');await until(async()=>(await world()).teaSquare.memory?.count===1,'continued first memory saved');await pause(true);const memory=(await world()).teaSquare.memory;assert.deepEqual(memory.participants,['bluewhale','claude','gemini']);record('One bounded continuation finished the same real stage2 event without replaying its checkpoint; prior timeout remains FAIL');await cancelledAndReplay(memory);await ordinaryTea();await photo();await bookhouseVisit()
  }else if(mode==='supplement'){
   if(initial.region.active!=='tea-square'||!initial.teaSquare.memory)throw new NotRun('Independent activity supplement requires the retained real tea profile and its first memory.')
   await assertArtFiles(identity);await assertArtFrame();await controlledSchedulingPreflight();await pause(true);const saved=await world();observations.push({supplementBeforeCancellation:saved})
   if(saved.teaSquare.active){await tab('Residents');await direct('Cancel tea gathering');await until(async()=>(await world()).teaSquare.active===null,'cancel retained unfinished replay through actual UI');assert.deepEqual((await world()).teaSquare.memory,saved.teaSquare.memory);record('Retained unfinished replay cancelled through real UI without changing its first memory; replay was not retried')}
   await ordinaryTea();await photo();await bookhouseVisit()
  }else if(mode==='bookhouse-supplement'){
   assert.equal(launch.visibleQa,true);assert.equal(initial.region.active,'bookhouse');await assertArtFiles(identity);await controlledSchedulingPreflight();await bookhouseVisit({remainingOnly:true})
  }else if(mode==='visible-replay'){
   assert.equal(launch.visibleQa,true);assert.equal(initial.region.active,'tea-square');assert.equal(initial.teaSquare.active,null);assert.equal(initial.teaSquare.memory?.count,1);await assertArtFiles(identity);await assertArtFrame();await controlledSchedulingPreflight();await pause(true);const memory=(await world()).teaSquare.memory,keepsake=(await world()).teaSquare.keepsake;await tab('Residents');await page.getByLabel('Current resident',{exact:true}).selectOption('bluewhale');await until(async()=>(await world()).actor.id==='bluewhale','replay actor selection');await startStory(['bluewhale','gpt','grok']);await waitStage(0);await direct('Arrange the coasters together');await waitStage(1);const hint=await order();for(let slot=0;slot<3;slot++)await place(hint[slot],slot);await waitStage(2);await screenshot('native-visible-replay-arrived');await direct('Remember this afternoon');await until(async()=>(await world()).teaSquare.memory?.count===2,'visible replay saved');await pause(true);assert.deepEqual((await world()).teaSquare.memory,{...memory,count:2});assert.equal((await world()).teaSquare.keepsake,keepsake);record('Visible native different-cast replay completed through three actual arrivals and real UI puzzle; first facts and decoration choice retained')
  }else if(mode==='photo'){
   if(initial.region.active!=='tea-square'||!initial.teaSquare.memory||initial.teaSquare.keepsake!=='message-tree')throw new NotRun('Photo mode requires a legitimately completed tea story and its placed tag.')
   await assertArtFiles(identity);await assertArtFrame();await photo()
  }else{
   if(initial.region.active!=='courtyard'||initial.teaSquare.memory)throw new NotRun('Start fullplay/checkpoint on a fresh courtyard profile with no completed tea story.')
   if(!await checkGate()){
    if(mode!=='checkpoint')throw new NotRun('Tea-square public map gate is still planned. Full play was not run.')
    await admitSeven();await pause(true);const saved=await world();assert.equal(saved.region.active,'courtyard');assert.equal(saved.teaSquare.active,null);assert.equal(saved.teaSquare.memory,null)
    await writeFile(join(work,'tea-native-checkpoint.json'),JSON.stringify({kind:'gate-world',artifact,launchPid:launch.pid,world:saved,at:new Date().toISOString()},null,2));await screenshot('native-gate-seven-checkpoint');checkpointReady=true;record('Planned gate retained; seven residents admitted through courtyard UI and paused world checkpoint saved without entering tea')
   }else{
    await assertArtFiles(identity);await admitSeven();await travel('tea-square');await assertArtFrame();await screenshot('native-seven-arrival')
    const checkpoint=await puzzleCheckpoint()
    if(mode==='checkpoint'){checkpointReady=true;record('Checkpoint saved; external identity-checked restart is required before restored mode')}
    else{const memory=await finishStory(checkpoint);await cancelledAndReplay(memory);await ordinaryTea();await photo();await bookhouseVisit()}
   }
  }
 }
 assert.deepEqual(errors,[])
}catch(error){if(error instanceof NotRun)notRunReason=error.message;else failure=String(error.stack??error);if(page)await screenshot('stopped').catch(()=>{})}
finally{
 const status=failure?'FAIL':notRunReason?'NOT_RUN':checkpointReady?'CHECKPOINT_READY':'PASS'
 await writeFile(join(evidence,'result.json'),JSON.stringify({status,mode,runRoot,artifact,scriptSha:hash(await readFile(new URL(import.meta.url))),environment,checks,observations,errors,requests,samples,notRunReason,failure,world:page?await world().catch(()=>null):null,notCovered:[launch?.visibleQa?'long-duration native foreground hardware FPS benchmark':'native foreground hardware FPS (window not activated)','physical sleep/minimize','long-duration memory soak','additional physical DPI','fault-injected UNKNOWN ACK (covered by separate core/browser tests)','new direction animation qualification']},null,2)+'\n')
 await protocol?.detach().catch(()=>{});console.log(JSON.stringify({status,evidence,checks,notRunReason,failure}));process.exit(failure||notRunReason?1:0)
}

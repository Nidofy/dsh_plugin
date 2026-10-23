/** Real official Desktop only. No fixture, world mutation, profile copying, or host changes. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),work=join(root,'.build/ai-village-v08-desktop'),mode=process.argv[2]??'inspect'
const label=process.argv[3]??`${mode}-${Date.now()}`
assert.match(label,/^[a-z0-9][a-z0-9-]{0,80}$/)
const evidence=join(root,'docs/ai-village/v08-v09/native',label)
await mkdir(join(root,'docs/ai-village/v08-v09/native'),{recursive:true});await mkdir(evidence)
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex')
const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
assert.ok(pw,'Existing Playwright required; no SDK installation')
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const browser=await chromium.connectOverCDP('http://127.0.0.1:18766')
const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>p.url().startsWith('dsh-app:'))
assert.ok(page,'Dedicated official Desktop app page required');page.setDefaultTimeout(25000)
const errors=[],screenshotIssues=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const capture=async name=>{const cdp=await page.context().newCDPSession(page);try{
  const shot=await Promise.race([cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true}),new Promise((_,reject)=>setTimeout(()=>reject(Error('SCREENSHOT_TIMEOUT')),8000))])
  await writeFile(join(evidence,name+'.png'),Buffer.from(shot.data,'base64'))
}catch(error){screenshotIssues.push({name,error:error.message})}finally{await cdp.detach()}}
const buttons=()=>page.getByRole('button').evaluateAll(els=>els.map(el=>({name:el.getAttribute('aria-label')||el.textContent,disabled:el.disabled})))
const report=async extra=>writeFile(join(evidence,'result.json'),JSON.stringify({mode,officialCarrier:'0.2.1-rc.2',profile:'.build/ai-village-v08-desktop',cdp:18766,checks,errors,screenshotIssues,...extra},null,2)+'\n')
const direct=name=>page.getByRole('button',{name,exact:true}).click()
const until=async(fn,message,seconds=30)=>{for(let i=0;i<seconds*5;i++){const r=await fn();if(r)return r;await page.waitForTimeout(200)}throw Error(message)}
const world=()=>page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/state');return r.ok?(await r.json()).saved?.world:null})
const album=()=>page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/album');return r.ok?(await r.json()).saved:null})
let artifact
try{
 if(mode==='inspect'){
  const summaries=[];for(const p of pages)summaries.push({kind:p.url().includes('welcome.html')?'welcome':p.url().startsWith('dsh-app:')?'app':'other',buttons:await p.getByRole('button').allTextContents()})
  const current=await world().catch(()=>null),card=await page.locator('.village-card').count()?await page.locator('.village-card').innerText():null,visibility=await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState})),iframe=await page.locator('.village-canvas iframe').count()?await page.locator('.village-canvas iframe').elementHandle():null,renderFrame=iframe?await iframe.contentFrame():null,metrics=renderFrame?await renderFrame.evaluate(()=>({visibility:document.visibilityState,hidden:document.hidden,...window.__sceneMetrics?.()})):null
  await report({passed:true,pages:summaries,world:current,card,visibility,metrics});console.log(JSON.stringify({pages:summaries,world:current?{ticks:current.ticks,userPaused:current.userPaused,active:current.play?.active}:null,card,visibility,metrics}));await capture('desktop-inspect');process.exit(0)
 }
 const welcome=pages.find(p=>p.url().includes('welcome.html'))
 if(welcome){await welcome.getByRole('button',{name:'Add API Key',exact:true}).click();await welcome.getByRole('button',{name:'Set up later',exact:true}).click();checks.push('Dismissed official first-run welcome through Add API Key / Set up later; no credentials configured')}
 if(mode==='dismiss-welcome'){await report({passed:true});console.log('Official welcome dismissed');process.exit(0)}
 artifact=(await json(join(root,'dist/manifest.json'))).find(p=>p.name==='@nidofy/dsh-ai-village')
 assert.equal(artifact.version,'0.8.0-preview.1');assert.equal(hash(await readFile(join(root,'dist',artifact.file))),artifact.sha256)
 const expectedSha=process.env.AI_VILLAGE_EXPECTED_SHA;assert.match(expectedSha??'',/^[a-f0-9]{64}$/,'Pin final package SHA with AI_VILLAGE_EXPECTED_SHA');assert.equal(artifact.sha256,expectedSha)
 if(mode==='install'){
  const close=page.getByRole('button',{name:'Close',exact:true});if(await close.isVisible())await close.click()
  await direct('Plugins');await direct('Add plugin')
  await page.getByRole('textbox',{name:'Package name or address'}).fill(join(root,'dist',artifact.file));await direct('Install')
  await page.getByRole('button',{name:'Enable now',exact:true}).waitFor({timeout:90000});await direct('Enable now')
  checks.push('Official plugin manager installed local pinned tarball into isolated profile')
  await capture('installed');await report({passed:true,artifact,restartRequired:true});console.log('Official install passed; cold restart required');process.exit(0)
 }
 const installed=join(work,'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village')
 assert.equal((await json(join(installed,'package.json'))).version,artifact.version)
 for(const file of ['lib/index.js','lib/client.js','lib/frame.js','assets/scenes/courtyard/scene.json'])assert.deepEqual(await readFile(join(installed,file)),await readFile(join(root,'packages/ai-village',file)),'Installed bytes: '+file)
 checks.push('Installed version and source build bytes match pinned artifact')
 if(!await page.locator('.village-card').count()){await page.getByRole('button',{name:'New session',exact:true}).first().click();await direct('Open AI Village')}
 await page.locator('.village-canvas iframe').waitFor({timeout:60000})
 const frame=await(await page.locator('.village-canvas iframe').elementHandle()).contentFrame()
 await frame.waitForFunction(()=>window.__sceneMetrics?.().frames>0,null,{timeout:60000})
 if(mode==='ui-inspect'){await report({passed:true,artifact,buttons:await buttons(),tabs:await page.getByRole('tab').allTextContents(),metrics:await frame.evaluate(()=>window.__sceneMetrics())});console.log(JSON.stringify(await buttons()));await capture('ui');process.exit(0)}
 const closePanel=async()=>{const close=page.getByRole('button',{name:'Close panel',exact:true});if(await close.isVisible()){await close.click();await page.waitForTimeout(260)}}
 const tab=async name=>{await closePanel();const t=page.getByRole('tab',{name,exact:true});await t.click()}
 const hud=async name=>{const b=page.getByRole('button',{name,exact:true});if(!await b.isVisible())await page.locator('.village-card').getByRole('button',{name:'More',exact:true}).click();await b.click()}
 const pause=async()=>{if(!(await world()).userPaused){await hud('Pause');await until(async()=>(await world())?.userPaused,'Pause must persist')}}
 const games=async()=>{await closePanel();await tab('Wishes');const all=page.getByRole('button',{name:'All wishes',exact:true});if(await all.isVisible())await all.click()}
 const photoBytes=async photo=>{const bytes=Buffer.from(await page.evaluate(async id=>{const r=await fetch('/api/nidofy-ai-village/photos/'+id);if(!r.ok)throw Error('Photo read failed');return [...new Uint8Array(await r.arrayBuffer())]},photo.id));assert.equal(hash(bytes),photo.hash);return bytes}
 const observations=[]
 const waitUI=async(button,message,seconds=240)=>{
  const started=Date.now();let nextLog=0
  for(;;){if(await button.count()&&await button.isEnabled())return
   if(Date.now()-started>seconds*1000)throw Error(message)
   if(Date.now()-started>=nextLog){const w=await world(),row={waiting:message,elapsedSeconds:Math.round((Date.now()-started)/1000),ticks:w?.ticks,paused:w?.userPaused,active:w?.play.active?{id:w.play.active.definitionId,stage:w.play.active.stage,phase:w.play.active.phase}:null};observations.push(row);console.log(JSON.stringify(row));nextLog+=20000}
   await page.waitForTimeout(250)
  }
 }
 const checkpoint=async()=>{await pause();await closePanel();const saved=await world(),photos=await album();assert.equal(saved.schemaVersion,9);await writeFile(join(work,'expected-v08.json'),JSON.stringify({artifact,world:saved,album:photos},null,2));return{saved,photos}}
 const collection=async()=>{
  await tab('Journal');const memoryButton=page.getByRole('button',{name:'Memories',exact:true});await memoryButton.click()
  const region=page.getByRole('region',{name:'Collection categories',exact:true});await region.waitFor()
  assert.equal(await region.locator('details').count(),8)
  const saved=await world(),ids=saved.neighborhood.memories.filter(m=>['paper-rescue','leaves-gather'].includes(m.id)).map(m=>m.id)
  assert.ok(ids.length>=1);await region.getByText(`Chance encounters · ${ids.length}/2`,{exact:true}).click()
  for(const id of ids)await region.getByText(id==='paper-rescue'?'A runaway message':'A letter from the leaves',{exact:true}).waitFor()
  await region.getByText('Residents in shared memories · 2/7',{exact:true}).waitFor()
  await capture('collection-categories');return{ids,text:await region.innerText()}
 }
 if(mode==='restored'){
  const expected=await json(join(work,'expected-v08.json'));assert.equal(expected.artifact.sha256,artifact.sha256)
  assert.deepEqual(await world(),expected.world);assert.deepEqual(await album(),expected.album)
  for(const p of expected.album?.world.photos??[])await photoBytes(p)
  checks.push('Whole official Desktop process restart preserved exact schema9 world, encounter consumed window/memory/reward placement, album index and PNG hashes')
  const collections=await collection();assert.deepEqual(await world(),expected.world);await capture('cold-restored')
  assert.deepEqual(errors,[]);await report({passed:true,artifact,world:expected.world,album:expected.album,collections,observations});console.log('Schema9 native cold restore and collection facts passed');process.exit(0)
 }
 assert.equal(mode,'check');assert.equal((await world()).schemaVersion,9)
 await pause()
 if(!(await world()).companions.some(a=>a.id==='claude')){
  await tab('Residents');const all=page.getByRole('button',{name:'All residents',exact:true});if(await all.isVisible())await all.click();await direct('Manage residents');await page.getByLabel('Resident Claude',{exact:true}).click();await until(async()=>(await world()).companions.some(a=>a.id==='claude'),'Resident admission must commit')
 }
 await closePanel();await hud('Resume');await until(async()=>!(await world()).userPaused,'Resume must persist');await games()
 let active=(await world()).play.active
 if(!active&&!((await world()).neighborhood.memories.some(m=>['paper-rescue','leaves-gather'].includes(m.id)))){
  const lend=page.getByRole('article',{name:'A chance encounter now',exact:true}).getByRole('button',{name:'Lend a hand',exact:true})
  await waitUI(lend,'Natural encounter offer with two real residents',300);await capture('natural-offer');await lend.click()
  active=await until(async()=>{const a=(await world()).play.active;return a&&['paper-rescue','leaves-gather'].includes(a.definitionId)?a:null},'Accepted encounter must commit')
  checks.push('Naturally offered encounter accepted via Lend a hand; no time/world injection')
 }
 const labels={'paper-rescue':['Unfold the message','Add our good news','Keep our message board'],'leaves-gather':['Look at the leaf shapes','Choose today’s leaf','Remember this breeze']}
 if(active){
  assert.ok(Object.hasOwn(labels,active.definitionId));const id=active.definitionId
  for(let stage=active.stage;stage<3;stage++){
   const button=page.getByRole('article',{name:'Current story',exact:true}).getByRole('button',{name:labels[id][stage],exact:true})
   await waitUI(button,`Actual ${id} stage ${stage+1} arrival and observation`,300)
   await pause();const ready=await world(),event=ready.play.active
   assert.equal(event.phase,'ready');assert.equal(event.stage,stage)
   for(let i=0;i<event.participants.length;i++)assert.deepEqual([ready.actor,...ready.companions].find(a=>a.id===event.participants[i]).position,event.targets[i])
   observations.push({arrivedStage:stage,definitionId:id,targets:event.targets,ticks:ready.ticks});await capture(`encounter-stage-${stage+1}`)
   await hud('Resume');await until(async()=>!(await world()).userPaused,'Resume stage must save');await waitUI(button,'Ready stage control');await button.click()
   await until(async()=>{const a=(await world()).play.active;return !a||a.stage>stage},'Explicit story action must commit')
  }
  const memory=(await world()).neighborhood.memories.find(m=>m.id===id);assert.equal(memory.count,1);checks.push('Three actual stages reached legal targets and explicitly completed with one first memory')
 }
 await pause();const completed=await world(),memory=completed.neighborhood.memories.find(m=>['paper-rescue','leaves-gather'].includes(m.id));assert.ok(memory);assert.equal(completed.play.active,null)
 const reward=memory.id==='paper-rescue'?'message-board':'leaf-pot',rewardName=memory.id==='paper-rescue'?'Good-news board':'Breeze-leaf pot'
 await tab('Decor');await direct('Hangings')
 if((await world()).play.decorations[reward]===null){
  await page.getByText(rewardName,{exact:true}).locator('..').getByRole('button',{name:'Choose a place',exact:true}).click();await direct('Wall');await direct('Save this place');await until(async()=>(await world()).play.decorations[reward]==='wall','Discovered keepsake placement must save')
 }
 checks.push('New encounter keepsake explicitly placed through Decor UI and saved')
 const collections=await collection();await closePanel();await capture('placed-keepsake')
 const photoWorld=await world();await hud('Photo mode');await direct('Take photo');await page.getByRole('img',{name:'Photo preview',exact:true}).waitFor({timeout:30000})
 const count=(await album())?.world.photos.length??0;await page.getByLabel('Photo title',{exact:true}).fill('Native 0.8 encounter');await direct('Save to album');await until(async()=>((await album())?.world.photos.length??0)===count+1,'Photo must commit');await direct('Exit photo mode');assert.deepEqual(await world(),photoWorld)
 const photo=(await album()).world.photos.at(-1),png=await photoBytes(photo);assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),960);await writeFile(join(evidence,'native-keepsake-photo.png'),png)
 checks.push('Actual720x960 renderer photo saved to album with byte hash checked and paused world unchanged')
 const {saved,photos}=await checkpoint();assert.deepEqual(errors,[]);await report({passed:true,artifact,world:saved,album:photos,collections,observations});console.log('Native schema9 encounter, collections, keepsake and photo passed; full restart required');process.exit(0)
}catch(error){await capture('failure');await report({passed:false,artifact,failure:{message:error.message,stack:error.stack},world:await world().catch(()=>null),buttons:await buttons().catch(()=>[])});console.error(error.message);process.exit(1)}

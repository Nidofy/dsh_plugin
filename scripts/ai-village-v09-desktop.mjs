/** Official Desktop 0.9 only. UI writes, read-only state evidence; never inject a world or simulation time. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),runRoot=process.env.AI_VILLAGE_RUN_ROOT??'ai-village-v09-desktop',mode=process.argv[2]??'inspect'
assert.match(runRoot,/^ai-village-v09-desktop(?:-[a-z0-9-]+)?$/)
const work=join(root,'.build',runRoot),label=process.argv[3]??`${mode}-${Date.now()}`
assert.match(label,/^[a-z0-9][a-z0-9-]{0,80}$/)
const evidence=join(root,'docs/ai-village/v08-v09/native-v09',label)
await mkdir(join(root,'docs/ai-village/v08-v09/native-v09'),{recursive:true});await mkdir(evidence)
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex')
const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
assert.ok(pw,'Existing Playwright required; no SDK installation')
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const browser=await chromium.connectOverCDP('http://127.0.0.1:18767')
const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>p.url().startsWith('dsh-app:'))
assert.ok(page,'Dedicated official Desktop page required');page.setDefaultTimeout(25000)
const checks=[],errors=[],screenshotIssues=[],observations=[]
page.on('pageerror',e=>errors.push(e.message))
const direct=name=>page.getByRole('button',{name,exact:true}).click()
const buttons=()=>page.getByRole('button').evaluateAll(els=>els.map(el=>({name:el.getAttribute('aria-label')||el.textContent,disabled:el.disabled})))
const until=async(fn,message,seconds=30)=>{for(let i=0;i<seconds*5;i++){const value=await fn();if(value)return value;await page.waitForTimeout(200)}throw Error(message)}
const world=()=>page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/state');return r.ok?(await r.json()).saved?.world:null})
const album=()=>page.evaluate(async()=>{const r=await fetch('/api/nidofy-ai-village/album');return r.ok?(await r.json()).saved:null})
const capture=async name=>{const cdp=await page.context().newCDPSession(page);try{
 const shot=await Promise.race([cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true}),new Promise((_,reject)=>setTimeout(()=>reject(Error('SCREENSHOT_TIMEOUT')),8000))]);await writeFile(join(evidence,name+'.png'),Buffer.from(shot.data,'base64'))
}catch(error){screenshotIssues.push({name,error:error.message})}finally{await cdp.detach()}}
const frame=async()=>{const element=await page.locator('.village-canvas iframe').elementHandle();return element?await element.contentFrame():null}
const metrics=async()=>{const f=await frame();return f?await f.evaluate(()=>({visibility:document.visibilityState,hidden:document.hidden,...window.__sceneMetrics?.()})):null}
const report=async extra=>writeFile(join(evidence,'result.json'),JSON.stringify({mode,officialCarrier:'0.2.1-rc.2',profile:'.build/'+runRoot,cdp:18767,checks,errors,screenshotIssues,observations,...extra},null,2)+'\n')
const poses=w=>[w.actor,...w.companions].map(({id,position,safe,facing})=>({id,position,safe,facing})).sort((a,b)=>a.id.localeCompare(b.id))
const facts=w=>({journal:w.journal,progress:w.progress,memories:w.neighborhood.memories,bonds:w.neighborhood.bonds,decorations:w.play.decorations,legacyDecorations:w.decorations,neighborhoodDecorations:w.neighborhood.decorations,home:w.home})
let artifact
try{
 if(mode==='inspect'){
  const summaries=[];for(const p of pages)summaries.push({kind:p.url().includes('welcome.html')?'welcome':p.url().startsWith('dsh-app:')?'app':'other',buttons:await p.getByRole('button').allTextContents()})
  await report({passed:true,pages:summaries,world:await world().catch(()=>null),metrics:await metrics().catch(()=>null)});await capture('inspect');console.log('Read-only native inspection saved');process.exit(0)
 }
 const welcome=pages.find(p=>p.url().includes('welcome.html'))
 if(welcome){await welcome.getByRole('button',{name:'Add API Key',exact:true}).click();await welcome.getByRole('button',{name:'Set up later',exact:true}).click();checks.push('Dismissed official welcome using Set up later, no credentials')}
 artifact=(await json(join(root,'dist/manifest.json'))).find(p=>p.name==='@nidofy/dsh-ai-village')
 assert.equal(artifact.version,'0.9.0-preview.1');assert.equal(hash(await readFile(join(root,'dist',artifact.file))),artifact.sha256)
 const expectedSha=process.env.AI_VILLAGE_EXPECTED_SHA;assert.match(expectedSha??'',/^[a-f0-9]{64}$/);assert.equal(artifact.sha256,expectedSha)
 if(mode==='install'){
  const close=page.getByRole('button',{name:'Close',exact:true});if(await close.isVisible())await close.click()
  await direct('Plugins');const back=page.getByRole('button',{name:'Back to plugins',exact:true});if(await back.isVisible())await back.click()
  await direct('Add plugin');await page.getByRole('textbox',{name:'Package name or address'}).fill(join(root,'dist',artifact.file));await direct('Install')
  await page.getByRole('button',{name:'Enable now',exact:true}).waitFor({timeout:90000});await direct('Enable now')
  checks.push('Fresh official plugin manager installation of pinned local final tarball');await capture('installed');await report({passed:true,artifact,restartRequired:true});console.log('Official 0.9 install passed; stop before any authorized test-save import');process.exit(0)
 }
 const installed=join(work,'home/profiles/desktop/node_modules/@nidofy/dsh-ai-village')
 assert.equal((await json(join(installed,'package.json'))).version,artifact.version)
 for(const file of ['lib/index.js','lib/client.js','lib/frame.js','assets/scenes/courtyard/scene.json'])assert.deepEqual(await readFile(join(installed,file)),await readFile(join(root,'packages/ai-village',file)))
 checks.push('Installed bundle bytes match the pinned current build')
 if(!await page.locator('.village-card').count()){await page.getByRole('button',{name:'New session',exact:true}).first().click();await direct('Open AI Village')}
 const readyFrame=async target=>{await page.locator('.village-canvas iframe').waitFor({timeout:60000});await until(async()=>{const m=await metrics();return m?.frames>0&&m.region===target},'Actual new region frame must paint: '+target,60)}
 await readyFrame((await world())?.region?.active??'courtyard')
 const closePanel=async()=>{const close=page.getByRole('button',{name:'Close panel',exact:true});if(await close.isVisible()){await close.click();await page.waitForTimeout(300)}}
 const tab=async name=>{await closePanel();await page.getByRole('tab',{name,exact:true}).click()}
 const hud=async name=>{const b=page.getByRole('button',{name,exact:true});if(!await b.isVisible())await page.locator('.village-card').getByRole('button',{name:'More',exact:true}).click();await b.click()}
 const pause=async()=>{if(!(await world()).userPaused){await hud('Pause');await until(async()=>(await world())?.userPaused,'User pause must commit')}}
 const photoBytes=async photo=>{const bytes=Buffer.from(await page.evaluate(async id=>{const r=await fetch('/api/nidofy-ai-village/photos/'+id);if(!r.ok)throw Error('Photo read failed');return [...new Uint8Array(await r.arrayBuffer())]},photo.id));assert.equal(hash(bytes),photo.hash);return bytes}
 const regions=async()=>{await tab('Residents');await page.getByRole('region',{name:'AI Bookhouse · Development preview',exact:true}).waitFor()}
 const travel=async(target)=>{
  if(target==='bookhouse'){await tab('Decor');await direct('Furniture');await direct('Go to AI Bookhouse')}
  else{await regions();await direct('Return to courtyard')}
  await until(async()=>(await world())?.region?.active===target,'Region change must persist',60);await readyFrame(target);await closePanel()
 }
 if(mode==='restored'){
  const expected=await json(join(work,'expected-v09.json'));assert.equal(expected.artifact.sha256,artifact.sha256)
  assert.deepEqual(await world(),expected.world);assert.deepEqual(await album(),expected.album)
  for(const photo of expected.album?.world.photos??[])await photoBytes(photo)
  assert.equal(expected.world.region.active,'bookhouse');observations.push({coldMetrics:await metrics()});await capture('bookhouse-cold-restored')
  await tab('Journal');await direct('Album');await page.getByRole('img',{name:'Native 0.9 bookhouse',exact:true}).waitFor();await direct('Memories')
  assert.deepEqual(facts(await world()),expected.facts);checks.push('Cold startup restored exact bookhouse world, shared facts, album and photo hashes')
  const before=await world();await travel('courtyard');const returned=await world()
  assert.deepEqual(poses(returned),expected.courtyardPoses);assert.deepEqual(facts(returned),expected.facts)
  assert.equal(returned.rng,before.rng);assert.equal(returned.ticks,before.ticks);assert.equal(returned.userPaused,true)
  checks.push('Real return UI restored original courtyard feet/facing and shared facts without advancing paused clock or RNG');await capture('returned-courtyard')
  assert.deepEqual(errors,[]);await report({passed:true,artifact,world:returned,album:await album(),metrics:await metrics()});console.log('Native bookhouse cold restore and courtyard return passed');process.exit(0)
 }
 assert.equal(mode,'check');await pause();await closePanel()
 const courtyard=await world();assert.equal(courtyard.region?.active??'courtyard','courtyard')
 const courtyardPoses=poses(courtyard),sharedFacts=facts(courtyard),oldAlbum=await album()
 const imported=await json(join(work,'expected-v08.json'))
 assert.deepEqual(courtyardPoses,poses(imported.world));assert.deepEqual(sharedFacts,facts(imported.world));assert.deepEqual(oldAlbum,imported.album)
 assert.equal(courtyard.ticks,imported.world.ticks);assert.equal(courtyard.rng,imported.world.rng);assert.equal(courtyard.userPaused,true)
 checks.push('Imported stopped schema9 checkpoint preserves exact initial poses, progress, album, clock and RNG before first travel write')
 await travel('bookhouse');const entered=await world();assert.equal(entered.schemaVersion,10)
 assert.deepEqual(entered.region.returns.courtyard.toSorted((a,b)=>a.id.localeCompare(b.id)),courtyardPoses)
 assert.deepEqual(facts(entered),sharedFacts);assert.equal(entered.rng,courtyard.rng);assert.equal(entered.ticks,courtyard.ticks)
 checks.push('Explicit travel committed schema10 and preserved paused courtyard poses, progress, clock and RNG');await capture('bookhouse-entered')
 for(const [id,activity,label] of [['bookcase','read','Read at the bookcase'],['reading-desk','work','Write at the reading desk'],['window-seat','sit','Sit by the window']]){
  await closePanel();await hud('Resume');await until(async()=>!(await world()).userPaused,'Resume must persist');await regions()
  const beforeActivity=await world();await direct(label)
  await until(async()=>{const w=await world();return w.actor.intent?.furnitureId===id&&w.actor.intent.expires!==beforeActivity.actor.intent?.expires},'Explicit furniture command must save: '+id)
  await closePanel()
  await until(async()=>{const w=await world();return w.actor.behavior===activity&&w.actor.intent?.furnitureId===id&&w.actor.intent.stage==='use'},'Actual activity arrival: '+id,180)
  await pause();const arrived=await world();assert.equal(arrived.actor.behavior,activity);assert.deepEqual(facts(arrived),sharedFacts)
  observations.push({activity:id,ticks:arrived.ticks,actor:arrived.actor,metrics:await metrics()});await closePanel();await capture('activity-'+id)
 }
 await tab('Journal');await direct('Memories');await page.getByRole('region',{name:'Collection categories',exact:true}).waitFor();assert.deepEqual(facts(await world()),sharedFacts)
 await closePanel();const photoWorld=await world();await hud('Photo mode');await direct('Take photo');await page.getByRole('img',{name:'Photo preview',exact:true}).waitFor({timeout:30000})
 const count=oldAlbum?.world.photos.length??0;await page.getByLabel('Photo title',{exact:true}).fill('Native 0.9 bookhouse');await direct('Save to album');await until(async()=>((await album())?.world.photos.length??0)===count+1,'Bookhouse photo must commit');await direct('Exit photo mode')
 assert.deepEqual(await world(),photoWorld);const photos=await album(),photo=photos.world.photos.at(-1),bytes=await photoBytes(photo);assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960);await writeFile(join(evidence,'native-bookhouse-photo.png'),bytes)
 const saved=await world();await writeFile(join(work,'expected-v09.json'),JSON.stringify({artifact,world:saved,album:photos,courtyardPoses,facts:sharedFacts},null,2)+'\n')
 const sourceSave=join(root,'.build/ai-village-v08-desktop/home/profiles/desktop/nidofy-ai-village'),targetSave=join(work,'home/profiles/desktop/nidofy-ai-village')
 const oldPointerBytes=await readFile(join(sourceSave,'current.json')),oldPointer=JSON.parse(oldPointerBytes)
 assert.match(oldPointer.snapshot,/^managed-v1-[a-f0-9-]{36}\.json$/)
 assert.deepEqual(await readFile(join(targetSave,'upgrade-v1-'+hash(oldPointerBytes)+'.json')),oldPointerBytes)
 assert.deepEqual(await readFile(join(targetSave,'snapshots',oldPointer.snapshot)),await readFile(join(sourceSave,'snapshots',oldPointer.snapshot)))
 checks.push('Schema9 pre-upgrade current pointer and original snapshot bytes remain protected after normal 0.9 saves')
 checks.push('All three furniture activities reached actual seats; shared journal unchanged; genuine 720x960 bookhouse photo saved')
 assert.deepEqual(errors,[]);await report({passed:true,artifact,world:saved,album:photos,metrics:await metrics()});console.log('Native bookhouse activities/photo passed; complete process restart required');process.exit(0)
}catch(error){await capture('failure');await report({passed:false,artifact,failure:{message:error.message,stack:error.stack},world:await world().catch(()=>null),buttons:await buttons().catch(()=>[]),metrics:await metrics().catch(()=>null)});console.error(error.message);process.exit(1)}

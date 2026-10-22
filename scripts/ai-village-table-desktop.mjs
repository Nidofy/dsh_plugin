/** Real official Desktop only. No fixture, world mutation, profile copying, or host changes. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),work=join(root,'.build/ai-village-table-desktop'),mode=process.argv[2]??'inspect'
const label=process.argv[3]??`${mode}-${Date.now()}`
assert.match(label,/^[a-z0-9][a-z0-9-]{0,80}$/)
const evidence=join(root,'docs/ai-village/table-preview/native',label)
await mkdir(join(root,'docs/ai-village/table-preview/native'),{recursive:true});await mkdir(evidence)
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex')
const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
assert.ok(pw,'Existing Playwright required; no SDK installation')
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const browser=await chromium.connectOverCDP('http://127.0.0.1:18765')
const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.find(p=>p.url().startsWith('dsh-app:'))
assert.ok(page,'Dedicated official Desktop app page required');page.setDefaultTimeout(25000)
const errors=[],screenshotIssues=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const capture=async name=>{const cdp=await page.context().newCDPSession(page);try{
  const shot=await Promise.race([cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true}),new Promise((_,reject)=>setTimeout(()=>reject(Error('SCREENSHOT_TIMEOUT')),8000))])
  await writeFile(join(evidence,name+'.png'),Buffer.from(shot.data,'base64'))
}catch(error){screenshotIssues.push({name,error:error.message})}finally{await cdp.detach()}}
const buttons=()=>page.getByRole('button').evaluateAll(els=>els.map(el=>({name:el.getAttribute('aria-label')||el.textContent,disabled:el.disabled})))
const report=async extra=>writeFile(join(evidence,'result.json'),JSON.stringify({mode,officialCarrier:'0.2.1-rc.2',profile:'.build/ai-village-table-desktop',cdp:18765,checks,errors,screenshotIssues,...extra},null,2)+'\n')
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
 assert.equal(artifact.version,'0.7.0-preview.2');assert.equal(hash(await readFile(join(root,'dist',artifact.file))),artifact.sha256)
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
 const checkpoint=async()=>{await pause();await closePanel();const saved=await world(),photos=await album();assert.equal(saved.schemaVersion,8);assert.equal(saved.play.tableMode,'game');await writeFile(join(work,'expected-table.json'),JSON.stringify({artifact,world:saved,album:photos},null,2));return{saved,photos}}
 const savePhoto=async()=>{
  await pause();const photoWorld=await world()
  if(!await page.getByRole('button',{name:'Take photo',exact:true}).isVisible())await hud('Photo mode')
  if(!await page.getByRole('img',{name:'Photo preview',exact:true}).isVisible()){await direct('Take photo');await page.getByRole('img',{name:'Photo preview',exact:true}).waitFor({timeout:30000})}
  const before=(await album())?.world.photos.length??0;await page.getByLabel('Photo title',{exact:true}).fill('Native table preview 2');await direct('Save to album')
  await until(async()=>((await album())?.world.photos.length??0)===before+1,'Actual captured photo must be saved');await direct('Exit photo mode')
  assert.deepEqual(await world(),photoWorld)
  const photo=(await album()).world.photos.at(-1),png=await photoBytes(photo);assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),960);await writeFile(join(evidence,'native-board-postcard.png'),png)
  checks.push('Real renderer PNG 720x960 saved through album UI; exact hash and unchanged paused world')
 }
 if(mode==='photo-finish'){
  assert.equal((await world()).play.active.choices.length,2);checks.push('Continued real two-piece paused board and existing photo preview after initial empty album returned null')
  await savePhoto();const {saved,photos}=await checkpoint();await capture('paused-board');await report({passed:true,artifact,world:saved,photos:photos.world.photos});console.log('Native photo/checkpoint passed; full process restart required');process.exit(0)
 }
 if(mode==='restored'||mode==='final-restored'){
  const expected=await json(join(work,'expected-table.json'));assert.equal(expected.artifact.sha256,artifact.sha256)
  assert.deepEqual(await world(),expected.world);assert.deepEqual(await album(),expected.album)
  for(const p of expected.album.world.photos)await photoBytes(p)
  checks.push('Full actual Desktop process restart preserved exact schema8 paused world, table board/history, album index and every PNG hash')
  await capture('cold-restored')
  if(mode==='final-restored'){await report({passed:true,artifact,world:expected.world,photos:expected.album.world.photos});console.log('Final completed-game cold restore passed');process.exit(0)}
  assert.equal(expected.world.play.active.definitionId,'table-game');assert.equal(expected.world.play.active.choices.length,2)
  await hud('Resume');await until(async()=>(await world())?.userPaused===false,'Resume must persist');await games()
  for(let turn=0;turn<5;turn++){
   const active=(await world()).play.active
   if(active.stage===1)break
   const empty=active.board.indexOf(-1);assert.ok(empty>=0)
   const name=`Row ${Math.floor(empty/3)+1}, column ${empty%3+1} · empty`,button=page.getByRole('button',{name,exact:true})
   await until(()=>button.isEnabled(),'Wait for actual ready board',120);await button.click()
   await until(async()=>{const a=(await world()).play.active;return a.choices.length>active.choices.length},'Player and resident round must save')
  }
  const finish=page.getByRole('button',{name:'Remember this game',exact:true});await until(()=>finish.isEnabled(),'Final story stage must become ready',120);await finish.click()
  await until(async()=>!(await world()).play.active,'Game completion must save');const completed=await world()
  assert.equal(completed.neighborhood.memories.find(m=>m.id==='table-game').count,1);assert.ok(Object.hasOwn(completed.play.decorations,'table-stones'))
  checks.push('Restored real game resumed through legal UI moves and completed with exactly one first memory')
  const {saved,photos}=await checkpoint();await capture('completed');await report({passed:true,artifact,world:saved,photos:photos.world.photos});console.log('Cold restore, legal continuation and first completion passed');process.exit(0)
 }
 assert.ok(mode==='check'||mode==='check-continue')
 assert.equal((await world()).schemaVersion,8)
 await pause()
 if(mode==='check'){
  assert.equal((await world()).play.tableMode,'dining','check requires the actual initial dining state; never reset a world for acceptance')
  await tab('Decor');await direct('Furniture');await direct('Game surface')
  assert.equal((await world()).play.tableMode,'dining');await direct('Cancel change');assert.equal((await world()).play.tableMode,'dining')
  await direct('Game surface');await direct('Confirm table use');await until(async()=>(await world()).play.tableMode==='game','Confirmed game surface must save')
  checks.push('Real furniture drawer draft/cancel and explicit game-surface confirmation')
 }else{assert.equal((await world()).play.tableMode,'game');checks.push('Continued actual persisted game surface after prior navigation attempt; did not reset world')}
 if(!(await world()).companions.some(a=>a.id==='claude')){await closePanel();await tab('Residents');const all=page.getByRole('button',{name:'All residents',exact:true});if(await all.isVisible())await all.click();await direct('Manage residents');await page.getByLabel('Resident Claude',{exact:true}).click()}
 await until(async()=>(await world()).companions.some(a=>a.id==='claude'),'Real admission must save');await closePanel();await hud('Resume')
 await games();if(!(await world()).play.active)await direct('Begin · Three in a row at the table (development preview)')
 else {assert.equal((await world()).play.active.definitionId,'table-game');assert.equal((await world()).play.active.choices.length,0);checks.push('Continued the already-created real table game after earlier arrival timeout')}
 const first=page.getByRole('button',{name:'Row 1, column 1 · empty',exact:true});await until(()=>first.isEnabled(),'Both actors must arrive and observe through actual simulation',120)
 await pause();const arrived=await world(),active=arrived.play.active
 assert.equal(active.definitionId,'table-game');assert.equal(active.phase,'ready')
 for(let i=0;i<2;i++)assert.deepEqual([arrived.actor,...arrived.companions].find(a=>a.id===active.participants[i]).position,active.targets[i])
 checks.push('Both residents reached actual reserved table seats before input')
 await closePanel();await capture('residents-arrived');await hud('Resume');await until(async()=>!(await world()).userPaused,'Resume before canvas input')
 const metrics=await frame.evaluate(()=>window.__sceneMetrics()),box=await page.locator('.village-canvas iframe').boundingBox(),center=metrics.tableGame.cells[0].center,view=metrics.viewport.world
 const point={x:box.x+view.x+center.x*view.scale,y:box.y+view.y+center.y*view.scale}
 const hit=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return{tag:e?.tagName,class:e?.className}},point);assert.equal(hit.tag,'IFRAME','Actual pointer must reach scene iframe')
 await page.mouse.click(point.x,point.y)
 await until(async()=>(await world()).play.active.choices.length===2,'Real canvas click must commit player and resident round')
 const moved=(await world()).play.active;assert.equal(moved.board[0],0);assert.equal(moved.board.filter(v=>v===1).length,1)
 checks.push('Physical canvas click at production-projected cell committed one player + resident round')
 await savePhoto()
 const {saved,photos}=await checkpoint();await capture('paused-board');await report({passed:true,artifact,canvasClick:{center,view,box,point},metrics,world:saved,photos:photos.world.photos});console.log('Native canvas move/photo/checkpoint passed; full process restart required');process.exit(0)
}catch(error){await capture('failure');await report({passed:false,artifact,failure:{message:error.message,stack:error.stack},world:await world().catch(()=>null),buttons:await buttons().catch(()=>[])});console.error(error.message);process.exit(1)}

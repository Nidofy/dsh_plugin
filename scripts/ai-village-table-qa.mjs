/** M5 table development preview: real component/canvas input, independent authenticated profile and append-only evidence. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'

const root=resolve(import.meta.dirname,'..'),label=process.argv[2]
const resumeLabel=process.argv.find(v=>v.startsWith('--resume='))?.slice('--resume='.length)
if(resumeLabel)assert.ok(/^[a-z0-9][a-z0-9-]{0,64}$/.test(resumeLabel)&&resumeLabel!==label)
assert.ok(label&&/^[a-z0-9][a-z0-9-]{0,64}$/.test(label),'Usage: node scripts/ai-village-table-qa.mjs <new-label> [--lifecycle]')
const pkg=join(root,'packages/ai-village'),evidence=join(root,'docs/ai-village/table-preview/qa',label),generated=join(root,'.build/ai-village-table-qa',label),out=join(generated,'preview')
await mkdir(join(root,'docs/ai-village/table-preview/qa'),{recursive:true});await mkdir(evidence);await mkdir(out,{recursive:true})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'))
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim()
const build={head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),dirty:git('status','--short'),version:(await json(join(pkg,'package.json'))).version,sourceHash:{},bundles:{}}
for(const f of (await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)).sort())build.sourceHash[f.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',f)))
for(const f of ['index.js','client.js','frame.js'])build.bundles[f]=hash(await readFile(join(pkg,'lib',f)))
if(resumeLabel){const previous=await json(join(root,'docs/ai-village/table-preview/qa',resumeLabel,'build.json'));assert.deepEqual(build.bundles,previous.bundles);assert.deepEqual(build.sourceHash,previous.sourceHash);build.resumedFrom=resumeLabel}
await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true})
await runPreview({root,pkg,out,buildOnly:true});build.fixtureSha256=hash(await readFile(join(out,'fixture.js')))
await writeFile(join(evidence,'build.json'),JSON.stringify(build,null,2)+'\n')
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js')))
const {source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
assert.ok(pw,'Use the existing Playwright; never install or download dependencies from this test')
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const executablePath=join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe');assert.ok(await stat(executablePath))
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']})
const profile=join(generated,'profile');await mkdir(profile)
if(resumeLabel)await cp(join(root,'.build/ai-village-table-qa',resumeLabel,'profile'),profile,{recursive:true})
const h=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:join(evidence,'video'),size:{width:960,height:640}}})
const errors=[],external=[],checks=[],captures=[],moves=[],lifecycle=[],anchors=[],recovery=[],canvasClicks=[],performanceSamples=[],photos=[],saveSummaries=[]
let loseAck=false,stateOffline=false,savePosts=0,stateReads=0
await context.route('**/*',async route=>{
  const url=route.request().url()
  if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:')){external.push(new URL(url).origin);return route.abort()}
  if(url.endsWith('/api/nidofy-ai-village/state')){stateReads++;if(stateOffline)return route.abort('failed')}
  if(url.endsWith('/api/nidofy-ai-village/save')){savePosts++;const w=route.request().postDataJSON()?.world;saveSummaries.push({sequence:savePosts,ticks:w?.ticks,paused:w?.userPaused,active:w?.play?.active?{stage:w.play.active.stage,phase:w.play.active.phase,choices:w.play.active.choices,board:w.play.active.board}:null});if(loseAck){loseAck=false;await route.fetch();return route.abort('failed')}}
  return route.continue()
})
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),frame=()=>page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'))
const simulation=w=>{const {actor,companions,...rest}=w;return{...rest,members:[actor,...companions].sort((a,b)=>a.id.localeCompare(b.id))}}
const entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error})
const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'})
const {click}=villageUI(page),direct=name=>page.getByRole('button',{name,exact:true}).click()
const tab=async name=>{const el=page.getByRole('tab',{name,exact:true});if((await inspect()).presentation.drawer==='closed'||await el.getAttribute('aria-selected')!=='true')await el.click()}
const closePanel=async()=>{const el=page.getByRole('button',{name:'关闭面板',exact:true});if(await el.isVisible())await el.click()}
const log=name=>{checks.push(name);console.log('PASS '+name)}
const screenshot=async name=>{
  await page.waitForTimeout(220)
  await page.locator('.village-card').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})))})
  const opacity=await page.locator('.village-surface,.village-panel').evaluateAll(els=>els.map(el=>Number(getComputedStyle(el).opacity)))
  assert.ok(opacity.every(n=>n===1),'Capture only after finite panel animations finish')
  await page.screenshot({path:join(evidence,name+'.png')})
  const s=await inspect();captures.push({name,opacity,box:await page.locator('.village-card').boundingBox(),theme:s.preferences.theme,language:s.preferences.language,route:s.presentation,world:s.world?.schemaVersion,tableMode:s.world?.play.tableMode,active:s.world?.play.active?{id:s.world.play.active.definitionId,stage:s.world.play.active.stage,phase:s.world.play.active.phase,board:s.world.play.active.board,choices:s.world.play.active.choices}:null})
}
const resize=async(width,height)=>{let vh=height+236;for(let i=0;i<6;i++){await page.setViewportSize({width:width+224,height:vh});await page.waitForTimeout(180);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1){await entered();return}vh+=Math.round(height-box.height)}throw Error('Cannot obtain actual card '+width+'x'+height)}
const gameplay=()=>page.getByRole('article',{name:'正在进行的故事',exact:true})
const gamesPage=async()=>{if((await inspect()).presentation.overlay)await closePanel();await tab('心愿');if((await inspect()).presentation.page==='quick')await page.getByRole('button',{name:'一起活动',exact:true}).first().click()}
const ready=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.world.play.active?.definitionId==='table-game'&&s.world.play.active.phase==='ready'&&!s.reasons.includes('commit-pending')},null,{timeout:120000})
// Exact labels and metric shape are pinned to the implemented table UI before the first execution.
const ui={enable:'棋局桌面',start:'开始 · 餐桌上的三连棋（开发预览）',finish:'记下这一局',replay:'再体验一次 · 餐桌上的三连棋（开发预览）'}
const enableTable=async()=>{
  await tab('布置');await direct('家具');await direct(ui.enable)
  assert.equal((await inspect()).world.play.tableMode,'dining','Choosing a mode is only a draft')
  await direct('取消更改');assert.equal((await inspect()).world.play.tableMode,'dining')
  await direct(ui.enable);await direct('确认桌面用途');await settled();assert.equal((await inspect()).world.play.tableMode,'game')
}
const alternateTable=async()=>{
  await click('暂停');await settled();await closePanel()
  const before=await frame().evaluate(()=>window.__sceneMetrics())
  await tab('布置');await direct('家具');await direct('开始布置')
  await page.getByLabel('选中家具',{exact:true}).selectOption('eat');await direct('餐桌 · 替代锚点')
  assert.equal((await inspect()).homeDraft?.home.positions.eat,1,'Alternate table must be accepted through the normal layout draft')
  await direct('保存布置');await settled();assert.equal((await inspect()).world.home.positions.eat,1)
  const after=await frame().evaluate(()=>window.__sceneMetrics());anchors.push({before:before.tableGame,after:after.tableGame,beforeSeats:before.geometry,afterSeats:after.geometry})
  assert.equal(after.tableGame.rect.x,before.tableGame.rect.x-54);assert.equal(after.tableGame.rect.y,before.tableGame.rect.y)
  assert.equal(after.textures,before.textures)
  for(let i=0;i<9;i++){assert.equal(after.tableGame.cells[i].center.x,before.tableGame.cells[i].center.x-54);assert.equal(after.tableGame.cells[i].center.y,before.tableGame.cells[i].center.y)}
  await screenshot('table-alternate-anchor');await click('继续');await settled()
  log('normal layout confirmation moves board and all nine hit centers with alternate table; textures unchanged')
}
const begin=async()=>{
  await gamesPage();await page.waitForFunction(()=>{const w=window.__villageHostFixture.inspect().world;return w.ticks>=w.play.nextTick})
  await direct((await inspect()).world.neighborhood.memories.some(m=>m.id==='table-game')?ui.replay:ui.start);await settled()
  assert.equal((await inspect()).world.play.active?.definitionId,'table-game',(await inspect()).actionError)
  if((await inspect()).world.userPaused){await closePanel();await click('继续');await settled()}
  await ready();const s=await inspect(),e=s.world.play.active;assert.equal(e.participants.length,2)
  const members=[s.world.actor,...s.world.companions]
  for(let i=0;i<2;i++){const a=members.find(a=>a.id===e.participants[i]);assert.ok(a);assert.deepEqual(a.position,e.targets[i],'Both residents actually reach their table targets')}
}
const cellClick=async cell=>{
  await closePanel()
  await page.waitForTimeout(240)
  const m=await frame().evaluate(()=>window.__sceneMetrics()),target=m.tableGame?.cells?.[cell]?.center,box=await page.locator('.village-canvas iframe').boundingBox(),p=m.viewport.world
  assert.ok(target&&Number.isFinite(target.x)&&Number.isFinite(target.y),'Production renderer must expose nine actual cell centers')
  const point={x:box.x+p.x+target.x*p.scale,y:box.y+p.y+target.y*p.scale}
  canvasClicks.push({cell,target,projection:p,box,point,element:await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return{tag:e?.tagName,class:e?.className}},point)})
  await page.mouse.click(point.x,point.y)
}
const photo=async name=>{
  const paused=(await inspect()).world.userPaused;if(!paused){await click('暂停');await settled()}
  const world=(await inspect()).world
  await click('拍照');await direct('拍摄照片');await page.getByRole('img',{name:'照片预览',exact:true}).waitFor()
  const download=page.waitForEvent('download');await direct('导出 PNG');await(await download).saveAs(join(evidence,name+'.png'))
  const bytes=await readFile(join(evidence,name+'.png'));assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960)
  photos.push({file:name+'.png',sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length})
  const photoCount=(await inspect()).album?.world.photos.length??0
  await page.getByLabel('照片标题',{exact:true}).fill(name);await direct('保存到相册');await page.waitForFunction(n=>window.__villageHostFixture.inspect().album?.world.photos.length>n,photoCount)
  assert.deepEqual((await inspect()).world,world);await direct('退出拍照');assert.equal((await inspect()).world.userPaused,true)
  if(!paused){await click('继续');await settled()}
  log('actual board photo PNG720x960, album and preserved world/pause')
}
const missingMoveAck=async()=>{
  // Same committed-save/lost-response and bounded read-recovery fault as ui-v11-recovery.
  await closePanel();const before=(await inspect()).world.play.active,count=savePosts,reads=stateReads
  stateOffline=true;loseAck=true;await cellClick(0)
  await page.waitForFunction(()=>window.__villageHostFixture.inspect().saveReceipt.status==='unknown')
  const held=(await inspect()).world;assert.deepEqual(held.play.active.board,before.board);await screenshot('table-move-unknown')
  await page.waitForTimeout(8200);assert.equal(savePosts,count+1);assert.deepEqual((await inspect()).world,held)
  recovery.push({phase:'unknown',savePosts:savePosts-count,stateReads:stateReads-reads,expected:'one immediate reconciliation + three delayed read-only checks'})
  assert.equal(stateReads-reads,4,'One immediate reconciliation plus three bounded delayed read checks')
  await page.waitForTimeout(1500);assert.equal(stateReads-reads,4);assert.equal(savePosts,count+1)
  stateOffline=false;await click('重新连接')
  await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.error&&s.saveReceipt.status==='committed'&&s.world.play.active.choices.length===2})
  assert.equal(savePosts,count+1);const after=(await inspect()).world.play.active
  assert.equal(after.board[0],0);assert.equal(after.board.filter(n=>n===1).length,1)
  recovery.push({savePosts:savePosts-count,stateReads:stateReads-reads,before:before.board,after:after.board,choices:after.choices})
  await screenshot('table-move-reconciled');log('lost move ACK: one committed player+resident round, bounded read-only checks, explicit reconciliation without replay')
}
const lifecycle50=async()=>{
  if(!(await inspect()).world.userPaused){await click('暂停');await settled()}
  await closePanel();await page.evaluate(()=>window.__villageHostFixture.flush());await settled()
  const saved=(await inspect()).world,resources=(await inspect()).resourceKeys.length,cdp=await context.newCDPSession(page)
  for(let i=1;i<=50;i++){
    await click('关闭小院');await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'))
    assert.deepEqual((await inspect()).world,saved)
    await direct('打开 AI 小院');await entered();assert.equal(await page.locator('.village-canvas iframe').count(),1);assert.deepEqual((await inspect()).world,saved)
    assert.equal((await frame().evaluate(()=>window.__sceneMetrics())).textures,resources)
    if(i%10===0){await page.mouse.move(1,1);await page.waitForTimeout(350);await cdp.send('HeapProfiler.collectGarbage');lifecycle.push({cycle:i,...await cdp.send('Memory.getDOMCounters')});console.log('LIFECYCLE '+i+'/50')}
  }
  assert.ok(lifecycle.every(x=>x.jsEventListeners===lifecycle[0].jsEventListeners),'Warm lifecycle listener counts keep growing')
  await click('关闭小院');await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await cdp.send('HeapProfiler.collectGarbage')
  lifecycle.push({closed:true,...await cdp.send('Memory.getDOMCounters')});await cdp.detach()
  log('50 true close/reopen cycles: stable warm listeners, retained world, one frame, final frame released')
  await direct('打开 AI 小院');await entered()
}
const sample=async scenario=>{
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await page.waitForTimeout(2000)
  const f=frame(),before=f?await f.evaluate(()=>window.__sceneMetrics()):null,beforeWorld=(await inspect()).world,first=(await cdp.send('Performance.getMetrics')).metrics,start=performance.now()
  await page.waitForTimeout(20000);const seconds=(performance.now()-start)/1000,after=f?await f.evaluate(()=>window.__sceneMetrics()):null,last=(await cdp.send('Performance.getMetrics')).metrics,metric=(list,name)=>list.find(m=>m.name===name)?.value??null
  const afterWorld=(await inspect()).world,summary=w=>({ticks:w.ticks,active:w.play.active?.definitionId??null,members:[w.actor,...w.companions].map(a=>({id:a.id,position:a.position,behavior:a.behavior}))})
  const row={scenario,seconds,fps:after?(after.frames-before.frames)/seconds:0,p50PaintMs:after?.p50PaintMs??null,p95PaintMs:after?.p95PaintMs??null,textures:after?.textures??0,paintSampleCount:after?.paintSampleCount??0,parentTaskPercentOfOneCore:100*(metric(last,'TaskDuration')-metric(first,'TaskDuration'))/seconds,parentHeapUsedBytes:metric(last,'JSHeapUsedSize'),tableVisibleBefore:!!before?.tableGame,tableVisibleAfter:!!after?.tableGame,worldBefore:summary(beforeWorld),worldAfter:summary(afterWorld),...await cdp.send('Memory.getDOMCounters')}
  performanceSamples.push(row);await writeFile(join(evidence,'performance.json'),JSON.stringify({backend:'Chromium headless / SwiftShader',samples:performanceSamples,limitations:'20s software samples; JS submission p95 is not GPU completion; parent CDP CPU/heap is not process-wide or uncontended hardware comparison.'},null,2)+'\n');console.log('MEASURED '+JSON.stringify(row))
  if(after){assert.ok(row.fps>=20&&row.fps<=35,JSON.stringify(row));assert.ok(row.paintSampleCount<=600);assert.equal(row.textures,128);if(!process.argv.includes('--life-perf'))assert.ok(after.tableGame)}else{assert.deepEqual((await inspect()).world,beforeWorld);assert.equal(await page.locator('.village-canvas iframe').count(),0)}
  await cdp.detach()
}

let failure
try{
  await page.goto(h.entry);await page.getByRole('textbox',{name:'消息输入'}).fill('M5 隔离测试草稿，不发送。');await direct('打开 AI 小院');await entered()
  if(!resumeLabel){
  assert.equal((await inspect()).world.schemaVersion,8);assert.equal((await inspect()).world.play.tableMode,'dining')
  await click('暂停');await settled();const originalGeometry=(await frame().evaluate(()=>window.__sceneMetrics())).geometry,originalResources=(await inspect()).resourceKeys
  await enableTable();await closePanel();await screenshot('table-enabled')
  assert.deepEqual((await frame().evaluate(()=>window.__sceneMetrics())).geometry,originalGeometry);assert.deepEqual((await inspect()).resourceKeys,originalResources)
  log('real decor UI enables development table with unchanged seats/geometry/textures')
  if(process.argv.includes('--perf-only')){
    await tab('居民');await direct('全部居民');await direct('安排入住');await direct('全员入住');await settled();assert.equal((await inspect()).world.companions.length,6);await closePanel();await begin();await closePanel()
    await screenshot('table-seven-visible');await sample('table-seven-visible')
    await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await sample('table-seven-hidden')
    await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered();await screenshot('table-seven-restored');log('seven-resident board visible and hidden 20s software performance, 20–35FPS/600 samples/128 textures and zero hidden frames')
  }else if(process.argv.includes('--surface-only')){
    await click('请一位朋友入住');await settled();await closePanel();await gamesPage();await direct('热茶');await direct('邀请同桌');await settled()
    assert.equal((await inspect()).world.activeEvent?.food,'tea');await closePanel()
    await frame().waitForFunction(()=>window.__sceneMetrics().tableGame===null);await screenshot('tea-reserved-board-hidden')
    await click('继续');await settled();await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.activeEvent?.phase==='talking',null,{timeout:90000})
    await click('暂停');await settled();assert.equal((await inspect()).world.activeEvent?.phase,'talking');assert.equal((await frame().evaluate(()=>window.__sceneMetrics())).tableGame,null)
    await screenshot('tea-cups-board-hidden');await photo('tea-without-board')
    await click('继续');await settled();await page.waitForFunction(()=>!window.__villageHostFixture.inspect().world.activeEvent,null,{timeout:30000})
    await frame().waitForFunction(()=>!!window.__sceneMetrics().tableGame);await screenshot('tea-finished-board-restored')
    assert.equal((await inspect()).world.play.tableMode,'game');log('normal tea invitation hides board during reserved/talking phases; tea cups visible; board returns after tea without changing mode')
    await begin();await cellClick(0);await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.play.active.choices.length===2);await settled()
    assert.deepEqual((await inspect()).world.play.active.choices,['0','4']);await photo('table-after-tea');await screenshot('table-after-tea-canvas-move')
    await gamesPage();await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).click();await settled();log('same new renderer retains actual canvas player/resident response and 720x960 photo after tea')
  }else{
  await click('请一位朋友入住');await closePanel();await click('继续');await begin();await screenshot('table-arrived')
  const initial=(await inspect()).world.play.active;assert.equal(initial.board.length,9);assert.equal(initial.choices.length,0)
  const beforePosts=savePosts;await cellClick(0);await settled();await page.waitForFunction(()=>window.__villageHostFixture.inspect().world.play.active.choices.length>0)
  const after=(await inspect()).world.play.active
  moves.push({cell:0,before:initial.board,after:after.board,choices:after.choices,savePosts:savePosts-beforePosts})
  assert.equal(savePosts-beforePosts,1,'One confirmed player move and resident reply must share one save')
  await ready();await page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.world.ticks%300>=30&&s.world.ticks%300<=180&&!s.reasons.includes('commit-pending')});await settled()
  const occupiedBoard=after.board,occupiedChoices=after.choices,posts=savePosts;await cellClick(0);await page.waitForFunction(()=>window.__villageHostFixture.inspect().actionError==='INVALID_TABLE_MOVE')
  assert.deepEqual((await inspect()).world.play.active.board,occupiedBoard);assert.deepEqual((await inspect()).world.play.active.choices,occupiedChoices);assert.equal(savePosts,posts)
  log('canvas move with deterministic resident response is atomic; repeat occupied cell does not write')
  }
  }
  if(process.argv.includes('--life-perf')){
    assert.ok(resumeLabel,'Life performance uses a new copy of the stopped seven-resident test profile')
    if((await inspect()).world.play.active){await gamesPage();await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).click();await settled()}
    await closePanel();if((await inspect()).world.userPaused){await click('继续');await settled()}
    assert.equal((await inspect()).world.companions.length,6);assert.equal((await inspect()).world.play.active,null)
    await screenshot('seven-natural-visible');await sample('seven-natural-visible')
    await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await sample('seven-natural-hidden')
    await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered();await screenshot('seven-natural-restored');log('seven natural residents after normal game cancellation; board may temporarily hide during meals; original performance limits retained')
  }
  if(!process.argv.includes('--perf-only')&&!process.argv.includes('--surface-only')){
  if(!process.argv.includes('--recovery-only')){
  await click('暂停');await settled();const paused=(await inspect()).world
  await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForTimeout(800);assert.deepEqual((await inspect()).world,paused)
  await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered();await cellClick(1);await page.waitForTimeout(250);assert.deepEqual(simulation((await inspect()).world),simulation(paused),'Paused canvas may select a resident, but cannot advance simulation or change the board')
  await screenshot('table-user-paused');await closePanel();await click('继续');await gamesPage();await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).click();await settled()
  assert.equal((await inspect()).world.play.active,null);assert.equal((await inspect()).world.neighborhood.memories.some(m=>m.id==='table-game'),false)
  log('user+hidden pause blocks game moves and simulation while resident selection remains available; cancel awards no memory')
  await alternateTable()
  await begin()
  // Play legal remaining cells through the scene; the engine supplies all opponent decisions.
  for(let turn=0;turn<9&&(await inspect()).world.play.active.stage===0;turn++){
    await ready();const e=(await inspect()).world.play.active,cell=e.board.findIndex(n=>n===-1);assert.ok(cell>=0,'Active table stage must have a legal cell')
    await cellClick(cell);await page.waitForFunction(n=>window.__villageHostFixture.inspect().world.play.active.choices.length>n,e.choices.length);await settled();const next=(await inspect()).world.play.active;moves.push({cell,before:e.board,after:next.board,choices:next.choices})
    if(turn===0)await photo('table-in-progress')
  }
  assert.equal((await inspect()).world.play.active.stage,1);assert.equal((await inspect()).world.neighborhood.memories.some(m=>m.id==='table-game'),false);await gamesPage();await screenshot('table-outcome')
  await ready();await gameplay().getByRole('button',{name:ui.finish,exact:true}).click();await settled()
  const memory=(await inspect()).world.neighborhood.memories.find(m=>m.id==='table-game');assert.equal(memory?.count,1);assert.equal((await inspect()).world.play.active,null)
  log('terminal game enters observed conclusion and explicit confirmation writes exactly one first memory')
  await click('暂停');await settled();await page.evaluate(()=>window.__villageHostFixture.flush());await settled();const saved=(await inspect()).world
  await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,saved)
  await tab('手账');await direct('相册');await page.getByText('table-in-progress',{exact:true}).waitFor();await screenshot('table-cold-restored');await closePanel()
  log('new client runtime restores table mode, confirmed result, memory and album')
  }
  if((await inspect()).world.play.active){await gamesPage();await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).click();await settled();await closePanel()}
  if((await inspect()).world.userPaused){await click('继续');await settled()}
  await begin();await missingMoveAck();await ready();await click('暂停');await settled()
  await click('展开小院')
  for(const [width,height]of [[340,720],[580,720],[1080,760],[320,360]])for(const theme of ['light','dark']){
    await resize(width,height);await page.evaluate(t=>window.__villageHostFixture.preference(t),theme);await settled();await gamesPage()
    await gameplay().getByRole('heading').scrollIntoViewIfNeeded();await screenshot('table-'+width+'x'+height+'-'+theme+'-top')
    const board=page.getByRole('group',{name:'九个棋格',exact:true});await board.scrollIntoViewIfNeeded();assert.equal(await board.getByRole('button').count(),9)
    await screenshot('table-'+width+'x'+height+'-'+theme+'-board')
    await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).scrollIntoViewIfNeeded();await screenshot('table-'+width+'x'+height+'-'+theme+'-bottom')
    await page.getByRole('button',{name:'返回',exact:true}).click();assert.equal((await inspect()).presentation.page,'quick');await closePanel()
  }
  await gamesPage();await gameplay().getByRole('button',{name:'取消这次活动',exact:true}).click();await settled();assert.equal((await inspect()).world.neighborhood.memories.find(m=>m.id==='table-game')?.count,1)
  log('four actual sizes and two themes: active board, top and bottom controls, return; cancelling replay preserves first memory count')
  if(process.argv.includes('--lifecycle'))await lifecycle50()
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);log('zero page exceptions and external requests')
}catch(error){failure=String(error?.stack||error);console.error(failure);await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});const s=await inspect().catch(()=>null);if(s)await writeFile(join(evidence,'failure-state.json'),JSON.stringify({world:s.world,error:s.error,actionError:s.actionError,reasons:s.reasons,presentation:s.presentation},null,2))}
finally{
  await writeFile(join(evidence,'validation.json'),JSON.stringify({status:failure?'FAIL':'PASS',build,checks,captures,moves,anchors,recovery,canvasClicks,photos,performanceSamples,saveSummaries,lifecycle,errors,external,failure,backend:'Chromium headless / SwiftShader',notRun:['real Windows GPU/DPI/IME','human board art approval','one-hour native use'],scope:'Independent authenticated Host fixture; no real user profile or model request'},null,2)+'\n')
  await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context.close();await h.close();await browser.close()
}
if(failure)process.exitCode=1

/** Independent 0.9 actual-component QA. No browser/build starts without --execute. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'

const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),qa=join(root,'docs/ai-village/v08-v09/qa-v09'),buildRoot=join(root,'.build/ai-village-v09-qa')
const label=process.argv[2],scenario=process.argv.find(v=>v.startsWith('--scenario='))?.slice(11)??'integration',resume=process.argv.find(v=>v.startsWith('--resume='))?.slice(9)
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim()
const members=w=>[w.actor,...w.companions]
const poses=w=>members(w).map(({id,position,safe,facing})=>({id,position,safe,facing})).sort((a,b)=>a.id.localeCompare(b.id))
const shared=w=>({home:w.home,journal:w.journal,decorations:w.decorations,memories:w.neighborhood.memories,bonds:w.neighborhood.bonds,play:w.play})
if(!process.argv.includes('--execute')) console.log('PREPARED / NOT RUN: node scripts/ai-village-v09-qa.mjs <new-label> --execute --scenario=integration|matrix|lifecycle|performance [--resume=<stopped-label>]')
else {
  assert.ok(label&&/^[a-z0-9][a-z0-9-]{0,64}$/.test(label));assert.ok(['integration','matrix','lifecycle','performance'].includes(scenario))
  if(resume)assert.ok(/^[a-z0-9][a-z0-9-]{0,64}$/.test(resume)&&resume!==label)
  await run()
}

async function run(){
  const evidence=join(qa,label),generated=join(buildRoot,label),out=join(generated,'preview'),profile=join(generated,'profile')
  await mkdir(qa,{recursive:true});await mkdir(evidence);await mkdir(buildRoot,{recursive:true});await mkdir(generated);await mkdir(out);await mkdir(profile)
  const build={head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),dirty:git('status','--short'),version:(await json(join(pkg,'package.json'))).version,sourceHash:{},bundles:{},scenario}
  for(const file of(await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)).sort())build.sourceHash[file.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',file)))
  for(const file of['index.js','client.js','frame.js'])build.bundles[file]=hash(await readFile(join(pkg,'lib',file)))
  if(resume){const old=await json(join(qa,resume,'build.json'));assert.deepEqual(build.sourceHash,old.sourceHash);assert.deepEqual(build.bundles,old.bundles);await stat(join(qa,resume,'validation.json'));await cp(join(buildRoot,resume,'profile'),profile,{recursive:true,filter:p=>!p.endsWith('owner.lock')});build.resumedFrom=resume}
  const checks=[],captures=[],photos=[],observations=[],performanceSamples=[],lifecycle=[],errors=[],external=[],requests=[]
  let browser,context,page,host,failure,dpr=1
  const log=name=>{checks.push(name);console.log('PASS '+name)}
  const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect())
  const frame=()=>page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'))
  const metrics=()=>frame().evaluate(()=>window.__sceneMetrics())
  const settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'})
  const entered=async region=>{
    await page.waitForFunction(region=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error&&(!region||s.world.region.active===region)},region)
    await frame().waitForFunction(region=>{const m=window.__sceneMetrics();return m.frames>0&&(!region||m.region===region)},region)
    assert.equal(await page.locator('.village-canvas iframe').count(),1)
  }
  const direct=name=>page.getByRole('button',{name,exact:true}).click()
  const click=name=>villageUI(page).click(name)
  const closePanel=async()=>{const el=page.getByRole('button',{name:'关闭面板',exact:true});if(await el.isVisible())await el.click();await page.waitForTimeout(240)}
  const tab=async name=>{
    if((await inspect()).presentation.overlay)await closePanel()
    const el=page.getByRole('tab',{name,exact:true})
    if((await inspect()).presentation.drawer==='closed'||await el.getAttribute('aria-selected')!=='true')await el.click()
  }
  const screenshot=async name=>{
    await page.waitForTimeout(220)
    await page.locator('.village-card').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})))})
    const opacity=await page.locator('.village-surface,.village-panel').evaluateAll(els=>els.map(e=>Number(getComputedStyle(e).opacity)));assert.ok(opacity.every(n=>n===1))
    await page.screenshot({path:join(evidence,name+'.png')});const s=await inspect()
    captures.push({name,dpr,opacity,box:await page.locator('.village-card').boundingBox(),theme:s.preferences.theme,reducedMotion:s.preferences.reducedMotion,region:s.world.region.active,route:s.presentation,tick:s.world.ticks})
  }
  const pause=async value=>{await closePanel();if((await inspect()).world.userPaused!==value){await click(value?'暂停':'继续');await settled()}}
  const regionPanel=()=>page.getByRole('region',{name:'AI 书屋 · 开发样板',exact:true})
  const travel=async target=>{
    if((await inspect()).world.region.active===target)return
    await closePanel()
    if(target==='bookhouse'){await tab('布置');await direct('家具');await regionPanel().getByRole('button',{name:'前往 AI 书屋',exact:true}).click()}
    else{await tab('居民');await regionPanel().getByRole('button',{name:'返回小院',exact:true}).click()}
    await settled();await entered(target);assert.equal((await metrics()).region,target)
  }
  const inviteAll=async()=>{
    await pause(true);await travel('courtyard');await tab('居民');await direct('全部居民');await direct('安排入住');await direct('全员入住');await settled();await closePanel();assert.equal((await inspect()).world.companions.length,6)
  }
  const photo=async(name,save=true)=>{
    await pause(true);const world=(await inspect()).world
    await click('拍照');await direct('拍摄照片');await page.getByRole('img',{name:'照片预览',exact:true}).waitFor()
    const download=page.waitForEvent('download');await direct('导出 PNG');await(await download).saveAs(join(evidence,name+'.png'))
    const bytes=await readFile(join(evidence,name+'.png'));assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960)
    photos.push({file:name+'.png',region:world.region.active,dpr,sha256:hash(bytes),bytes:bytes.length,width:720,height:960})
    if(save){const count=(await inspect()).album?.world.photos.length??0;await page.getByLabel('照片标题',{exact:true}).fill(name);await direct('保存到相册');await page.waitForFunction(n=>window.__villageHostFixture.inspect().album?.world.photos.length===n+1,count)}
    else{await direct('返回取景');await page.getByRole('button',{name:'拍摄照片',exact:true}).waitFor()}
    await direct('退出拍照');assert.deepEqual((await inspect()).world,world)
  }
  const activity=async(id,title)=>{
    await pause(false);await tab('居民');await regionPanel().getByRole('button',{name:title,exact:true}).click();await settled()
    assert.equal((await inspect()).world.actor.intent?.furnitureId,id,(await inspect()).actionError)
    await closePanel()
    await page.waitForFunction(id=>{const a=window.__villageHostFixture.inspect().world.actor;return a.intent?.furnitureId===id&&a.intent.stage==='use'},id,{timeout:90000})
    const state=(await inspect()).world;observations.push({activity:id,actor:state.actor,ticks:state.ticks})
    await pause(true);await screenshot('activity-'+id);await tab('居民')
    assert.equal(await regionPanel().getByRole('button',{name:title,exact:true}).isDisabled(),true)
    await regionPanel().getByRole('button',{name:'结束当前活动',exact:true}).click();await settled();assert.equal((await inspect()).world.actor.intent,null);await closePanel()
  }
  const resize=async(width,height)=>{
    if(!(await inspect()).presentation.expanded)await click('展开小院')
    await closePanel();let viewportHeight=height+236,matched=false
    for(let i=0;i<6;i++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(180);const b=await page.locator('.village-card').boundingBox();if(Math.abs(b.width-width)<1&&Math.abs(b.height-height)<1){matched=true;break}viewportHeight+=Math.round(height-b.height)}
    assert.ok(matched,`actual dimensions ${width}x${height}`);await entered()
  }
  const appearance=async(theme,reduced)=>{
    await closePanel();await click('小院设置');await direct('外观与显示')
    await page.getByLabel('界面主题',{exact:true}).selectOption(theme);await settled()
    // Preferences publish after their authenticated CAS; Playwright setChecked assumes synchronous DOM state.
    if((await inspect()).preferences.reducedMotion!==reduced)await page.getByLabel('减少动态',{exact:true}).click()
    await settled();await page.waitForFunction(value=>window.__villageHostFixture.inspect().preferences.reducedMotion===value,reduced);await closePanel()
  }
  const openContext=async scale=>{
    dpr=scale;context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:scale,recordVideo:{dir:join(evidence,'video'),size:{width:960,height:640}}})
    await context.route('**/*',async route=>{
      const url=route.request().url();if(!url.startsWith(host.url+'/')&&!url.startsWith('blob:')){external.push(new URL(url).origin);return route.abort()}
      const endpoint=new URL(url).pathname.split('/').at(-1)
      if(['save','state','heartbeat','album-save'].includes(endpoint))requests.push({endpoint,method:route.request().method(),elapsedMs:Math.round(performance.now())})
      return route.continue()
    })
    page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message))
    await page.goto(host.entry);await page.getByRole('textbox',{name:'消息输入'}).fill('0.9 书屋隔离验收草稿，不发送。');await direct('打开 AI 小院');await entered()
  }
  const closeContext=async()=>{await page.evaluate(()=>window.__villageHostFixture.dispose());await context.close();context=null;page=null}
  try{
    await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true})
    build.fixtureSha256=hash(await readFile(join(out,'fixture.js')));await writeFile(join(evidence,'build.json'),JSON.stringify(build,null,2)+'\n')
    const{harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js')))
    const{source}=await json(join(root,'.local/environment.json')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
    assert.ok(pw);const{chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
    const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1),executablePath=join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe');await stat(executablePath)
    host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')});browser=await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']})
    await openContext(1)
    const first=(await inspect()).world;assert.equal(first.schemaVersion,10);assert.equal(first.contentRevision,7);assert.equal(first.simulationRulesVersion,4)
    build.contract={schema:10,content:7,rules:4,frame:7};await screenshot('initial')
    if(scenario==='integration'){
      await pause(true);await travel('courtyard');const before=(await inspect()).world;await photo('courtyard-first')
      const albumBefore=(await inspect()).album;await travel('bookhouse')
      let book=(await inspect()).world;assert.equal(book.userPaused,true);assert.equal(book.ticks,before.ticks);assert.equal(book.rng,before.rng);assert.deepEqual(shared(book),shared(before));assert.deepEqual(book.region.returns.courtyard,poses(before));
      assert.ok(!(await inspect()).resourceKeys.some(k=>['scene/background.png','scene/cushion.png','scene/desk-back.png','scene/desk-front.png','scene/table-back.png','scene/table-front.png','scene/bowl.png'].includes(k)))
      await screenshot('bookhouse-first-scene');await photo('bookhouse-first')
      assert.equal((await inspect()).album.world.photos.length,albumBefore.world.photos.length+1)
      for(const[id,title]of[['bookcase','在书柜选书'],['reading-desk','在阅读桌写字'],['window-seat','在窗边坐下']])await activity(id,title)
      log('three bookhouse activities navigate in real time and stop through UI; user pause blocks starting activities')
      await pause(true);await page.evaluate(()=>window.__villageHostFixture.flush());await settled();book=(await inspect()).world
      await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await page.waitForTimeout(1000);assert.deepEqual((await inspect()).world,book)
      await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered('bookhouse');assert.deepEqual((await inspect()).world,book)
      await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered('bookhouse');assert.deepEqual((await inspect()).world,book)
      await tab('手账');await direct('相册');await page.getByRole('img',{name:'bookhouse-first',exact:true}).waitFor();await screenshot('bookhouse-cold-album');await closePanel()
      await travel('courtyard');assert.deepEqual(poses((await inspect()).world),poses(before));assert.deepEqual(shared((await inspect()).world),shared(book))
      log('shared progress and both actual 720x960 photos; hidden suspension and cold bookhouse restore; exact courtyard feet restored')
      await inviteAll();const seven=(await inspect()).world;await travel('bookhouse');assert.equal((await inspect()).world.companions.length,6);await screenshot('seven-bookhouse');await travel('courtyard');assert.deepEqual(poses((await inspect()).world),poses(seven))
      log('seven residents travel together, with one iframe and old courtyard poses retained')
    }
    if(scenario==='matrix'){
      await pause(true);await travel('bookhouse')
      for(const scale of[1,2]){
        if(dpr!==scale){await closeContext();await openContext(scale);await pause(true);await travel('bookhouse')}
        for(const[width,height]of[[340,720],[580,720],[320,360]])for(const theme of['light','dark']){
          await resize(width,height);await appearance(theme,theme==='dark');await tab('居民')
          await regionPanel().getByRole('heading').scrollIntoViewIfNeeded();await screenshot(`book-${width}x${height}-dpr${scale}-${theme}-top`)
          await regionPanel().getByRole('button',{name:'返回小院',exact:true}).scrollIntoViewIfNeeded();await screenshot(`book-${width}x${height}-dpr${scale}-${theme}-return`);await closePanel()
          await photo(`photo-${width}x${height}-dpr${scale}-${theme}`,false)
          await travel('courtyard');await tab('布置');await direct('家具');await regionPanel().getByRole('button',{name:'前往 AI 书屋',exact:true}).scrollIntoViewIfNeeded();await screenshot(`court-${width}x${height}-dpr${scale}-${theme}`)
          await direct('返回');assert.equal((await inspect()).presentation.page,'quick');await closePanel();await travel('bookhouse')
          assert.equal((await inspect()).world.userPaused,true)
        }
      }
      log('actual 340x720/580x720/320x360 at DPR1/2, both themes and motion settings: scroll, back, travel, real photo and cancel')
    }
    if(scenario==='lifecycle'){
      await inviteAll();const initial=(await inspect()).world,cdp=await context.newCDPSession(page)
      for(let i=1;i<=50;i++){
        const target=i%2?'bookhouse':'courtyard';await travel(target);const m=await metrics();assert.equal(m.textures,target==='bookhouse'?121:128);assert.equal(m.actors,7)
        assert.equal((await inspect()).world.ticks,initial.ticks);assert.equal((await inspect()).world.rng,initial.rng);assert.deepEqual(shared((await inspect()).world),shared(initial))
        if(i%10===0){await page.mouse.move(1,1);await page.waitForTimeout(300);await cdp.send('HeapProfiler.collectGarbage');lifecycle.push({cycle:i,region:target,metrics:m,...await cdp.send('Memory.getDOMCounters')});console.log('TRAVEL '+i+'/50')}
      }
      assert.ok(lifecycle.every(row=>row.jsEventListeners===lifecycle[0].jsEventListeners));assert.deepEqual(poses((await inspect()).world),poses(initial))
      await click('关闭小院');await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));await cdp.send('HeapProfiler.collectGarbage');lifecycle.push({closed:true,...await cdp.send('Memory.getDOMCounters')});await cdp.detach()
      await direct('打开 AI 小院');await entered('courtyard');log('50 actual region transitions, stable warm listener counts, bounded current texture/URL ownership, released iframe on close')
    }
    if(scenario==='performance'){
      await inviteAll();await appearance('light',false)
      for(const region of['courtyard','bookhouse']){
        await pause(true);await travel(region);await pause(false);assert.equal((await inspect()).world.play.active,null)
        for(const hidden of[false,true]){
          if(hidden){await page.evaluate(()=>window.__villageHostFixture.sidebar(true));await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'))}
          const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await page.waitForTimeout(2000)
          const f=frame(),before=f?await metrics():null,first=(await cdp.send('Performance.getMetrics')).metrics,beforeWorld=(await inspect()).world,start=performance.now()
          await page.waitForTimeout(20000)
          const seconds=(performance.now()-start)/1000,after=f?await metrics():null,last=(await cdp.send('Performance.getMetrics')).metrics,get=(list,name)=>list.find(m=>m.name===name)?.value??null,afterWorld=(await inspect()).world
          const row={scenario:`seven-natural-${region}-${hidden?'hidden':'visible'}`,seconds,fps:after?(after.frames-before.frames)/seconds:0,p95PaintMs:after?.p95PaintMs??null,textures:after?.textures??0,textureSources:after?.textureSources??0,decodedRGBABytes:after?.decodedRGBABytes??0,urls:after?.urls??0,paintSampleCount:after?.paintSampleCount??0,parentTaskPercentOfOneCore:100*(get(last,'TaskDuration')-get(first,'TaskDuration'))/seconds,beforeWorld,afterWorld}
          performanceSamples.push(row);await writeFile(join(evidence,'performance.json'),JSON.stringify({backend:'Chromium headless / SwiftShader',limitations:'20s samples; parent CDP CPU and Pixi JS submission time are not process-wide native/GPU hardware costs. RGBA bytes estimate decoded source storage, not measured GPU allocation.',samples:performanceSamples},null,2)+'\n')
          if(after){assert.ok(row.fps>=20&&row.fps<=35,`FPS ${row.fps}`);assert.equal(row.textures,region==='bookhouse'?121:128);assert.ok(row.paintSampleCount<=600);assert.ok(row.decodedRGBABytes>0);assert.ok(afterWorld.ticks>beforeWorld.ticks)}else assert.deepEqual(afterWorld,beforeWorld)
          console.log('MEASURED '+row.scenario+' '+row.fps.toFixed(3)+' FPS / '+row.textures+' textures / '+row.decodedRGBABytes+' decoded bytes');await cdp.detach()
        }
        await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await entered(region);await screenshot('performance-'+region+'-restored')
      }
      log('seven natural residents in both regions: independent 20s visible and hidden samples, original FPS/resource limits and no hidden simulation')
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);log('zero page exceptions and external requests')
  }catch(error){
    failure=String(error?.stack||error);console.error(failure);await page?.screenshot({path:join(evidence,'failure.png')}).catch(()=>{})
    const s=await inspect().catch(()=>null);if(s)await writeFile(join(evidence,'failure-state.json'),JSON.stringify({world:s.world,error:s.error,actionError:s.actionError,album:s.album,reasons:s.reasons,presentation:s.presentation,entrance:s.entrance,frameReady:s.frameReady,resourceKeys:s.resourceKeys},null,2))
  }finally{
    await page?.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context?.close();await host?.close();await browser?.close()
    await writeFile(join(evidence,'validation.json'),JSON.stringify({status:failure?'FAIL':'PASS',build,checks,captures,photos,observations,performanceSamples,lifecycle,errors,external,requests,failure,notRun:['native GPU hardware and full-process budget','one-hour native endurance','real primary-model streaming concurrency','formal bookhouse art approval'],scope:'Isolated authenticated Host fixture, real production runtime/frame/UI, no daily DSH_HOME or model request, no injected world/ticks'},null,2)+'\n')
  }
  if(failure)process.exitCode=1
}

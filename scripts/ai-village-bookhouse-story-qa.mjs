/** Real UI and wall-clock story; read-only inspection, no world/tick injection. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),label=process.argv[2],dpr=Number(process.argv[3]??1)
assert.ok(label&&/^[a-z0-9-]+$/.test(label));assert.ok([1,2].includes(dpr))
const qa=join(root,'docs/ai-village/life-content/story-qa',label),out=join(root,'.build/bookhouse-story-qa',label),profile=join(out,'profile')
await mkdir(join(root,'docs/ai-village/life-content/story-qa'),{recursive:true});await mkdir(qa);await mkdir(out,{recursive:true});await mkdir(profile)
const hash=b=>createHash('sha256').update(b).digest('hex'),build={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),version:JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,dpr,bundles:{},source:{}}
for(const f of ['index.js','client.js','frame.js'])build.bundles[f]=hash(await readFile(join(pkg,'lib',f)))
for(const f of(await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)))build.source[f]=hash(await readFile(join(pkg,'src',f)))
await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2))
await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js'))),host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:dpr,recordVideo:{dir:qa,size:{width:1440,height:960}}}),page=await context.newPage(),checks=[],errors=[],external=[],captures=[],writes=[]
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',route=>{const u=route.request().url();if(!u.startsWith(host.url+'/')&&!u.startsWith('blob:')){external.push(u);return route.abort()}if(u.endsWith('/save'))writes.push({time:Date.now(),body:route.request().postDataJSON()});return route.continue()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),direct=name=>page.getByRole('button',{name,exact:true}).click(),settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'}),entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error})
const close=async()=>{if(await page.getByRole('button',{name:'关闭面板',exact:true}).isVisible())await direct('关闭面板')}
const tab=async name=>{await close();await page.getByRole('tab',{name,exact:true}).click()}
const shot=async name=>{await page.waitForTimeout(450);await page.screenshot({path:join(qa,name+'.png')});const s=await inspect();captures.push({name,world:s.world,box:await page.locator('.village-card').boundingBox()})}
const resize=async(width,height)=>{
 if(!(await inspect()).presentation.expanded){await close();await villageUI(page).click('展开小院')}
 await close();let viewportHeight=height+236,matched=false
 for(let i=0;i<6;i++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(200);const b=await page.locator('.village-card').boundingBox();if(b&&Math.abs(b.width-width)<1&&Math.abs(b.height-height)<1){matched=true;break}assert.ok(b,'expanded card must remain visible');viewportHeight+=Math.round(height-b.height)}
 assert.ok(matched,`actual card ${width}x${height}`);await entered()
}
const appearance=async(theme,reduced)=>{
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption(theme);await settled()
 if((await inspect()).preferences.reducedMotion!==reduced)await page.getByLabel('减少动态',{exact:true}).click();await settled();await close()
}
const photo=async(name)=>{
 await close();const before=(await inspect()).world;await villageUI(page).click('拍照');await direct('拍摄照片');await page.getByRole('img',{name:'照片预览',exact:true}).waitFor()
 const download=page.waitForEvent('download');await direct('导出 PNG');await(await download).saveAs(join(qa,name+'.png'));const bytes=await readFile(join(qa,name+'.png'));assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960)
 await direct('返回取景');await direct('退出拍照');assert.deepEqual((await inspect()).world,before)
}
const log=s=>{checks.push(s);console.log('PASS '+s)}
let failure
try{
 await page.goto(host.entry);await direct('打开 AI 小院');await entered();await villageUI(page).click('暂停');await settled();await villageUI(page).click('展开小院');await entered()
 await tab('居民');await direct('全部居民');await direct('安排入住');await page.getByLabel('入住 Seedance',{exact:true}).click();await settled();await entered()
 await tab('布置');await direct('家具');await direct('前往 AI 书屋');await settled();await entered();await close();await villageUI(page).click('继续');await settled()
 await tab('心愿');await direct('一起寻找微光');await settled()
 assert.equal((await inspect()).world.bookhouse.active.participants[1],'seedance');await shot('story-started');log('Real UI admits Seedance and starts shared reading in bookhouse with exactly two participants')
 const started=(await inspect()).world.bookhouse.active.id
 for(let stage=0;stage<3;stage++){
  await page.waitForFunction(stage=>{const e=window.__villageHostFixture.inspect().world.bookhouse.active;return e?.stage===stage&&e.phase==='ready'},stage,{timeout:90000})
  await shot('stage-'+stage+'-ready');assert.equal((await inspect()).world.bookhouse.active.id,started)
  if(stage===1){
   await close();await villageUI(page).click('暂停');await settled();await page.evaluate(()=>window.__villageHostFixture.flush());const before=(await inspect()).world
   await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,before)
   await shot('mid-story-cold-restored');await villageUI(page).click('继续');await settled();await tab('心愿');log('Mid-story cold restore preserves event, phase, physical feet, theme and first-world state exactly while paused')
  }
  await direct(stage===0?'记住窗边的光':stage===1?'写下我们的句子':'收好这枚微光书签');await settled();log('Stage '+stage+' requires real arrival and observation before confirmed action')
 }
 const completed=(await inspect()).world.bookhouse;assert.equal(completed.memory.count,1);assert.equal(completed.active,null);assert.equal(completed.keepsake,'bookhouse')
 await close();await villageUI(page).click('暂停');await settled();await shot('bookhouse-bookmark')
 const noticeId=`memory:bookhouse-light:${completed.memory.eventId}`
 await page.locator('.village-toast button').click();await settled()
 await page.waitForFunction(id=>{const s=window.__villageHostFixture.inspect();return s.preferences.noticeReadIds.includes(id)&&document.activeElement?.getAttribute('data-notice-id')===id},noticeId)
 assert.equal(await page.locator(`[data-notice-id="${noticeId}"]`).count(),1);assert.equal(await page.locator(`[data-notice-id="${noticeId}"] h3`).innerText(),'夹在书里的微光');await shot('first-memory-toast-journal')
 await close();await page.getByRole('button',{name:/^消息，/}).click();await page.locator('.village-notice-list button').filter({hasText:'夹在书里的微光'}).click();await settled()
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-notice-id')===id,noticeId);await shot('first-memory-notification-journal');log('Completion toast and notification both focus the single titled durable journal row and persist its read state')
 await tab('布置');await direct('带回小院');await settled();await direct('返回小院');await settled();await entered();await close();await shot('courtyard-bookmark');assert.deepEqual((await inspect()).world.bookhouse.memory,completed.memory)
 log('One durable first memory and keepsake appear in journal and travel back to courtyard without duplicate reward')
 await page.evaluate(()=>window.__villageHostFixture.flush());const saved=(await inspect()).world;await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,saved)
 await tab('手账');await shot('final-cold-journal');log('Cold restart keeps exact paused world, first participants, completed tick, count and courtyard placement')
 // Cold starts restore the floating layout. Explicitly expand before testing small card sizes;
 // a narrow host with a floating card correctly hides it to protect the composer.
 for(const [width,height] of [[320,360],[340,720],[580,720]])for(const theme of ['light','dark']){
  await resize(width,height);await appearance(theme,theme==='dark');await tab('心愿');await shot(`${width}x${height}-${theme}-wishes`);await tab('居民');await shot(`${width}x${height}-${theme}-residents`)
  await tab('布置');await direct('家具');await direct('前往 AI 书屋');await settled();await entered();await tab('心愿');await shot(`${width}x${height}-${theme}-bookhouse`);await page.getByRole('button',{name:'再读一次',exact:true}).scrollIntoViewIfNeeded();await shot(`${width}x${height}-${theme}-bookhouse-action`)
  await photo(`${width}x${height}-${theme}-bookhouse-photo`);await tab('居民');await direct('返回小院');await settled();await entered()
 }
 await resize(580,720);await appearance('light',false);await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('语言',{exact:true}).selectOption('en');await settled();await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.getByRole('tab',{name:'Wishes',exact:true}).click();await shot('english-wishes')
 log('Actual 320x360,340x720,580x720 cards: light/dark and reduced motion, story and resident access, travel, six real 720x960 photos and English wishes')
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);log('No page exceptions, external requests, model calls, injected time or injected world')
}catch(e){failure=String(e.stack||e);console.error(failure);await shot('failure').catch(()=>{})}
finally{await page.evaluate(()=>window.__villageHostFixture.dispose()).catch(()=>{});await context.close();await browser.close();await host.close();await writeFile(join(qa,'validation.json'),JSON.stringify({status:failure?'FAIL':'PASS',checks,captures,errors,external,saveRequests:writes.length,failure,build,notRun:['native candidate install','physical sleep','hardware GPU performance']},null,2))}
if(failure)process.exitCode=1

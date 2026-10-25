/** Real UI, actual routes and wall-clock time. An isolated authenticated Host; no world injection. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {runPreview} from './ai-village-phase4-browser.mjs'
import {villageUI} from './ai-village-ui-v1-navigation.mjs'
import {playDefinitions} from '../packages/ai-village/src/core/play-catalog.ts'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),label=process.argv[2],dpr=Number(process.argv[3]??1)
const visualOnly=process.argv[4]==='--visual-only'
assert.match(label??'',/^[a-z0-9-]+$/);assert.ok([1,2].includes(dpr))
const qa=join(root,'docs/ai-village/v011/browser',label),out=join(root,'.build/ai-village-v011',label),profile=join(out,'profile')
await mkdir(join(root,'docs/ai-village/v011/browser'),{recursive:true});await mkdir(qa);await mkdir(profile,{recursive:true})
if(visualOnly)await cp(join(root,'.build/ai-village-v011',`final-dpr${dpr}-01`,'profile'),profile,{recursive:true})
const hash=b=>createHash('sha256').update(b).digest('hex'),build={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),version:JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,dpr,source:{},bundles:{}}
for(const f of ['index.js','client.js','frame.js'])build.bundles[f]=hash(await readFile(join(pkg,'lib',f)))
for(const f of(await readdir(join(pkg,'src'),{recursive:true})).filter(f=>/\.tsx?$/.test(f)))build.source[f]=hash(await readFile(join(pkg,'src',f)))
await writeFile(join(qa,'build.json'),JSON.stringify(build,null,2));await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true});await runPreview({root,pkg,out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js'))),host=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:dpr,recordVideo:{dir:qa,size:{width:1440,height:960}}}),page=await context.newPage(),checks=[],errors=[],external=[],observations=[]
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',r=>{if(!r.request().url().startsWith(host.url+'/')&&!r.request().url().startsWith('blob:')){external.push(r.request().url());return r.abort()}return r.continue()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),direct=name=>page.getByRole('button',{name,exact:true}).click(),settled=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.ready&&!s.error&&!s.preferencesSaving&&!s.reasons.includes('commit-pending')&&s.saveReceipt.status!=='pending'}),entered=()=>page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return s.frameReady&&!s.entrance.blocking&&!s.error})
const close=async()=>{if(await page.getByRole('button',{name:'关闭面板',exact:true}).isVisible())await direct('关闭面板')},tab=async name=>{await close();await page.getByRole('tab',{name,exact:true}).click()},wishes=async()=>{await tab('心愿');if(await page.getByRole('button',{name:'全部心愿',exact:true}).isVisible())await direct('全部心愿')}
const metrics=async()=>page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame')).evaluate(()=>window.__sceneMetrics())
const shot=async name=>{await page.screenshot({path:join(qa,name+'.png'),animations:'disabled'});observations.push({name,world:(await inspect()).world,metrics:await metrics()})},log=s=>{checks.push(s);console.log('PASS '+s)}
const rel=page.locator('.village-relationships'),showRelationshipHeading=()=>rel.evaluate(el=>{const panel=el.closest('.village-panel');if(panel)panel.scrollTop+=el.getBoundingClientRect().top-panel.getBoundingClientRect().top})
const pause=async value=>{await close();if((await inspect()).world.userPaused!==value){await villageUI(page).click(value?'暂停':'继续');await settled()}}
const admissions=async()=>{await tab('居民');await direct('全部居民');await direct('安排入住')}
const names={bluewhale:'DeepSeek',claude:'Claude',gemini:'Gemini',gpt:'GPT',grok:'Grok',kimi:'Kimi',qwen:'Qwen',seedance:'Seedance',glm:'GLM',minimax:'MiniMax',llama:'Llama',mistral:'Mistral'}
const member=async(id,present)=>{await admissions();const cb=page.getByLabel('入住 '+names[id],{exact:true});if(await cb.isChecked()!==present){await cb.click();await settled();await entered()}}
const finishPlay=async id=>{
 const d=playDefinitions.find(d=>d.id===id);assert.ok(d)
 for(let stage=0;stage<d.stages.length;stage++){
  await page.waitForFunction(({id,stage})=>{const e=window.__villageHostFixture.inspect().world.play.active;return e?.definitionId===id&&e.stage===stage&&e.phase==='ready'},{id,stage},{timeout:120000})
  await close();await shot(id+'-'+stage+'-scene');await wishes();await shot(id+'-'+stage+'-dialogue');await direct(d.stages[stage].actionLabel.zh);await settled()
 }
 assert.equal((await inspect()).world.play.active,null);assert.equal((await inspect()).world.neighborhood.memories.find(m=>m.id===id).count,1);log(id+' completed with real routes and saved exactly once')
}
let failure
try{
 await page.goto(host.entry);await direct('打开 AI 小院');await entered()
 if(visualOnly){if(!await page.getByRole('button',{name:'Courtyard settings',exact:true}).isVisible())await direct('More');await direct('Courtyard settings');await direct('Appearance and display');await page.getByLabel('Language',{exact:true}).selectOption('zh');await settled();await close()}
 await villageUI(page).click('展开小院');await entered()
 if(!visualOnly){
 for(const id of ['seedance','glm','minimax','llama','mistral']){
  await member(id,true);await wishes()
  if(!(await inspect()).world.play.active){const b=page.getByRole('button',{name:'认识一下 · '+names[id],exact:true});await b.waitFor();await b.click({timeout:30000});await settled()}
  await finishPlay('intro-'+id)
 }
 await member('claude',true);await wishes();await direct('开始 · 饭碗里的书签');await settled();await finishPlay('pair-bluewhale-claude')
 await member('seedance',false);await member('gemini',true);await wishes();await direct('开始 · 两个答案');await settled();await finishPlay('pair-glm-gemini')
 const roster=async wanted=>{
  for(const a of [(await inspect()).world.actor,...(await inspect()).world.companions])if(!wanted.includes(a.id))await member(a.id,false)
  for(const id of wanted)if(![(await inspect()).world.actor,...(await inspect()).world.companions].some(a=>a.id===id))await member(id,true)
 }
 for(const d of playDefinitions.filter(d=>d.id.startsWith('pair-')&&!['pair-bluewhale-claude','pair-glm-gemini'].includes(d.id))){
  await roster([...new Set(['bluewhale',...d.requiredParticipants])]);await wishes();await direct('开始 · '+d.name.zh);await settled();await finishPlay(d.id)
 }
 await roster(['bluewhale','claude','gemini','glm','minimax','llama','mistral'])
 await pause(true);await tab('手账');await direct('回忆');await showRelationshipHeading();assert.equal(await rel.locator('option').count(),12);assert.equal(await rel.locator('[data-relationship]').count(),11);await shot('relationships-light')
 await rel.getByLabel('查看居民的共同回忆').selectOption('glm');await rel.locator('[data-relationship]').filter({hasText:'Gemini'}).locator('summary').click();await shot('relationship-glm-gemini-source')
 const accent=await page.locator('.village-relationships select').evaluate(el=>getComputedStyle(el).accentColor);assert.notEqual(accent,'auto');observations.push({nativeControlAccent:accent})
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption('dark');await settled();await close();await tab('手账');await direct('回忆');await rel.scrollIntoViewIfNeeded();await shot('relationships-dark');log('12-resident / 11-pair memory book, exact source, light/dark and computed native accent')
 await tab('布置');await direct('家具');await direct('前往 AI 书屋');await settled();await entered();await pause(false);await tab('心愿');await direct('看看书架里的谜题');await settled()
 for(let stage=0;stage<3;stage++){
  await page.waitForFunction(stage=>{const e=window.__villageHostFixture.inspect().world.bookhouse.active;return e?.kind==='puzzle'&&e.stage===stage&&e.phase==='ready'},stage,{timeout:120000})
  await close();await shot('puzzle-'+stage+'-scene');await tab('心愿');await shot('puzzle-'+stage+'-dialogue')
  if(stage===0)await direct('把书页带到阅读桌')
  else if(stage===1){
   const pages=page.getByRole('group',{name:'散落的书页'}),slots=page.getByRole('group',{name:'书页顺序'})
   await pages.getByRole('button',{name:'开花',exact:true}).click();await slots.getByRole('button').nth(0).click();await settled();assert.deepEqual((await inspect()).world.bookhouse.active.board,[2,-1,-1]);await direct('重新排书页');await settled()
   await pages.getByRole('button',{name:'种子',exact:true}).click();await slots.getByRole('button').nth(0).click();await settled()
   await pause(true);await page.evaluate(()=>window.__villageHostFixture.flush());const before=(await inspect()).world;await page.evaluate(()=>window.__villageHostFixture.dispose());await page.reload();await direct('打开 AI 小院');await entered();assert.deepEqual((await inspect()).world,before);await shot('puzzle-cold-restored');await pause(false);await tab('心愿')
   for(const [i,name]of [[1,'发芽'],[2,'开花']]){await pages.getByRole('button',{name,exact:true}).click();await slots.getByRole('button').nth(i).click();await settled()}
  }else await direct('记住这次书页整理')
  await settled()
 }
 const completed=(await inspect()).world.bookhouse;assert.equal(completed.puzzleMemory.count,1);assert.equal(completed.memory,null);assert.equal(completed.keepsake,null);await pause(true);await tab('手账');await direct('回忆');await shot('puzzle-journal');log('Repeatable shelf puzzle: wrong order/reset, mid-puzzle cold recovery, one memory and no unearned bookmark')
 // Texture churn and region epochs are observations, not an inferred leak-free claim.
 for(let i=0;i<3;i++){await tab('居民');await direct('返回小院');await settled();await entered();const court=await metrics();assert.ok(court.textures<=128);await tab('布置');await direct('家具');await direct('前往 AI 书屋');await settled();await entered();const book=await metrics();assert.ok(book.textures<=121);assert.equal(await page.locator('.village-canvas iframe').count(),1);observations.push({switch:i,court,book})}
 await tab('居民');await direct('返回小院');await settled();await entered();await admissions();assert.equal(await page.getByLabel('入住 Seedance',{exact:true}).isDisabled(),true);assert.equal((await inspect()).world.play.active,null)
 await member('gemini',false);await member('seedance',true);assert.equal((await inspect()).world.play.active,null);assert.equal((await inspect()).world.neighborhood.memories.find(m=>m.id==='intro-seedance').count,1)
 log('Three region round trips keep one iframe and 128/121 texture limits; returning completed resident does not replay welcome')
 }
 for(const [width,height]of [[320,360],[340,720],[580,720]])for(const theme of ['light','dark']){
  await close();if(!(await inspect()).presentation.expanded){await villageUI(page).click('展开小院');await entered()}
  let hostHeight=height+236
  for(let n=0;n<6;n++){await page.setViewportSize({width:width+224,height:hostHeight});await page.waitForTimeout(200);const box=await page.locator('.village-card').boundingBox();assert.ok(box);if(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)break;hostHeight+=Math.round(height-box.height)}
  const box=await page.locator('.village-card').boundingBox();assert.ok(Math.abs(box.width-width)<1&&Math.abs(box.height-height)<1)
  await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('界面主题',{exact:true}).selectOption(theme);await settled();await close();await tab('手账');await direct('回忆');await showRelationshipHeading();await shot(`${width}x${height}-${theme}-relationships`)
 }
 await close();await villageUI(page).click('小院设置');await direct('外观与显示');await page.getByLabel('语言',{exact:true}).selectOption('en');await settled();await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.getByRole('tab',{name:'Journal',exact:true}).click();await page.getByRole('button',{name:'Memories',exact:true}).click();await showRelationshipHeading();await shot('english-relationships');log('Real card 320x360 / 340x720 / 580x720, light/dark, English, requested DPR')
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
}catch(e){failure=String(e.stack||e);console.error(failure);await shot('failure').catch(()=>{})}
finally{await page.evaluate(()=>window.__villageHostFixture.dispose()).catch(()=>{});await context.close();await browser.close();await host.close();await writeFile(join(qa,'result.json'),JSON.stringify({status:failure?'FAIL':'PASS',build,checks,errors,external,observations,failure,notRun:['physical sleep','native minimization','hardware GPU','approved layered art']},null,2))}
if(failure)process.exitCode=1

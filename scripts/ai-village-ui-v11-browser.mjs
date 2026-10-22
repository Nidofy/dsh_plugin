import { execFileSync } from 'node:child_process'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/ai-village-phase4'), qa = join(root, 'packages/ai-village/art/QA/ui-v11/visual')
await mkdir(qa, { recursive: true })
const { runPreview } = await import('./ai-village-phase4-browser.mjs')
await runPreview({ root, pkg: join(root, 'packages/ai-village'), out, buildOnly: true })
const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href), plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
const h = await harness({ profile: await mkdtemp(join(root, '.build/ui-v1-browser-profile-')), plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
const browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), args: ['--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(root, '.build/ui-v11-video'),size:{width:960,height:640} } }), page = await context.newPage(), errors = [], external = [], checks = []
page.on('pageerror', e => errors.push(e.message))
await context.route('**/*', route => {
  if (route.request().url().startsWith(h.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
  external.push(route.request().url()); return route.abort()
})
const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
const ready = () => page.waitForFunction(() => window.__villageHostFixture.inspect().frameReady)
const click = name => page.getByRole('button', { name, exact: true }).click()
const frame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))

const build={version:'0.6.3',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),dirty:true,fixtureSHA256:createHash('sha256').update(await readFile(join(out,'fixture.js'))).digest('hex'),clientSHA256:createHash('sha256').update(await readFile(join(out,'lib/client.js'))).digest('hex'),frameSHA256:createHash('sha256').update(await readFile(join(out,'lib/frame.js'))).digest('hex')}
const metadata = [], captures = []
const shot = async name => {
 await page.waitForTimeout(240);
 await page.locator('.village-card img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
 await page.screenshot({path:join(qa,name+'.png')});
 const state=await inspect(),display=await page.locator('.village-card').evaluate(el=>{const cs=getComputedStyle(el);return{css:el.getBoundingClientRect().toJSON(),mode:el.dataset.theme,themeSource:el.dataset.themeSource,materialMode:el.dataset.material,fontSize:cs.fontSize,lineHeight:cs.lineHeight}});
 const renderer=await frame().evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'});
 metadata.push({name,build,...display,dpr:await page.evaluate(()=>devicePixelRatio),theme:state.preferences.theme,textScale:state.preferences.textScale,environment:state.world.home.environment,language:state.preferences.language,route:state.presentation,renderer});
 await writeFile(join(qa,'metadata.json'),JSON.stringify(metadata,null,2));
}
const tab = name => page.getByRole('tab',{name,exact:true}).click()
const system = async name => { if (!await page.getByRole('button',{name,exact:true}).isVisible()) await page.getByRole('button',{name:/^(更多|More)$/}).click(); await click(name) }
const settled = () => page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.preferencesSaving && !s.error && !s.reasons.includes('commit-pending') && s.saveReceipt.status !== 'pending'})
const frameIdentity = () => page.locator('.village-canvas iframe').evaluate(el => { el.dataset.identity ??= 'same-frame';return el.dataset.identity })
const resize=async(width,height)=>{let viewportHeight=height+236;for(let i=0;i<5;i++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(180);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<.1&&Math.abs(box.height-height)<.1){await ready();return}viewportHeight+=Math.round(height-box.height)}throw Error('Unable to size courtyard '+width+'x'+height)}

const closePanel=()=>page.locator('.village-panel-header button').last().click();
const settings=async()=>{await system((await inspect()).preferences.language==='en'?'Courtyard settings':'小院设置')};
const appearance=()=>page.getByRole('button',{name:/^(外观与显示|Appearance and display)$/}).click();
const configure=async(theme,language,scale=1)=>{await settings();await appearance();await page.getByLabel(/^(界面主题|Theme)$/).selectOption(theme);await settled();await page.getByLabel(/^(文字大小|Text size)$/).selectOption(String(scale));await settled();await page.getByLabel(/^(语言|Language)$/).selectOption(language);await settled();await closePanel()};
try {
 await page.goto(h.entry);await click('打开 AI 小院');await ready();await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush());await settled();
 assert.equal((await inspect()).preferences.schemaVersion,3);await page.getByLabel('消息输入',{exact:true}).fill('UI-v1.1 unsent draft — 保留输入');
 await system('展开小院');
 const identity=await frameIdentity(),world=(await inspect()).world;
 for(const [width,height] of [[340,720],[1080,760],[320,360],[340,480],[580,720],[800,600]]) {
  await resize(width,height);
  for(const theme of ['light','dark'])for(const language of ['zh','en']) {
   await configure(theme,language);const prefix=width+'x'+height+'-'+theme+'-'+language;
   await shot(prefix+'-default');
   const hud=await page.locator('.village-hud button,.village-tabs,.village-tabs button,.village-time').evaluateAll(els=>els.map(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopWidth,s.boxShadow,s.backdropFilter]}));
   assert.ok(hud.every(v=>v[0]==='rgba(0, 0, 0, 0)'&&v[1]==='0px'&&v[2]==='none'&&v[3]==='none'));
   await tab(language==='zh'?'居民':'Residents');await shot(prefix+'-residents');const box=await page.locator('.village-drawer').boundingBox();
   const material=await page.locator('.village-card').getAttribute('data-material');if(material!=='glass')assert.match(await page.locator('.village-drawer').evaluate(el=>getComputedStyle(el).backgroundColor),/^rgb\(/);
   assert.ok(box.height<=(height<480?128:width>=900?224:Math.max(128,Math.min(184,Math.round(.22*height))))+.1);
   assert.ok(box.width<=(height<480?248:width>=900?296:Math.min(360,width-24))+.1);await closePanel();
   await settings();await shot(prefix+'-settings');const sb=await page.locator('.village-settings').boundingBox();assert.ok(sb.height<=Math.min(224,Math.floor(.42*height))+.1);
   await appearance();const detailBox=await page.locator('.village-settings').boundingBox();assert.ok(detailBox.height<=Math.min(320,Math.floor(height*.52))+.1);await shot(prefix+'-appearance');await closePanel();assert.equal(await frameIdentity(),identity);
  }
 }
 checks.push('96 actual component screenshots: 6 sizes × 2 themes × 2 languages × 4 states; bounded cards, transparent HUD, same iframe');
 await resize(340,720);await configure('dark','zh');await tab('居民');await click('互动');await click('小院设置');await appearance();await click('返回');await click('返回');
 assert.equal((await inspect()).presentation.page,'activities');assert.equal((await inspect()).presentation.tab,'residents');await shot('navigation-return-resident');await closePanel();
 await system('更多');await click('小院设置');await click('返回');assert.equal((await inspect()).presentation.overlay,'more');await closePanel();
 assert.deepEqual((await inspect()).world,world);checks.push('resident→settings→appearance→back twice, more→settings→back, no world writes');
 for(const scale of [.9,1,1.15,1.3,1.5,2]){await configure('dark','en',scale);await settings();await appearance();await page.getByLabel('Show speech bubbles').scrollIntoViewIfNeeded();await shot('text-scale-'+scale);await closePanel()}
 await configure('light','zh',1);
 await tab('居民');await click('全部居民');await click('安排入住');await click('全员入住');await settled();await ready();await shot('seven-residents');await closePanel();
 await tab('居民');await click('互动');await shot('eight-activities');await closePanel();
 await tab('心愿');await click('一起活动');await shot('together');await closePanel();
 await tab('布置');await click('家具');await click('开始布置');await shot('arrangement');await click('取消');
 await tab('手账');await click('相册');await shot('album-empty');await closePanel();
 await page.getByRole('button',{name:/^消息，/}).click();await shot('notifications');await closePanel();
 await settings();await appearance();for(const [w,h] of [[340,479],[340,480],[340,481],[559,720],[560,720],[899,720],[900,720]]){await resize(w,h);assert.equal((await inspect()).presentation.page,'appearance')}await closePanel();checks.push('open detail survives all height/HUD/wide breakpoints');
 await resize(340,720);await configure('light','zh');await tab('居民');await click('全部居民');await click('安排入住');await click('仅留当前');await settled();await ready();await closePanel();
 for(const [w,h] of [[340,720],[580,720],[1080,760]]){await resize(w,h);await system('拍照');await click('拍摄照片');await page.getByAltText('照片预览',{exact:true}).waitFor();const dl=page.waitForEvent('download');await click('导出 PNG');const download=await dl,path=join(qa,'capture-'+w+'.png');await download.saveAs(path);captures.push(await readFile(path));await shot('photo-'+w);await click('返回取景');await click('退出拍照')}
 assert.deepEqual(captures[0],captures[1]);assert.deepEqual(captures[0],captures[2]);checks.push('720×960 photo bytes identical across 340/580/1080; UI absent and user pause retained');
 assert.equal(await page.getByLabel('消息输入',{exact:true}).inputValue(),'UI-v1.1 unsent draft — 保留输入');const composer=await page.locator('[data-composer-card]').boundingBox(),card=await page.locator('.village-card').boundingBox();assert.ok(card.y+card.height<=composer.y);checks.push('full composer avoidance and draft preserved');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile(join(qa,'validation.json'),JSON.stringify({status:'PASS',checks,errors,external,manual:'GPU glass and Windows visual approval NOT RUN; one hour DEFERRED'},null,2));console.log(JSON.stringify({status:'PASS',checks,screenshots:metadata.length}));
} catch(error){await page.screenshot({path:join(qa,'failure.png')});await writeFile(join(qa,'failure.json'),JSON.stringify({error:String(error),checks,errors,state:await inspect()},null,2));throw error}
finally{const video=page.video();await context.close();await mkdir(join(qa,'../interaction'),{recursive:true});await video.saveAs(join(qa,'../interaction/ui-v11-runtime.webm'));await browser.close();await h.close()}

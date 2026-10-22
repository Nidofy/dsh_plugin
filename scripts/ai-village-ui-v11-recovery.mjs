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
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir: join(root, '.build/ui-v11-recovery-video'),size:{width:960,height:640} } }), page = await context.newPage(), errors = [], external = [], checks = []
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
 await writeFile(join(qa,'recovery-metadata.json'),JSON.stringify(metadata,null,2));
}
const tab = name => page.getByRole('tab',{name,exact:true}).click()
const system = async name => { if (!await page.getByRole('button',{name,exact:true}).isVisible()) await page.getByRole('button',{name:/^(更多|More)$/}).click(); await click(name) }
const settled = () => page.waitForFunction(()=>{const s=window.__villageHostFixture.inspect();return !s.preferencesSaving && !s.error && !s.reasons.includes('commit-pending') && s.saveReceipt.status !== 'pending'})
const frameIdentity = () => page.locator('.village-canvas iframe').evaluate(el => { el.dataset.identity ??= 'same-frame';return el.dataset.identity })
const resize=async(width,height)=>{let viewportHeight=height+236;for(let i=0;i<5;i++){await page.setViewportSize({width:width+224,height:viewportHeight});await page.waitForTimeout(180);const box=await page.locator('.village-card').boundingBox();if(Math.abs(box.width-width)<.1&&Math.abs(box.height-height)<.1){await ready();return}viewportHeight+=Math.round(height-box.height)}throw Error('Unable to size courtyard '+width+'x'+height)}


let heartbeatOffline=false,stateOffline=false,loseAck=false,writes=0;const requests=[];
await context.route('**/api/nidofy-ai-village/{heartbeat,state,save}',async route=>{
 const endpoint=new URL(route.request().url()).pathname.split('/').at(-1);requests.push({endpoint,ms:Date.now()});
 if(endpoint==='heartbeat'&&heartbeatOffline || endpoint==='state'&&stateOffline)return route.abort('failed');
 if(endpoint==='save'){writes++;if(loseAck){loseAck=false;await route.fetch();return route.abort('failed')}}
 return route.continue();
});
try{
 await page.goto(h.entry);await click('打开 AI 小院');await ready();await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush());await settled();
 await tab('布置');await click('家具');await click('开始布置');await click('书桌 · 替代锚点');const draft=(await inspect()).homeDraft,world=(await inspect()).world,identity=await frameIdentity(),beforeWrites=writes;
 heartbeatOffline=true;await page.waitForFunction(()=>window.__villageHostFixture.inspect().errorCode==='CONNECTION_TEMPORARY');await shot('recovery-heartbeat-pending');heartbeatOffline=false;
 await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);assert.deepEqual((await inspect()).homeDraft,draft);assert.deepEqual((await inspect()).world,world);assert.equal(writes,beforeWrites);assert.equal(await frameIdentity(),identity);assert.ok((await inspect()).reasons.includes('user'));assert.equal(await page.getByRole('button',{name:'撤销',exact:true}).isEnabled(),true);await shot('recovery-heartbeat-restored');checks.push('real fetch failure with unchanged transport recovers after lease/state checks, retaining draft/undo/user and same iframe');
 heartbeatOffline=true;await page.waitForFunction(()=>!!window.__villageHostFixture.inspect().error);await page.evaluate(()=>window.__villageHostFixture.sidebar(true));const beforeReads=requests.filter(x=>x.endpoint==='state').length;await page.waitForTimeout(4500);assert.equal(requests.filter(x=>x.endpoint==='state').length,beforeReads);heartbeatOffline=false;await page.evaluate(()=>window.__villageHostFixture.sidebar(false));await ready();await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error);assert.deepEqual((await inspect()).homeDraft,draft);checks.push('hidden foreground gate cancels automatic reads; return rechecks and keeps draft');
 const count=writes;stateOffline=true;loseAck=true;await click('保存布置');await page.waitForFunction(()=>window.__villageHostFixture.inspect().saveReceipt.status==='unknown');await shot('recovery-save-unknown');await page.waitForTimeout(8200);assert.equal(writes,count+1);assert.deepEqual((await inspect()).world,world);assert.deepEqual((await inspect()).homeDraft,draft);await shot('recovery-save-still-unknown');
 stateOffline=false;await click('重新连接');await page.waitForFunction(()=>!window.__villageHostFixture.inspect().error&&window.__villageHostFixture.inspect().saveReceipt.status==='committed');assert.equal(writes,count+1);assert.deepEqual((await inspect()).homeDraft,draft);assert.ok((await inspect()).reasons.includes('arrange'));await shot('recovery-save-confirmed');checks.push('server committed but ACK lost; three bounded read checks, no second save; explicit read confirms, keeps draft and undo');
 const other=await context.newPage();await other.goto(h.entry);await other.getByRole('button',{name:'打开 AI 小院',exact:true}).click();await other.waitForFunction(()=>window.__villageHostFixture.inspect().error.includes('WORLD_IN_USE'));await other.screenshot({path:join(qa,'recovery-other-owner.png')});await other.close();checks.push('second real authenticated runtime cannot take over active owner');
 const state=await inspect();await writeFile(join(qa,'recovery-validation.json'),JSON.stringify({status:'PASS',checks,writes,requests:requests.map(x=>({...x,ms:x.ms-requests[0].ms})),trace:state.diagnostics,build,siteIncident:'NOT CONFIRMED',gpu:'NOT RUN'},null,2));console.log(JSON.stringify({status:'PASS',checks}));
}catch(error){await page.screenshot({path:join(qa,'recovery-failure.png')});await writeFile(join(qa,'recovery-failure.json'),JSON.stringify({error:String(error),checks,state:await inspect()},null,2));throw error}
finally{const video=page.video();await context.close();await mkdir(join(qa,'../interaction'),{recursive:true});await video.saveAs(join(qa,'../interaction/ui-v11-recovery.webm'));await browser.close();await h.close()}

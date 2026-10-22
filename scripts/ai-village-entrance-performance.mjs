import {readFile,readdir,mkdir,mkdtemp,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {runPreview} from './ai-village-phase4-browser.mjs'
const root=resolve(import.meta.dirname,'..'),qa=join(root,'packages/ai-village/art/QA/entrance-v1'),base=join(root,'.build/entrance-baseline'),current=join(root,'.build/ai-village-phase4')
await mkdir(qa,{recursive:true});await runPreview({root,pkg:join(base,'source/packages/ai-village'),out:join(base,'preview'),buildOnly:true})
const {harness}=await import(pathToFileURL(join(current,'harness.mjs')))
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const rows=[]
try {for(let sample=0;sample<3;sample++)for(const variant of ['baseline','entrance']){
 const old=variant==='baseline',plugin=await import(pathToFileURL(old?join(base,'runtime/package/lib/index.js'):join(current,'lib/index.js')))
 const h=await harness({profile:await mkdtemp(join(root,'.build/entrance-perf-')),plugin,html:await readFile(join(old?join(base,'preview'):current,'index.html'),'utf8')})
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage()
 try {
  await page.goto(h.entry);const start=Date.now();await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click();await page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady)
  const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));await frame.waitForFunction(()=>window.__sceneMetrics?.().frames>0);const firstPaintObservedMs=Date.now()-start
  if(!old)await page.waitForFunction(()=>!window.__villageHostFixture.inspect().entrance.blocking)
  const enteredMs=Date.now()-start;await page.getByRole('button',{name:'暂停',exact:true}).click();await page.evaluate(()=>window.__villageHostFixture.flush());await page.waitForTimeout(350)
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const read=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])),before=await read(),metrics=await frame.evaluate(()=>window.__sceneMetrics())
  await page.waitForTimeout(3000);const after=await read(),afterMetrics=await frame.evaluate(()=>window.__sceneMetrics())
  rows.push({sample,variant,firstPaintObservedMs,enteredMs,parentHeapBytes:after.JSHeapUsedSize,idleParentCpuPercent:(after.TaskDuration-before.TaskDuration)/3*100,idlePaints:afterMetrics.frames-metrics.frames,textures:metrics.textures,renderer:'SwiftShader'});console.log(JSON.stringify(rows.at(-1)))
 }finally{await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context.close();await h.close()}
}}finally{await browser.close()}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],comparison={}
for(const key of ['firstPaintObservedMs','enteredMs','parentHeapBytes','idleParentCpuPercent']){const before=median(rows.filter(r=>r.variant==='baseline').map(r=>r[key])),after=median(rows.filter(r=>r.variant==='entrance').map(r=>r[key]));comparison[key]={before,after,delta:after-before,percent:before?(after/before-1)*100:null}}
const files=[];for(const name of ['client.js','frame.js']){const before=await readFile(join(base,'runtime/package/lib',name)),after=await readFile(join(current,'lib',name));files.push({name,before:before.length,after:after.length,delta:after.length-before.length,sha256:createHash('sha256').update(after).digest('hex')})}
const manifest=JSON.parse(await readFile(join(root,'packages/ai-village/assets/portraits/manifest.json'),'utf8')),portraits=[]
for(const entry of manifest.files){const bytes=await readFile(join(root,'packages/ai-village/assets',entry.file));portraits.push({key:entry.key,bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)})}
await writeFile(join(qa,'performance.json'),JSON.stringify({baseline:'2fd86da / retained 0.6.3 package',current:'0.6.4 working tree',rows,comparison,files,portraits,newPortraitTransferBytes:portraits.reduce((n,e)=>n+e.bytes,0),portraitDecodedRGBAEstimate:portraits.reduce((n,e)=>n+e.width*e.height*4,0),newArtBytes:0,notes:'Three fresh-context cold samples; successful render observed by polling, not physical display. First-frame receipt adds no renderer. Heap is parent CDP only. Decoded image estimate excludes GPU copies/cache and is NOT measured peak. Real GPU/peak decode memory NOT RUN; one hour DEFERRED.'},null,2))

/** Build, inspect and package the standalone art delivery without touching a DSH profile. */
import { readFile, writeFile, readdir, mkdir, stat, copyFile, cp, mkdtemp } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { build } from 'tsdown'
import sharp from 'sharp'
import * as tar from 'tar'
import ts from 'typescript'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village')
const dir=join(pkg,'art/deliverables/roster-expansion'),qa=join(pkg,'art/QA/roster-expansion'),out=join(root,'.build/roster-expansion')
await mkdir(out,{recursive:true})
await mkdir(join(dir,'sources'),{recursive:true})
await mkdir(join(dir,'prompts'),{recursive:true})
const ids=['seedance','glm','minimax','llama','mistral'], payload=[], findings=[], tiles=[]
const hash=b=>createHash('sha256').update(b).digest('hex')
for(const [row,id] of ids.entries()){
  const base=join(dir,'characters',id),manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'))
  const character=JSON.parse(await readFile(join(base,'character.json'),'utf8')),animations=JSON.parse(await readFile(join(base,'animations.json'),'utf8'))
  assert.equal(manifest.parts.length,16);assert.deepEqual(character.canvas,[1024,1024]);assert.deepEqual(character.feet,[512,952])
  const images={}
  for(const [column,p] of manifest.parts.entries()){
    const bytes=await readFile(join(base,p.file));assert.equal(hash(bytes),p.sha256)
    const meta=await sharp(bytes).metadata();assert.ok(meta.hasAlpha);assert.deepEqual([meta.width,meta.height],p.nativeSize)
    const sourceCrop=await sharp(join(pkg,p.source)).extract(p.crop).ensureAlpha().raw().toBuffer()
    assert.equal(hash(await readFile(join(pkg,p.source))),p.sourceSha256)
    await copyFile(join(pkg,p.source),join(dir,'sources',basename(p.source)))
    const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();assert.deepEqual(raw,sourceCrop,'Native pixels must be unchanged')
    let transparent=0,opaque=0,nearOpaque=0
    for(let i=3;i<raw.length;i+=4){if(raw[i]===0)transparent++;if(raw[i]===255)opaque++;if(raw[i]>=240)nearOpaque++}
    assert.ok(transparent>meta.width*meta.height*.03,`${id}/${p.id}: transparent exterior`)
    assert.ok(nearOpaque>meta.width*meta.height*.1,`${id}/${p.id}: near-opaque artwork`)
    // Connected islands are reported for visual inspection, never silently erased.
    const seen=new Uint8Array(meta.width*meta.height),components=[]
    for(let i=0;i<seen.length;i++)if(!seen[i]&&raw[i*4+3]>=32){
      let count=0;const stack=[i];seen[i]=1
      while(stack.length){const n=stack.pop();count++;const x=n%meta.width,y=Math.floor(n/meta.width)
        for(const next of [x? n-1:-1,x+1<meta.width?n+1:-1,y?n-meta.width:-1,y+1<meta.height?n+meta.width:-1])if(next>=0&&!seen[next]&&raw[next*4+3]>=32){seen[next]=1;stack.push(next)}
      } if(count>32)components.push(count)
    }
    findings.push({id,part:p.id,size:p.nativeSize,transparent,opaque,nearOpaque,components:components.sort((a,b)=>b-a)})
    images[p.file]='data:image/png;base64,'+bytes.toString('base64')
    tiles.push({input:await sharp(bytes).resize(94,120,{fit:'inside'}).toBuffer(),left:column*104+5,top:row*138+6})
  }
  for(const p of character.parts){assert.equal(p.mirror,'never');assert.ok(p.parent===null||character.parts.some(q=>q.id===p.parent));for(const f of [p.file,...Object.values(p.expressions??{})].filter(Boolean))assert.ok(images[f],f)}
  assert.deepEqual(Object.keys(animations.actions).sort(),['dragging','idle','pickup','put_down','walk'])
  for(const clip of Object.values(animations.actions)){assert.ok(clip.duration>0);for(const t of clip.tracks){assert.ok(character.parts.some(p=>p.id===t.part));assert.ok(t.keys.every((k,i)=>Number.isFinite(k.value)&&k.time>=0&&k.time<=clip.duration&&(i===0||k.time>t.keys[i-1].time)))}}
  for(const p of manifest.definitions)assert.equal(hash(await readFile(join(base,p.file))),p.sha256)
  payload.push({id,character,animations,images})
}
await sharp({create:{width:1664,height:690,channels:4,background:'#83898d'}}).composite(tiles).png().toFile(join(qa,'parts-contact.png'))
const previewEntry=join(pkg,'experiments/roster-expansion-preview.ts')
const program=ts.createProgram([previewEntry],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true})
const diagnostics=[...program.getOptionsDiagnostics(),...program.getSyntacticDiagnostics(program.getSourceFile(previewEntry)),...program.getSemanticDiagnostics(program.getSourceFile(previewEntry))]
assert.equal(diagnostics.length,0,ts.formatDiagnostics(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}))
await build({config:false,entry:{preview:previewEntry},outDir:out,format:'esm',platform:'browser',target:'es2022',clean:false,dts:false,minify:true,deps:{alwaysBundle:[/./]},outputOptions:{inlineDynamicImports:true,entryFileNames:'preview.js'}})
const bundle=await readFile(join(out,'preview.js'),'utf8')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>AI 小院 · 五位新居民美术预览</title><style>body{margin:0;background:#e9e5dc;color:#363a38;font:16px system-ui,sans-serif}main{max-width:1280px;margin:32px auto;padding:0 20px}h1{font-size:28px;margin-bottom:8px}p{line-height:1.6}nav{display:flex;gap:12px;flex-wrap:wrap;padding:16px 0}select,button{padding:9px;border:1px solid #bbb4a5;border-radius:8px;background:#fff;color:#333}#stage{background:#f5eee2;border-radius:20px;overflow:hidden}canvas{display:block;width:100%;height:auto}.names{display:grid;grid-template-columns:repeat(5,1fr);text-align:center;padding:18px 0;font-weight:650}small{color:#686b65}a{color:#346757}</style><main><small>AI VILLAGE / ART COLLECTION · 2026.10.23</small><h1>五位新居民 · 美术与动作预览</h1><p>同源纸娃娃渲染器 · 四种表情 · 五段基础动作 · 工作、用餐、坐姿<br><small>独立美术预览；尚未加入游戏居民名单。桌面是检查遮挡用的简化示意。</small></p><nav><label>动作 <select id="action"><option value="idle">待机</option><option value="walk">行走</option><option value="pickup">抓起</option><option value="dragging">拖动</option><option value="put_down">放下</option><option value="work">工作</option><option value="eat">吃饭</option><option value="rest">休息</option></select></label><label>表情 <select id="expression"><option value="auto">随动作</option><option value="neutral">中性</option><option value="happy">开心</option><option value="surprised">惊讶</option><option value="sleepy">困倦</option></select></label><label>高度 <select id="size"><option>216</option><option>128</option><option>108</option><option>96</option></select></label><label>底色 <select id="background"><option value="#f5eee2">米白</option><option value="#ffffff">白色</option><option value="#83898d">灰色</option><option value="#151820">深色</option></select></label><button id="pause">暂停 / Pause</button></nav><div id="stage"></div><div class="names">${ids.map(id=>`<span>${id==='glm'?'GLM':id==='minimax'?'MiniMax':id[0].toUpperCase()+id.slice(1)}</span>`).join('')}</div><p><small>每套包含 16 张透明部件、1024 × 1024 骨架、脚底锚点和动作定义。可直接离线打开本页。</small></p></main><script>window.artPayload=${JSON.stringify(payload).replaceAll('<','\\u003c')};</script><script type="module">${bundle.replaceAll('</script','<\\/script')}</script></html>`
await writeFile(join(dir,'preview.html'),html)
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm')
const playwright=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'));assert.ok(playwright)
const {chromium}=await import(pathToFileURL(join(pnpm,playwright,'node_modules/playwright/index.mjs')).href)
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'));assert.ok(folder)
let executablePath
for(const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe','chrome-win/headless_shell.exe'])if(await stat(join(cache,folder,candidate)).catch(()=>false)){executablePath=join(cache,folder,candidate);break}
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']})
const errors=[],network=[],samples=[]
try{
  const page=await browser.newPage({viewport:{width:1360,height:740},deviceScaleFactor:1})
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())})
  await page.goto(pathToFileURL(join(dir,'preview.html')).href);await page.waitForFunction(()=>window.artReview?.ready)
  for(const action of ['idle','walk','pickup','dragging','put_down','work','eat','rest']){
    for(const t of [0,.2,.4,.6,1.2,3.3]){await page.evaluate(([s,t])=>window.artReview.set(s,t),[action,t]);samples.push(await page.evaluate(()=>window.artReview.metrics()))}
    await page.evaluate(s=>window.artReview.set(s,.4),action);await page.locator('#stage').screenshot({path:join(qa,action+'.png')})
  }
  for(const size of [96,108,128]){await page.evaluate(s=>window.artReview.set('idle',0,s),size);await page.locator('#stage').screenshot({path:join(qa,`size-${size}.png`)})}
  for(const expression of ['neutral','happy','surprised','sleepy']){await page.evaluate(e=>window.artReview.set('idle',0,216,e),expression);await page.locator('#stage').screenshot({path:join(qa,`expression-${expression}.png`)})}
  for(const [name,bg] of [['white','#ffffff'],['grey','#83898d'],['dark','#151820']]){await page.evaluate(b=>window.artReview.set('idle',0,216,'neutral',b),bg);await page.locator('#stage').screenshot({path:join(qa,`alpha-${name}.png`)})}
  await page.evaluate(()=>window.artReview.set('idle',0));await page.screenshot({path:join(qa,'preview-page.png')})
}finally{await browser.close()}
assert.deepEqual(errors,[]);assert.deepEqual(network,[])
await writeFile(join(qa,'validation.json'),JSON.stringify({characters:5,parts:80,basicActions:25,poseSamples:samples.length,offlineNetworkRequests:network,browserErrors:errors,renderer:'Production PaperDoll + samplePose; scene.ts activity geometry; simplified desk occluder',findings,samples},null,2)+'\n')
if(process.argv.includes('--reviewed'))for(const id of ids){const file=join(dir,'characters',id,'manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));manifest.status='art-reviewed';manifest.artReview={reviewer:'assistant',scope:'Native alpha, crop boundaries, expressions, assembly, 96/108/128px and 8 motion/activity previews',evidence:'../../QA/validation.json'};await writeFile(file,JSON.stringify(manifest,null,2)+'\n')}
await cp(qa,join(dir,'QA'),{recursive:true})
for(const name of ['roster-expansion.json','roster-expansion-generation-record.json'])await copyFile(join(pkg,'art/prompts',name),join(dir,'prompts',name))
await copyFile(join(pkg,'THIRD-PARTY-NOTICES.txt'),join(dir,'THIRD-PARTY-NOTICES.txt'))
await copyFile(join(root,'LICENSE'),join(dir,'LICENSE'))
const closure=[]
for(const file of (await readdir(dir,{recursive:true})).sort()){const path=join(dir,file);if(!(await stat(path)).isFile()||file==='SHA256SUMS.json')continue;const bytes=await readFile(path);closure.push({file:file.replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)})}
await writeFile(join(dir,'SHA256SUMS.json'),JSON.stringify(closure,null,2)+'\n')
const archiveDir=join(root,'output/ai-village-roster-expansion-2026-10-23')
await mkdir(archiveDir,{recursive:true})
const archive=join(archiveDir,'ai-village-five-characters-v01.tar.gz')
await tar.c({file:archive,cwd:join(pkg,'art/deliverables'),gzip:true},['roster-expansion'])
const unpacked=await mkdtemp(join(out,'unpack-'))
await tar.x({file:archive,cwd:unpacked})
for(const entry of closure)assert.equal(hash(await readFile(join(unpacked,'roster-expansion',entry.file))),entry.sha256,entry.file)
console.log(JSON.stringify({characters:5,parts:80,poseSamples:samples.length,browserErrors:errors.length,externalRequests:network.length,delivery:dir,archive,archiveSha256:hash(await readFile(archive)),islands:findings.filter(f=>f.components.length>1).map(f=>({id:f.id,part:f.part,components:f.components}))},null,2))

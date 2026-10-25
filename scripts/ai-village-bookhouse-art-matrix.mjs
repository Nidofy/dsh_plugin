/** Candidate-only approval matrix. Reads approved resident bytes and never changes production resources. */
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build} from 'tsdown'
import ts from 'typescript'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),out=join(pkg,'art/deliverables/bookhouse-layered-v02'),qa=join(out,'matrix-v03'),work=join(root,'.build/bookhouse-layered-v02')
await mkdir(qa,{recursive:true});await mkdir(work,{recursive:true})
const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),payload={residents:[],layers:manifest.layers,images:{}},source=[]
for(const layer of manifest.layers){const b=await readFile(join(out,layer.file));assert.equal(hash(b),layer.sha256);payload.images[layer.file]='data:image/png;base64,'+b.toString('base64')}
const courtyard=JSON.parse(await readFile(join(pkg,'assets/scenes/courtyard/manifest.json'),'utf8'))
for(const id of['bluewhale','claude','gemini','gpt','grok','kimi','qwen','seedance','glm','minimax','llama','mistral']){
 const base=join(pkg,'assets/characters',id),character=JSON.parse(await readFile(join(base,'character.json'),'utf8')),animations=JSON.parse(await readFile(join(base,'animations.json'),'utf8')),m=JSON.parse(await readFile(join(base,'manifest.json'),'utf8')),images={}
 for(const part of m.parts){const b=await readFile(join(base,part.file));assert.equal(hash(b),part.sha256);images[part.file]='data:image/png;base64,'+b.toString('base64');source.push({id,file:part.file,sha256:hash(b)})}
 for(const name of['work-left','work-right','rest-pose']){const file=name+'.png',path=id==='bluewhale'?join(pkg,'assets/scenes/courtyard',file):join(base,'parts',file),b=await readFile(path),expected=id==='bluewhale'?courtyard.files.find(f=>f.file===file):m.parts.find(f=>f.file==='parts/'+file);assert.equal(hash(b),expected.sha256);images['activity/'+file]='data:image/png;base64,'+b.toString('base64')}
 payload.residents.push({id,character,animations,images})
}
const entry=join(out,'review-renderer.ts'),program=ts.createProgram([entry],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true}),diagnostics=ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length,0,ts.formatDiagnostics(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}))
await build({config:false,entry:{review:entry},outDir:work,format:'esm',platform:'browser',target:'es2022',clean:false,dts:false,minify:true,deps:{alwaysBundle:[/./]},outputOptions:{inlineDynamicImports:true,entryFileNames:'review.js'}})
const bundle=await readFile(join(work,'review.js'),'utf8')
await writeFile(join(work,'index.html'),`<!doctype html><meta charset="utf-8"><title>Bookhouse candidate matrix</title><style>body{margin:0}#stage,canvas{width:1080px;height:780px;display:block}</style><div id="stage"></div><script>window.artPayload=${JSON.stringify(payload).replaceAll('<','\\u003c')}</script><script type="module">${bundle.replaceAll('</script','<\\/script')}</script>`)
const{source:donor}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(donor,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.')),{chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')).href)
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-')),exe=join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe');await stat(exe)
const browser=await chromium.launch({headless:true,executablePath:exe,args:['--enable-unsafe-swiftshader']}),samples=[],screenshots=[],errors=[],network=[]
try{for(const dpr of[1,2]){const page=await browser.newPage({viewport:{width:1080,height:780},deviceScaleFactor:dpr});page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});await page.goto(pathToFileURL(join(work,'index.html')).href);await page.waitForFunction(()=>window.artReview?.ready)
 for(const station of['bookcase','reading-desk','window-seat','window-seat-rest-proposal'])for(const light of['day','dusk'])for(const theme of['light','dark']){const proposal=station.endsWith('-proposal'),sample=await page.evaluate(args=>window.artReview.set(...args),[proposal?'window-seat':station,light,theme,proposal]);assert.equal(sample.residents.length,12);assert.equal(sample.tickerStarted,false);assert.ok(sample.residents.every(r=>r.feet[0]===sample.anchor.x&&r.feet[1]===sample.anchor.y));const file=station+'-'+light+'-'+theme+'-dpr'+dpr+'.png';await page.locator('#stage').screenshot({path:join(qa,file)});samples.push(sample);screenshots.push({file,sha256:hash(await readFile(join(qa,file))),dpr,proposal})}await page.close()}}finally{await browser.close()}
assert.deepEqual(errors,[]);assert.deepEqual(network,[])
const implementations=[];for(const f of['src/art/paper-doll.ts','src/art/animation.ts','src/core/bookhouse-scene.ts','src/frame/furniture.ts'])implementations.push({file:f,sha256:hash(await readFile(join(pkg,f)))})
await writeFile(join(qa,'validation.json'),JSON.stringify({status:'REVIEW_CANDIDATE_NOT_APPROVED',approvedForRelease:false,scope:'Production PaperDoll/samplePose + candidate layers in isolated Pixi fixture; no world simulation/host/profile. Dusk uses current tint constants; theme affects review mat only. Software WebGL, browser DPR, not native DPI or real GPU acceptance.',mapping:manifest.mapping,layers:manifest.layers,source,implementations,samples,screenshots,browserErrors:errors,externalRequests:network},null,2)+'\n')
console.log(JSON.stringify({screenshots:screenshots.length,residentFurnitureViews:samples.length*12,errors,output:qa},null,2))

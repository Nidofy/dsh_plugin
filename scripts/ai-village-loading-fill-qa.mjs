/** Real production entrance, local authenticated Host, observed DOM only; no synthetic progress. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile, cp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { runPreview } from './ai-village-phase4-browser.mjs'
const root=resolve(import.meta.dirname,'..'),label=process.argv[2]
assert.match(label??'',/^[a-z0-9-]+$/)
const pkg=join(root,'packages/ai-village'),out=join(root,'.build/loading-fill',label),evidence=join(root,'docs/ai-village/loading-fill/qa',label)
await mkdir(evidence,{recursive:false});await mkdir(out,{recursive:true})
await cp(join(pkg,'lib'),join(out,'lib'),{recursive:true});await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true})
await runPreview({root,pkg,out,buildOnly:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.js')))
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const results=[],errors=[]
try {for(const scenario of ['fast','slow-assets','held-first-frame','reduced','skip','close']){
 const profile=join(out,scenario);await mkdir(profile)
 const h=await harness({profile,plugin,html:await readFile(join(out,'index.html'),'utf8')})
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:scenario==='reduced'?'reduce':'no-preference',recordVideo:{dir:join(evidence,scenario),size:{width:960,height:640}}})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 await context.addInitScript(({scenario})=>{
  if(window!==parent){if(scenario==='held-first-frame')window.addEventListener('message',e=>{if(e.data?.type==='render'&&!window.__allowPaint)e.stopImmediatePropagation()});return}
  window.__fillSamples=[]
  const sample=()=>{
   const nodes=[...document.querySelectorAll('.entrance-portrait img+img')]
   if(nodes.length){const state=window.__villageHostFixture.inspect();window.__fillSamples.push({at:performance.now(),clips:nodes.map(n=>n.style.clipPath),imagesReady:nodes.map(n=>n.complete&&n.naturalWidth>0),progress:state.entrance.progress,canReveal:state.entrance.canReveal,phase:state.entrance.phase})}
   window.__fillSampleFrame=requestAnimationFrame(sample)
  };window.__fillSampleFrame=requestAnimationFrame(sample)
 },{scenario})
 await context.route('**/*',async route=>{
  const url=route.request().url();if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:'))return route.abort()
  if(scenario==='slow-assets'&&url.endsWith('/assets/scene/background.png'))await new Promise(resolve=>setTimeout(resolve,1200))
  return route.continue()
 })
 try{
  await page.goto(h.entry);await page.getByRole('button',{name:'打开 AI 小院',exact:true}).click()
  await page.locator('.village-entrance').waitFor()
  if(scenario==='skip')await page.getByRole('button',{name:'跳过动画',exact:true}).click()
  if(scenario==='close'){
   await page.locator('.entrance-actions').getByRole('button',{name:'关闭小院',exact:true}).click()
   await page.waitForTimeout(800);assert.equal(await page.locator('.village-entrance').count(),0)
  }else{
   if(scenario==='held-first-frame'){
    await page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady);await page.waitForTimeout(850)
    const held=await page.evaluate(()=>window.__villageHostFixture.inspect());assert.equal(held.entrance.canReveal,false);assert.equal(held.entrance.blocking,true);assert.equal(held.world.ticks,0)
    await page.locator('.village-card').screenshot({path:join(evidence,'waiting-for-real-frame.png')})
    const frame=page.frames().find(f=>f.url().includes('/api/nidofy-ai-village/frame'));await frame.evaluate(()=>{window.__allowPaint=true})
    // The earlier render was deliberately discarded. A real resize requests a fresh view/ACK.
    await page.setViewportSize({width:1441,height:960})
   }
   if(scenario==='fast')for(const index of [0,3,6]){
    await page.waitForFunction(index=>{const n=document.querySelectorAll('.entrance-portrait img+img')[index];return n&&parseFloat(n.style.clipPath.split(' ')[1])>0&&parseFloat(n.style.clipPath.split(' ')[1])<100},index,{polling:'raf'})
    await page.locator('.entrance-status').screenshot({path:join(evidence,`sequence-${index}.png`)})
   }
   await page.waitForFunction(()=>!window.__villageHostFixture.inspect().entrance.blocking)
   assert.equal((await page.evaluate(()=>window.__villageHostFixture.inspect())).entrance.firstFrame,true)
  }
  const samples=await page.evaluate(()=>{cancelAnimationFrame(window.__fillSampleFrame);return window.__fillSamples}),seen=new Set()
  for(const sample of samples){
   const fills=sample.clips.map(clip=>{const m=/^inset\(0(?:px)? ([\d.]+)% 0(?:px)? 0(?:px)?\)$/.exec(clip);assert.ok(m,clip);return 1-Number(m[1])/100})
   assert.ok(fills.reduce((a,b)=>a+b,0)/7<=sample.progress+1e-6)
   fills.forEach((f,i)=>{if(f>0&&f<1){seen.add(i);assert.ok(fills.slice(0,i).every(x=>x===1));assert.ok(fills.slice(i+1).every(x=>x===0))}})
  }
  if(['fast','slow-assets','held-first-frame'].includes(scenario))assert.deepEqual([...seen],[0,1,2,3,4,5,6])
  results.push({scenario,status:'PASS',seen:[...seen],samples});console.log(scenario+' PASS')
 }catch(error){results.push({scenario,status:'FAIL',error:String(error),samples:await page.evaluate(()=>window.__fillSamples)});await page.screenshot({path:join(evidence,scenario+'-failure.png')});throw error}
 finally{await context.close();await h.close()}
 }}finally{
 await browser.close()
 const sha=p=>readFile(p).then(b=>createHash('sha256').update(b).digest('hex'))
 await writeFile(join(evidence,'validation.json'),JSON.stringify({results,errors,version:JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,overlaySha:await sha(join(pkg,'src/client/EntranceOverlay.tsx')),clientSha:await sha(join(pkg,'lib/client.js')),scope:'Chromium SwiftShader, production source in official authenticated isolated fixture; no art approval change'},null,2)+'\n')
}
assert.deepEqual(errors,[])

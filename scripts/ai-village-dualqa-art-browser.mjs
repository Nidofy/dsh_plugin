import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises'
import {join,resolve,relative} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {source,root,requireTool,sha256} from '../tools/ai-village-dualqa/env.mjs'
const art=resolve(process.argv[2]??join(root,'../dsh_plugin-entrance-art'))
const preview=join(art,'packages/ai-village/art/entrance-v1/preview.html'),before=await sha256(await readFile(preview))
const out=join(root,'packages/ai-village/art/QA/entrance-dual/qa/art-preview');await mkdir(out,{recursive:true})
const pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')))
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1}),errors=[],rows=[],sharp=requireTool('sharp')
page.on('pageerror',e=>errors.push(String(e)))
await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith('data:'))return route.continue();if(!url.startsWith('file:'))return route.abort();const rel=relative(art,fileURLToPath(url));return rel.startsWith('..')?route.abort():route.continue()})
try{
 await page.goto(pathToFileURL(preview).href);await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())))
 for(const [width,height]of [[340,720],[580,720],[1080,760]])for(const theme of ['light','dark']){
  await page.selectOption('#size',width+'×'+height);await page.evaluate(theme=>{document.getElementById('viewport').classList.toggle('dark',theme==='dark')},theme)
  for(const percent of [0,25,50,75,100]){
   await page.evaluate(p=>{document.getElementById('door').value=String(p);draw()},percent)
   const name=width+'x'+height+'-'+theme+'-'+percent+'.png';await page.locator('#viewport').screenshot({path:join(out,name)})
   rows.push({width,height,theme,percent,screenshot:name,status:'CAPTURED',scope:'standalone source art preview, not production integration'})
  }
  const samples=[]
  for(const color of [[13,97,173],[219,43,111]]){
   await page.evaluate(rgb=>document.getElementById('world').style.background='rgb('+rgb.join(',')+')',color)
   const point=await page.evaluate(()=>{const v=document.getElementById('viewport').getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect();return {x:Math.round(s.x-v.x+542.5*s.width/1080),y:Math.round(s.y-v.y+687.5*s.height/1440)}})
   const bytes=await page.locator('#viewport').screenshot(),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true})
   const pixel=[...data.subarray((point.y*info.width+point.x)*4,(point.y*info.width+point.x)*4+3)]
   assert.deepEqual(pixel,color);samples.push({point,color,pixel})
  }
  rows.push({case:'ART05',width,height,theme,samples,status:'PASS'})
  await page.evaluate(()=>document.getElementById('world').style.background='')
 }
 assert.deepEqual(errors,[])
 assert.equal(await sha256(await readFile(preview)),before)
 await writeFile(join(out,'validation.json'),JSON.stringify({previewSHA:before,backend:'Chromium headless / SwiftShader',status:'PASS',scope:'Source preview only; door keyframes CAPTURED require human review',rows,errors},null,2))
 console.log('ART_PREVIEW: 30 keyframe screenshots, 6 two-color aperture checks PASS')
}finally{await browser.close()}

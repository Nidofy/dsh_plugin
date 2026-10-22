import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,mkdtemp,readdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=resolve(import.meta.dirname,'..'),out=join(root,'tools/ai-village-dualqa/.generated/preview'),qa=join(root,'docs/ai-village/entrance-parallel/integration/final-product')
await mkdir(qa,{recursive:true})
const {harness}=await import(pathToFileURL(join(out,'harness.mjs'))),plugin=await import(pathToFileURL(join(out,'lib/index.mjs')))
const h=await harness({profile:await mkdtemp(join(root,'.build/final-product-')),plugin,html:await readFile(join(out,'index.html'),'utf8')})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8')),pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs'))),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--enable-unsafe-swiftshader']})
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[],external=[],checks=[],captures=[]
let refuseUpload=false,uploads=0
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(h.url+'/')&&!url.startsWith('blob:')){external.push(url);return route.abort()}if(url.endsWith('/photo-upload')){uploads++;if(refuseUpload)return route.fulfill({status:413,contentType:'application/json',body:JSON.stringify({error:'PHOTO_TOO_LARGE'})})}return route.continue()})
const inspect=()=>page.evaluate(()=>window.__villageHostFixture.inspect()),click=name=>page.getByRole('button',{name,exact:true}).click(),ready=()=>page.waitForFunction(()=>window.__villageHostFixture.inspect().frameReady&&!window.__villageHostFixture.inspect().entrance.blocking)
const system=async name=>{if(!await page.getByRole('button',{name,exact:true}).isVisible())await click('更多');await click(name)}
const shot=async name=>page.screenshot({path:join(qa,name+'.png')})
try{
 await page.goto(h.entry);await click('打开 AI 小院');await ready();await click('暂停');await page.evaluate(()=>window.__villageHostFixture.flush())
 const frozen=(await inspect()).world
 await page.getByLabel('消息输入',{exact:true}).fill('Final candidate draft — 保留输入')
 const original=await page.locator('.village-canvas iframe').elementHandle()
 await click('打开 Git / Hg 工具');await page.locator('.vcs-floating').waitFor()
 await page.waitForFunction(()=>{const g=document.querySelector('.vcs-floating')?.getBoundingClientRect(),v=document.querySelector('.village-card')?.getBoundingClientRect();return g&&v&&v.top>=g.bottom+10})
 assert.equal(await original.evaluate(el=>el.isConnected),true);await shot('git-village')
 await click('打开 Live2D 伙伴');await page.locator('.live2d-card').waitFor();await page.waitForFunction(()=>!document.querySelector('.village-canvas iframe'));assert.equal(await page.locator('.vcs-floating').count(),1)
 await click('打开 AI 小院');await ready();assert.equal(await page.locator('.live2d-card').count(),0);assert.equal(await page.locator('.vcs-floating').count(),1);assert.deepEqual((await inspect()).world,frozen)
 await page.locator('.vcs-floating').getByRole('button',{name:'关闭',exact:true}).click()
 checks.push('Real Git/Live2D client components: Git above village, Live2D excludes village, return preserves paused world')
 await system('展开小院')
 for(const [width,height]of [[340,720],[580,720],[1080,760]]){
  let vh=height+236;for(let i=0;i<6;i++){await page.setViewportSize({width:width+224,height:vh});await page.waitForTimeout(100);const b=await page.locator('.village-card').boundingBox();if(Math.abs(b.width-width)<1&&Math.abs(b.height-height)<1)break;vh+=Math.round(height-b.height)}
  await ready();await system('拍照');await click('拍摄照片');await page.getByAltText('照片预览',{exact:true}).waitFor()
  const download=page.waitForEvent('download');await click('导出 PNG');const file=join(qa,`photo-${width}.png`);await(await download).saveAs(file);const bytes=await readFile(file);assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960);captures.push(bytes)
  if(width===1080){
   refuseUpload=true;await click('保存到相册');await page.getByRole('alert').waitFor();assert.equal(uploads,1);assert.equal((await inspect()).album?.world.photos.length??0,0);assert.equal(await page.getByAltText('照片预览',{exact:true}).count(),1)
   await click('重新读取相册');await page.waitForTimeout(150);assert.equal(uploads,1);assert.deepEqual((await inspect()).world,frozen);await shot('upload-413-retained')
   refuseUpload=false;await click('保存到相册');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===1);assert.equal(uploads,2);await click('退出拍照')
  }else{await click('返回取景');await click('退出拍照')}
 }
 assert.deepEqual(captures[0],captures[1]);assert.deepEqual(captures[0],captures[2]);checks.push('720x960 PNG bytes identical at 340/580/1080; HTTP413 retains photo and world; read-only reconciliation does not repeat upload; explicit retry saves once')
 await page.reload();await click('打开 AI 小院');await ready();assert.deepEqual((await inspect()).world,frozen)
 await page.getByRole('tab',{name:'手账',exact:true}).click();await click('相册');await page.getByRole('button',{name:'删除照片',exact:true}).waitFor();assert.equal((await inspect()).album.world.photos.length,1)
 await click('删除照片');await click('确认删除照片');await page.waitForFunction(()=>window.__villageHostFixture.inspect().album?.world.photos.length===0);assert.deepEqual((await inspect()).world,frozen);checks.push('Album and paused world survive reload; confirmed photo deletion leaves world unchanged')
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 await writeFile(join(qa,'validation.json'),JSON.stringify({status:'PASS',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),build:JSON.parse(await readFile(join(out,'build.json'),'utf8')),checks,uploads,errors,external,scope:'A execution; real plugin client components with isolated authenticated Village Host; not full Desktop/native GPU verification'},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks}))
}catch(e){await shot('failure');await writeFile(join(qa,'failure.json'),JSON.stringify({error:String(e),checks,state:await inspect()},null,2));throw e}
finally{await page.evaluate(()=>window.__villageHostFixture?.dispose()).catch(()=>{});await context.close();await browser.close();await h.close()}

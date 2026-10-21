/** Real Electron acceptance, using only the generated carrier and synthetic test profile. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const root = resolve(import.meta.dirname, '..'), qa = join(root, '.build/pet-native-qa')
const {source} = JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8'))
const pnpm = join(source,'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {_electron} = await import(pathToFileURL(join(pnpm,name,'node_modules/playwright/index.mjs')).href)
const require = createRequire(join(root,'.build/official-runtime/package.json'))
const {runProfilePnpm} = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href)
const profile = join(qa,'home/profiles/desktop')
// The source fixture is copied as ordinary files; keep its pnpm metadata local too.
const modulesFile=join(profile,'node_modules/.modules.yaml')
const modules=JSON.parse(await readFile(modulesFile,'utf8'))
modules.storeDir=join(qa,'store/v11'); modules.virtualStoreDir=join(profile,'node_modules/.pnpm')
await writeFile(modulesFile,JSON.stringify(modules,null,2)+'\n')
const artifacts = JSON.parse(await readFile(join(root,'dist/manifest.json'),'utf8'))
const pet = artifacts.find(p=>p.name==='@nidofy/dsh-desktop-pets')
const result = await runProfilePnpm({profile:'desktop',dir:profile,home:join(qa,'home'),cwd:qa,installAnchor:require.resolve('@deepseek-ai/dsh/package.json')},
  ['add',join(root,'dist',pet.file),'--offline','--ignore-scripts','--store-dir',join(qa,'store'),'--registry=http://127.0.0.1:9'],
  {execution:'service',command:process.execPath,args:[join(qa,'carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs')],
    env:{CI:'1',COREPACK_ENABLE_NETWORK:'0'},outputBytes:16384,activateNewBundles:true,idleTimeoutMs:30000})
assert.equal(result.exitCode,0,result.output)
const electron = await _electron.launch({executablePath:join(qa,'carrier/DeepSeek Harness.exe'),
  args:['--user-data-dir='+join(qa,'electron-data')],env:{...process.env,DSH_HOME:join(qa,'home')},timeout:60000})
const checks=[]
try {
  await electron.firstWindow()
  let page
  for(let i=0;i<60;i++) {page=electron.windows().find(p=>p.url()==='dsh-app://app/');if(page)break;await new Promise(r=>setTimeout(r,500))}
  assert.ok(page, 'Main workspace: '+electron.windows().map(p=>p.url()).join(', '))
  await page.waitForFunction(()=>window.nidofyPetDesktop?.protocolVersion===1)
  await page.getByRole('button',{name:'Plugins',exact:true}).waitFor({timeout:60000})
  await page.waitForFunction(async()=>{try{const r=await fetch('/api/nidofy-pets/status',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return r.ok&&!!(await r.json()).preferences}catch{return false}})
  const save=edit=>page.evaluate(async edit=>{
    const post=async(method,data)=>{const r=await fetch('/api/nidofy-pets/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error(method+': '+r.status+' '+await r.text());return r.json()}
    const {preferences:p}=await post('status',{});Object.assign(p,edit);return post('preferences',p)
  },edit)
  const nativeRows=()=>electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('/api/nidofy-pets/assets/pet/')).map(w=>({id:w.id,parent:w.getParentWindow()?.id??null,visible:w.isVisible(),alwaysOnTop:w.isAlwaysOnTop(),bounds:w.getBounds()})))
  await save({pets:false})
  for(let i=0;i<50&&(await nativeRows()).length;i++)await page.waitForTimeout(100)
  assert.equal((await nativeRows()).length,0)
  // Use the actual official Settings section and its switch to create native windows.
  await writeFile(join(qa,'initial-ui.txt'),await page.locator('body').innerText())
  await page.getByRole('button',{name:'Account menu',exact:true}).click()
  await page.getByRole('menuitem',{name:'Settings',exact:true}).click()
  await page.getByRole('button',{name:'Desktop pets',exact:true}).click()
  await page.getByRole('switch',{name:'Show pets',exact:true}).click()
  let rows
  for(let i=0;i<100;i++){rows=await nativeRows();if(rows.length&&rows.every(w=>w.visible))break;await page.waitForTimeout(100)}
  assert.ok(rows.length>0&&rows.every(w=>w.visible&&w.parent===null&&w.alwaysOnTop),JSON.stringify(rows))
  assert.equal(await page.locator('[data-nidofy-pet] iframe').count(),0)
  checks.push('Official Settings switch opens visible parentless always-on-top native windows; no embedded overlay')
  const petPage=electron.windows().find(p=>p.url().includes('/api/nidofy-pets/assets/pet/'))
  await petPage.waitForFunction(()=>{const c=document.querySelector('canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)})
  await petPage.screenshot({path:join(qa,'native-pet.png'),omitBackground:true})
  await page.screenshot({path:join(qa,'native-pet-settings.png')})
  await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='dsh-app://app/').minimize())
  await new Promise(r=>setTimeout(r,350))
  assert.ok((await nativeRows()).every(w=>w.visible))
  checks.push('Native pet renders actual sprite pixels and remains visible when the DSH main window is minimized')
  await electron.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='dsh-app://app/').restore())
  await page.getByRole('switch',{name:'Show pets',exact:true}).click()
  for(let i=0;i<50&&(await nativeRows()).length;i++)await page.waitForTimeout(100)
  assert.equal((await nativeRows()).length,0)
  for(let cycle=0;cycle<3;cycle++){
    await page.getByRole('switch',{name:'Show pets',exact:true}).click()
    for(let i=0;i<100;i++){if((await nativeRows()).some(w=>w.visible))break;await page.waitForTimeout(100)}
    assert.equal((await nativeRows()).length,1)
    await page.getByRole('switch',{name:'Show pets',exact:true}).click()
    for(let i=0;i<50&&(await nativeRows()).length;i++)await page.waitForTimeout(100)
    assert.equal((await nativeRows()).length,0)
  }
  checks.push('Global off destroys windows immediately; three repeated on/off cycles leave no orphan windows')
  await mkdir(join(root,'dist'),{recursive:true})
  await writeFile(join(qa,'validation.json'),JSON.stringify({passed:true,plugin:pet.version,sha256:pet.sha256,checks},null,2)+'\n')
  console.log(JSON.stringify(checks,null,2))
} catch(error) {
  for(const [i,page]of electron.windows().entries()) {await writeFile(join(qa,`failure-${i}.txt`),await page.locator('body').innerText().catch(()=>page.url()));await page.screenshot({path:join(qa,`failure-${i}.png`)}).catch(()=>{})}
  throw error
} finally { await electron.close() }

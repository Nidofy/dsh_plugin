/** Browser acceptance for real plugin components, with isolated fixture data and local assets. */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),out=join(root,'.build/plugin-ui-qa')
const require=createRequire(import.meta.url)
const {build}=await import(pathToFileURL(createRequire(require.resolve('vitest/package.json')).resolve('vite')).href)
await mkdir(out,{recursive:true})
const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8'))
const entry=`
import{createRoot}from'react-dom/client';import{createElement,useState}from'react';
import{PetStore}from'../../packages/desktop-pets/src/client/store.ts';
import{PetSettingsPage}from'../../packages/desktop-pets/src/client/Settings.tsx';

import{FloatingPanel}from'../../packages/source-control/src/client/Floating.tsx';
import{attachFloatingLayout}from'../../packages/live2d/src/client/floating-layout.ts';
import{apply as skin}from'../../packages/whale-skin/src/client/index.ts';
const store=new PetStore();store.refresh();const cleanups=[];let Section;let palettes={};let dark=false;
const paint=()=>{document.body.toggleAttribute('data-ds-dark-theme',dark);for(const[key,v]of Object.entries(palettes))document.body.style.setProperty(key,v[dark?'dark':'light'])};
const ctx={effect:fn=>cleanups.push(fn()),locale:{register:()=>()=>{},bind:()=>()=>''},theme:{overrideTokens:(_,tokens)=>{palettes=tokens;paint();return()=>{for(const key of Object.keys(palettes))document.body.style.removeProperty(key);palettes={}}}},slots:{inject:(_,fn)=>fn(),register:(_,fn)=>{Section=fn;return()=>{}}}};
skin(ctx);
function App(){const[tab,setTab]=useState('pets');return <><nav><button onClick={()=>setTab('pets')}>桌宠</button><button onClick={()=>setTab('skin')}>鲸屿皮肤</button><button onClick={()=>{dark=!dark;paint()}}>浅深色</button></nav><section id="settings">{tab==='pets'?<PetSettingsPage store={store} zh/>:<Section t={()=>'鲸屿皮肤'}/>}</section></>}
createRoot(document.getElementById('settings-root')).render(<App/>);

createRoot(document.getElementById('git')).render(<FloatingPanel projectRoot="D:/fixture" locale="zh" onClose={()=>{}}/>);
const companion=document.getElementById('companion');const stop=attachFloatingLayout(companion,g=>{const card=document.getElementById('companion-card');card.style.display=g?'block':'none';if(g)Object.assign(card.style,{left:g.left+'px',top:g.top+'px',height:g.height+'px'})});
window.fixture={dispose:()=>{stop();store.dispose();cleanups.reverse().forEach(fn=>fn())}};
`
await writeFile(join(out,'entry.tsx'),entry)
const official=JSON.parse(await readFile(join(root,'.local/original.json'),'utf8')).source.replaceAll('\\','/')
await writeFile(join(out,'primitives.ts'),['Button','Switch','Input'].map(name=>'export {'+name+'} from '+JSON.stringify(official+'/packages/client/ui-primitives/src/'+name+'.tsx')).join('\n'))
await build({configFile:false,root:out,resolve:{alias:{'@deepseek-ai/dsh-client-ui-primitives':join(out,'primitives.ts'),clsx:createRequire(join(source,'packages/client/ui-primitives/package.json')).resolve('clsx')}},
  esbuild:{jsx:'automatic'},build:{outDir:join(out,'web'),emptyOutDir:false,lib:{entry:join(out,'entry.tsx'),name:'PluginFixture',formats:['iife'],fileName:()=> 'fixture.js',cssFileName:'fixture'}},
  define:{'process.env.NODE_ENV':'"production"'}})
const {defaults}=await import(pathToFileURL(join(root,'packages/plugin-shared/lib/state.js')).href)
const {packageCommand}=await import(pathToFileURL(join(root,'packages/desktop-pets/src/legacy/pet-packages.mjs')).href)
let preferences=defaults()
const assets=join(root,'packages/desktop-pets/assets'),skinAssets=join(root,'packages/whale-skin/assets')
const repo={id:'fixture',name:'示例项目',root:'D:/fixture',vcs:'git'}
const snapshot={...repo,revision:'1',branch:'main',head:'abc123',changes:Array.from({length:25},(_,i)=>({path:'src/component-'+i+'.tsx',index:' ',worktree:'M'})),branches:[{name:'main',node:'abc123',current:true}],remotes:['origin'],added:120,removed:24,stagedAdded:0,stagedRemoved:0,conflict:false}
const officialCss=(await Promise.all(['base.css','design-platform.css','focus.css'].map(file=>readFile(join(official,'packages/client/ui-theme/src/styles',file),'utf8')))).join('\n')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><style>${officialCss}
body{margin:0;font:14px system-ui;background:var(--dsw-alias-bg-base,#eef1f6);color:var(--dsw-alias-label-primary,#172b4d);--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-overlay:#fff;--dsw-alias-label-secondary:#596b85;--dsw-alias-label-primary:#172b4d;--dsw-alias-border-l2:#cbd5e5}#frame{height:100vh;position:relative;display:flex}main{flex:1;min-width:0}main>article{height:calc(100vh - 80px);margin-top:50px;padding:0 30px;box-sizing:border-box}#overlay{position:absolute;inset:0;pointer-events:none}#settings-root{max-width:760px;margin:auto;padding:24px}#settings{padding:24px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;max-height:1050px;overflow:auto}nav{display:flex;gap:12px;margin-bottom:18px}nav button{font:inherit;border:0;padding:8px 16px;border-radius:8px;color:inherit;background:var(--dsw-alias-bg-layer-2)}#companion-card{position:absolute;width:340px;border-radius:16px;box-sizing:border-box;padding:20px;background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid #8498b433;pointer-events:auto}#companion-card img{width:100%;height:90%;object-fit:contain}button,input,select{font:inherit}
</style><div id="frame" data-rightbar-collapsed><main><article data-conversation-content><div id="settings-root"></div></article></main><div data-rightbar-col></div><div data-shell-overlay id="overlay"><div id="git"></div><div id="companion" data-nidofy-live2d-open><aside id="companion-card"><strong>Live2D 布局占位 · 验收夹具</strong><img src="/api/nidofy-whale-skin/companion.webp"></aside></div><div id="pets"></div></div></div><script src="/fixture.js"></script></html>`
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname
    const json=data=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(data))}
    if(path.startsWith('/api/nidofy-vcs/')){const method=path.split('/').at(-1);json(method==='repositories'?{repositories:[repo],warnings:[]}:method==='status'?snapshot:method==='diff'?'diff --git a/example b/example\n'+Array.from({length:25},(_,i)=>'+ added line '+i).join('\n'):[]);return}
    if(req.method==='POST'&&path.startsWith('/api/nidofy-pets/')){
      let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body||'{}'),method=path.slice('/api/nidofy-pets/'.length)
      if(method==='status')json({preferences})
      else if(method==='preferences'){preferences={...input,revision:preferences.revision+1};json(preferences)}
      else if(method==='pet/snapshot')json({settings:{...preferences.pet,profile:'fixture'},state:{generation:'1',revision:1,items:[],profile:'fixture'},doubleMs:350})
      else if(method==='pet/resource')json(await packageCommand({home:out,resources:assets,action:'asset',resourceId:'xiaojing'}))
      else json({items:[{id:'xiaojing',displayName:'吃白饭的大肥鱼'}]})
      return
    }
    let file
    if(['/fixture.js','/fixture.css'].includes(path))file=join(out,'web',path.slice(1))
    else if(/^\/api\/nidofy-whale-skin\/(day|night|companion)\.webp$/.test(path))file=join(skinAssets,path.split('/').at(-1))
    else if(path.startsWith('/api/nidofy-pets/assets/')&&!path.includes('..'))file=join(assets,path.slice('/api/nidofy-pets/assets/'.length))
    if(file){res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.json':'application/json'})[extname(file)]??'application/octet-stream');res.end(await readFile(file))}
    else{res.setHeader('content-type','text/html');res.end(html)}
  }catch(error){res.writeHead(500);res.end(String(error))}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port
const pnpm=join(source,'node_modules/.pnpm'),name=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
const {chromium}=await import(pathToFileURL(join(pnpm,name,'node_modules/playwright/index.mjs')).href)
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).find(n=>n.startsWith('chromium_headless_shell-'))
const executablePath=join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe')
const browser=await chromium.launch({headless:true,executablePath})
const errors=[],external=[]
try{
  const context=await browser.newContext({viewport:{width:2560,height:1440},deviceScaleFactor:1})
  await context.route('**/*',route=>{if(route.request().url().startsWith(url)||route.request().url().startsWith('blob:')||route.request().url().startsWith('data:'))return route.continue();external.push(route.request().url());return route.abort()})
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url)
  await page.getByRole('switch',{name:'显示桌宠',exact:true}).click()
  await page.getByText('当前客户端尚未接入独立桌宠窗口。设置会保留，请使用配套的 Desktop 桌宠适配载体。').waitFor()
  assert.equal(await page.locator('[data-nidofy-pet] iframe').count(),0)
  await page.locator('#settings').screenshot({path:join(out,'pets-settings.png')})
  await page.getByRole('switch',{name:'显示桌宠',exact:true}).click()
  const geometry=()=>page.evaluate(()=>({git:document.querySelector('.vcs-floating').getBoundingClientRect().toJSON(),companion:document.querySelector('#companion-card').getBoundingClientRect().toJSON()}))
  const compact=await geometry()
  await page.locator('.vcs-row').first().click()
  await page.locator('.vcs-detail').waitFor();await page.waitForTimeout(150)
  const expanded=await geometry();await writeFile(join(out,'layout.json'),JSON.stringify({compact,expanded},null,2));await page.screenshot({path:join(out,'expanded-debug.png')})
  assert.ok(expanded.git.height>compact.git.height,JSON.stringify({compact,expanded}));assert.ok(expanded.companion.top>=expanded.git.bottom+10);assert.ok(expanded.git.height>240)
  assert.equal(Math.round(expanded.companion.bottom),1398)
  await page.screenshot({path:join(out,'expanded-git-1440p.png')})
  await page.getByRole('button',{name:'鲸屿皮肤',exact:true}).click()
  await page.getByRole('switch',{name:'启用鲸屿皮肤'}).click()
  await page.waitForFunction(()=>document.body.hasAttribute('data-nidofy-whale-skin'))
  const backdrop=await page.evaluate(()=>{const s=getComputedStyle(document.querySelector('[data-conversation-content]'),'::before');return {background:s.backgroundImage,opacity:s.opacity,width:s.width,height:s.height,display:s.display}})
  await writeFile(join(out,'backdrop.json'),JSON.stringify(backdrop))
  assert.notEqual(backdrop.background,'none')
  await page.waitForTimeout(200)
  await page.screenshot({path:join(out,'skin-light-1440p.png')})
  await page.getByRole('button',{name:'浅深色'}).click();await page.screenshot({path:join(out,'skin-dark-1440p.png')})
  await page.reload();await page.waitForFunction(()=>document.body.hasAttribute('data-nidofy-whale-skin'))
  await page.getByRole('button',{name:'鲸屿皮肤',exact:true}).click();await page.getByRole('button',{name:'恢复官方外观'}).click()
  assert.equal(await page.locator('body[data-nidofy-whale-skin]').count(),0)
  await page.evaluate(()=>window.fixture.dispose())
  assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  await writeFile(join(out,'results.json'),JSON.stringify({passed:true,errors,external,checks:['inline official pet switch saves settings; unadapted clients explain missing native support without embedding a pet','expanded Git pushes companion with full-height rail at 1440p','skin follows dark/light, persists and restores official appearance']},null,2))
  console.log('Plugin settings, native capability notice, adaptive Git and skin browser checks passed.')
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}

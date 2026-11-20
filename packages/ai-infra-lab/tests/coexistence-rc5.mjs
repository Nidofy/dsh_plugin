import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { carrier, launchBrowser, official, pkg } from './browser-runtime.mjs'

const build=join(pkg,'.build')
await mkdir(build,{recursive:true})
// On Windows a native module's DLL remains loaded until its process exits.
if (process.argv[2] !== '--isolated-child') {
  const temporary=await mkdtemp(join(build,'coexistence-'))
  try {
    execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--isolated-child',temporary],
      {cwd:pkg,windowsHide:true,stdio:'inherit',timeout:180000})
    const report=await readFile(join(temporary,'verified.json'),'utf8')
    const {version}=JSON.parse(await readFile(join(pkg,'package.json'),'utf8'))
    await writeFile(join(build,'coexistence-v'+version+'.json'),report)
  } finally { await rm(temporary,{recursive:true,force:true,maxRetries:2,retryDelay:150}) }
  process.exit(0)
}
const stage=process.argv[3]
const home=join(stage,'home'), profile=join(home,'profiles/qualification')
const originalCwd=process.cwd()
process.env.DSH_HOME=home
process.env.DSH_TELEMETRY_DISABLED='1'
const installed = createRequire(join(profile,'package.json'))
const officialImport=id=>import(pathToFileURL(official.resolve(id)).href)
const hash=(bytes,alg='sha256')=>createHash(alg).update(bytes).digest('hex')
const manifest=JSON.parse(await readFile(join(pkg,'package.json'),'utf8'))
const distribution=join(carrier,'dist')
const delivery=JSON.parse(await readFile(join(distribution,'desktop-rc5-manifest.json'),'utf8'))
const packages=['@nidofy/dsh-runtime-adapter','@nidofy/dsh-working-notebook','@nidofy/dsh-source-control',
  '@nidofy/dsh-ai-village','@local/dsh-doc-pipeline','dsh-plugin-learn',manifest.name]
const receipts=[]
const expectedHosts=['nidofy-runtime-jsonl','nidofy-working-notebook','nidofy-source-control','nidofy-ai-village','doc-pipeline','learn','learn-ui','ai-infra-lab']

// Learn's four registry dependencies are not bundled. Pin the registry bytes and
// read only their content-addressed npm cache objects (or the supplied offline kit).
const pinned=[
  ['argparse','2.0.1','8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q=='],
  ['js-yaml','4.3.2','SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA=='],
  ['nodemailer','7.0.13','PNDFSJdP+KFgdsG3ZzMXCgquO7I6McjY2vlqILjtJd0hy8wEvtugS9xKRF2NWlPNGxvLCXlTNIae4serI7dinw=='],
  ['zod','4.4.3','ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ=='],
]
async function dependencyOverrides() {
  const cache=process.env.npm_config_cache ?? (process.platform==='win32'?join(process.env.LOCALAPPDATA,'npm-cache'):join(homedir(),'.npm'))
  const dir=join(stage,'registry-tarballs')
  await mkdir(dir)
  const rows=[]
  for(const [name,version,integrity] of pinned) {
    const digest=Buffer.from(integrity,'base64').toString('hex'), filename=name+'-'+version+'.tgz'
    const source=process.env.OFFLINE_REGISTRY_TARBALLS ? join(process.env.OFFLINE_REGISTRY_TARBALLS,filename) :
      join(cache,'_cacache/content-v2/sha512',digest.slice(0,2),digest.slice(2,4),digest.slice(4))
    const bytes=await readFile(source)
    assert.equal(hash(bytes,'sha512'),digest,filename)
    await writeFile(join(dir,filename),bytes)
    rows.push('  '+name+': '+JSON.stringify('file:'+join(dir,filename).replaceAll('\\','/')))
  }
  return rows.join('\n')
}

// Observe the official browser Loader passed to its own start method. All real
// factories, plugin fibers, transport, renderer and registrations run unmodified.
function observeLoader() {
  let facade
  Object.defineProperty(window,'__ModuleLoader__',{configurable:true,get:()=>facade,set(value){
    facade=value
    const create=facade.create
    facade.create=function(options) {
      const modules=create.call(this,options)
      const start=modules.entries.start
      modules.entries.start=function(loader,...args){
        window.qualificationSnapshot=()=>({
          states:[...loader.entries()].map(e=>[e.options.name,e.fiber?.state]),
          slots:Object.fromEntries(['main','sidebar.panellist','settings.section','shell.overlay'].map(name=>[name,
            loader.ctx.root.get('slots').entries(name).map(({options})=>({id:options.id??options.key,order:options.order}))])),
        })
        return start.call(this,loader,...args)
      }
      return modules
    }
  }})
}
let browser, running
try {
  process.chdir(stage)
  assert.equal(official('@deepseek-ai/dsh/package.json').version,delivery.dsh)
  assert.equal(delivery.dsh,'0.2.1-rc.5')
  assert.equal(delivery.artifacts.length,6)
  const files=[]
  for(const item of delivery.artifacts) {
    const path=join(distribution,item.file)
    assert.equal(hash(await readFile(path)),item.sha256,item.file)
    files.push(path)
  }
  files.push(join(pkg,manifest.name+'-'+manifest.version+'.tgz'))
  await mkdir(profile,{recursive:true})
  const profileJson=join(profile,'package.json')
  await writeFile(profileJson,JSON.stringify({name:'seven-plugin-qualification',private:true,type:'module',dependencies:{},
    dsh:{profile:{bundles:[]}}}))
  await writeFile(join(profile,'pnpm-workspace.yaml'),'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\noverrides:\n'+await dependencyOverrides()+'\n')
  await writeFile(join(profile,'cordis.patch.yml'),'- id: web-runtime\n  config:\n    openBrowser: false\n    printUrl: false\n    surfaceContext: true\n')
  const {runProfilePnpm}=await officialImport('@deepseek-ai/dsh-plugin-manager/operations')
  const pnpm=process.env.PNPM_CLI ?? join(carrier,'.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs')
  const result=await runProfilePnpm({profile:'qualification',dir:profile,home,cwd:stage,installAnchor:official.resolve('@deepseek-ai/dsh/package.json')},
    ['add',...files,'--offline','--ignore-scripts','--store-dir',join(stage,'empty-store'),'--registry=http://127.0.0.1:9'],
    {execution:'service',command:process.execPath,args:[pnpm],env:{CI:'1',COREPACK_ENABLE_NETWORK:'0'},outputBytes:12000,activateNewBundles:false,idleTimeoutMs:60000})
  assert.equal(result.exitCode,0,result.output)
  const peers=join(carrier,'.build/official-runtime-rc5/node_modules/@deepseek-ai')
  const localPeers=join(profile,'node_modules/@deepseek-ai')
  await mkdir(localPeers,{recursive:true})
  for(const name of await readdir(peers)) {
    if(!existsSync(join(localPeers,name))) await symlink(join(peers,name),join(localPeers,name),'junction')
  }
  const boot=await officialImport('@deepseek-ai/dsh-app-boot')
  for(const id of packages) {
    const descriptor=JSON.parse(await readFile(installed.resolve(id+'/package.json'),'utf8'))
    assert.equal(boot.evaluatePluginCompatibility(descriptor,{}),undefined,id)
    await import(pathToFileURL(installed.resolve(id)).href)
    receipts.push({id,version:descriptor.version,web:!!descriptor.dsh?.client})
  }
  const contents=JSON.parse(await readFile(profileJson,'utf8'))
  assert.deepEqual(Object.keys(contents.dependencies).sort(),[...packages].sort())
  contents.dsh.profile.bundles=['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app',...packages]
  await writeFile(profileJson,JSON.stringify(contents))
  console.log('PASS seven installed tarballs, pinned offline dependencies and rc.5 compatibility')
  const {runProfile}=await officialImport('@deepseek-ai/dsh/profile-boot')
  running=await runProfile({environment:boot.loadLayeredEnv('dsh'),profile:'qualification',patchFiles:[],
    args:['--no-open','--host','127.0.0.1','--port','0']})
  const {ctx}=running
  const active=ctx.fiber.state
  await ctx.loader.await()
  const status=new Map([...ctx.loader.entries()].map(e=>[e.options.id,e.fiber?.state]))
  for(const id of expectedHosts) assert.equal(status.get(id),active,'Host '+id)
  assert.notEqual(status.get('session-persistence-jsonl'),active,'duplicate JSONL writer')
  const origin=ctx.webServer.getOrigin()
  const url=ctx.connection.authenticatedUrl(origin)
  browser=await launchBrowser()
  const page=await browser.newPage({locale:'en-US',viewport:{width:1280,height:800}})
  const pageErrors=[]
  page.on('pageerror',e=>pageErrors.push(e.message))
  await page.addInitScript(observeLoader)
  await page.goto(url)
  const clients=receipts.filter(r=>r.web).map(r=>r.id)
  assert.equal(clients.length,5)
  try {
    await page.waitForFunction(({clients,active})=>{
      try { const states=new Map(window.qualificationSnapshot().states);return clients.every(id=>states.get(id)===active) }
      catch {return false}
    },{clients,active},{timeout:45000})
  } catch(error) {
    throw Error('Client activation: '+(await page.locator('body').innerText()).slice(-2200)+' '+pageErrors.join(' '),{cause:error})
  }
  const view=await page.evaluate(()=>window.qualificationSnapshot())
  for(const slot of ['main','sidebar.panellist']) {
    assert.equal(view.slots[slot].filter(entry=>entry.id==='ai-infra-lab').length,1,slot)
  }
  const sidebar=view.slots['sidebar.panellist']
  assert.deepEqual(sidebar.filter(e=>e.order===17).map(e=>e.id),['ai-infra-lab'],'sidebar order collision')
  assert.ok(view.slots['settings.section'].some(e=>e.id==='nidofy-notebook'))
  assert.ok(view.slots['settings.section'].some(e=>e.id==='nidofy-source-control'))
  assert.ok(view.slots['shell.overlay'].some(e=>e.id==='nidofy-ai-village-launcher'))
  assert.ok(sidebar.some(e=>e.id==='learn'))
  const routes=await page.evaluate(async()=>{
    const request=async(path,body)=>{
      const res=await fetch('/api/'+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      if (!res.ok) throw Error(path+' '+res.status)
      return res.json()
    }
    return {lab:(await request('ai-infra-lab/rpc',{method:'overview',args:[]})).catalog.version,
      notebook:(await request('nidofy-notebook/settings',{})).mode,
      repositories:(await request('nidofy-vcs/repositories',{})).repositories,village:(await request('nidofy-ai-village/state')).profileId}
  })
  const catalog=JSON.parse(await readFile(join(pkg,'content/catalog.json'),'utf8'))
  assert.equal(routes.lab,catalog.version)
  assert.equal(routes.notebook,'enhanced')
  assert.ok(Array.isArray(routes.repositories))
  assert.ok(routes.village)
  assert.deepEqual(pageErrors,[])
  await writeFile(join(stage,'verified.json'),JSON.stringify({dsh:delivery.dsh,packages:receipts,
    hostRows:expectedHosts,clients,sidebar,registryDependencies:pinned.map(([name,version])=>({name,version})),
    routes:{lab:routes.lab,notebook:routes.notebook,repositories:routes.repositories.length,village:true},pageErrors},null,2))
  console.log('PASS official Cordis profile: '+expectedHosts.length+' active Host rows, '+clients.length+' active browser clients, four distinct HTTP routes, sidebar order 17')
} finally {
  await browser?.close()
  await running?.shutdown.shutdown(0)
  process.chdir(originalCwd)
}

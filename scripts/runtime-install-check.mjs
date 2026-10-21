/** Exercise the exact package-operation service used by official local-file imports, without elevation. */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, join, delimiter } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),stage=await mkdtemp(join(root,'.build/runtime-install-'))
const elevated=spawnSync('powershell',['-NoProfile','-Command','[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'],{encoding:'utf8',windowsHide:true})
assert.equal(elevated.stdout.trim(),'False','This check must run without administrator elevation')
const require=createRequire(join(root,'.build/official-runtime/package.json'))
const {runProfilePnpm}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href)
const manifest=JSON.parse(await readFile(join(root,'dist/manifest.json'),'utf8'))
const pnpm=[process.env.PNPM_CLI,join(root,'.build/ai-village-phase5/carrier/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs'),
  ...process.env.PATH.split(delimiter).flatMap(p=>[join(p,'node_modules/pnpm/bin/pnpm.mjs'),join(p,'node_modules/pnpm/bin/pnpm.cjs')])].filter(Boolean).find(existsSync)
assert.ok(pnpm,'PNPM_CLI must name the installed pnpm entry')
await writeFile(join(stage,'package.json'),JSON.stringify({name:'permission-qualification',private:true,dependencies:{},dsh:{bundles:[]}}))
await writeFile(join(stage,'pnpm-workspace.yaml'),'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
const results=[]
const installOrder=process.argv.includes('--notebook-first')
  ? ['desktop-pets','working-notebook','runtime-adapter']
  : ['desktop-pets','runtime-adapter','working-notebook']
for(const name of installOrder) {
  const artifact=manifest.find(p=>p.name==='@nidofy/dsh-'+name)
  if(name==='runtime-adapter' && process.argv.includes('--failed-first-attempt')) {
    // Model an interrupted import with unpacked dependencies but no completion marker,
    // plus the two foreign staging directories named by the reported pnpm warning.
    const partial=join(stage,'node_modules',artifact.name)
    await mkdir(partial,{recursive:true})
    await tar.x({file:join(root,'dist',artifact.file),cwd:partial,strip:1})
    await unlink(join(partial,'package.json'))
    for(const id of ['runtime-adapter','working-notebook']) {
      const residue=join(stage,`node_modules/@nidofy/dsh-${id}_tmp_9716_2`)
      await mkdir(join(residue,'node_modules'),{recursive:true})
      await writeFile(join(residue,'package.json'),JSON.stringify({name:`@nidofy/dsh-${id}`,version:artifact.version}))
    }
  }
  const result=await runProfilePnpm({profile:'qualification',dir:stage,home:join(stage,'home'),cwd:root,
    installAnchor:require.resolve('@deepseek-ai/dsh/package.json')},
  ['add',join(root,'dist',artifact.file),'--offline','--ignore-scripts','--store-dir',join(stage,'store'),'--registry=http://127.0.0.1:9'],
  {execution:'service',command:process.execPath,args:[pnpm],env:{CI:'1',COREPACK_ENABLE_NETWORK:'0'},outputBytes:16384,activateNewBundles:false,idleTimeoutMs:30000})
  assert.equal(result.exitCode,0,result.output)
  results.push({name:artifact.name,version:artifact.version,sha256:artifact.sha256,exitCode:result.exitCode})
  // The next install runs while a native plugin is loaded, as in an active Desktop profile.
  if(name!=='runtime-adapter')assert.equal(createRequire(join(stage,'node_modules',artifact.name,'package.json'))('koffi').sizeof('int'),4)
}
// Fresh installs do not exercise pnpm's merge of an existing embedded node_modules.
// Change the package version AND a file, so this cannot pass as "Already up to date".
const upgrades=[]
for(const scenario of ['auto','copy','same-version']) for(const name of ['runtime-adapter','working-notebook']) {
  const method=scenario==='same-version'?'auto':scenario
  const artifact=manifest.find(p=>p.name==='@nidofy/dsh-'+name)
  const installed=join(stage,'node_modules',artifact.name)
  assert.equal(createRequire(join(installed,'package.json'))('koffi').sizeof('int'),4)
  const update=join(stage,`upgrade-${name}-${scenario}`)
  await mkdir(update)
  await tar.x({file:join(root,'dist',artifact.file),cwd:update})
  const pkgPath=join(update,'package/package.json'),pkg=JSON.parse(await readFile(pkgPath,'utf8'))
  if(scenario==='same-version') pkg.version=JSON.parse(await readFile(join(installed,'package.json'),'utf8')).version
  else pkg.version+=`-qualification.${method==='auto'?1:2}`
  await writeFile(pkgPath,JSON.stringify(pkg,null,2)+'\n')
  await writeFile(join(update,'package/UPGRADE-QUALIFICATION.txt'),scenario)
  const archive=join(update,'upgrade.tgz')
  await tar.c({file:archive,cwd:update,gzip:true},['package'])
  const result=await runProfilePnpm({profile:'qualification',dir:stage,home:join(stage,'home'),cwd:root,
    installAnchor:require.resolve('@deepseek-ai/dsh/package.json')},
  ['add',archive,'--offline','--ignore-scripts',`--package-import-method=${method}`,'--store-dir',join(stage,'store'),'--registry=http://127.0.0.1:9'],
  {execution:'service',command:process.execPath,args:[pnpm],env:{CI:'1',COREPACK_ENABLE_NETWORK:'0'},outputBytes:16384,activateNewBundles:false,idleTimeoutMs:30000})
  assert.equal(result.exitCode,0,result.output)
  assert.equal(JSON.parse(await readFile(join(installed,'package.json'),'utf8')).version,pkg.version)
  assert.equal(await readFile(join(installed,'UPGRADE-QUALIFICATION.txt'),'utf8'),scenario)
  upgrades.push({name:artifact.name,sourceSha256:artifact.sha256,scenario,method,version:pkg.version,exitCode:result.exitCode})
}
const packageManager=spawnSync(process.execPath,[pnpm,'--version'],{cwd:stage,encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,COREPACK_ENABLE_NETWORK:'0'}})
assert.equal(packageManager.status,0,packageManager.stderr)
await writeFile(join(root,'dist/runtime-install-validation.json'),JSON.stringify({passed:true,elevated:false,offline:true,
  officialService:'DSH 0.2.1-rc.2 runProfilePnpm',node:process.version,packageManager:'pnpm '+packageManager.stdout.trim(),
  failedFirstAttempt:process.argv.includes('--failed-first-attempt'),installOrder,results,upgrades},null,2)+'\n')
console.log('Non-administrator official import and 6 reimports passed with pnpm '+packageManager.stdout.trim()+'.')

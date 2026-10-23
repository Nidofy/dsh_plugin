import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,mkdir,readdir,symlink} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {join,resolve,dirname,delimiter} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),manifest=JSON.parse(await readFile(join(root,'dist/manifest.json'),'utf8')),item=manifest.find(p=>p.name==='@nidofy/dsh-ai-village')
assert.ok(item)
const archive=join(root,'dist',item.file),digest=createHash('sha256').update(await readFile(archive)).digest('hex');assert.equal(digest,item.sha256)
const entries=[];await tar.t({file:archive,onReadEntry:e=>{entries.push(e.path);assert.ok(!e.path.includes('..'));assert.ok(!['SymbolicLink','Link'].includes(e.type),'No dependency escape links')}})
assert.ok(!entries.some(p=>/^package\/(experiments|scripts|src|\.local|\.build)\//.test(p)))
const stage=await mkdtemp(join(root,'.build/entrance-package-')),store=join(stage,'empty-store');await mkdir(store)
await writeFile(join(stage,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{[item.name]:'file:'+archive.replaceAll('\\','/')}}))
await writeFile(join(stage,'pnpm-workspace.yaml'),'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
const pnpm=[process.env.PNPM_CLI,...process.env.PATH.split(delimiter).flatMap(p=>[join(p,'node_modules/pnpm/bin/pnpm.cjs'),join(p,'node_modules/pnpm/bin/pnpm.mjs'),resolve(p,'../../node/node_modules/pnpm/bin/pnpm.mjs')])].find(p=>p&&existsSync(p))
assert.ok(pnpm,'PNPM_CLI must point to installed pnpm entry');assert.deepEqual(await readdir(store),[])
const installed=spawnSync(process.execPath,[pnpm,'install','--offline','--ignore-scripts','--store-dir',store,'--registry=http://127.0.0.1:9','--reporter=append-only'],{cwd:stage,encoding:'utf8',windowsHide:true,env:{...process.env,CI:'1',COREPACK_ENABLE_NETWORK:'0',npm_config_update_notifier:'false'}})
assert.equal(installed.status,0,installed.stdout+installed.stderr)
const dir=join(stage,'node_modules',item.name),pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))
const art=JSON.parse(await readFile(join(dir,'assets/entrance/manifest.json'),'utf8'));assert.equal(art.status,'APPROVED')
for(const f of art.files)assert.equal(createHash('sha256').update(await readFile(join(dir,'assets',f.file))).digest('hex'),f.sha256)
const client=await readFile(join(dir,'lib/client.js'),'utf8')
for(const forbidden of ['reviewMotion','entrance-review-art','dsh_plugin-entrance-art','__allowAck'])assert.ok(!client.includes(forbidden),forbidden)
assert.ok(client.includes('APPROVED'),'Production must preserve the approval predicate')
assert.ok(!/[A-Z]:[\\/](?:Users|Documents)/i.test(client),'Absolute developer path')
// DSH and React are host peers, never downloaded by the offline plugin install.
for(const peer of Object.keys(pkg.peerDependencies)){const dest=join(stage,'node_modules',peer);await mkdir(dirname(dest),{recursive:true});await symlink(join(root,'node_modules',peer),dest,'junction')}
await writeFile(join(stage,'verify.mjs'),`import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {join} from 'node:path';import {mkdtemp} from 'node:fs/promises';import {VillageHost} from './node_modules/@nidofy/dsh-ai-village/lib/service.mjs';import * as plugin from '@nidofy/dsh-ai-village';const root=import.meta.dirname,dir=join(root,'node_modules/@nidofy/dsh-ai-village'),req=createRequire(join(dir,'package.json'));assert.ok(req.resolve('koffi').startsWith(root));assert.equal(req('koffi').sizeof('int'),4);assert.equal(plugin.name,'nidofy-ai-village');const owner=await VillageHost.open(await mkdtemp(join(root,'profile-')),join(dir,'assets'),join(dir,'lib'),new AbortController().signal);assert.equal(await owner.store.read(),null);await owner.close();console.log('Offline plugin native dependency and isolated Host smoke PASS')`)
const verified=spawnSync(process.execPath,[join(stage,'verify.mjs')],{cwd:stage,encoding:'utf8',windowsHide:true});assert.equal(verified.status,0,verified.stdout+verified.stderr)
const report={status:'PASS',file:item.file,sha256:digest,bytes:item.bytes,entries:entries.length,art_status:art.status,offline_empty_store:true,registry:'http://127.0.0.1:9',lifecycle_scripts:false,isolated_host_smoke:true,real_profile_touched:false,preview_modules_packaged:false,host_peers:'Existing pinned host installation, provided only after offline plugin install'}
await writeFile(join(root,'docs/ai-village/reentry-recovery/ENTRANCE_PACKAGE_CHECK.json'),JSON.stringify(report,null,2)+'\n')
console.log(installed.stdout.trim());console.log(verified.stdout.trim());console.log(JSON.stringify(report))

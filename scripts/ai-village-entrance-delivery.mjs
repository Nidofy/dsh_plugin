import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,copyFile,readdir,mkdtemp,stat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),doc='docs/ai-village/entrance-v1',qa='packages/ai-village/art/QA/entrance-v1',delivery='dist/ai-village-entrance-v1-delivery'
process.chdir(root)
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex'),put=async(p,value)=>writeFile(p,JSON.stringify(value,null,2)+'\n')
const pkg=(await json('dist/manifest.json')).find(p=>p.name==='@nidofy/dsh-ai-village')
assert.equal(pkg.version,'0.6.4');assert.equal(await hash('dist/'+pkg.file),pkg.sha256)
const userFiles=await json(doc+'/user-files-baseline.json')
for(const item of userFiles)assert.equal((await hash(item.Path)).toUpperCase(),item.Hash)
execFileSync('git',['diff','--check'])
const build={head:execFileSync('git',['rev-parse','HEAD']).toString().trim(),dirty:execFileSync('git',['status','--short']).toString(),version:pkg.version,clientSHA256:await hash('packages/ai-village/lib/client.js'),frameSHA256:await hash('packages/ai-village/lib/frame.js'),fixtureSHA256:await hash('.build/ai-village-phase4/fixture.js')}
const browser=await json(qa+'/validation.json');assert.equal(browser.results.length,15);assert.ok(browser.results.every(r=>r.status==='PASS'));assert.equal(browser.build.sha256['lib/client.js'],build.clientSHA256);assert.equal(browser.build.sha256['lib/frame.js'],build.frameSHA256);assert.equal(browser.build.sha256['fixture.js'],build.fixtureSHA256)
assert.match(await readFile(doc+'/logs/tests-final.txt','utf8'),/Tests\s+145 passed/)
for(const folder of ['regression-interaction-final','regression-recovery-final']){
 const metadata=await json(qa+'/'+folder+'/'+(folder.includes('recovery')?'recovery-metadata.json':'metadata.json'))
 for(const row of metadata){assert.equal(row.build.clientSHA256,build.clientSHA256);assert.equal(row.build.frameSHA256,build.frameSHA256);assert.equal(row.build.fixtureSHA256,build.fixtureSHA256)}
 const validation=await json(qa+'/'+folder+'/'+(folder.includes('recovery')?'recovery-validation.json':'validation.json'));assert.equal(validation.status,'PASS')
}
const offline=await json('dist/offline-validation.json');assert.equal(offline.passed,true);assert.equal(offline.artifacts.find(p=>p.name===pkg.name).sha256,pkg.sha256)
const unpack=await mkdtemp(resolve('.build/entrance-delivery-unpack-'));await tar.x({file:'dist/'+pkg.file,cwd:unpack})
for(const name of ['client.js','frame.js','index.js'])assert.equal(await hash(join(unpack,'package/lib',name)),await hash('packages/ai-village/lib/'+name))
const performance=await json(qa+'/performance.json')
for(const entry of performance.files)assert.equal(entry.sha256,await hash('packages/ai-village/lib/'+entry.name))
const before=(await stat('dist/nidofy-dsh-ai-village-0.6.3.tgz')).size
await put(doc+'/BUILD_RESULTS.json',{build,package:pkg,packageDeltaBytes:pkg.bytes-before,performance,tests:{files:30,passed:145,browserScenarios:15},art:'ART_PENDING',gpu:'NOT RUN',userVisualReview:'PENDING',oneHour:'DEFERRED',userFilesUnchanged:true,dailyProfileTouched:false})
await mkdir(delivery,{recursive:true})
await copyFile('dist/'+pkg.file,delivery+'/'+pkg.file)
await writeFile('dist/'+pkg.file+'.sha256',pkg.sha256+'  '+pkg.file+'\n');await copyFile('dist/'+pkg.file+'.sha256',delivery+'/'+pkg.file+'.sha256')
const allowed=p=>p.startsWith('packages/ai-village/')&&!p.startsWith('packages/ai-village/art/QA/')||p.startsWith('scripts/ai-village-')
const changed=[...new Set([...execFileSync('git',['diff','--name-only']).toString().trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard']).toString().trim().split('\n')])].filter(p=>p&&allowed(p))
await put(doc+'/source-manifest.json',await Promise.all(changed.map(async path=>({path,sha256:await hash(path)}))))
await writeFile(delivery+'/tracked-changes.patch',execFileSync('git',['diff','--binary','--','packages/ai-village','scripts/ai-village-resources.mjs','scripts/ai-village-ui-v11-interaction.mjs','scripts/ai-village-ui-v11-recovery.mjs'],{maxBuffer:8*1024*1024}))
await tar.c({gzip:true,file:delivery+'/source-changes.tar.gz',cwd:root},changed)
await tar.c({gzip:true,file:delivery+'/evidence.tar.gz',cwd:root,filter:path=>!path.includes('/videos/')&&!path.endsWith('/videos')},[doc,qa])
const output=[];for(const file of await readdir(delivery)){if(file==='SHA256SUMS.txt')continue;output.push((await hash(delivery+'/'+file))+'  '+file)}
await writeFile(delivery+'/SHA256SUMS.txt',output.join('\n')+'\n')
console.log(JSON.stringify({delivery,package:pkg,sourceFiles:changed.length,build},null,2))

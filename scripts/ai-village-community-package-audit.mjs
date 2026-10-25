/** Bind the offline package to the precise source, bundles and passed browser runs. */
import assert from 'node:assert/strict'
import { readFile,readdir,mkdtemp,writeFile } from 'node:fs/promises'
import { join,resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),out=join(root,'docs/ai-village/community-next')
const labels=process.argv.slice(2);assert.equal(labels.length,2,'Supply the final DPR1 and DPR2 PASS labels')
for(const label of labels)assert.match(label,/^[a-z0-9-]+$/)
const hash=b=>createHash('sha256').update(b).digest('hex'),version=JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version
const file=`nidofy-dsh-ai-village-${version}.tgz`,bytes=await readFile(join(root,'dist',file)),stage=await mkdtemp(join(root,'.build/community-package-audit-'))
await tar.x({file:join(root,'dist',file),cwd:stage})
const source={},files={},bundles={}
for(const name of(await readdir(join(pkg,'src'),{recursive:true})).filter(n=>/\.tsx?$/.test(n)))source[name.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',name)))
for(const entry of(await readdir(join(stage,'package'),{recursive:true,withFileTypes:true})).filter(e=>e.isFile())){
  const name=join(entry.parentPath,entry.name).slice(join(stage,'package').length+1).replaceAll('\\','/')
  const packed=await readFile(join(stage,'package',name));files[name]=hash(packed)
  if(name.startsWith('lib/')||name.startsWith('assets/'))assert.equal(hash(await readFile(join(pkg,name))),hash(packed),'Packed bytes differ: '+name)
  assert.ok(!name.includes('community-next'),'Candidate art/design must not enter package')
}
for(const name of ['index.js','client.js','frame.js'])bundles[name]=hash(await readFile(join(pkg,'lib',name)))
const browser=[]
for(const label of labels){
  const build=JSON.parse(await readFile(join(out,'browser',label,'build.json'),'utf8')),result=JSON.parse(await readFile(join(out,'browser',label,'result.json'),'utf8'))
  assert.equal(result.status,'PASS');assert.equal(build.version,version);assert.deepEqual(build.bundles,bundles)
  assert.deepEqual(Object.fromEntries(Object.entries(build.source).map(([k,v])=>[k.replaceAll('\\','/'),v])),source)
  browser.push({label,dpr:build.dpr,status:result.status,identity:'MATCH',checks:result.checks})
}
assert.deepEqual(browser.map(b=>b.dpr).sort(),[1,2])
const identity={version,file,bytes:bytes.length,sha256:hash(bytes),fileCount:Object.keys(files).length,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),workingTree:'uncommitted; HEAD is the baseline, source hashes identify this artifact',source,bundles,files,browser}
await writeFile(join(out,'package-identity.json'),JSON.stringify(identity,null,2)+'\n')
console.log(JSON.stringify({version,file,bytes:bytes.length,sha256:hash(bytes),files:Object.keys(files).length,sourceFiles:Object.keys(source).length,browser:browser.map(b=>({label:b.label,dpr:b.dpr,status:b.status,identity:b.identity}))}))

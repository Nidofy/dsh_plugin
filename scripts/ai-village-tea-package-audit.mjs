/** Qualify an explicitly named gate/play artifact without rewriting the frozen 0.12 identity. */
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,writeFile,mkdir,cp,copyFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),out=join(root,'docs/ai-village/community-next/tea-square'),[scope,label1,label2]=process.argv.slice(2)
assert.ok(['gate','play'].includes(scope));for(const label of [label1,label2])assert.match(label??'',/^[a-z0-9-]+$/)
const hash=b=>createHash('sha256').update(b).digest('hex'),version=JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version,file=`nidofy-dsh-ai-village-${version}.tgz`,bytes=await readFile(join(root,'dist',file)),source={},bundles={},files={}
const stage=await mkdtemp(join(root,'.build/tea-package-audit-'));await tar.x({file:join(root,'dist',file),cwd:stage})
for(const name of (await readdir(join(pkg,'src'),{recursive:true})).filter(n=>/\.tsx?$/.test(n)))source[name.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',name)))
for(const name of ['index.js','client.js','frame.js'])bundles[name]=hash(await readFile(join(pkg,'lib',name)))
for(const e of (await readdir(join(stage,'package'),{recursive:true,withFileTypes:true})).filter(e=>e.isFile())){
 const name=join(e.parentPath,e.name).slice(join(stage,'package').length+1).replaceAll('\\','/'),b=await readFile(join(stage,'package',name));files[name]=hash(b)
 if(name.startsWith('lib/')||name.startsWith('assets/'))assert.equal(hash(await readFile(join(pkg,name))),hash(b),'Packed bytes differ: '+name)
 assert.ok(!name.includes('/art/candidates/'),'Unapproved candidate leaked')
 if(scope==='gate')assert.ok(!name.startsWith('assets/tea-square/'),'Gate package must not silently enable candidate tea art')
}
const browser=[]
for(const label of [label1,label2]){
 const build=JSON.parse(await readFile(join(out,'browser',label,'build.json'),'utf8')),result=JSON.parse(await readFile(join(out,'browser',label,'result.json'),'utf8'))
 assert.equal(result.status,'PASS');assert.equal(build.version,version);assert.equal(build.mode,scope);assert.deepEqual(build.bundles,bundles);assert.deepEqual(Object.fromEntries(Object.entries(build.source).map(([k,v])=>[k.replaceAll('\\','/'),v])),source)
 browser.push({label,dpr:build.dpr,scope,status:'PASS',sourceAndBundles:'MATCH'})
}
assert.deepEqual(browser.map(b=>b.dpr).sort(),[1,2])
const identity={version,file,sha256:hash(bytes),bytes:bytes.length,fileCount:Object.keys(files).length,scope:scope==='gate'?'PLANNED_REGION_GATE_ONLY':'PLAYABLE_TEA_SQUARE',source,bundles,files,browser}
await mkdir(out,{recursive:true});await writeFile(join(out,`${scope}-package-identity.json`),JSON.stringify(identity,null,2)+'\n')
const snapshot=join(root,`.build/ai-village-tea-${version}-${scope}-frozen`);await mkdir(snapshot)
for(const dir of ['src','lib','tests'])await cp(join(pkg,dir),join(snapshot,dir),{recursive:true});for(const name of ['package.json','README.md'])await copyFile(join(pkg,name),join(snapshot,name));await writeFile(join(snapshot,'package-identity.json'),JSON.stringify(identity,null,2)+'\n')
console.log(JSON.stringify({version,file,sha256:identity.sha256,bytes:bytes.length,fileCount:identity.fileCount,scope:identity.scope,snapshot},null,2))

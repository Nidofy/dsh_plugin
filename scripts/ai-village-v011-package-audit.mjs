/** Bind final offline artifact to reviewed source and UI evidence without installing it. */
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),out=join(root,'docs/ai-village/v011')
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),version=JSON.parse(await readFile(join(pkg,'package.json'),'utf8')).version
const file=`nidofy-dsh-ai-village-${version}.tgz`,bytes=await readFile(join(root,'dist',file)),stage=await mkdtemp(join(root,'.build/v011-package-audit-'))
await tar.x({file:join(root,'dist',file),cwd:stage})
const source={},files={},bundles={}
for(const name of (await readdir(join(pkg,'src'),{recursive:true})).filter(n=>/\.tsx?$/.test(n)))source[name.replaceAll('\\','/')]=hash(await readFile(join(pkg,'src',name)))
for(const entry of (await readdir(join(stage,'package'),{recursive:true,withFileTypes:true})).filter(n=>n.isFile())){
 const name=join(entry.parentPath,entry.name).slice(join(stage,'package').length+1)
 const packed=await readFile(join(stage,'package',name));files[name.replaceAll('\\','/')]=hash(packed)
 if(name.startsWith('lib/')||name.startsWith('lib\\')||name.startsWith('assets/')||name.startsWith('assets\\'))assert.equal(hash(await readFile(join(pkg,name))),hash(packed),'Packed bytes differ: '+name)
}
for(const name of ['index.js','client.js','frame.js'])bundles[name]=hash(await readFile(join(pkg,'lib',name)))
const browser=[]
for(const label of (await readdir(join(out,'browser'))).filter(n=>n.startsWith('final-')||/^visual-dpr[12]-02$/.test(n))){
 const build=JSON.parse(await readFile(join(out,'browser',label,'build.json'),'utf8'));assert.equal(build.version,version);assert.deepEqual(build.bundles,bundles)
 assert.deepEqual(Object.fromEntries(Object.entries(build.source).map(([k,v])=>[k.replaceAll('\\','/'),v])),source)
 browser.push({label,buildIdentity:'MATCH',result:'Read each result.json; identity alone is not a PASS'})
}
await mkdir(out,{recursive:true})
await writeFile(join(out,'package-identity.json'),JSON.stringify({version,file,bytes:bytes.length,sha256:hash(bytes),fileCount:Object.keys(files).length,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),workingTree:'uncommitted iteration; HEAD is baseline, source hashes identify delivered code',source,bundles,files,browser},null,2)+'\n')
console.log(JSON.stringify({version,file,bytes:bytes.length,sha256:hash(bytes),files:Object.keys(files).length,sourceFiles:Object.keys(source).length,browser}))

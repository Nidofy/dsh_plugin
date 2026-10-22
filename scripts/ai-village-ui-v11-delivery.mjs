/** Freeze evidence for the actual dirty checkpoint; never commits or installs a daily profile. */
import assert from 'node:assert/strict'
import {readFile,writeFile,readdir,mkdir,copyFile,mkdtemp,stat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import * as tar from 'tar'
const root=resolve(import.meta.dirname,'..'),doc='docs/ai-village/ui-v1.1',qa='packages/ai-village/art/QA/ui-v11',logs='.build/ai-village-ui-v11'
process.chdir(root)
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex'),put=async(p,value)=>writeFile(p,JSON.stringify(value,null,2)+'\n')
const pkg=(await json('dist/manifest.json')).find(p=>p.name==='@nidofy/dsh-ai-village')
assert.equal(pkg.version,'0.6.3');assert.equal(await hash('dist/'+pkg.file),pkg.sha256)
const build={version:'0.6.3',head:execFileSync('git',['rev-parse','HEAD']).toString().trim(),dirty:true,clientSHA256:await hash('packages/ai-village/lib/client.js'),frameSHA256:await hash('packages/ai-village/lib/frame.js'),fixtureSHA256:await hash('.build/ai-village-phase4/fixture.js')}
const testLog=await readFile(logs+'/tests.log','utf8');assert.match(testLog,/Test Files\s+29 passed/);assert.match(testLog,/Tests\s+133 passed/);execFileSync('git',['diff','--check']);
const baseline=await json(doc+'/baseline.json')
for(const item of baseline.initialUntracked)assert.equal(await hash(item.path),item.sha256)
const unpack=await mkdtemp(resolve('.build/ui-v11-delivery-unpack-'))
await tar.x({file:'dist/'+pkg.file,cwd:unpack})
for(const name of ['client.js','frame.js','index.js'])assert.equal(await hash(join(unpack,'package/lib',name)),await hash('packages/ai-village/lib/'+name))
for(const path of ['visual/validation.json','interaction-checks/validation.json','visual/recovery-validation.json'])assert.equal((await json(qa+'/'+path)).status,'PASS')
const performance=await json(qa+'/performance.json')
assert.equal(performance.builds.current.clientSHA256,build.clientSHA256);assert.equal(performance.builds.current.fixtureSHA256,build.fixtureSHA256)
let count=0
for(const file of ['visual/metadata.json','visual/recovery-metadata.json','interaction-checks/metadata.json']){
 const entries=await json(qa+'/'+file)
 for(const row of entries){assert.equal(row.build.clientSHA256,build.clientSHA256);assert.equal(row.build.frameSHA256,build.frameSHA256);assert.equal(row.build.fixtureSHA256,build.fixtureSHA256)}
 count+=entries.length
}
const photos=[]
for(const width of [340,580,1080]){const path=qa+'/visual/capture-'+width+'.png',bytes=await readFile(path);assert.equal(bytes.readUInt32BE(16),720);assert.equal(bytes.readUInt32BE(20),960);photos.push({path,sha256:await hash(path)})}
assert.equal(new Set(photos.map(p=>p.sha256)).size,1)
const offline=await json('dist/offline-validation.json');assert.equal(offline.passed,true);assert.equal(offline.artifacts.find(p=>p.name===pkg.name).sha256,pkg.sha256)
await mkdir(doc+'/logs',{recursive:true})
for(const file of await readdir(logs))if(file.endsWith('.log'))await copyFile(join(logs,file),join(doc,'logs',file))
const currentTime=(await stat('packages/ai-village/lib/client.js')).mtimeMs,supplementary=[]
for(const [name,path]of [['lifecycle','.build/ai-village-v0.6.1-qa/browser'],['content','.build/ai-village-v0.6-qa/content'],['neighborhood','.build/ai-village-v0.6-qa/neighborhood']]){
 await mkdir(qa+'/'+name,{recursive:true})
 for(const file of await readdir(path)){const full=join(path,file),info=await stat(full);if(info.isFile()&&info.mtimeMs>=currentTime&&/\.(png|json|webm)$/.test(file)&&!file.startsWith('failure')){await copyFile(full,join(qa,name,file));supplementary.push({path:qa+'/'+name+'/'+file,sha256:await hash(full),build})}}
}
await put(qa+'/supplementary-metadata.json',supplementary)
await put(doc+'/package-manifest.json',{package:pkg,build,photos,screenshotsWithMetadata:count,tests:{baseline:'28 files / 121 PASS',final:'29 files / 133 PASS'},softwarePerformance:performance.status,realGPU:'NOT RUN',manual:'NEEDS_REVIEW',soak:'DEFERRED',siteIncident:'NOT CONFIRMED',dailyProfileTouched:false})
const table=performance.gates.map(g=>`| ${g.scenario} | ${g.cpuBefore.toFixed(4)} → ${g.cpuAfter.toFixed(4)} | ${g.p95Before.toFixed(2)} → ${g.p95After.toFixed(2)} | ${g.cpuPass&&g.p95Pass?'PASS':'FAIL'} |`).join('\n')
await writeFile(doc+'/BUILD_RESULTS.md',`# 最终构建与证据核验

HEAD ${build.head}，dirty=true；版本0.6.3。用户原有两份未跟踪文档哈希未变。没有提交、推送、发布或安装日常profile。

离线包：dist/${pkg.file}，${pkg.bytes} bytes，${pkg.files} files。

SHA256：${pkg.sha256}

client.js：${build.clientSHA256}

frame.js：${build.frameSHA256}

fixture.js：${build.fixtureSHA256}

${count}张逐图元数据截图；另附最终生命周期/内容/邻里回归图。所有主要截图client/frame/fixture哈希与本次构建相符，解包后的client/frame/index与正式lib逐字节相同。三个窗口的720×960原始PNG字节相等，详情见package-manifest.json。

软件性能结果：**${performance.status}**。同机0.6.2/0.6.3、同Chromium SwiftShader，三轮每场景10秒。保留原CPU≤15%相对增幅和p95旧值+max(20%,1ms)门槛。

| 场景 | CDP CPU % 旧→新 | Pixi提交p95 ms 旧→新 | 门槛 |
|---|---|---|---|
${table}

这是软件后端的调度/提交及CDP指标，不能推出硬件GPU合成或玻璃成本；后者NOT RUN。初版样本performance-initial.json保留，不作为最终包成绩。隐藏长样本如另行执行，见performance-hidden-followup.json，原失败不覆盖。

源码清单/受控diff → 正式lib → tgz解包相等 → 每图metadata中的client/frame/fixture哈希。source-delta.tgz叠加e85ccc7基线，包含普通git diff未覆盖的新增文件。source-manifest.json记录来源；SHA256SUMS.txt与delivery-manifest.json记录三个交付包。
`)
if(performance.status==='FAIL'){let acceptance=await readFile(doc+'/ACCEPTANCE.md','utf8');acceptance=acceptance.replace(/(\| F06 \|[^\n]+?\| )NOT RUN( \|)/,'$1FAIL$2');await writeFile(doc+'/ACCEPTANCE.md',acceptance)}
execFileSync('git',['diff','--binary','--output='+resolve(doc,'changes.patch')])
const changed=execFileSync('git',['diff','--name-only','-z']).toString().split('\0').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean),excluded=new Set(baseline.initialUntracked.map(p=>p.path))
const files=[...new Set([...changed,...untracked])].filter(p=>!excluded.has(p)&&!p.startsWith(qa+'/')&&!p.startsWith(doc+'/logs/')&&!p.endsWith('/source-manifest.json')&&!p.endsWith('/delivery-manifest.json')&&!p.endsWith('/SHA256SUMS.txt')).sort()
const sources=await Promise.all(files.map(async path=>({path,sha256:await hash(path)})))
await put(doc+'/source-manifest.json',{build,baseline:baseline.head,originalUserFiles:baseline.initialUntracked,files:sources,sourceArchive:'delta over e85ccc7; original user files and generated evidence excluded',frameChange:'input dismissal priority only; protocol3, scene geometry and photo pipeline retained'})
const sourceArchive='dist/ai-village-0.6.3-ui-v1.1-source-delta.tgz',evidenceArchive='dist/ai-village-0.6.3-ui-v1.1-evidence.tgz'
await tar.c({file:sourceArchive,cwd:root,gzip:true},[...files,doc+'/source-manifest.json'])
await tar.c({file:evidenceArchive,cwd:root,gzip:true,filter:path=>!path.endsWith('/delivery-manifest.json')&&!path.endsWith('/SHA256SUMS.txt')},[doc,qa])
const artifacts=await Promise.all(['dist/'+pkg.file,sourceArchive,evidenceArchive].map(async path=>({path,bytes:(await stat(path)).size,sha256:await hash(path)})))
await put(doc+'/delivery-manifest.json',{version:'0.6.3',build,artifacts})
await writeFile(doc+'/SHA256SUMS.txt',artifacts.map(p=>p.sha256+'  '+p.path).join('\n')+'\n')
await writeFile('dist/'+pkg.file+'.sha256',pkg.sha256+'  '+pkg.file+'\n')
console.log(JSON.stringify({status:'PASS',build,artifacts,screenshots:count,performance:performance.status}))

/** Read-only world14 decode followed by one explicit world15 CAS publication. */
import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import * as tar from 'tar'
import { root, villageCompatibility } from './ai-village-compatibility.mjs'
const lane=villageCompatibility('rc3'),hash=b=>createHash('sha256').update(b).digest('hex')
const oldFile=join(root,'dist/nidofy-dsh-ai-village-0.13.0-preview.5.tgz')
assert.equal(hash(await readFile(oldFile)),'c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760')
const stage=await mkdtemp(join(root,'.build/ai-village-afternoon-upgrade-')),extracted=join(stage,'old')
await mkdir(extracted);await tar.x({file:oldFile,cwd:extracted})
const old=await import(pathToFileURL(join(extracted,'package/lib/service.mjs')).href),current=await import(pathToFileURL(join(lane.out,'lib/service.mjs')).href)
const world=JSON.parse(await readFile(join(root,'packages/ai-village/tests/fixtures/tea-ordinary-world14.json'),'utf8'))
const profile=join(stage,'profile'),signal=new AbortController().signal;await mkdir(profile)
let host=await old.VillageHost.open(profile,join(extracted,'package/assets'),join(extracted,'package/lib'),signal)
const owner=await host.execute('acquire',{clientId:randomUUID()}),operationId=randomUUID()
try{await host.execute('save',{...owner,expectedRevision:0,world,operationId})}finally{await host.close()}
const dir=join(profile,'nidofy-ai-village'),pointer=await readFile(join(dir,'current.json')),snapshotPath=join(dir,'snapshots',JSON.parse(pointer).snapshot),snapshot=await readFile(snapshotPath)
host=await current.VillageHost.open(profile,join(root,'packages/ai-village/assets'),join(lane.out,'lib'),signal)
let migrated
try{
 const restored=await host.store.read();migrated=restored.world
 const {afternoon,community,...previous}=migrated
 assert.deepEqual({...previous,schemaVersion:14,contentRevision:10},world)
 assert.equal(migrated.schemaVersion,15);assert.equal(migrated.contentRevision,11);assert.deepEqual(afternoon.memories,[]);assert.deepEqual(community.recent,[])
 assert.equal(restored.revision,1);assert.equal(restored.operationId,operationId);assert.equal(host.profileId,owner.profileId);assert.notEqual(host.epoch,owner.epoch)
 await assert.rejects(host.execute('heartbeat',owner),/OWNER_LOST/)
 assert.deepEqual(await readFile(join(dir,'current.json')),pointer);assert.deepEqual(await readFile(snapshotPath),snapshot)
 const lease=await host.execute('acquire',{clientId:randomUUID()}),op=randomUUID()
 const ack=await host.execute('save',{...lease,expectedRevision:1,world:migrated,operationId:op})
 assert.equal(ack.revision,2);assert.deepEqual(ack.world,migrated)
 const repeated=await host.execute('save',{...lease,expectedRevision:1,world:migrated,operationId:op});assert.deepEqual(repeated,ack)
 const protectedPointer=join(dir,'upgrade-v1-'+hash(pointer)+'.json');assert.deepEqual(await readFile(protectedPointer),pointer)
 assert.deepEqual(await readFile(snapshotPath),snapshot)
}finally{await host.close()}
host=await current.VillageHost.open(profile,join(root,'packages/ai-village/assets'),join(lane.out,'lib'),signal)
try{assert.deepEqual((await host.store.read()).world,migrated)}finally{await host.close()}
const version=JSON.parse(await readFile(join(root,'packages/ai-village/package.json'),'utf8')).version
const evidence={status:'PASS',from:'0.13.0-preview.5 / world14',to:version+' / world15',oldPackageSha256:hash(await readFile(oldFile)),checks:['Frozen A6 Host writes genuine old-format save','Read decodes world15 without changing pointer or snapshot','All prior fields retained, new bounded states empty','Stale epoch rejected','One explicit CAS publishes revision2; same operation returns identical ACK','Exact old pointer protected before publication','Cold reopen preserves world15'],candidateBundles:Object.fromEntries(await Promise.all(['service.mjs','client.js','frame.js','build-identity.json'].map(async n=>[n,hash(await readFile(join(lane.out,'lib',n)))])))}
const out=join(root,'docs/ai-village/compatibility',version);await mkdir(out,{recursive:true});await writeFile(join(out,'world15-save-upgrade.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(evidence,null,2))

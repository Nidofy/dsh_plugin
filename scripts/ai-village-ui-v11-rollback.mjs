import assert from 'node:assert/strict'
import {mkdtemp,cp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {SaveStore} from '../packages/ai-village/src/host/save-store.ts'
import {scene} from '../packages/ai-village/src/definitions.ts'
import {preferencesCodec as nextCodec} from '../packages/ai-village/src/core/preferences.ts'
import {preferencesCodec as oldCodec,defaultPreferences} from '../.build/ui-v11-baseline-source/packages/ai-village/src/core/preferences.ts'
const root=await mkdtemp(resolve('.build/ui-v11-rollback-')),old=await SaveStore.open(root,scene,oldCodec),original={...defaultPreferences,theme:'dark',language:'en',reducedMotion:true,reducedTransparency:true,bubbles:false,noticeReadIds:['first-memory'],noticesInitialized:true}
await old.save(0,original,randomUUID());const backup=join(root,'backup');await mkdir(backup);await cp(old.directory,join(backup,'nidofy-ai-village'),{recursive:true});const before=await readFile(join(old.directory,'current.json'))
const next=await SaveStore.open(root,scene,nextCodec),migrated=(await next.read()).world;assert.deepEqual(migrated,{...original,schemaVersion:3,textScale:1});await next.save(1,{...migrated,textScale:1.5},randomUUID());const v3=await readFile(join(old.directory,'current.json'));await assert.rejects(()=>old.read(),/INVALID_PREFERENCES/);assert.deepEqual(await readFile(join(old.directory,'current.json')),v3)
const restored=await SaveStore.open(backup,scene,oldCodec);assert.deepEqual((await restored.read()).world,original);assert.deepEqual(await readFile(join(restored.directory,'current.json')),before);assert.equal((await next.read()).world.textScale,1.5)
const result={status:'PASS',baseline:'e85ccc7 actual schema2 decoder',checks:['schema2 original values and notice IDs retained by schema3 migration','0.6.2 refuses schema3 without modifying bytes','separate restored backup reads through actual 0.6.2 decoder','new schema3 data remains untouched'],backupPointerSHA256:createHash('sha256').update(before).digest('hex'),upgradedPointerSHA256:createHash('sha256').update(v3).digest('hex')};await writeFile('packages/ai-village/art/QA/ui-v11/rollback.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))

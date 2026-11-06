import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { temporaryDirectory } from './temporary-directory.mjs'
import { Engine } from '../src/engine.ts'
import type { RunRecord } from '../src/types.ts'
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
test('historical reflection preserves run provenance and records current answer help separately', async () => {
  const temp = await temporaryDirectory('neural-provenance-')
  const engine = await Engine.open(temp.directory)
  try {
    const e = engine.exercise('L04-train')
    const run: RunRecord = {id:'old-run',exerciseId:e.id,code:e.reference,codeHash:hash(e.reference),
      contentVersion:'historical-content',testVersion:'historical-test',seed:42,config:{},environment:'fixture',
      run_status:'completed',check_status:'passed',createdAt:new Date().toISOString(),events:[],log:'',help:'answer',attemptId:'old-attempt'}
    engine.store.putRun(run)
    engine.store.beginIndependent(e.id)
    engine.hint(e.id,'concept')
    const answerAttempt = engine.workspace(e.id).attemptId
    engine.answer(e.id,'My later explanation',run.id)
    const evidence = engine.store.evidence().at(-1)!
    assert.equal(evidence.contentVersion,'historical-content')
    assert.equal(evidence.testVersion,'historical-test')
    assert.equal(evidence.attemptId,'old-attempt')
    assert.equal(evidence.help,'answer')
    assert.equal(evidence.answerAttemptId,answerAttempt)
    assert.equal(evidence.answerHelp,'concept')
    assert.equal(evidence.answerContentVersion,engine.catalog.version)
    assert.equal(engine.run(run.id).check_status,'passed')
  } finally { await engine.close(); await temp.cleanup() }
})
test('single-file MLP replay roundtrips without component markers and rejects forged event identity',async()=>{
  const temp = await temporaryDirectory('neural-replay-')
  const engine = await Engine.open(temp.directory)
  try {
    const e = engine.exercise('L04-train')
    const { trainingDataset } = await import('../src/training-protocol.ts')
    const run: RunRecord = {id:'mlp-run',exerciseId:e.id,code:e.reference,codeHash:hash(e.reference),
      contentVersion:engine.catalog.version,testVersion:e.testVersion,seed:42,config:{learningRate:.05},environment:'fixture',
      resolvedImageId:'sha256:'+'a'.repeat(64),trainingManifest:{protocol:e.runtimeKey!,dataset:trainingDataset(e.runtimeKey)!,splitHash:'b'.repeat(64),initialHash:'c'.repeat(64),batchHash:'d'.repeat(64)},
      prediction:'Predict a decrease',run_status:'completed',check_status:'passed',createdAt:new Date().toISOString(),
      events:[{runId:'mlp-run',seq:1,type:'metric',name:'loss',value:1,source:'program'}],log:'',help:'none'}
    engine.store.putRun(run)
    const file = engine.projectFile(run.id)
    assert.deepEqual(file.components,[])
    assert.deepEqual(engine.inspectProject(e.id,JSON.stringify(file)),JSON.parse(JSON.stringify(file)))
    file.contentVersion = '0.5.0'
    assert.equal(engine.inspectProject(e.id, JSON.stringify(file)).contentVersion, '0.5.0')
    file.results[0]!.runId = 'another-run'
    assert.throws(()=>engine.inspectProject(e.id,JSON.stringify(file)),/Invalid imported event/)
    assert.equal(engine.store.runs().length,1)
  } finally {await engine.close(); await temp.cleanup()}
})


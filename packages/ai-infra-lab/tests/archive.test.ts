import assert from 'node:assert/strict'
import { createHash,randomUUID } from 'node:crypto'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { Engine } from '../src/engine.ts'
import type { RunRecord } from '../src/types.ts'

it('restores valid runs, answers, reading and evidence once, rejecting malformed batches atomically',async()=>{
  const root=await mkdtemp(join(tmpdir(),'infra-archive-'))
  const source=await Engine.open(join(root,'source'))
  const restored=await Engine.open(join(root,'target'))
  try {
    const id=randomUUID(), at=new Date().toISOString(), code='# synthetic answer'
    const run: RunRecord={id,exerciseId:'A00-code',code,codeHash:createHash('sha256').update(code).digest('hex'),
      dataSource:'cpu_measured',resourceProfile:'scalar-cpu',contentVersion:'0.5.0',testVersion:'1',seed:42,config:{},
      attemptId:'initial',environment:'test',run_status:'completed',check_status:'passed',createdAt:at,finishedAt:at,log:'',
      help:'none',events:[{runId:id,seq:1,type:'check',name:'greet_machine',step:'greet_machine',passed:true}]}
    source.store.putRun(run)
    source.store.record(run.exerciseId,'evidence',{id:randomUUID(),runId:id,attemptId:'initial',exerciseId:run.exerciseId,
      concept:'assertion',kind:'implementation',dataSource:run.dataSource,source:'program',help:'none',result:'passed',
      contentVersion:'0.5.0',testVersion:'1',at})
    source.readLesson('B01')
    source.answer('A01-fasttrack',source.exercise('A01-fasttrack').quiz!.correctOptionId)
    source.answer('X01-design','模型假设与测量计划 / assumptions and measurement plan')
    const raw=source.exportData(), valid=JSON.parse(raw)
    const clean=()=>[restored.store.runs(),restored.store.evidence(),restored.store.archiveAnswers(),restored.overview().readLessons]
    const before=clean()
    for (const mutate of [
      (a:any)=>a.runs={}, (a:any)=>a.evidence=Array(5001).fill({}), (a:any)=>a.runs=Array(1001).fill({}),
      (a:any)=>a.answers[0].exerciseId='B01-quiz', (a:any)=>a.runs[0].events[0].runId=randomUUID(),
      (a:any)=>a.runs[0].config={bad:'NaN'}, (a:any)=>a.runs[0].code+='changed',
      (a:any)=>a.runs[0].events[0].passed=false, (a:any)=>a.readLessons.push('Z99'),
      (a:any)=>a.evidence.push({...a.evidence[0],id:randomUUID(),exerciseId:'C03-code',concept:'loss-scaling'}),
      (a:any)=>a.evidence[0].runId=randomUUID(), (a:any)=>a.runs[0].cleanupPending='unconfirmed',
      (a:any)=>a.runs[0].events[0].timeline=[{rank:4,op:'send',startMs:1,endMs:2}],
      (a:any)=>a.answers.pop(), (a:any)=>a.answers[0].diagnostic.en=null,
      (a:any)=>a.unexpected=true, (a:any)=>a.evidence.push({...a.evidence[0]}),
      (a:any)=>a.readLessons=Array(27).fill('A00'),
    ]) {
      const a=structuredClone(valid); mutate(a)
      assert.throws(()=>restored.importData(JSON.stringify(a)))
      assert.deepEqual(clean(),before)
    }
    assert.throws(()=>restored.importData('界'.repeat(1_333_334)),/4 MB/)
    assert.throws(()=>restored.importData(' '.repeat(4_000_001)),/4 MB/)
    assert.deepEqual(restored.importData(raw),{importedRuns:1,importedEvidence:valid.evidence.length})
    assert.deepEqual(restored.run(id),run)
    assert.deepEqual(restored.overview().evidence,source.overview().evidence)
    assert.deepEqual(restored.overview().readLessons,source.overview().readLessons)
    assert.deepEqual(restored.overview().fastTrackedLessons,source.overview().fastTrackedLessons)
    assert.deepEqual(restored.workspace('X01-design').answers,source.workspace('X01-design').answers)
    assert.deepEqual(restored.importData(raw),{importedRuns:0,importedEvidence:0})
    valid.runs[0].environment='changed'
    assert.throws(()=>restored.importData(JSON.stringify(valid)),/conflicting run id/)
    assert.equal(restored.run(id).environment,'test')
  } finally { await source.close(); await restored.close(); await rm(root,{recursive:true,force:true}) }
})

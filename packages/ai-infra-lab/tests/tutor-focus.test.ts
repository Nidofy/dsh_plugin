import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Engine } from '../src/engine.ts'
import { askInfraTutor } from '../src/tutor-context.ts'
import type { RunRecord } from '../src/types.ts'

it('filters a selected failed Gloo step, binds its diagnosis and rejects a foreign or successful step', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'infra-step-'))
  const engine = await Engine.open(dir)
  try {
    const id = 'D02-code', runId = 'selected'
    engine.store.putRun({id:runId, exerciseId:id, resourceProfile:'distributed-gloo', log:'unrelated log',
      run_status:'completed', check_status:'failed', events:[
        {runId,seq:1,type:'check',name:'ring_reduce_scatter',step:'ring_reduce_scatter',passed:true},
        {runId,seq:2,type:'check',name:'ring_all_gather',step:'ring_all_gather',passed:false,detail:'rank 1=irecv'},
      ]} as RunRecord)
    const capture = async (text: string) => ({status:'completed',text})
    const ask = (step:string, run:string|undefined) => askInfraTutor(engine,id,'Which rank is waiting?','steps',run,capture,step)
    const prompt = JSON.parse((await ask('ring_all_gather',runId)).text)
    const context = JSON.parse(prompt.observedRunContext)
    assert.equal(context.events.length,1)
    assert.equal(context.distributedDiagnostics[0].message,'rank 1=irecv')
    assert.equal(context.stderrTail,undefined)
    for (const step of ['ring_reduce_scatter','tp_mlp_forward']) await assert.rejects(ask(step,runId),/failed step/)
    await assert.rejects(ask('ring_all_gather',undefined),/Select a run/)
    const ex = engine.exercise('B05-code')
    assert.deepEqual(engine.hint(ex.id,'formula'),ex.hints[2])
    assert.deepEqual(engine.hint(ex.id,'code'),ex.hints[3])
    assert.ok(engine.hint(ex.id,'answer').en.includes(ex.reference))
  } finally { await engine.close(); await rm(dir,{recursive:true,force:true}) }
})

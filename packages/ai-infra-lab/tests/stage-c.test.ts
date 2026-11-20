import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { Engine } from '../src/engine.ts'
import { completedMemoryLedger, trainingExample, trainingLedger } from '../src/sim-stage-c.ts'
import { askInfraTutor } from '../src/tutor-context.ts'
import type { RunRecord } from '../src/types.ts'

it('accounts for master weights, moments, gradient width and checkpoint recomputation', () => {
  const a = { ...trainingExample, parameters: 7e9 }
  const r = trainingLedger(a)
  assert.equal(r.staticBytes,112e9)
  assert.equal(trainingLedger({...a,fp32Gradients:true}).staticBytes,18*7e9)
  const b = {...a,checkpoint:true}
  const cp = trainingLedger(b)
  assert.equal(cp.activations*4,r.activations)
  assert.equal(cp.stepFlops,4*r.forwardFlops)
  assert.equal(cp.staticBytes,r.staticBytes)
  const sgd = {...a,optimizer:'SGD' as const}
  assert.equal(trainingLedger(sgd).moments,0)
  assert.equal(completedMemoryLedger([a,b,sgd]),true)
  assert.equal(completedMemoryLedger([a,{...sgd,checkpoint:true}]),false)
  assert.equal(completedMemoryLedger([{...a,sequence:Infinity},b,sgd]),false)
})

it('gives a concept tutor only the selected run from this exercise and no reference solution', async () => {
  const root = await mkdtemp(join(tmpdir(),'infra-tutor-'))
  const engine = await Engine.open(root)
  try {
    const id = 'C04-code'
    for (const [runId,exerciseId] of [['selected',id],['old',id],['other','A00-code']]) {
      engine.store.putRun({id:runId,exerciseId,events:[{runId,seq:1,type:'metric',name:'marker-'+runId,value:1}],
        run_status:'completed',check_status:'passed',log:'',dataSource:'cpu_measured'} as RunRecord)
    }
    const capture = async (prompt:string) => ({status:'completed',text:prompt})
    const reply = await askInfraTutor(engine,id,'How should I start?','concept','selected',capture)
    assert.match(reply.text,/marker-selected/)
    assert.doesNotMatch(reply.text,/marker-old|marker-other/)
    assert.equal(JSON.parse(reply.text).requestedMode,'concept')
    assert.ok(!reply.text.includes('rows.append(o / l)'))
    assert.equal(engine.workspace(id).exercise.reference,'')
    assert.doesNotMatch((await askInfraTutor(engine,id,'Why?','concept',undefined,capture)).text,/marker-/)
    await assert.rejects(askInfraTutor(engine,id,'Why?','steps','other',capture),/current exercise/)
  } finally { await engine.close(); await rm(root,{recursive:true,force:true}) }
})

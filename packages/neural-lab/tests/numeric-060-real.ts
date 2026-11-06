import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadCatalog } from '../src/catalog.ts'
import { temporaryRunner } from './runner-helper.ts'
import type { RunRecord } from '../src/types.ts'

// Real Docker only. Registered runtime keys deliberately avoid coupling to lesson IDs.
const catalog = await loadCatalog()
const exercises = catalog.lessons.flatMap((l) => l.exercises)
const tmp = await temporaryRunner()
try {
  const env = await tmp.runner.environment()
  assert.ok(env.available, env.detail)
  const execute = async (key: string, config: Record<string, number>, mutation?: [string,string,string]) => {
    const e = exercises.find((e) => e.runtimeKey === key)
    assert.ok(e, `Missing registered protocol ${key}`)
    let code = e.reference
    if (mutation) {
      assert.equal(code.split(mutation[0]).length, 2, `Mutation must match once: ${mutation[0]}`)
      code = code.replace(mutation[0], mutation[1])
    }
    const input: RunRecord = {
      id: randomUUID(), exerciseId: e.id, code, config: {learningRate: 0.05, ...config}, seed: 42,
      createdAt: new Date().toISOString(), environment:'', help:'none', events:[], log:'',
      run_status:'queued', check_status:'not_run', contentVersion:catalog.version, testVersion:e.testVersion,
    }
    const r = await tmp.runner.execute(input,e,new AbortController().signal)
    assert.equal(r.run_status,'completed',JSON.stringify(r))
    assert.equal(r.cleanupPending,undefined)
    assert.equal(r.check_status,mutation?'failed':'passed',JSON.stringify(r.events.filter((e)=>e.passed===false)))
    assert.ok(r.events.length <= 1024)
    assert.ok(Buffer.byteLength(r.events.map((e)=>JSON.stringify(e)).join('\n')) < 262144)
    if (mutation) {
      assert.ok(r.events.some((e)=>e.type==='check' && e.name===mutation[2] && e.passed===false),JSON.stringify(r.events))
      assert.ok(!r.events.some((e)=>e.type==='sample'))
    } else if (key.startsWith('project-char')) {
      const layers = key==='project-char-flex-v1'?1:2
      for(let layer=0; layer<layers; layer++) {
        for(let head=0; head<(config.heads??2); head++)
          assert.ok(r.events.some((e)=>e.type==='tensor' && e.name===`attention.layer${layer}.head${head}`))
      }
      assert.ok(r.events.some((e)=>e.type==='metric' && e.name==='parameter_delta' && e.value!>0))
    }
    console.log(JSON.stringify({protocol:key,config,mutation:mutation?.[0],status:r.check_status,events:r.events.length,image:r.resolvedImageId}))
    return r
  }
  await execute('train-mlp-multi-v1',{})
  await execute('train-mlp-multi-v1',{},['loss = (model(x) - y).square().mean()','loss = (model(x) - y).square().sum() / len(x)','fresh minibatch gradients'])
  await execute('train-mlp-multi-v1',{},['loss.backward()','pass # no backward','training contract'])
  await execute('train-mlp-multi-v1',{},['optimizer.step()','pass # no update','SGD parameter update'])
  for (const [batchSize,context,heads] of [[1,2,6],[4,8,3],[2,4,1],[3,6,2]])
    await execute('project-char-flex-v1',{batchSize,context,heads})
  await execute('project-char-two-v1',{})
  await execute('project-char-observe-v1',{batchSize:4,context:8,heads:6,steps:24})
  await execute('project-char-observe-v1',{batchSize:1,context:2,heads:1,steps:8})
  const bad: [string,string,string][] = [
    ['h = p.heads','h = 2','attention alternate B/T/heads'],
    ['z = block(z, second)','z = z # skipped layer 2','decoder logits'],
    ['z = block(z, second)','z = block(z, second).detach()','embedding input gradient'],
    ['return causal_mask(scores).softmax(-1)','return scores.softmax(-1)','causal prefix unchanged'],
    ['return F.cross_entropy(scores.flatten(0, 1), targets.flatten())','return F.cross_entropy(scores.flatten(0, 1), targets.flatten()).detach()','decoder contract'],
    ['optimizer.step()','pass # no update','SGD parameter updates'],
  ]
  for (const mutation of bad) await execute('project-char-two-v1',{},mutation)
} finally { await tmp.cleanup() }

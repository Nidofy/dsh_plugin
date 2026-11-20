import assert from 'node:assert/strict'
import { it } from 'node:test'
import { evaluateEstimate,parseQuantity } from '../src/estimator.ts'
import { capacityExample,completedCapacity,completedServing,evaluateCapacityPlan,servingExample,simulateServing } from '../src/sim-stage-e.ts'

it('parses token rates and rejects scalar and bandwidth answers',()=>{
  const spec={dimension:'token_rate' as const,expectedBase:1200,canonicalDisplay:'1200 tok/s',relativeTolerance:.01}
  for (const v of ['1.2 ktok/s','1200 tokens/s','1200 tok/s']) assert.equal(evaluateEstimate(v,spec).status,'passed')
  for (const v of ['1200','1200 GB/s','1200 ms']) assert.equal(evaluateEstimate(v,spec).status,'failed')
  assert.equal(parseQuantity('0.02 ktok/s')?.baseValue,20)
})

it('replays arrivals, includes queueing in TTFT and releases only allocated KV pages',()=>{
  const a=servingExample, b={...a,policy:'continuous' as const}
  const r=simulateServing(b)
  assert.deepEqual(r,simulateServing(b))
  assert.equal(r.rejected,0)
  assert.ok(r.tokensPerSecond>simulateServing(a).tokensPerSecond)
  assert.equal(completedServing([a,b]),true)
  assert.equal(completedServing([a,{...b,pages:1}]),false)
  assert.ok(r.curve.every(p=>p.blocks<=b.pages && p.utilization===p.blocks/b.pages))
  const single={...a,requestCount:1,slots:1,promptLength:1,outputLength:2,arrivalGap:0}
  const x=simulateServing(single)
  assert.equal(x.ttft.p95,1+1/8+1/4)
  assert.equal(x.tpot.mean,1.25)
  const none=simulateServing({...single,pages:1,promptLength:64,outputLength:64})
  assert.equal(none.rejected,1)
  assert.equal(none.wallMs,0)
  const tiny=simulateServing({...b,pages:1})
  assert.equal(tiny.requests.length+tiny.rejected,b.requestCount)
  assert.ok(tiny.curve.every(p=>p.blocks<=1))
})

it('audits memory, topology, time, precision, concurrency and link budget independently',()=>{
  const serve={...capacityExample,tp:8}
  const train={...capacityExample,scenario:'train13b' as const,tp:2,zero:1,batch:8}
  const r=evaluateCapacityPlan(serve)
  assert.equal(r.weights,17.5e9)
  assert.equal(r.kv,2*80*8*128*2048*2*32/8)
  assert.ok(r.passes)
  assert.ok(evaluateCapacityPlan(train).passes)
  assert.ok(completedCapacity([serve,train]))
  assert.ok(!completedCapacity([serve]))
  assert.equal(evaluateCapacityPlan(capacityExample).checks.memory,false)
  assert.equal(evaluateCapacityPlan({...serve,pp:2}).checks.topology,false)
  assert.equal(evaluateCapacityPlan({...train,precision:'int4'}).checks.precision,false)
  assert.equal(evaluateCapacityPlan({...serve,batch:8}).checks.batch,false)
  assert.equal(evaluateCapacityPlan({...serve,batch:128}).checks.link,false)
  assert.equal(evaluateCapacityPlan({...serve,batch:128}).checks.latency,false)
  assert.ok(evaluateCapacityPlan({...train,zero:3}).gradients<evaluateCapacityPlan(train).gradients)
})

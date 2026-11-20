import assert from 'node:assert/strict'
import { it } from 'node:test'
import { completedPipeline, pipelineSchedule, ringCost } from '../src/sim-stage-d.ts'
import { validateRunEvent } from '../src/runner.ts'

it('places every forward/backward after its dependencies, with exact bubbles and peak activation counts', () => {
  for (const stages of [1,2,4,8]) for (const microbatches of [1,3,12,32]) {
    for (const schedule of ['GPipe','1F1B'] as const) {
      const {slots,bubble,peaks,ticks} = pipelineSchedule({stages,microbatches,schedule})
      const byStage = new Set(slots.map(s => [s.stage,s.tick].join('/')))
      assert.equal(byStage.size,2*stages*microbatches)
      assert.equal(ticks,2*(microbatches+stages-1))
      assert.equal(bubble,(stages-1)/(microbatches+stages-1))
      assert.equal(peaks[0],schedule==='GPipe'?microbatches:Math.min(stages,microbatches))
      for (const s of slots) {
        const before = (stage:number, phase:string) => slots.find(v => v.stage===stage && v.phase===phase && v.microbatch===s.microbatch)!.tick < s.tick
        if (s.phase==='F' && s.stage>0) assert.ok(before(s.stage-1,'F'))
        if (s.phase==='B') {
          assert.ok(before(s.stage,'F'))
          if (s.stage<stages-1) assert.ok(before(s.stage+1,'B'))
        }
      }
    }
  }
  assert.equal(completedPipeline([{stages:4,microbatches:12,schedule:'GPipe'},{stages:4,microbatches:12,schedule:'1F1B'}]),true)
  assert.equal(completedPipeline([{stages:4,microbatches:1,schedule:'GPipe'},{stages:4,microbatches:1,schedule:'1F1B'}]),false)
  const ring = ringCost(4,5,1e9,4000)
  assert.equal(ring.rounds,6)
  assert.ok(Math.abs(ring.elapsedSeconds-36e-6)<1e-12)
  assert.equal(ring.normalizedSeconds,ring.elapsedSeconds/4)
})

it('bounds and validates rank timelines', () => {
  const event = {runId:'r',seq:1,type:'config' as const,name:'timeline'}
  const slot = {rank:3,op:'all_reduce',startMs:0,endMs:1}
  validateRunEvent({...event,timeline:[slot]},'r',1)
  for (const timeline of [Array(129).fill(slot), [{...slot,rank:4}], [{...slot,endMs:-1}], [{...slot,startMs:NaN}], [null]]) {
    assert.throws(()=>validateRunEvent({...event,timeline:timeline as any},'r',1))
  }
})

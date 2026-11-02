import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadCatalog } from '../src/catalog.ts'
import { temporaryRunner } from './runner-helper.ts'
import type { RunRecord } from '../src/types.ts'
const catalog = await loadCatalog()
const exercises = catalog.lessons.flatMap((l) => l.exercises)
const tmp = await temporaryRunner()
try {
  for (const [id, before, after] of [
    ['L12-assembly', '', ''],
    ['L12-variant', '', ''],
    ['L12-signal', '', ''],
    ['L12-signal', 'range(cut-length)', 'range(cut)'],
    ['L12-signal', 'std(unbiased=False)', 'std(unbiased=True)'],
    ['L12-assembly', 'window[:, 1:]', 'window[:, :-1]'],
    ['L12-assembly', 'return causal_mask(scores).softmax(-1)', 'return scores.softmax(-1)'],
    ['L12-variant', 'h = p.heads', 'h = 2'],
    ['L12-assembly', 'h = x + attention', 'h = 0*x + attention'],
    ['L12-assembly', 'lm_head(block(x, p), p)', 'lm_head(block(x.detach(), p), p)'],
    ['L12-assembly', 'optimizer.step()', 'pass'],
    ['L12-signal', 'return (F.pad', 'return x.roll(-1, -1) + w.sum()*0 # (F.pad'],
  ]) {
    const e = exercises.find((e) => e.id === id)!
    const code = before ? e.reference.replace(before, after) : e.reference
    if (before) assert.notEqual(code, e.reference)
    const input: RunRecord = {
      id: randomUUID(),
      exerciseId: id,
      code,
      config: { learningRate: 0.05 },
      seed: 42,
      createdAt: new Date().toISOString(),
      environment: '',
      help: 'none',
      events: [],
      log: '',
      run_status: 'queued',
      check_status: 'not_run',
      contentVersion: catalog.version,
      testVersion: e.testVersion,
    }
    const r = await tmp.runner.execute(input, e, new AbortController().signal)
    console.log(
      id,
      before || 'reference',
      r.run_status,
      r.check_status,
      r.events.find((x) => x.passed === false)?.detail ?? r.reason ?? '',
    )
    assert.equal(r.run_status, 'completed', r.reason)
    assert.equal(r.check_status, before ? 'failed' : 'passed')
    if (!before && id !== 'L12-signal') assert.ok(r.events.some((ev) => ev.type === 'sample'))
  }
} finally {
  await tmp.cleanup()
}

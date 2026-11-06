import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadCatalog } from '../src/catalog.ts'
import { temporaryRunner } from './runner-helper.ts'
import type { RunRecord } from '../src/types.ts'

// Integration evidence only: never execute submissions with a host Python fallback.
const catalog = await loadCatalog()
const exercises = catalog.lessons.flatMap((l) => l.exercises)
const mutations = [
  ['L12-assembly', 'detached loss', 'return F.cross_entropy(scores.flatten(0, 1), targets.flatten())', 'return F.cross_entropy(scores.flatten(0, 1), targets.flatten()).detach()', 'decoder contract'],
  ['L12-assembly', 'same forward wrong gradient', 'return x @ p["lm"]', 'return (x @ p["lm"]) * 2 - (x @ p["lm"]).detach()', 'all parameter gradients'],
  ['L12-assembly', 'wrong labels inside loss', 'targets.flatten())', '(targets.flatten() + 1) % scores.size(-1))', 'module loss_fn'],
  ['L12-assembly', 'batch coupling', 'return F.layer_norm(x, (x.size(-1),))', 'return F.layer_norm(x + x.mean(0), (x.size(-1),))', 'batch isolation'],
  ['L12-assembly', 'reverse causal mask', '.tril()', '.triu()', 'causal prefix unchanged'],
  ['L12-signal', 'validation overlaps boundary', 'range(cut,total-length)', 'range(cut-1,total-length)', 'split and normalization'],
  ['L12-signal', 'omitted final training window', 'range(cut-length)', 'range(cut-length-1)', 'split and normalization'],
  ['L12-signal', 'detached convolution weights', 'w[:4].view(1, 1, 4)', 'w[:4].detach().view(1, 1, 4)', 'causal_cnn'],
  ['L12-signal', 'cross batch local attention', 'v = F.pad(x, (3, 0))', 'v = F.pad(x + x.mean(0), (3, 0))', 'local_attention'],
] as const

const tmp = await temporaryRunner()
try {
  const env = await tmp.runner.environment()
  assert.ok(env.available, 'Docker is required: ' + env.detail)
  const execute = async (id: string, code: string) => {
    const exercise = exercises.find((e) => e.id === id)!
    const input: RunRecord = {
      id: randomUUID(), exerciseId: id, code, config: { learningRate: 0.05 },
      seed: 42, createdAt: new Date().toISOString(), environment: '', help: 'none',
      events: [], log: '', run_status: 'queued', check_status: 'not_run',
      contentVersion: catalog.version, testVersion: exercise.testVersion,
    }
    const out = await tmp.runner.execute(input, exercise, new AbortController().signal)
    assert.equal(out.run_status, 'completed', JSON.stringify(out))
    assert.equal(out.cleanupPending, undefined)
    assert.equal(out.resolvedImageId, env.resolvedImageId)
    return out
  }
  for (const id of new Set(mutations.map((m) => m[0]))) {
    const result = await execute(id, exercises.find((e) => e.id === id)!.reference)
    assert.equal(result.check_status, 'passed', JSON.stringify(result))
    assert.ok(result.trainingManifest)
    console.log(JSON.stringify({ id, case: 'reference', status: result.check_status, image: result.resolvedImageId }))
  }
  for (const [id, label, from, to, failedCheck] of mutations) {
    const reference = exercises.find((e) => e.id === id)!.reference
    assert.equal(reference.split(from).length, 2, 'Mutation must match exactly once: ' + label)
    const result = await execute(id, reference.replace(from, to))
    assert.equal(result.check_status, 'failed', label)
    assert.ok(result.events.some((e) => e.type === 'check' && e.name === failedCheck && e.passed === false), JSON.stringify({ label, result }))
    assert.ok(!result.events.some((e) => e.type === 'sample'), 'Wrong programs must not publish a successful sample')
    console.log(JSON.stringify({ id, case: label, status: result.check_status, failedCheck }))
  }
} finally {
  await tmp.cleanup()
}

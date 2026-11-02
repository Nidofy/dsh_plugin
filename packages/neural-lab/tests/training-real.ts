import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadCatalog } from '../src/catalog.ts'
import { temporaryRunner } from './runner-helper.ts'
import type { RunRecord } from '../src/types.ts'

const catalog = await loadCatalog()
const exercise = catalog.lessons
  .flatMap((l) => l.exercises)
  .find((e) => e.runtimeKey === 'train-mlp-v1')!
const tmp = await temporaryRunner()
const evidence: unknown[] = []
try {
  const execute = async (
    label: string,
    code: string,
    rate = 0.05,
    seed = 42,
    activity = exercise,
  ) => {
    const input: RunRecord = {
      id: randomUUID(),
      exerciseId: activity.id,
      code,
      config: { learningRate: rate },
      prediction: 'Measure update and validation errors',
      seed,
      contentVersion: catalog.version,
      testVersion: activity.testVersion,
      createdAt: new Date().toISOString(),
      help: 'none',
      environment: '',
      run_status: 'queued',
      check_status: 'not_run',
      events: [],
      log: '',
    }
    const r = await tmp.runner.execute(input, activity, new AbortController().signal)
    const failed = r.events.filter((e) => e.type === 'check' && !e.passed)
    evidence.push({
      label,
      exerciseId: activity.id,
      id: r.id,
      image: r.resolvedImageId,
      manifest: r.trainingManifest,
      config: r.effectiveConfig,
      status: r.run_status,
      check: r.check_status,
      failures: failed.map((e) => [e.name, e.detail]),
    })
    console.log(label, r.run_status, r.check_status, failed[0]?.name ?? '')
    assert.equal(r.run_status, 'completed', JSON.stringify(r))
    return r
  }
  const ref = exercise.reference
  const first = await execute('reference', ref)
  assert.equal(first.check_status, 'passed', JSON.stringify(first))
  const curve = (r: RunRecord) =>
    r.events
      .filter((e) => e.name === 'validation_loss' && e.source === 'program')
      .map((e) => e.value)
  assert.equal(curve(first).length, 8)
  const replay = await execute('repeat', ref)
  assert.deepEqual(curve(replay), curve(first))
  const changed = await execute('different learning rate', ref, 0.2)
  assert.equal(changed.check_status, 'passed')
  assert.deepEqual(changed.trainingManifest, first.trainingManifest)
  assert.notDeepEqual(curve(changed), curve(first))
  const other = await execute('different seed', ref, 0.05, 43)
  assert.notEqual(other.trainingManifest!.splitHash, first.trainingManifest!.splitHash)
  for (const [label, from, to, check] of [
    ['skip zero_grad', 'optimizer.zero_grad()', 'pass', 'fresh minibatch gradients'],
    ['skip backward', 'loss.backward()', 'pass', 'training contract'],
    ['skip step', 'optimizer.step()', 'pass', 'SGD parameter update'],
    [
      'wrong loss',
      'loss = (model(x) - y).square().mean()',
      'loss = (model(x) - y).abs().mean()',
      'forward + MSE',
    ],
    ['constant metric', 'return loss.item()', 'return 0.12345', 'forward + MSE'],
    [
      'wrong validation set',
      'return (model(x) - y).square().mean().item()',
      'return (model(torch.zeros_like(x)) - y).square().mean().item()',
      'held-out validation MSE',
    ],
    [
      'validation changes weights',
      'with torch.no_grad():',
      'with torch.no_grad():\n        next(model.parameters()).add_(1)',
      'validation preserves parameters',
    ],
    [
      'validation tracks grad',
      'with torch.no_grad():',
      'with torch.enable_grad():',
      'validation uses eval and no_grad',
    ],
    [
      'validation training mode',
      'model.eval()',
      'model.train()',
      'validation uses eval and no_grad',
    ],
  ]) {
    assert.ok(ref.includes(from))
    const wrong = await execute(label, ref.replace(from, to))
    assert.equal(wrong.check_status, 'failed', label)
    assert.ok(
      wrong.events.some((e) => e.name === check && e.passed === false),
      JSON.stringify(wrong),
    )
  }
  const staleBatch = ref
    .replace(
      'optimizer.zero_grad()',
      'optimizer.zero_grad()\n    import json\n    with open("/tmp/train-batch.json", "w") as f: json.dump([t.tolist() for t in batch], f)',
    )
    .replace(
      'with torch.no_grad():',
      'import json\n    with open("/tmp/train-batch.json") as f: x,y = [torch.tensor(v,dtype=torch.float64) for v in json.load(f)]\n    with torch.no_grad():',
    )
  const reused = await execute('validation reuses actual last training batch', staleBatch)
  assert.equal(reused.check_status, 'failed')
  assert.ok(reused.events.some((e) => e.name === 'held-out validation MSE' && e.passed === false))
  const lm = catalog.lessons
    .flatMap((l) => l.exercises)
    .find((e) => e.runtimeKey === 'train-char-v1')!
  const runLM = (label: string, code: string, rate = 0.05) => execute(label, code, rate, 42, lm)
  const partial = await runLM(
    'first function only',
    lm.starter.replace(
      'raise NotImplementedError("shifted")',
      'return window[:, :-1], window[:, 1:]',
    ),
  )
  assert.equal(partial.check_status, 'failed')
  assert.ok(partial.events.some((e) => e.name === 'module shifted' && e.passed))
  assert.ok(partial.events.some((e) => e.name === 'module attention' && !e.passed))
  const baseline = await runLM('decoder reference', lm.reference)
  assert.equal(baseline.check_status, 'passed', JSON.stringify(baseline))
  const sample = (r: RunRecord) => r.events.find((e) => e.type === 'sample')?.detail
  assert.match(sample(baseline)!, /^[abcde]{17}$/)
  assert.equal(curve(baseline).length, 4)
  const repeated = await runLM('decoder repeat', lm.reference)
  assert.equal(repeated.check_status, 'passed')
  assert.deepEqual(curve(repeated), curve(baseline))
  assert.equal(sample(repeated), sample(baseline))
  const faster = await runLM('decoder changed rate', lm.reference, 0.2)
  assert.equal(faster.check_status, 'passed')
  assert.deepEqual(faster.trainingManifest, baseline.trainingManifest)
  assert.notDeepEqual(curve(faster), curve(baseline))
  for (const [label, from, to, failedCheck] of [
    ['unshifted targets', 'window[:, 1:]', 'window[:, :-1]', 'next-token windows'],
    ['missing positions', ' + p["position"][:ids.shape[1]]', '', 'token and position embedding'],
    ['future leak', '.masked_fill(~allowed, -torch.inf)', '', 'causal prefix unchanged'],
    ['mixed batches', 'n = F.layer_norm(x,', 'n = F.layer_norm(x + x.mean(0),', 'batch isolation'],
    ['unscaled attention', ' / (width // 2) ** 0.5', '', 'decoder logits'],
    ['wrong head merge', 'mixed.transpose(1, 2).reshape', 'mixed.reshape', 'decoder logits'],
    [
      'detached embedding',
      'return block(x, p) @',
      'return block(x.detach(), p) @',
      'embedding input gradient',
    ],
    [
      'detached query',
      '(n @ w).reshape',
      '(n @ (w.detach() if w is p["q"] else w)).reshape',
      'all parameter gradients',
    ],
    ['missing pre-LN', 'z = F.layer_norm(h, (width,))', 'z = h', 'decoder logits'],
    ['missing FFN', 'return h + F.relu(z @ p["up"]) @ p["down"]', 'return h', 'decoder logits'],
  ]) {
    assert.ok(lm.reference.includes(from))
    const wrong = await runLM(label, lm.reference.replace(from, to))
    assert.equal(wrong.check_status, 'failed', label)
    assert.ok(
      wrong.events.some((e) => e.name === failedCheck && e.passed === false),
      JSON.stringify(wrong),
    )
    assert.equal(sample(wrong), undefined)
  }
  await mkdir(join(import.meta.dirname, 'results'), { recursive: true })
  await writeFile(
    join(import.meta.dirname, 'results/training-021.json'),
    JSON.stringify(
      { contentVersion: catalog.version, testVersion: exercise.testVersion, evidence },
      null,
      2,
    ),
  )
} finally {
  await tmp.cleanup()
}

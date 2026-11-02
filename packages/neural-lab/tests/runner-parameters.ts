import { strict as assert } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { loadCatalog } from '../src/catalog.ts'
import type { RunRecord, ExperimentConfig } from '../src/types.ts'
import { temporaryRunner } from './runner-helper.ts'
const catalog = await loadCatalog()
const temporary = await temporaryRunner()
const results: RunRecord[] = []
try {
  const env = await temporary.runner.environment()
  assert.ok(env.available, env.detail)
  const execute = async (key: string, config: Record<string, unknown>, expected = 'completed') => {
    const exercise = catalog.lessons.flatMap((l) => l.exercises).find((e) => e.runtimeKey === key)!
    const literal = JSON.stringify(config).replace(/true/g, 'True').replace(/false/g, 'False')
    const code = 'def configure():\n    return ' + literal + '\n'
    const run: RunRecord = {
      id: randomUUID(),
      exerciseId: exercise.id,
      code,
      contentVersion: catalog.version,
      testVersion: exercise.testVersion,
      seed: 42,
      config: { seed: 42 },
      environment: '',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help: 'none',
    }
    const result = await temporary.runner.execute(run, exercise, new AbortController().signal)
    results.push(result)
    assert.equal(result.run_status, expected, JSON.stringify(result))
    if (expected === 'completed') {
      assert.equal(result.check_status, 'passed')
      assert.ok(result.effectiveConfig)
      assert.equal(result.events.filter((e) => e.type === 'config').length, 1)
    } else {
      assert.equal(result.check_status, 'not_run')
      assert.equal(result.effectiveConfig, undefined)
    }
    return result
  }
  const metric = (run: RunRecord, name: string) =>
    run.events.filter((e) => e.type === 'metric' && e.name === name).map((e) => e.value)
  const tensor = (run: RunRecord, name: string) =>
    run.events.find((e) => e.type === 'tensor' && e.name === name)?.data
  const gradA = await execute('grad', { eps: [0.1] })
  const gradB = await execute('grad', { eps: [0.01] })
  assert.notDeepEqual(metric(gradA, 'gradient_error'), metric(gradB, 'gradient_error'))
  assert.deepEqual(gradB.effectiveConfig, { eps: [0.01] })
  const softA = await execute('softmax', { offset: 0, temperature: 1 })
  const softB = await execute('softmax', { offset: 1000, temperature: 1 })
  const softC = await execute('softmax', { offset: 0, temperature: 2 })
  assert.notDeepEqual(metric(softA, 'naive_nonfinite'), metric(softB, 'naive_nonfinite'))
  assert.deepEqual(tensor(softA, 'stable_probabilities'), tensor(softB, 'stable_probabilities'))
  assert.notDeepEqual(tensor(softA, 'stable_probabilities'), tensor(softC, 'stable_probabilities'))
  const attA = await execute('attention', { dim: 8, scale: true })
  const attB = await execute('attention', { dim: 8, scale: false })
  const attC = await execute('attention', { dim: 16, scale: true })
  assert.notDeepEqual(tensor(attA, 'selected_weights'), tensor(attB, 'selected_weights'))
  assert.equal(tensor(attC, 'selected_output')![0]!.length, 16)
  const causalA = await execute('causal', { perturbation: 0 })
  const causalB = await execute('causal', { perturbation: 10 })
  assert.deepEqual(metric(causalA, 'last_position_change'), [0])
  assert.ok(metric(causalB, 'last_position_change')[0]! > 0)
  assert.deepEqual(metric(causalB, 'protected_change'), [0])
  for (const key of ['mlp', 'lm']) {
    const a = await execute(key, { steps: 4, lr: 0.03 })
    const b = await execute(key, { steps: 4, lr: 0.01 })
    const c = await execute(key, { steps: 6, lr: 0.03 })
    const trainName = key === 'mlp' ? 'train_lr=' : 'train_loss'
    const trainValues = (run: RunRecord) =>
      run.events
        .filter((e) => e.type === 'metric' && e.name.startsWith(trainName))
        .slice(0, 4)
        .map((e) => e.value)
    assert.notDeepEqual(
      trainValues(a),
      trainValues(b),
      'Learning rate must change real loss values, not just run metadata',
    )
    assert.deepEqual(
      trainValues(a),
      trainValues(c),
      'Longer training must retain the same fixed-seed prefix',
    )
    assert.ok(
      c.events.some((e) => e.type === 'metric' && e.step === 5),
      'Configured step count must execute the additional steps',
    )
    assert.deepEqual(c.effectiveConfig, { steps: 6, lr: 0.03 })
  }
  const defaults: Record<string, ExperimentConfig> = {
    grad: { eps: [0.1, 0.01, 0.001, 0.0001, 0.00001] },
    softmax: { offset: 1000, temperature: 1 },
    attention: { dim: 8, scale: true },
    causal: { perturbation: 10 },
    mlp: { steps: 60, lr: 0.03 },
    lm: { steps: 60, lr: 0.03 },
  }
  for (const [key, config] of Object.entries(defaults)) {
    const r = await execute(key, {})
    assert.deepEqual(r.effectiveConfig, config)
  }
  for (const [key, config] of [
    ['grad', { eps: [] }],
    ['grad', { eps: [true] }],
    ['softmax', { temperature: 0 }],
    ['softmax', { lr: 0.03 }],
    ['attention', { dim: 3.5 }],
    ['attention', { scale: 1 }],
    ['causal', { perturbation: -1 }],
    ['mlp', { steps: true }],
    ['lm', { lr: 2 }],
  ] as const)
    await execute(key, config, 'failed')
  // Non-finite return values must fail before any trusted configuration is emitted.
  const e = catalog.lessons[2]!.exercises.find((e) => e.kind === 'experiment')!
  const nonfinite: RunRecord = {
    ...results[0]!,
    id: randomUUID(),
    exerciseId: e.id,
    code: 'def configure():\n    return {"eps": [float("nan")]}\n',
    effectiveConfig: undefined,
    events: [],
    run_status: 'queued',
    check_status: 'not_run',
  }
  const invalid = await temporary.runner.execute(nonfinite, e, new AbortController().signal)
  results.push(invalid)
  assert.equal(invalid.run_status, 'failed')
  assert.equal(invalid.effectiveConfig, undefined)
  const unknown = await temporary.runner.execute(
    { ...nonfinite, id: randomUUID(), code: 'def solve(x):\n    return [x[:-1], x[1:]]\n' },
    { ...e, kind: 'code', runtimeKey: 'code99' },
    new AbortController().signal,
  )
  results.push(unknown)
  assert.equal(unknown.run_status, 'failed')
  assert.match(unknown.log, /unknown code key: code99/)
  console.log('Parameter effects, defaults, bounds, types and unknown keys verified')
} finally {
  try {
    await mkdir('tests/results', { recursive: true })
    await writeFile(
      'tests/results/parameter-runs.json',
      JSON.stringify({ version: catalog.version, results }, null, 2),
    )
  } finally {
    await temporary.cleanup()
  }
}

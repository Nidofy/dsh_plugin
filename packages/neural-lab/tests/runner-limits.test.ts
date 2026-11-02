import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { Runner } from '../src/runner.ts'
test('resource settings reject unsafe or nonfinite limits', () => {
  assert.throws(() => new Runner('/tmp/neural-test', '--privileged'), /image reference/)
  for (const limits of [
    { cpus: NaN },
    { memoryMb: 0 },
    { timeoutMs: Infinity },
    { outputBytes: 1 },
    { cpus: 9 },
  ])
    assert.throws(
      () => new Runner('/tmp/neural-test', 'dsh-neural-lab-cpu:0.1', limits),
      /resource limits/,
    )
})
import type { RunRecord, Exercise } from '../src/types.ts'
const base: RunRecord = {
  id: '../escape',
  exerciseId: 'x',
  code: '',
  contentVersion: '1',
  testVersion: '1',
  seed: 42,
  config: {},
  environment: '',
  run_status: 'queued',
  check_status: 'not_run',
  createdAt: '',
  events: [],
  log: '',
  help: 'none',
}
const exercise: Exercise = {
  id: 'x',
  lessonId: 'L01',
  title: '',
  kind: 'code',
  prompt: '',
  starter: '',
  reference: '',
  hints: [],
  concepts: [],
  testVersion: '1',
  runtimeKey: 'code01',
  inputDomain: '',
  commonErrors: [],
}
test('run identity rejects path traversal before filesystem access', async () => {
  await assert.rejects(
    new Runner('/tmp/neural-test').execute(base, exercise, new AbortController().signal),
    /identity/,
  )
})
test('already cancelled run never invokes execution', async () => {
  const a = new AbortController()
  a.abort()
  const r = await new Runner('/tmp/neural-test').execute(
    { ...base, id: 'cancelled' },
    exercise,
    a.signal,
  )
  assert.equal(r.run_status, 'cancelled')
  assert.equal(r.check_status, 'not_run')
  assert.deepEqual(r.events, [])
})

test('diagnostics require bounded, finite matrices and traceable sample axes', async () => {
  const { validateDiagnosticEvent } = await import('../src/runner.ts')
  const event = {
    runId: 'r',
    seq: 1,
    type: 'tensor' as const,
    name: 'attention.layer0.head0',
    shape: [33, 33],
    stride: 3,
    data: Array.from({ length: 11 }, () => Array(11).fill(0)),
  }
  assert.doesNotThrow(() => validateDiagnosticEvent(event))
  assert.throws(() => validateDiagnosticEvent({ ...event, stride: 1 }), /axes/)
  assert.throws(
    () =>
      validateDiagnosticEvent({
        ...event,
        shape: undefined,
        data: Array.from({ length: 129 }, () => [0]),
      }),
    /tensor/i,
  )
  assert.throws(
    () => validateDiagnosticEvent({ ...event, shape: undefined, data: [[Infinity]] }),
    /tensor/i,
  )
  assert.throws(() => validateDiagnosticEvent({ ...event, type: 'shape', shape: [-1] }), /shape/)
})

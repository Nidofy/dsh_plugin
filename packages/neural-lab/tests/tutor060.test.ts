import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Engine } from '../src/engine.ts'
import { askActivityTutor, validateTutorContext } from '../src/tutor-context.ts'
import type { RunRecord } from '../src/types.ts'
import { temporaryDirectory } from './temporary-directory.mjs'

const exerciseId = 'L04-train'
async function fixture(body: (engine: Engine, run: RunRecord) => Promise<void>) {
  const temp = await temporaryDirectory('neural-tutor060-')
  const engine = await Engine.open(temp.directory)
  try {
    const run: RunRecord = { id: 'old-run', exerciseId, code: '# old executed code',
      contentVersion: 'old-content', testVersion: 'old-test', seed: 42, config: {},
      environment: 'fixture', createdAt: new Date().toISOString(), run_status: 'completed',
      check_status: 'failed', help: 'none', log: '', events: [
        { runId: 'old-run', seq: 0, type: 'check', name: 'fresh minibatch gradients', passed: false, detail: 'step 1' },
        { runId: 'old-run', seq: 1, type: 'check', name: 'validation uses eval and no_grad', passed: true },
      ] }
    engine.store.putRun(run)
    await body(engine, run)
  } finally { await engine.close(); await temp.cleanup() }
}
test('focused two turns preserve selected older run, current draft and conservative help provenance', async () => fixture(async (engine, run) => {
  engine.store.putRun({ ...run, id: 'new-run', code: '# newer', events: [], check_status: 'passed', createdAt: '2099-01-01' })
  engine.saveDraft(exerciseId, '# unexecuted', 0)
  const prompts: any[] = []
  const tutor = async (prompt: string) => { prompts.push(JSON.parse(prompt)); return { status: 'completed', text: 'A reply with potentially excessive code' } }
  const focus = { runId: run.id, component: 'train_step', check: 'fresh minibatch gradients' }
  await askActivityTutor(engine, exerciseId, 'Why this check?', '', tutor, 'concept', focus)
  await askActivityTutor(engine, exerciseId, 'What should I hold fixed?', '', tutor, 'steps', focus)
  const second = prompts[1]
  assert.equal(second.recentMessages.length, 2)
  assert.equal(second.recentMessages[0].requestedMode, 'concept')
  assert.equal(second.recentMessages[1].deliveredHelp, 'unknown')
  assert.equal(second.observedHelp, 'unknown')
  assert.equal(second.lastExecutedSnapshot.runId, run.id)
  assert.equal(second.lastExecutedSnapshot.checks, 'failed')
  assert.equal(second.lastExecutedSnapshot.status, 'completed')
  assert.equal(second.lastExecutedSnapshot.matchesCurrentDraft, false)
  assert.equal(second.currentDraft.code, '# unexecuted')
  assert.equal(second.focus.checks[0].passed, false)
  assert.equal(engine.store.help(exerciseId), 'unknown')
  assert.equal(engine.store.evidence().length, 0)
  assert.ok(engine.store.history<any>(exerciseId, 'help-delivered').every(e => e.level === 'unknown'))
}))
test('reject invalid run/check/component before recording or calling provider', async () => fixture(async (engine, run) => {
  engine.store.putRun({ ...run, id: 'foreign', exerciseId: 'L01-code' })
  let called = 0
  for (const context of [
    { runId: 'missing', component: 'train_step' }, { runId: 'foreign', component: 'train_step' },
    { runId: run.id, component: 'made-up' }, { runId: run.id, component: 'train_step', check: 'missing' },
    { runId: run.id, component: 'validate', check: 'fresh minibatch gradients' },
  ]) await assert.rejects(askActivityTutor(engine, exerciseId, 'help', '', async () => { called++; return { status: 'completed', text: 'x' } }, 'concept', context))
  assert.equal(called, 0)
  assert.equal(engine.store.history(exerciseId, 'message').length, 0)
  assert.equal(validateTutorContext(engine, exerciseId, { runId: run.id, component: 'validate', check: 'validation uses eval and no_grad' }).checks.length, 1)
}))
test('explicit check ownership overrides legacy mapping; unowned project checks rejected', async () => fixture(async (engine, run) => {
  const exercise = engine.exercise(exerciseId)
  exercise.components = [{ name: 'layer2', version: '1', dependsOn: [] }]
  run.events = [{ runId: run.id, seq: 0, type: 'check', name: 'gradient', passed: false, component: 'layer2' } as any]
  engine.store.putRun(run)
  assert.equal(validateTutorContext(engine, exerciseId, { runId: run.id, component: 'layer2', check: 'gradient' }).checks.length, 1)
  assert.throws(() => validateTutorContext(engine, exerciseId, { runId: run.id, component: 'train_step', check: 'gradient' }))
  delete (run.events[0] as any).component
  engine.store.putRun(run)
  assert.throws(() => validateTutorContext(engine, exerciseId, { runId: run.id, component: 'layer2', check: 'gradient' }))
}))
test('failed/cancelled/unavailable/throw/empty output never count as delivered help', async () => fixture(async (engine) => {
  for (const status of ['failed', 'cancelled', 'unavailable', 'completed']) {
    await askActivityTutor(engine, exerciseId, 'help', '', async () => ({ status, text: status === 'completed' ? '' : 'partial' }), 'answer')
  }
  await askActivityTutor(engine, exerciseId, 'help', '', async () => { throw Error('fixture') }, 'code')
  assert.equal(engine.store.help(exerciseId), 'none')
  assert.equal(engine.store.history(exerciseId, 'help-delivered').length, 0)
  assert.ok(engine.store.history<any>(exerciseId, 'message').filter(m => m.role === 'assistant').every(m => m.deliveredHelp === 'none'))
}))

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Engine } from '../src/engine.ts'
import { askActivityTutor } from '../src/tutor-context.ts'
import { mentor } from '../src/mentor.ts'
import type { RunRecord } from '../src/types.ts'
import { temporaryDirectory } from './temporary-directory.mjs'

const exerciseId = 'L04-train'

test('mentor unavailable model and abort after completed event release their lifecycle', async () => {
  const abort = new AbortController()
  assert.equal((await mentor({ get: () => undefined } as any, 'Help', abort.signal)).status, 'unavailable')
  let listener: (...args: any[]) => void = () => {}
  let stopped = 0, disposed = 0, cancelled = 0
  const context: any = {
    get: (name: string) => name === 'agents' ? {
      create: async ({ sessionId }: any) => ({
        agent: {
          followup: () => {
            listener({ id: sessionId }, { type: 'assistant/message', data: {
              message: { content: [{ type: 'text', text: 'Already generated' }] },
            } })
            listener({ id: sessionId }, { type: 'turn/end', data: { reason: { kind: 'completed' } } })
            abort.abort()
          },
          cancel: () => { cancelled++ },
          whenIdle: async () => {},
        },
        dispose: async () => { disposed++ },
      }),
    } : { currentSelection: () => ({ provider: 'fixture', model: 'fixture' }) },
    on: (_name: string, callback: typeof listener) => {
      listener = callback
      return () => { stopped++ }
    },
    logger: { warn: () => {} },
  }
  const result = await mentor(context, 'Help', abort.signal)
  assert.equal(result.status, 'cancelled')
  assert.equal(cancelled, 1)
  assert.equal(stopped, 1)
  assert.equal(disposed, 1)
  context.get = (name: string) => name === 'agents' ? {} : { currentSelection: () => ({}) }
  assert.equal((await mentor(context, 'Help', new AbortController().signal)).status, 'unavailable')
  assert.equal(stopped, 2)
})
async function fixture(body: (engine: Engine) => Promise<void>) {
  const temp = await temporaryDirectory('neural-tutor-1106-')
  const engine = await Engine.open(temp.directory)
  try { await body(engine) } finally { await engine.close(); await temp.cleanup() }
}
function run(engine: Engine, id = 'old-run'): RunRecord {
  const e = engine.exercise(exerciseId)
  return { id, exerciseId, code: e.reference,
    codeHash: createHash('sha256').update(e.reference).digest('hex'),
    contentVersion: 'old-content', testVersion: 'old-test', attemptId: 'old-attempt',
    seed: 42, config: {}, environment: 'fixture', createdAt: new Date().toISOString(),
    run_status: 'completed', check_status: 'failed', help: 'none', events: [], log: 'failed check' }
}

test('two follow-ups keep bounded same-attempt conversation and distinguish old failed run from draft', async () => fixture(async engine => {
  const old = run(engine)
  engine.store.putRun(old)
  engine.saveDraft(exerciseId, '# new unexecuted code', 0)
  let prompt: any
  const tutor = async (text: string) => {
    prompt = JSON.parse(text)
    return { status: 'completed', text: 'Consider the gradient.' }
  }
  await askActivityTutor(engine, exerciseId, 'Why?', '', tutor, 'concept')
  await askActivityTutor(engine, exerciseId, 'Which gradient?', '', tutor, 'steps')
  assert.deepEqual(prompt.recentMessages.map((m: any) => m.role), ['user', 'assistant'])
  assert.equal(prompt.recentMessages[0].text, 'Why?')
  await askActivityTutor(engine, exerciseId, 'Why this layer?', '', tutor, 'concept')
  assert.equal(prompt.recentMessages.length, 4)
  assert.equal(prompt.currentDraft.code, '# new unexecuted code')
  assert.equal(prompt.lastExecutedSnapshot.code, old.code)
  assert.equal(prompt.lastExecutedSnapshot.matchesCurrentDraft, false)
  assert.equal(prompt.lastExecutedSnapshot.contentVersion, 'old-content')
  assert.equal(prompt.lastExecutedSnapshot.status, 'completed')
  assert.equal(prompt.lastExecutedSnapshot.checks, 'failed')
  assert.equal(prompt.lastExecutedSnapshot.source, 'program')
  assert.equal(engine.run(old.id).check_status, 'failed')
  assert.equal(engine.store.evidence().length, 0)
  for (let n = 0; n < 5; n++) await askActivityTutor(engine, exerciseId, 'x'.repeat(2000), '', tutor)
  assert.equal(prompt.recentMessages.length, 8)
  assert.ok(prompt.recentMessages.every((m: any) => m.text.length <= 1200))
  engine.store.beginIndependent(exerciseId)
  await askActivityTutor(engine, exerciseId, 'New independent attempt', '', tutor)
  assert.deepEqual(prompt.recentMessages, [])
}))

test('late answer belongs to original attempt and cannot taint new independent attempt', async () => fixture(async engine => {
  let resolve!: (reply: { status: string; text: string }) => void
  let started!: () => void
  const ready = new Promise<void>(r => { started = r })
  const pending = askActivityTutor(engine, exerciseId, 'Help', '', () => {
    started()
    return new Promise(r => { resolve = r })
  }, 'answer')
  await ready
  engine.store.beginIndependent(exerciseId)
  const current = engine.workspace(exerciseId).attemptId
  resolve({ status: 'completed', text: 'An answer for the old attempt' })
  const result = await pending
  assert.equal(result.attemptId, 'initial')
  assert.notEqual(result.attemptId, current)
  assert.equal(engine.store.help(exerciseId), 'none')
  const delivered = engine.store.history<any>(exerciseId, 'help-delivered')
  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].attemptId, 'initial')
  assert.equal(delivered[0].source, 'mentor')
  const messages = engine.store.history<any>(exerciseId, 'message')
  assert.equal(messages[0].requestId, messages[1].requestId)
  assert.equal(messages[1].cycle, 'initial')
}))

test('failed cancelled unavailable blank malformed and unknown replies never count as help', async () => fixture(async engine => {
  const replies: unknown[] = [
    { status: 'failed', text: 'partial' }, { status: 'cancelled', text: 'partial' },
    { status: 'unavailable', text: 'No model' }, { status: 'completed', text: '' },
    { status: 'completed', text: ' \n\t' }, { status: 'invented', text: 'answer' },
    { status: 'completed', text: null }, null,
  ]
  for (const reply of replies) {
    const result = await askActivityTutor(engine, exerciseId, 'Help', '', async () => reply as any, 'answer')
    assert.ok(['failed', 'cancelled', 'unavailable'].includes(result.status))
    assert.equal(engine.store.help(exerciseId), 'none')
  }
  for (const tutor of [async () => { throw Error('async failure') }, () => { throw Error('sync failure') }]) {
    assert.equal((await askActivityTutor(engine, exerciseId, 'Help', '', tutor, 'answer')).status, 'failed')
  }
  assert.deepEqual(engine.store.history(exerciseId, 'help-delivered'), [])
  assert.equal(engine.store.history(exerciseId, 'message').length, 20)
}))

test('provider extra fields cannot overwrite request attribution', async () => fixture(async engine => {
  await askActivityTutor(engine, exerciseId, 'Help', '', async () => ({
    status: 'completed', text: 'Concept', role: 'user', cycle: 'forged', requestId: 'forged',
  }), 'concept')
  const [request, reply] = engine.store.history<any>(exerciseId, 'message')
  assert.equal(reply.role, 'assistant')
  assert.equal(reply.cycle, request.cycle)
  assert.equal(reply.requestId, request.requestId)
  assert.equal(engine.store.help(exerciseId), 'concept')
}))

test('review snooze preserves run source and reflection completes only its own review', async () => fixture(async engine => {
  const old = run(engine), other = run(engine, 'other-run')
  for (const record of [old, other]) {
    engine.store.putRun(record)
    engine.recordEvidence(engine.exercise(exerciseId), 'failed', 'none', 'program', {
      runId: record.id, attemptId: record.attemptId,
      contentVersion: record.contentVersion, testVersion: record.testVersion,
    })
  }
  const before = engine.overview().reviews
  const now = Date.now()
  engine.snooze(exerciseId, old.id)
  const after = engine.overview().reviews
  assert.ok(Date.parse(after.find(r => r.runId === old.id)!.due) >= now + 86400000)
  assert.deepEqual(after.find(r => r.runId === other.id), before.find(r => r.runId === other.id))
  assert.throws(() => engine.finishTrainingReview(old.id), /reflection/)
  engine.answer(exerciseId, 'My explanation of the failed checks', old.id)
  const evidence = engine.store.evidence().at(-1)!
  assert.equal(evidence.source, 'learner')
  assert.equal(evidence.runId, old.id)
  assert.equal(evidence.contentVersion, old.contentVersion)
  assert.equal(evidence.result, 'inconclusive')
  engine.finishTrainingReview(old.id)
  assert.deepEqual(engine.overview().reviews.map(r => r.runId), [other.id])
  const completed = engine.store.history<any>(exerciseId, 'review-completed')[0]
  assert.equal(completed.source, 'learner')
  assert.equal(completed.runId, old.id)
  assert.equal(engine.run(old.id).check_status, 'failed')
}))

/** Explicit live qualification entry point. Does not locate/read credentials or user profiles. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { askActivityTutor, validateTutorContext } from '../src/tutor-context.ts'
import { mentor } from '../src/mentor.ts'

/** Caller owns isolated official DSH context, real CPU run, configuration and cleanup.
 * Returns responses for local human review; never automatically labels their help level/quality.
 */
export async function runTutor060Live({ ctx, engine, context, isolated, signal }) {
  assert.equal(isolated, true, 'Live test requires an explicitly isolated profile')
  const run = engine.run(context.runId)
  validateTutorContext(engine, run.exerciseId, context)
  assert.ok(context.check, 'Select an actual check for the two-round qualification')
  const selection = ctx.get('agentDefaultModel')?.currentSelection()
  assert.ok(selection?.provider && selection?.model, 'Configure the isolated default model first')
  const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)
  const turns = []
  const questions = [
    ['concept', '请只讲概念：围绕所选组件和具体检查，解释已观察事实与我的预测有什么区别。请引用实际运行标识，不要给代码。'],
    ['steps', '继续刚才同一个检查，最多给三条小步骤。我该怎样做单变量对照？请说清固定哪些seed、数据和环境，以及现在还不能得出的结论，不要给代码。'],
  ]
  for (const [mode, question] of questions) {
    if (bounded.aborted) throw Error('Live qualification cancelled or timed out')
    const reply = await askActivityTutor(engine, run.exerciseId, question, '',
      prompt => mentor(ctx, prompt, bounded), mode, context)
    turns.push({ requestedMode: mode, status: reply.status, text: reply.text,
      textSha256: createHash('sha256').update(reply.text).digest('hex') })
    if (reply.status !== 'completed') break // no retry or hidden additional calls
  }
  return { runId: run.id, component: context.component, check: context.check,
    completedRounds: turns.filter(t => t.status === 'completed').length,
    qualityAssessment: 'requires-human-review', deliveredHelp: engine.store.help(run.exerciseId), turns }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let harness
  try {
    assert.ok(process.env.NEURAL_TUTOR060_HARNESS, 'Supply an isolated harness module')
    const module = await import(pathToFileURL(resolve(process.env.NEURAL_TUTOR060_HARNESS)).href)
    harness = await module.openTutor060Harness()
    const result = await runTutor060Live(harness)
    // No provider configuration, credentials, prompts, error details or model text on stdout.
    console.log(JSON.stringify({ ...result, turns: result.turns.map(({ text, ...turn }) => ({ ...turn, characters: text.length })) }, null, 2))
    if (result.completedRounds !== 2) process.exitCode = 1
  } catch {
    console.error('Tutor060 live qualification failed; inspect the isolated harness locally.')
    process.exitCode = 1
  } finally { await harness?.dispose?.() }
}

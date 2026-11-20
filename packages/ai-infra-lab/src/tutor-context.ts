import type { Engine } from './engine.ts'
import type { HelpLevel } from './types.ts'

export async function askInfraTutor(
  engine: Engine,
  exerciseId: string,
  question: string,
  mode: HelpLevel,
  runId: string | undefined,
  invokeModel: (prompt: string) => Promise<{ status: string; text: string }>,
  focusStep?: string,
): Promise<{ status: string; text: string }> {
  const ex = engine.exercise(exerciseId)
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > 4000) {
    throw Error('问题不能为空且不超过 4000 字符 / Question must be 1..4000 characters')
  }
  const allowedModes: HelpLevel[] = ['unknown', 'none', 'concept', 'steps', 'formula', 'code', 'answer']
  if (!allowedModes.includes(mode)) throw Error(`导师提示级别无效 / Invalid tutor mode: ${mode}`)

  const ws = engine.workspace(exerciseId)
  let runSummary = 'No run selected.'
  if (focusStep !== undefined && !runId) throw Error('请先选择运行记录 / Select a run for step diagnostics')
  if (runId) {
    const r = engine.run(runId)
    if (r.exerciseId !== exerciseId) {
      throw Error('请选择本题的运行 / Tutor runId must belong to the current exercise')
    }
    const failed = r.events.filter(e => e.type === 'check' && e.passed === false)
    if (focusStep !== undefined && (!ex.steps?.some(s => s.name === focusStep) ||
        !failed.some(e => (e.step ?? e.name) === focusStep))) {
      throw Error('请选择这次运行中未通过的步骤 / Select a failed step from this run')
    }
    const relevant = focusStep ? r.events.filter(e => (e.step ?? e.name) === focusStep) : r.events
    const distributedDiagnostics = r.resourceProfile === 'distributed-gloo'
      ? failed.filter(e => !focusStep || (e.step ?? e.name) === focusStep).map(e => ({
          step: e.step ?? e.name, message: e.message ?? e.detail,
        })) : undefined
    runSummary = JSON.stringify({
      runId: r.id,
      runStatus: r.run_status,
      checkStatus: r.check_status,
      dataSource: r.dataSource,
      prediction: r.prediction ?? null,
      focusStep,
      distributedDiagnostics,
      events: relevant.slice(-32),
      reason: r.reason ?? null,
      stderrTail: focusStep ? undefined : r.log.slice(-800),
    })
  }

  const lesson = engine.catalog.lessons.find((l) => l.id === ex.lessonId)
  const prompt = JSON.stringify(
    {
      requestedMode: mode === 'none' ? 'concept' : mode,
      lessonId: ex.lessonId,
      lessonSummary: lesson?.summary.zh ?? '',
      exercise: {
        id: ex.id,
        title: ex.title,
        kind: ex.kind,
        dataSource: ex.dataSource,
        prompt: ex.prompt,
        steps: ex.steps ?? [],
      },
      learnerDraft: ws.draft.slice(0, 6000),
      observedRunContext: runSummary,
      savedAnalysis: ex.kind === 'explanation' ? ws.answers.findLast(a => a.attemptId === ws.attemptId)?.text.slice(0,6000) : undefined,
      learnerQuestion: trimmed,
    },
    null,
    2,
  )

  if (mode !== 'unknown' && mode !== 'none') {
    engine.store.record(exerciseId, 'hint', mode)
  }
  const userMsg = { role: 'user' as const, text: trimmed, status: 'sent', at: new Date().toISOString() }
  engine.store.record(exerciseId, 'message', userMsg)

  const reply = await invokeModel(prompt)
  engine.store.record(exerciseId, 'message', {
    role: 'tutor' as const,
    text: reply.text,
    status: reply.status,
    at: new Date().toISOString(),
  })
  return reply
}

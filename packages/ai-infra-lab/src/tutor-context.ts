import type { Engine } from './engine.ts'
import type { HelpLevel } from './types.ts'

export async function askInfraTutor(
  engine: Engine,
  exerciseId: string,
  question: string,
  mode: HelpLevel,
  runId: string | undefined,
  invokeModel: (prompt: string) => Promise<{ status: string; text: string }>,
): Promise<{ status: string; text: string }> {
  const ex = engine.exercise(exerciseId)
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > 4000) {
    throw Error('问题不能为空且不超过 4000 字符 / Question must be 1..4000 characters')
  }
  const allowedModes: HelpLevel[] = ['unknown', 'none', 'concept', 'steps', 'code', 'answer']
  if (!allowedModes.includes(mode)) throw Error(`Invalid tutor mode: ${mode}`)

  const ws = engine.workspace(exerciseId)
  let runSummary = 'No run selected.'
  if (runId) {
    const r = engine.run(runId)
    if (r.exerciseId !== exerciseId) {
      throw Error('Tutor runId must belong to the current exercise')
    }
    runSummary = JSON.stringify({
      runId: r.id,
      runStatus: r.run_status,
      checkStatus: r.check_status,
      dataSource: r.dataSource,
      prediction: r.prediction ?? null,
      events: r.events.slice(0, 32),
      reason: r.reason ?? null,
      stderrTail: r.log.slice(-800),
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
      learnerQuestion: trimmed,
    },
    null,
    2,
  )

  if (mode === 'concept' || mode === 'steps' || mode === 'code' || mode === 'answer') {
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

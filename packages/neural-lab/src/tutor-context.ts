import type { Engine } from './engine.ts'

/** Build only the current activity context; preserve the learner attempt before seeking help. */
export async function askActivityTutor(
  engine: Engine,
  exerciseId: string,
  text: string,
  selection: string,
  tutor: (prompt: string) => Promise<{ status: string; text: string }>,
): Promise<{ status: string; text: string }> {
  const e = engine.exercise(exerciseId)
  engine.text(text, 6000)
  engine.text(selection, 3000)
  const workspace = engine.workspace(e.id)
  const lesson = engine.catalog.lessons.find((l) => l.id === e.lessonId)
  const profile = Object.fromEntries(
    Object.entries(engine.store.get<Record<string, string>>('profile', {})).map(([key, value]) => [
      key,
      value.slice(0, 1000),
    ]),
  )
  const selectionIndex = selection && lesson ? lesson.body.indexOf(selection) : -1
  const excerpt =
    lesson?.body.slice(
      Math.max(0, selectionIndex - 300),
      Math.max(0, selectionIndex - 300) + 1800,
    ) ?? ''
  engine.snapshotAttempt(e.id, 'mentor-request')
  engine.store.record(e.id, 'message', { role: 'user', text, status: 'completed' })
  engine.store.record(e.id, 'hint', 'concept')
  const result = await tutor(
    JSON.stringify({
      exercise: { title: e.title, prompt: e.prompt, inputDomain: e.inputDomain },
      lesson: { id: e.lessonId, title: lesson?.title, objectives: lesson?.objectives, excerpt },
      profile,
      recentEvidence: engine.store
        .evidence()
        .filter((item) => item.exerciseId === e.id)
        .slice(-4),
      observedHelp: engine.store.help(e.id),
      selection,
      question: text,
      code: workspace.draft.slice(0, 12000),
      latestRun: workspace.runs[0]
        ? {
            id: workspace.runs[0].id,
            status: workspace.runs[0].run_status,
            checks: workspace.runs[0].check_status,
            events: workspace.runs[0].events.slice(-12),
            effectiveConfig: workspace.runs[0].effectiveConfig,
            log: workspace.runs[0].log.slice(-3000),
          }
        : null,
    }),
  )
  engine.store.record(e.id, 'message', { role: 'assistant', ...result })
  return result
}

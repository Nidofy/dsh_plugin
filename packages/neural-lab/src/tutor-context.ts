import { randomUUID, createHash } from 'node:crypto'
import type { HelpLevel } from './types.ts'
import type { Engine } from './engine.ts'

/** Build only the current activity context; preserve the learner attempt before seeking help. */
export async function askActivityTutor(
  engine: Engine,
  exerciseId: string,
  text: string,
  selection: string,
  tutor: (prompt: string) => Promise<{ status: string; text: string }>,
  mode: HelpLevel = 'unknown',
): Promise<{ status: string; text: string }> {
  const e = engine.exercise(exerciseId)
  if (!['unknown', 'concept', 'steps', 'code', 'answer'].includes(mode))
    throw Error('Invalid help mode')
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
  const requestId = randomUUID()
  const identity = {
    requestId,
    exerciseId,
    mode,
    contentVersion: engine.catalog.version,
    testVersion: e.testVersion,
    cycle: engine.store.get('attempt:' + e.id, 'initial'),
  }
  engine.store.record(e.id, 'message', { ...identity, role: 'user', text, status: 'requested' })
  const last = workspace.runs[0]
  const snapshot = (code: string) => ({
    code: code.slice(0, 12000),
    sha256: createHash('sha256').update(code).digest('hex'),
    truncated: code.length > 12000,
  })
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
      mode,
      recentMessages: workspace.messages
        .slice(-8)
        .map((m) => ({ ...m, text: m.text.slice(0, 1200) })),
      currentDraft: {
        ...snapshot(workspace.draft),
        revision: workspace.revision,
        contentVersion: engine.catalog.version,
        testVersion: e.testVersion,
      },
      lastExecutedSnapshot: last
        ? {
            runId: last.id,
            ...snapshot(last.code),
            contentVersion: last.contentVersion,
            testVersion: last.testVersion,
            seed: last.seed,
            prediction: last.prediction,
            manifest: last.trainingManifest,
            reflection: workspace.answers
              ?.filter((a) => a.runId === last.id)
              .at(-1)
              ?.text.slice(0, 2000),
            matchesCurrentDraft:
              last.code === workspace.draft &&
              last.contentVersion === engine.catalog.version &&
              last.testVersion === e.testVersion,
            source: 'program',
            status: workspace.runs[0].run_status,
            checks: workspace.runs[0].check_status,
            events: workspace.runs[0].events.slice(-12),
            effectiveConfig: workspace.runs[0].effectiveConfig,
            log: workspace.runs[0].log.slice(-3000),
          }
        : null,
    }),
  ).catch((error: unknown) => ({ status: 'failed', text: String(error) }))
  engine.store.record(e.id, 'message', { ...identity, role: 'assistant', ...result })
  if (result.status === 'completed' && result.text.trim())
    engine.recordHelp(e.id, mode, 'mentor', requestId)
  return result
}

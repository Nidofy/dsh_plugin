import { allowedTrainingConfig } from './training-protocol.ts'
import { randomUUID, createHash } from 'node:crypto'
import type { HelpLevel, RunEvent } from './types.ts'
import type { Engine } from './engine.ts'

export interface TutorContext { runId: string; component: string; check?: string }

// Frozen legacy controller names; no substring inference of check ownership.
const mlpChecks: Record<string, string> = {
  'forward + MSE': 'train_step', 'fresh minibatch gradients': 'train_step',
  'SGD parameter update': 'train_step', 'held-out validation MSE': 'validate',
  'validation uses eval and no_grad': 'validate', 'validation preserves parameters': 'validate',
}

// Omit matrix payloads; keep event identity and attribution exactly as collected.
function tutorEvent(event: RunEvent) {
  const {runId,seq,type,name,source,component,layer,step,shape,value,passed,artifactId,detail}=event
  return {runId,seq,type,name,source,component,layer,step,shape,value,passed,artifactId,detail:detail?.slice(0,1000)}
}
function boundedEvents(events: RunEvent[]) {
  const ordered=[...events].sort((a,b)=>a.seq-b.seq)
  const chosen=ordered.length<=64?ordered:[...ordered.slice(0,32),...ordered.slice(-32)]
  return {events:chosen.map(tutorEvent),totalEvents:ordered.length,omittedEvents:ordered.length-chosen.length}
}

export function validateTutorContext(engine: Engine, exerciseId: string, context: TutorContext) {
  if (!context || typeof context !== 'object') throw Error('Invalid tutor context')
  for (const value of [context.runId, context.component, ...(context.check === undefined ? [] : [context.check])]) {
    engine.text(value, 200)
    if (!value.trim()) throw Error('Empty tutor context')
  }
  const exercise = engine.exercise(exerciseId), run = engine.run(context.runId)
  if (run.exerciseId !== exerciseId) throw Error('Tutor run belongs to another activity')
  const mlp = ['train-mlp-v1', 'train-mlp-multi-v1'].includes(exercise.runtimeKey ?? '')
  if (!exercise.components?.some(c => c.name === context.component) &&
      !(mlp && ['train_step', 'validate'].includes(context.component)))
    throw Error('Unknown tutor component')
  const checks = run.events.filter(event => event.type === 'check' && event.runId === run.id && event.name === context.check)
  const owned = (event: RunEvent) => {
    const component = (event as RunEvent & { component?: string }).component
    return component !== undefined ? component === context.component : mlp && mlpChecks[event.name] === context.component
  }
  if (context.check !== undefined && (!checks.length || !checks.every(owned)))
    throw Error('Tutor check has no verified component mapping in this run')
  return { run, checks, context: { runId: run.id, component: context.component, ...(context.check === undefined ? {} : { check: context.check }) } }
}

/** Build only the current activity context; preserve the learner attempt before seeking help. */
export async function askActivityTutor(
  engine: Engine,
  exerciseId: string,
  text: string,
  selection: string,
  tutor: (prompt: string) => Promise<{ status: string; text: string }>,
  mode: HelpLevel = 'unknown',
  context?: TutorContext,
): Promise<{ status: string; text: string; attemptId: string }> {
  const e = engine.exercise(exerciseId)
  if (!['unknown', 'concept', 'steps', 'code', 'answer'].includes(mode))
    throw Error('Invalid help mode')
  engine.text(text, 6000)
  engine.text(selection, 3000)
  const focused = context === undefined ? undefined : validateTutorContext(engine, e.id, context)
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
    requestedMode: mode,
    observedHelp: engine.store.help(e.id),
    ...(focused ? { context: focused.context } : {}),
    contentVersion: engine.catalog.version,
    testVersion: e.testVersion,
    cycle: engine.store.get('attempt:' + e.id, 'initial'),
  }
  engine.store.record(e.id, 'message', { ...identity, role: 'user', text, status: 'requested' })
  const last = focused?.run ?? workspace.runs[0]
  const snapshot = (code: string) => ({
    code: code.slice(0, 12000),
    sha256: createHash('sha256').update(code).digest('hex'),
    truncated: code.length > 12000,
  })
  const result = await Promise.resolve().then(() => tutor(
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
      requestedMode: mode,
      executionConstraints: {
        allowedRunConfig:allowedTrainingConfig(e.runtimeKey),
        editable:'Only one legal UI/Host run parameter OR one local change to the student draft. Preserve every other variable.',
        fixedGraderProbes:'Internal reference checks, alternate B/T/heads probes, fixtures and expected values are Host-owned and NOT editable. UI config does not rewrite fixed probes.',
        forbidden:'Do not recommend out-of-domain configurations or editing the Host grader, even as a theoretical probe. If no new run exists, do not invent new outcomes.',
        followup:'Audit the previous recommendation for executability. Explicitly retract any out-of-domain or fixed-grader edit before offering a legal alternative.',
      },
      focus: focused ? {
        ...focused.context,
        checks: boundedEvents(focused.checks).events,
        ...boundedEvents(focused.run.events.filter(event=>event.runId===focused.run.id &&
          ['shape','metric','check'].includes(event.type) &&
          (event.component===focused.context.component || focused.checks.includes(event)))),
        mapping:'validated-component; event source/layer remain as collected',
        checkSemantics: 'The check named exactly module <component> compares BOTH shape and numerical values against a reference. The separate module <component> execution shape check checks execution shape only; do not apply composite semantics to it. Failure does not isolate which condition failed. expected shape in detail is a requirement, NOT a measured shape. Compare the actual shape events; missing layer is unknown, not layer 0.',
      } : null,
      recentMessages: workspace.messages
        .filter((m) => m.cycle === identity.cycle)
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
            components: last.components,
            diagnostics: last.events
              .filter(
                (e) =>
                  e.artifactId ||
                  e.name.includes('gradient_norm') ||
                  e.name.includes('parameter_delta'),
              )
              .slice(-10)
              .map(tutorEvent),
            earliestFailedCheck: last.events.filter(event=>event.runId===last.id && event.type==='check' && event.passed===false).sort((a,b)=>a.seq-b.seq).map(tutorEvent)[0] ?? null,
            reflection: workspace.answers
              ?.filter((a) => a.runId === last.id)
              .at(-1)
              ?.text.slice(0, 2000),
            matchesCurrentDraft:
              last.code === workspace.draft &&
              last.contentVersion === engine.catalog.version &&
              last.testVersion === e.testVersion,
            source: 'program',
            status: last.run_status,
            checks: last.check_status,
            events: last.events.slice(-12),
            effectiveConfig: last.effectiveConfig,
            environment: last.environment,
            resolvedImageId: last.resolvedImageId,
            log: last.log.slice(-3000),
          }
        : null,
    }),
  )).then((reply) => {
    // Treat provider output as external input; never spread it over request identity.
    if (!reply || typeof reply.text !== 'string' ||
        !['completed', 'failed', 'cancelled', 'unavailable'].includes(reply.status))
      return { status: 'failed', text: '导师返回无效结果 / Invalid tutor response' }
    return {
      status: reply.status === 'completed' && !reply.text.trim() ? 'failed' : reply.status,
      text: reply.text,
    }
  }).catch((error: unknown) => ({ status: 'failed', text: String(error) }))
  const delivered = result.status === 'completed' && !!result.text.trim()
  engine.store.record(e.id, 'message', { ...identity, role: 'assistant', ...result,
    deliveredHelp: delivered ? 'unknown' : 'none', helpSource: 'mentor',
    helpAssessment: 'unclassified',
  })
  if (result.status === 'completed' && result.text.trim())
    engine.recordHelp(e.id, 'unknown', 'mentor', requestId, identity.cycle)
  return { ...result, attemptId: identity.cycle }
}

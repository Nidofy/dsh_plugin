import { trainingDataset } from './training-protocol.ts'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { acquireOwner } from './owner.ts'
import { Store } from './store.ts'
import { Runner, type RunnerLimits } from './runner.ts'
import { loadCatalog } from './catalog.ts'
import type {
  Catalog,
  Exercise,
  HelpLevel,
  Overview,
  RunRecord,
  Workspace,
  CheckStatus,
} from './types.ts'
export class Engine {
  private active = new Map<string, { abort: AbortController; done: Promise<void> }>()
  private closing = false
  constructor(
    readonly catalog: Catalog,
    readonly store: Store,
    readonly runner: Runner,
    private releaseOwner: () => Promise<void> = async () => {},
  ) {}
  static async open(root: string, image?: string, limits?: RunnerLimits): Promise<Engine> {
    await mkdir(root, { recursive: true })
    const release = await acquireOwner(join(root, 'owner.sqlite'))
    try {
      const catalog = await loadCatalog()
      const runner = new Runner(join(root, 'runs'), image, limits)
      const store = new Store(join(root, 'neural-lab.sqlite'))
      for (const run of store.runs().filter((r) => r.cleanupPending)) {
        try {
          await runner.recover(run)
          delete run.cleanupPending
        } catch (error) {
          run.cleanupPending = String(error).slice(0, 1000)
        }
        store.putRun(run)
      }
      return new Engine(catalog, store, runner, release)
    } catch (error) {
      await release()
      throw error
    }
  }
  exercise(id: string): Exercise {
    const e = this.catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === id)
    if (!e) throw Error('Unknown exercise')
    return e
  }
  text(value: string, max = 100000): void {
    if (typeof value !== 'string' || value.length > max) throw Error('Invalid or oversized text')
  }
  overview(): Overview {
    return {
      catalog: {
        ...this.catalog,
        lessons: this.catalog.lessons.map((l) => ({
          ...l,
          exercises: l.exercises.map((e) => ({
            ...e,
            reference: '',
            answer: undefined,
            hints: [],
          })),
        })),
      },
      currentLesson: this.store.get('currentLesson', this.catalog.lessons[0]?.id ?? ''),
      readLessons: this.store.get('readLessons', []),
      profile: this.store.get('profile', {}),
      reviews: this.store.get('reviews', []),
      evidence: this.store.evidence(),
    }
  }
  workspace(id: string): Workspace {
    const exercise = this.exercise(id),
      draft = this.store.draft(id)
    let profileId = this.store.get('bufferScope', '')
    if (!profileId) {
      profileId = randomUUID()
      this.store.set('bufferScope', profileId)
    }
    return {
      profileId,
      exercise: { ...exercise, reference: '', answer: undefined, hints: [] },
      draft: draft?.code ?? exercise.starter,
      revision: draft?.revision ?? 0,
      note: this.store.draft('note:' + id)?.code ?? '',
      noteRevision: this.store.draft('note:' + id)?.revision ?? 0,
      runs: this.store.runs(id),
      hints: this.store.history(id, 'hint'),
      messages: this.store.history(id, 'message'),
      answers: this.store.history(id, 'answer'),
      snapshots: this.store.history(id, 'attempt-snapshot'),
    }
  }
  saveDraft(id: string, code: string, revision: number): number {
    this.exercise(id)
    this.text(code)
    if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Invalid draft revision')
    return this.store.saveDraft(id, code, revision)
  }
  saveNote(id: string, note: string, revision: number): number {
    this.exercise(id)
    this.text(note)
    if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Invalid note revision')
    return this.store.saveDraft('note:' + id, note, revision)
  }
  readLesson(id: string): void {
    const lesson = this.catalog.lessons.find((l) => l.id === id)
    if (!lesson) throw Error('Unknown lesson')
    const first = lesson.exercises[0]
    if (first && !this.store.get<string[]>('readLessons', []).includes(id))
      this.store.record(first.id, 'evidence', {
        id: randomUUID(),
        exerciseId: first.id,
        concept: id,
        kind: 'reading',
        source: 'learner',
        result: 'read',
        help: 'unknown',
        contentVersion: this.catalog.version,
        at: new Date().toISOString(),
      })
    this.store.set('currentLesson', id)
    this.store.set('readLessons', [
      ...new Set([...this.store.get<string[]>('readLessons', []), id]),
    ])
  }
  saveProfile(profile: Record<string, string>): void {
    const valid: Record<string, string> = {}
    for (const [key, value] of Object.entries(profile)) {
      if (!['background', 'goal', 'difficulties', 'explanations'].includes(key))
        throw Error('Unknown profile field')
      this.text(value, 3000)
      valid[key] = value
    }
    this.store.set('profile', valid)
  }
  start(id: string, code: string, config: Record<string, number>, prediction?: string): RunRecord {
    if (this.closing) throw Error('Plugin is stopping')
    if (this.active.size >= 2) throw Error('Two runs are already active')
    const exercise = this.exercise(id)
    this.text(code)
    if (!['code', 'experiment'].includes(exercise.kind))
      throw Error('This activity accepts a written answer')
    const training = !!trainingDataset(exercise.runtimeKey)
    if (training) {
      this.text(prediction ?? '', 2000)
      if (!prediction?.trim()) throw Error('请先写下预测 / Record a prediction before running')
    }
    for (const [key, v] of Object.entries(config)) {
      if (training && key === 'learningRate' && Number.isFinite(v) && v >= 0.001 && v <= 0.3)
        continue
      if (key !== 'seed' || !Number.isFinite(v) || v < 0 || v > 10000)
        throw Error('Invalid experiment configuration')
    }
    if (config.seed !== undefined && !Number.isSafeInteger(config.seed))
      throw Error('Seed must be an integer')
    const run: RunRecord = {
      id: randomUUID(),
      exerciseId: id,
      code,
      ...(training ? { prediction: prediction!.trim() } : {}),
      contentVersion: this.catalog.version,
      testVersion: exercise.testVersion,
      seed: config.seed ?? 42,
      config,
      attemptId: this.store.get('attempt:' + id, 'initial'),
      environment: 'pending environment inspection',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help: this.store.help(id),
    }
    this.store.putRun(run)
    const abort = new AbortController()
    const done = Promise.resolve().then(async () => {
      try {
        const result = await this.runner.execute(run, exercise, abort.signal, (r) => {
          if (r.run_status === 'running') this.store.putRun(r)
        })
        this.store.transaction(() => {
          this.store.putRun(result)
          if (result.check_status === 'passed' || result.check_status === 'failed')
            this.recordEvidence(exercise, result.check_status, result.help, 'program', {
              runId: run.id,
              attemptId: run.attemptId,
            })
        })
      } catch (error) {
        this.store.putRun({
          ...this.store.run(run.id),
          run_status: abort.signal.aborted ? 'cancelled' : 'failed',
          check_status: 'inconclusive',
          reason: String(error),
          finishedAt: new Date().toISOString(),
        })
      } finally {
        this.active.delete(run.id)
      }
    })
    this.active.set(run.id, { abort, done })
    return run
  }
  run(id: string): RunRecord {
    return this.store.run(id)
  }
  cancel(id: string): void {
    this.store.run(id)
    this.active.get(id)?.abort.abort()
  }
  answer(id: string, text: string, runId?: string): CheckStatus {
    const e = this.exercise(id)
    this.text(text, 12000)
    const training = !!trainingDataset(e.runtimeKey)
    const run = training && runId ? this.run(runId) : undefined
    if (
      training &&
      (!run || run.exerciseId !== id || run.run_status !== 'completed' || !text.trim())
    )
      throw Error('解释须关联本活动已完成的运行 / Select a completed training run')
    const explanation = training || e.kind === 'explanation' || e.id === 'L09-transfer'
    if (!explanation && e.kind !== 'numeric') throw Error('Use the code runner')
    const status = explanation
      ? 'inconclusive'
      : this.matchesAnswer(text, e.answer)
        ? 'passed'
        : 'failed'
    const answerId = randomUUID()
    this.store.transaction(() => {
      this.store.record(id, 'answer', {
        id: answerId,
        ...(run ? { runId: run.id } : {}),
        text,
        status,
        contentVersion: this.catalog.version,
        testVersion: e.testVersion,
      })
      this.recordEvidence(e, status, this.store.help(id), explanation ? 'learner' : 'program', {
        answerId,
        runId: run?.id,
        attemptId: run?.attemptId ?? this.store.get('attempt:' + id, 'initial'),
      })
    })
    return status
  }
  finishTrainingReview(runId: string): void {
    const run = this.run(runId)
    const reviews = this.store.get<Overview['reviews']>('reviews', [])
    if (
      !trainingDataset(this.exercise(run.exerciseId).runtimeKey) ||
      !this.workspace(run.exerciseId).answers?.some((a) => a.runId === runId)
    )
      throw Error('请先记录本次解释 / Save a reflection first')
    if (!reviews.some((r) => r.runId === runId)) return
    this.store.transaction(() => {
      this.store.record(run.exerciseId, 'review-completed', {
        id: randomUUID(),
        runId,
        source: 'learner',
        at: new Date().toISOString(),
      })
      this.store.set(
        'reviews',
        reviews.filter((r) => r.runId !== runId),
      )
    })
  }
  matchesAnswer(text: string, expected?: string): boolean {
    if (expected === undefined) return false
    const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
    if (numeric.test(expected.trim())) {
      if (!numeric.test(text.trim())) return false
      const a = Number(text),
        b = Number(expected)
      return Number.isFinite(a) && Math.abs(a - b) <= 1e-8 + 1e-6 * Math.abs(b)
    }
    return text.trim().replace(/\s+/g, '') === expected.trim().replace(/\s+/g, '')
  }
  recordEvidence(
    e: Exercise,
    result: string,
    help: HelpLevel,
    source: 'program' | 'learner',
    origin: { runId?: string; answerId?: string; attemptId?: string },
  ): void {
    const isTraining = Boolean(trainingDataset(e.runtimeKey))
    for (const concept of e.concepts)
      this.store.record(e.id, 'evidence', {
        id: randomUUID(),
        ...origin,
        contentVersion: this.catalog.version,
        testVersion: e.testVersion,
        exerciseId: e.id,
        concept,
        kind:
          origin.answerId && isTraining
            ? 'explanation'
            : e.kind === 'experiment'
              ? 'observation'
              : e.id === 'L09-transfer'
                ? origin.answerId
                  ? 'explanation'
                  : 'implementation'
                : (e.evidenceKind ??
                  (['numeric', 'explanation'].includes(e.kind) ? 'explanation' : 'implementation')),
        source,
        help,
        result,
        at: new Date().toISOString(),
      })
    const reviews = this.store
      .get<Overview['reviews']>('reviews', [])
      .filter((r) => (isTraining ? r.runId !== origin.runId : r.exerciseId !== e.id))
    if (isTraining || result !== 'passed' || help !== 'none')
      reviews.push({
        exerciseId: e.id,
        runId: origin.runId,
        reason: isTraining
          ? origin.answerId
            ? '用同种子复习预测与解释 / Revisit prediction and explanation'
            : '解释本次训练结果 / Explain this training run'
          : help === 'answer'
            ? '请独立完成变式 / Retry independently'
            : result === 'failed'
              ? '检查失败 / Failed checks'
              : '解释或独立迁移仍需证据 / More evidence needed',
        due: new Date().toISOString(),
      })
    this.store.set('reviews', reviews)
  }
  hint(id: string, level: HelpLevel): string {
    const e = this.exercise(id)
    const ix = ['concept', 'steps', 'code', 'answer'].indexOf(level)
    if (ix < 0) throw Error('Invalid hint level')
    if (level === 'answer' && e.kind === 'experiment')
      throw Error('No reference solution for a guided experiment')
    if (level === 'answer') this.snapshotAttempt(id, 'answer-reveal')
    this.recordHelp(id, level, 'preset')
    return level === 'answer'
      ? e.reference
      : (e.hints[ix] ?? e.hints[0] ?? '请重读输入域 / Review the input domain')
  }
  recordHelp(id: string, level: HelpLevel, source: string, requestId?: string): void {
    this.store.record(id, 'help-delivered', {
      id: randomUUID(),
      requestId,
      level,
      source,
      exerciseId: id,
      attemptId: this.store.get('attempt:' + id, 'initial'),
      contentVersion: this.catalog.version,
      testVersion: this.exercise(id).testVersion,
    })
    this.store.record(id, 'hint', level)
  }
  snapshotAttempt(id: string, reason: string): void {
    const e = this.exercise(id),
      draft = this.store.draft(id)
    this.store.record(id, 'attempt-snapshot', {
      id: randomUUID(),
      attemptId: this.store.get('attempt:' + id, 'initial'),
      code: draft?.code ?? e.starter,
      revision: draft?.revision ?? 0,
      reason,
      contentVersion: this.catalog.version,
      testVersion: e.testVersion,
      at: new Date().toISOString(),
    })
  }
  snooze(id: string, runId?: string): void {
    this.exercise(id)
    this.store.set(
      'reviews',
      this.store
        .get<Overview['reviews']>('reviews', [])
        .map((r) =>
          r.exerciseId === id && (!runId || r.runId === runId)
            ? { ...r, due: new Date(Date.now() + 86400000).toISOString() }
            : r,
        ),
    )
  }
  async close(): Promise<void> {
    this.closing = true
    for (const task of this.active.values()) task.abort.abort()
    await Promise.allSettled([...this.active.values()].map((t) => t.done))
    this.store.close()
    await this.releaseOwner()
  }
}

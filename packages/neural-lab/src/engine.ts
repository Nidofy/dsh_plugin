import { reviewRule } from './learning-progress.ts'
import { ExperimentGroups } from './experiment-groups.ts'
import { trainingDataset, validateTrainingConfig } from './training-protocol.ts'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { splitProject } from './project.ts'
import { createHash, randomUUID } from 'node:crypto'
import { acquireOwner } from './owner.ts'
import { Store } from './store.ts'
import { Runner, validateDiagnosticEvent, type RunnerLimits } from './runner.ts'
import { loadCatalog } from './catalog.ts'
import type {
  ProjectFile,
  Catalog,
  Exercise,
  HelpLevel,
  Overview,
  RunRecord,
  Workspace,
  CheckStatus,
} from './types.ts'
export class Engine {
  readonly groups: ExperimentGroups
  private active = new Map<string, { abort: AbortController; done: Promise<void> }>()
  private recovery?: Promise<void>
  private closing = false
  constructor(
    readonly catalog: Catalog,
    readonly store: Store,
    readonly runner: Runner,
    private releaseOwner: () => Promise<void> = async () => {},
  ) { this.groups = new ExperimentGroups(this) }
  static async open(root: string, image?: string, limits?: RunnerLimits): Promise<Engine> {
    await mkdir(root, { recursive: true })
    const release = await acquireOwner(join(root, 'owner.sqlite'))
    try {
      const catalog = await loadCatalog()
      const runner = new Runner(join(root, 'runs'), image, limits)
      const store = new Store(join(root, 'neural-lab.sqlite'))
      const engine = new Engine(catalog, store, runner, release)
      engine.recovery = engine.recoverInterrupted(store.runs().filter((r) => r.cleanupPending))
      // The lifecycle observes errors at shutdown; attach a handler during background work.
      void engine.recovery.catch(() => {})
      return engine
    } catch (error) {
      await release()
      throw error
    }
  }
  private async recoverInterrupted(runs: RunRecord[]): Promise<void> {
    for (const run of runs) {
      if (this.closing) break
      try {
        await this.runner.recover(run)
        delete run.cleanupPending
      } catch (error) {
        run.cleanupPending = String(error).slice(0, 1000)
      }
      this.store.putRun(run)
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
  private bufferScope(): string {
    let id = this.store.get('bufferScope', '')
    if (!id) {
      id = randomUUID()
      this.store.set('bufferScope', id)
    }
    return id
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
      profileId: this.bufferScope(),
      profileRevision: this.store.get('profileRevision', 0),
      profile: this.store.get('profile', {}),
      reviews: this.store.get('reviews', []),
      evidence: this.store.evidence(),
    }
  }
  workspace(id: string): Workspace {
    const exercise = this.exercise(id),
      draft = this.store.draft(id)
    return {
      profileId: this.bufferScope(),
      attemptId: this.store.get('attempt:' + id, 'initial'),
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
  saveProfile(profile: Record<string, string>, revision: number): number {
    const valid: Record<string, string> = {}
    for (const [key, value] of Object.entries(profile)) {
      if (!['background', 'goal', 'difficulties', 'explanations'].includes(key))
        throw Error('Unknown profile field')
      this.text(value, 3000)
      valid[key] = value
    }
    return this.store.transaction(() => {
      if (!Number.isSafeInteger(revision) || revision !== this.store.get('profileRevision', 0))
        throw Error('学习档案版本冲突 / Profile revision conflict')
      this.store.set('profile', valid)
      this.store.set('profileRevision', revision + 1)
      return revision + 1
    })
  }
  projectFile(runId: string): ProjectFile {
    const r = this.run(runId)
    if (
      !trainingDataset(this.exercise(r.exerciseId).runtimeKey) ||
      !r.codeHash ||
      !r.trainingManifest ||
      !r.resolvedImageId ||
      r.run_status !== 'completed'
    )
      throw Error('Select a completed project run')
    const results = r.events
      .filter((e) => ['metric', 'sample', 'check', 'tensor', 'shape'].includes(e.type))
      .map((e) =>
        e.artifactId ? { ...e, data: this.store.diagnostic(r.id, e.artifactId!, r.codeHash!) } : e,
      )
    const signature = createHash('sha256')
      .update(JSON.stringify(results.map(({ runId, seq, ...event }) => event)))
      .digest('hex')
    const bundle: ProjectFile = {
      format: 'neural-lab-project/1',
      config: {...r.config, seed: r.seed, learningRate: r.config.learningRate ?? .05},
      mode: r.mode ?? 'check',
      variantOf: r.variantOf,
      exerciseId: r.exerciseId,
      contentVersion: r.contentVersion,
      testVersion: r.testVersion,
      runId: r.id,
      code: r.code,
      codeHash: r.codeHash,
      components: r.components ?? [],
      seed: r.seed,
      learningRate: r.config.learningRate ?? 0.05,
      prediction: r.prediction ?? '',
      manifest: r.trainingManifest,
      image: r.resolvedImageId,
      help: r.help,
      explanations: this.store
        .history<{ runId?: string; text: string }>(r.exerciseId, 'answer')
        .filter((a) => a.runId === r.id)
        .map((a) => a.text),
      results,
      signature,
    }
    if (Buffer.byteLength(JSON.stringify(bundle)) > 200000)
      throw Error('Project export exceeds 200 KB')
    return bundle
  }
  inspectProject(id: string, text: string): ProjectFile {
    if (Buffer.byteLength(text) > 200000) throw Error('Project file exceeds 200 KB')
    let b: ProjectFile
    try {
      b = JSON.parse(text) as ProjectFile
    } catch {
      throw Error('Invalid project JSON')
    }
    const e = this.exercise(id)
    if (
      !b ||
      typeof b !== 'object' ||
      !trainingDataset(e.runtimeKey) ||
      b.format !== 'neural-lab-project/1' ||
      b.exerciseId !== id ||
      b.testVersion !== e.testVersion ||
      !(b.contentVersion === this.catalog.version ||
        (['0.5.1','0.6.0'].includes(this.catalog.version) && ['0.5.0','0.5.1'].includes(b.contentVersion))) ||
      b.manifest?.protocol !== e.runtimeKey ||
      b.manifest.dataset !== trainingDataset(e.runtimeKey) ||
      !Number.isSafeInteger(b.seed) ||
      b.seed < 0 ||
      b.seed > 10000 ||
      !Number.isFinite(b.learningRate) ||
      b.learningRate < 0.001 ||
      b.learningRate > 0.3 ||
      typeof b.runId !== 'string' ||
      !/^[\w-]{1,100}$/.test(b.runId) ||
      !['unknown', 'none', 'concept', 'steps', 'code', 'answer'].includes(b.help) ||
      ![b.manifest.initialHash, b.manifest.splitHash, b.manifest.batchHash].every(
        (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v),
      ) ||
      typeof b.image !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(b.image) ||
      !Array.isArray(b.explanations) ||
      !Array.isArray(b.results) ||
      b.results.some((ev) => !ev || typeof ev !== 'object') ||
      b.explanations.some((s) => typeof s !== 'string') ||
      b.results.length > 1024 ||
      !Array.isArray(b.components) ||
      b.components.length !== (e.components?.length ?? 0)
    )
      throw Error('Incompatible project manifest')
    validateTrainingConfig(e.runtimeKey, b.config ?? { seed: b.seed, learningRate: b.learningRate })
    if (b.config && (b.config.seed !== b.seed || (b.config.learningRate ?? .05) !== b.learningRate)) throw Error('Project config identity mismatch')
    if (e.runtimeKey?.startsWith('project-char-') && ['project-char-flex-v1','project-char-two-v1','project-char-observe-v1'].includes(e.runtimeKey) && !b.config) throw Error('Full configuration required for this protocol')
    if (b.mode !== undefined && b.mode !== (e.mode ?? 'check')) throw Error('Project execution mode mismatch')
    let previousSeq = 0
    for (const event of b.results) {
      if (event.runId !== b.runId || !Number.isSafeInteger(event.seq) || event.seq <= previousSeq ||
          !['metric', 'sample', 'check', 'tensor', 'shape'].includes(event.type) ||
          typeof event.name !== 'string' || event.name.length > 200 ||
          (event.source !== undefined && !['program', 'student'].includes(event.source)) ||
          (event.step !== undefined && (!Number.isSafeInteger(event.step) || event.step < 0)) ||
          (event.detail !== undefined && (typeof event.detail !== 'string' || event.detail.length > 4000)) ||
          (event.type === 'metric' && !Number.isFinite(event.value)) ||
          (event.type === 'check' && typeof event.passed !== 'boolean'))
        throw Error('Invalid imported event')
      if (event.type === 'tensor' || event.type === 'shape') validateDiagnosticEvent(event)
      previousSeq = event.seq
    }
    this.text(b.code)
    this.text(b.prediction, 2000)
    const hash = (v: string) => createHash('sha256').update(v).digest('hex')
    if (
      hash(b.code) !== b.codeHash ||
      hash(JSON.stringify(b.results.map(({ runId, seq, ...event }) => event))) !== b.signature
    )
      throw Error('Project digest mismatch')
    const parts = e.components ? splitProject(b.code, e.components).parts : []
    for (const [i, part] of parts.entries()) {
      const c = b.components[i]
      if (
        c?.name !== part.name ||
        c.version !== e.components![i]!.version ||
        c.sha256 !== hash(part.code)
      )
        throw Error('Invalid component digest: ' + part.name)
    }
    return b
  }
  start(
    id: string,
    code: string,
    config: Record<string, number>,
    prediction?: string,
    variantOf?: string,
    frozen?: { id: string; attemptId: string; help: HelpLevel; groupId: string; expectedImageId: string },
  ): RunRecord {
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
    validateTrainingConfig(exercise.runtimeKey, config)
    if (variantOf) {
      const parent = this.run(variantOf)
      if (
        id !== 'L12-variant' ||
        parent.exerciseId !== 'L12-assembly' ||
        parent.run_status !== 'completed' ||
        !this.store
          .history<{ runId?: string }>(parent.exerciseId, 'answer')
          .some((answer) => answer.runId === variantOf)
      )
        throw Error('A transfer must refer to an explained decoder run')
    }
    const run: RunRecord = {
      ...(variantOf ? { variantOf } : {}),
      id: frozen?.id ?? randomUUID(),
      ...(frozen ? {groupId: frozen.groupId, expectedImageId: frozen.expectedImageId} : {}),
      mode: exercise.mode ?? 'check',
      exerciseId: id,
      code,
      codeHash: createHash('sha256').update(code).digest('hex'),
      ...(exercise.components
        ? {
            components: splitProject(code, exercise.components).parts.map((p, i) => ({
              name: p.name,
              version: exercise.components![i]!.version,
              sha256: createHash('sha256').update(p.code).digest('hex'),
            })),
          }
        : {}),
      ...(training ? { prediction: prediction!.trim() } : {}),
      contentVersion: this.catalog.version,
      testVersion: exercise.testVersion,
      seed: config.seed ?? 42,
      config,
      attemptId: frozen?.attemptId ?? this.store.get('attempt:' + id, 'initial'),
      environment: 'pending environment inspection',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help: frozen?.help ?? this.store.help(id),
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
  async waitRun(id: string): Promise<void> { await this.active.get(id)?.done }
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
    // The reflection is made now, but its subject is an immutable historical run.
    const currentAttemptId = this.store.get<string>('attempt:' + id, 'initial')
    const answerHelp = this.store.help(id)
    const provenance = {
      contentVersion: run?.contentVersion ?? this.catalog.version,
      testVersion: run?.testVersion ?? e.testVersion,
      ...(run ? { answerAttemptId: currentAttemptId, answerHelp,
        answerContentVersion: this.catalog.version, answerTestVersion: e.testVersion } : {}),
    }
    this.store.transaction(() => {
      this.store.record(id, 'answer', {
        id: answerId,
        attemptId: run?.attemptId ?? this.store.get('attempt:' + id, 'initial'),
        ...(run ? { runId: run.id } : {}),
        text,
        status,
        ...provenance,
      })
      this.recordEvidence(e, status, run?.help ?? answerHelp, explanation ? 'learner' : 'program', {
        ...provenance,
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
        resolution: run.check_status === 'failed' ? 'acknowledged-failure' : 'reflection-reviewed',
        checkStatus: run.check_status,
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
    origin: { runId?: string; answerId?: string; attemptId?: string;
      contentVersion?: string; testVersion?: string; answerAttemptId?: string;
      answerHelp?: HelpLevel; answerContentVersion?: string; answerTestVersion?: string },
  ): void {
    const isTraining = Boolean(trainingDataset(e.runtimeKey))
    for (const concept of e.concepts)
      this.store.record(e.id, 'evidence', {
        id: randomUUID(),
        ...origin,
        contentVersion: origin.contentVersion ?? this.catalog.version,
        testVersion: origin.testVersion ?? e.testVersion,
        exerciseId: e.id,
        concept,
        kind:
          origin.answerId && isTraining
            ? 'explanation'
            : e.mode === 'observe' || e.kind === 'experiment'
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
    const subject = origin.runId ? this.store.runs().find((run) => run.id === origin.runId) : undefined
    const rule = reviewRule(e, subject?.check_status === 'failed' ? 'failed' : result, source, origin.answerHelp ?? help)
    const reviews = this.store
      .get<Overview['reviews']>('reviews', [])
      .filter((r) => (isTraining ? r.runId !== origin.runId : r.exerciseId !== e.id))
    if (
      isTraining ||
      result !== 'passed' ||
      help !== 'none' ||
      (e.id === 'L09-transfer' &&
        !this.store
          .history<{ attemptId?: string }>(e.id, 'answer')
          .some((a) => a.attemptId === origin.attemptId))
    )
      reviews.push({
        exerciseId: e.id,
        runId: origin.runId,
        reason: rule.text,
        rule: rule.id,
        contentVersion: origin.contentVersion ?? this.catalog.version,
        testVersion: origin.testVersion ?? e.testVersion,
        due: new Date(Date.now() + rule.delay).toISOString(),
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
  recordHelp(
    id: string,
    level: HelpLevel,
    source: string,
    requestId?: string,
    attemptId = this.store.get<string>('attempt:' + id, 'initial'),
  ): void {
    this.store.record(id, 'help-delivered', {
      id: randomUUID(),
      requestId,
      level,
      source,
      exerciseId: id,
      attemptId,
      contentVersion: this.catalog.version,
      testVersion: this.exercise(id).testVersion,
    })
    if (attemptId === this.store.get('attempt:' + id, 'initial'))
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
    await this.groups.close()
    for (const task of this.active.values()) task.abort.abort()
    await Promise.allSettled([...this.active.values()].map((t) => t.done))
    try {
      await this.recovery
    } finally {
      try {
        this.store.close()
      } finally {
        await this.releaseOwner()
      }
    }
  }
}

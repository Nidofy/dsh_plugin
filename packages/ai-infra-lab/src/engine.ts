import { createHash, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCatalog } from './catalog.ts'
import { evaluateEstimate } from './estimator.ts'
import { completedWarpAccess } from './sim-stage-b.ts'
import { completedMemoryLedger } from './sim-stage-c.ts'
import { acquireOwner } from './owner.ts'
import { LocalDockerCpuRunner, type RunnerBackend, type RunnerLimits } from './runner.ts'
import { Store } from './store.ts'
import type {
  AnswerRecord,
  BilingualText,
  Catalog,
  CheckStatus,
  EnvironmentStatus,
  Evidence,
  Exercise,
  HelpLevel,
  Overview,
  ReviewItem,
  RunRecord,
  Workspace,
} from './types.ts'

function sanitizeExerciseForClient(ex: Exercise): Exercise {
  return {
    ...ex,
    reference: '',
    hints: [],
    quiz: ex.quiz ? { options: ex.quiz.options, correctOptionId: '' } : undefined,
  }
}

export class Engine {
  private active = new Map<string, { abort: AbortController; done: Promise<void> }>()
  private recovery?: Promise<void>
  private closing = false

  constructor(
    readonly catalog: Catalog,
    readonly store: Store,
    readonly runner: RunnerBackend,
    private releaseOwner: () => Promise<void> = async () => {},
  ) {}

  static async open(
    root: string,
    image?: string,
    limits?: RunnerLimits,
    customRunner?: RunnerBackend,
  ): Promise<Engine> {
    await mkdir(root, { recursive: true })
    const release = await acquireOwner(join(root, 'owner.sqlite'))
    try {
      const catalog = await loadCatalog()
      const runner = customRunner ?? new LocalDockerCpuRunner(join(root, 'runs'), image, limits)
      const store = new Store(join(root, 'ai-infra-lab.sqlite'))
      const engine = new Engine(catalog, store, runner, release)
      engine.recovery = engine.recoverInterrupted(store.runs().filter((r) => r.cleanupPending))
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
    const found = this.catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === id)
    if (!found) throw Error(`Unknown exercise: ${id}`)
    return found
  }

  private assertText(value: string, maxLen = 100000): void {
    if (typeof value !== 'string' || value.length > maxLen) {
      throw Error('Invalid or oversized text input')
    }
  }

  private profileScopeId(): string {
    let id = this.store.get('profileScopeId', '')
    if (!id) {
      id = randomUUID()
      this.store.set('profileScopeId', id)
    }
    return id
  }

  async environment(): Promise<EnvironmentStatus> {
    return await this.runner.environment()
  }

  private collectMeasuredRooflinePoints(): Overview['measuredRooflinePoints'] {
    const points: Overview['measuredRooflinePoints'] = []
    const seen = new Set<string>()
    for (const run of this.store.runs()) {
      if (run.run_status !== 'completed') continue
      for (const ev of run.events) {
        if (
          ev.type === 'roofline_point' &&
          typeof ev.arithmeticIntensity === 'number' &&
          typeof ev.gflops === 'number'
        ) {
          const key = `${run.exerciseId}:${ev.name}`
          if (seen.has(key)) continue
          seen.add(key)
          points.push({
            label: ev.name,
            exerciseId: run.exerciseId,
            arithmeticIntensity: ev.arithmeticIntensity,
            gflops: ev.gflops,
            bandwidthGBps: ev.bandwidthGBps,
          })
        }
      }
    }
    return points
  }

  overview(): Overview {
    return {
      profileId: this.profileScopeId(),
      profileRevision: this.store.get('profileRevision', 0),
      catalog: {
        ...this.catalog,
        lessons: this.catalog.lessons.map((l) => ({
          ...l,
          exercises: l.exercises.map(sanitizeExerciseForClient),
        })),
      },
      currentLesson: this.store.get('currentLesson', this.catalog.lessons[0]?.id ?? 'A00'),
      readLessons: this.store.get('readLessons', []),
      fastTrackedLessons: this.store.get('fastTrackedLessons', []),
      profile: this.store.get('profile', {}),
      reviews: this.store.get('reviews', []),
      evidence: this.store.evidence(),
      measuredRooflinePoints: this.collectMeasuredRooflinePoints(),
    }
  }

  workspace(id: string): Workspace {
    const exercise = this.exercise(id)
    const draft = this.store.draft(id)
    const note = this.store.draft('note:' + id)
    return {
      attemptId: this.store.get('attempt:' + id, 'initial'),
      profileId: this.profileScopeId(),
      exercise: sanitizeExerciseForClient(exercise),
      draft: draft?.code ?? exercise.starter,
      revision: draft?.revision ?? 0,
      note: note?.code ?? '',
      noteRevision: note?.revision ?? 0,
      runs: this.store.runs(id),
      hints: this.store.history<HelpLevel>(id, 'hint'),
      answers: this.store.history<AnswerRecord>(id, 'answer'),
      messages: this.store.history(id, 'message'),
    }
  }

  selectLesson(lessonId: string): void {
    if (!this.catalog.lessons.some((l) => l.id === lessonId)) {
      throw Error(`Unknown lesson: ${lessonId}`)
    }
    this.store.set('currentLesson', lessonId)
  }

  readLesson(lessonId: string): void {
    const lesson = this.catalog.lessons.find((l) => l.id === lessonId)
    if (!lesson) throw Error(`Unknown lesson: ${lessonId}`)
    const currentRead = this.store.get<string[]>('readLessons', [])
    const firstExercise = lesson.exercises[0]
    this.store.transaction(() => {
      if (firstExercise && !currentRead.includes(lessonId)) {
        const ev: Evidence = {
          id: randomUUID(),
          attemptId: 'reading',
          exerciseId: firstExercise.id,
          concept: lessonId,
          kind: 'reading',
          source: 'learner',
          help: 'none',
          result: 'read',
          contentVersion: this.catalog.version,
          at: new Date().toISOString(),
        }
        this.store.record(firstExercise.id, 'evidence', ev)
      }
      this.store.set('currentLesson', lessonId)
      this.store.set('readLessons', [...new Set([...currentRead, lessonId])])
    })
  }

  saveDraft(id: string, code: string, revision: number): number {
    this.exercise(id)
    this.assertText(code)
    if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Invalid draft revision')
    return this.store.saveDraft(id, code, revision)
  }

  saveNote(id: string, note: string, revision: number): number {
    this.exercise(id)
    this.assertText(note, 50000)
    if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Invalid note revision')
    return this.store.saveDraft('note:' + id, note, revision)
  }

  saveProfile(profile: Record<string, string>, revision: number): number {
    const allowed = new Set(['background', 'goal', 'notes'])
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(profile)) {
      if (!allowed.has(k)) throw Error(`Unknown profile field: ${k}`)
      this.assertText(v, 4000)
      clean[k] = v
    }
    return this.store.transaction(() => {
      const currentRev = this.store.get('profileRevision', 0)
      if (!Number.isSafeInteger(revision) || revision !== currentRev) {
        throw Error('学习档案版本冲突 / Profile revision conflict')
      }
      this.store.set('profile', clean)
      this.store.set('profileRevision', currentRev + 1)
      return currentRev + 1
    })
  }

  private enqueueReviewIfNeeded(exercise: Exercise, status: CheckStatus, help: HelpLevel, runId?: string): void {
    const reviews = this.store.get<ReviewItem[]>('reviews', []).filter((r) => r.exerciseId !== exercise.id)
    if (status === 'failed') {
      reviews.push({
        exerciseId: exercise.id,
        lessonId: exercise.lessonId,
        runId,
        due: new Date(Date.now() + 3600_000).toISOString(),
        reason: {
          zh: '上次提交未通过全部检查，建议结合诊断复盘后重测。',
          en: 'Last attempt did not pass all checks; review diagnostics and retry.',
        },
      })
    } else if (status === 'passed' && (help === 'code' || help === 'answer')) {
      reviews.push({
        exerciseId: exercise.id,
        lessonId: exercise.lessonId,
        runId,
        due: new Date(Date.now() + 86400_000).toISOString(),
        reason: {
          zh: '本次通过借助了代码级提示，建议稍后开启“独立新尝试”巩固掌握。',
          en: 'Passed with code/answer hints; try a fresh independent attempt later.',
        },
      })
    }
    this.store.set('reviews', reviews)
  }

  dismissReview(exerciseId: string): void {
    this.exercise(exerciseId)
    const reviews = this.store.get<ReviewItem[]>('reviews', [])
    this.store.set(
      'reviews',
      reviews.filter((r) => r.exerciseId !== exerciseId),
    )
  }

  private recordEvidence(
    exercise: Exercise,
    kind: Evidence['kind'],
    result: string,
    help: HelpLevel,
    source: 'program' | 'learner',
    extra: { runId?: string; answerId?: string } = {},
  ): void {
    const attemptId = this.store.get('attempt:' + exercise.id, 'initial')
    for (const concept of exercise.concepts.length ? exercise.concepts : [exercise.lessonId]) {
      const ev: Evidence = {
        id: randomUUID(),
        attemptId,
        exerciseId: exercise.id,
        concept,
        kind,
        dataSource: exercise.dataSource,
        source,
        help,
        result,
        contentVersion: this.catalog.version,
        testVersion: exercise.testVersion,
        at: new Date().toISOString(),
        ...extra,
      }
      this.store.record(exercise.id, 'evidence', ev)
    }
  }

  async start(
    id: string,
    code: string,
    config: Record<string, number> = {},
    prediction?: string,
  ): Promise<RunRecord> {
    if (this.closing) throw Error('AI Infra Lab is shutting down')
    const exercise = this.exercise(id)
    if (exercise.kind !== 'code' || !exercise.runtimeKey) {
      throw Error('Selected activity does not run in the container runner')
    }
    if (this.active.size >= 2) {
      throw Error('已有运行中的实验，请等待完成或先取消 / Another run is already active')
    }
    this.assertText(code)
    if (exercise.requiresPrediction) {
      this.assertText(prediction ?? '', 2000)
      if (!prediction?.trim()) {
        throw Error('请先填写你的运行前预测，再点击运行 / Enter your prediction before running')
      }
    }
    const cleanConfig: Record<string, number> = {}
    for (const [k, v] of Object.entries(config)) {
      if (!/^[a-zA-Z0-9_]{1,40}$/.test(k) || typeof v !== 'number' || !Number.isFinite(v)) {
        throw Error(`Invalid run config entry: ${k}`)
      }
      cleanConfig[k] = v
    }

    const help = this.store.help(id)
    const run: RunRecord = {
      id: randomUUID(),
      exerciseId: id,
      code,
      codeHash: createHash('sha256').update(code).digest('hex'),
      dataSource: exercise.dataSource,
      resourceProfile: exercise.resourceProfile ?? 'scalar-cpu',
      ...(prediction?.trim() ? { prediction: prediction.trim() } : {}),
      contentVersion: this.catalog.version,
      testVersion: exercise.testVersion,
      seed: Number.isSafeInteger(cleanConfig.seed) ? cleanConfig.seed! : 42,
      config: cleanConfig,
      attemptId: this.store.get('attempt:' + id, 'initial'),
      environment: 'Pending environment inspection',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help,
    }
    this.store.putRun(run)

    const abort = new AbortController()
    const done = Promise.resolve().then(async () => {
      try {
        const finished = await this.runner.execute(run, exercise, abort.signal, (partial) => {
          if (partial.run_status === 'running') this.store.putRun(partial)
        })
        this.store.transaction(() => {
          this.store.putRun(finished)
          if (finished.check_status === 'passed' || finished.check_status === 'failed') {
            this.recordEvidence(exercise, 'implementation', finished.check_status, finished.help, 'program', {
              runId: finished.id,
            })
            this.enqueueReviewIfNeeded(exercise, finished.check_status, finished.help, finished.id)
          }
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

  async waitRun(runId: string): Promise<RunRecord> {
    await this.active.get(runId)?.done
    return this.store.run(runId)
  }

  run(runId: string): RunRecord {
    return this.store.run(runId)
  }

  cancel(runId: string): void {
    this.store.run(runId)
    this.active.get(runId)?.abort.abort()
  }

  answer(
    id: string,
    text: string,
    runId?: string,
  ): { status: CheckStatus; diagnostic: BilingualText } {
    const exercise = this.exercise(id)
    this.assertText(text, 12000)
    const trimmed = text.trim()
    if (!trimmed) throw Error('请先输入作答内容 / Answer cannot be empty')

    const help = this.store.help(id)
    let status: CheckStatus = 'inconclusive'
    let diagnostic: BilingualText = {
      zh: '已记录你的分析说明（开放解释题不做机器硬判，可向右侧导师请求点评）。',
      en: 'Saved your reflection (open explanations remain inconclusive; ask the Tutor for feedback).',
    }
    let evidenceKind: Evidence['kind'] = 'explanation'
    let source: 'program' | 'learner' = 'learner'

    if (exercise.kind === 'estimate' && exercise.estimate) {
      const evaluated = evaluateEstimate(trimmed, exercise.estimate)
      status = evaluated.status
      diagnostic = evaluated.diagnostic
      evidenceKind = 'estimate'
      source = 'program'
    } else if (exercise.kind === 'quiz' && exercise.quiz) {
      const correct = trimmed === exercise.quiz.correctOptionId
      status = correct ? 'passed' : 'failed'
      diagnostic = correct
        ? {
            zh: exercise.fastTrackSkipLesson
              ? '回答正确！已为你标记本节快速通关，可直接进入下一单元。'
              : '回答正确！',
            en: exercise.fastTrackSkipLesson
              ? 'Correct! Fast-track unlocked — you can jump straight to the next unit.'
              : 'Correct!',
          }
        : {
            zh: '选项不正确，请结合讲义中的关键概念再思考一下。',
            en: 'Not quite right — review the key concept in the lecture and try again.',
          }
      evidenceKind = 'quiz'
      source = 'program'
    } else if (exercise.kind !== 'explanation') {
      throw Error(`Activity ${id} (${exercise.kind}) does not accept text answers`)
    }

    const answerId = randomUUID()
    const record: AnswerRecord = {
      id: answerId,
      attemptId: this.store.get('attempt:' + id, 'initial'),
      ...(runId ? { runId } : {}),
      text: trimmed,
      status,
      diagnostic,
      contentVersion: this.catalog.version,
      testVersion: exercise.testVersion,
      at: new Date().toISOString(),
    }

    this.store.transaction(() => {
      this.store.record(id, 'answer', record)
      this.recordEvidence(exercise, evidenceKind, status, help, source, { answerId, runId })
      if (status === 'passed' && exercise.fastTrackSkipLesson) {
        const fast = this.store.get<string[]>('fastTrackedLessons', [])
        this.store.set('fastTrackedLessons', [...new Set([...fast, exercise.lessonId])])
        const read = this.store.get<string[]>('readLessons', [])
        this.store.set('readLessons', [...new Set([...read, exercise.lessonId])])
      }
      if (source === 'program') {
        this.enqueueReviewIfNeeded(exercise, status, help)
      }
    })

    return { status, diagnostic }
  }

  completeSimulator(
    id: string,
    summaryJson: string,
  ): { status: CheckStatus; diagnostic: BilingualText } {
    const exercise = this.exercise(id)
    if (exercise.kind !== 'simulator' || !exercise.simulator) {
      throw Error('Selected activity is not an interactive simulator exercise')
    }
    this.assertText(summaryJson, 16000)
    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(summaryJson)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Expected JSON object')
      payload = parsed as Record<string, unknown>
    } catch {
      throw Error('Invalid simulator exploration payload')
    }

    let passed = false
    let diagnostic: BilingualText
    if (exercise.simulator.widget === 'memory-waterfall') {
      passed = completedMemoryLedger(payload.observations)
      diagnostic = passed ? {"zh":"已核对重计算与优化器的两组对照。","en":"Verified both checkpointing and optimizer comparisons."} : exercise.simulator.goalDescription
    } else if (exercise.simulator.widget === 'gpu-coalescing') {
      passed = completedWarpAccess(payload.observations)
      diagnostic = passed ? { zh: '已核对合并、分裂和 Bank 冲突的访存记录。', en: 'Verified the coalesced, split and bank-conflicted accesses.' }
        : exercise.simulator.goalDescription
    } else if (exercise.simulator.widget === 'bit-layout') {
      const formatsVisited = Array.isArray(payload.formatsVisited) ? payload.formatsVisited.length : 0
      const flips = typeof payload.bitFlips === 'number' ? payload.bitFlips : 0
      passed = formatsVisited >= 2 && flips >= 1
      diagnostic = passed
        ? {
            zh: '已完成多精度位布局对比与位翻转探索！',
            en: 'Completed multi-format bit-layout comparison and bit-flip exploration!',
          }
        : {
            zh: '请至少切换对比 2 种浮点格式（如 FP16 与 BF16），并亲手点击翻转至少 1 个二进制位后再确认完成。',
            en: 'Switch between at least 2 float formats (e.g. FP16 & BF16) and flip at least 1 bit before completing.',
          }
    } else {
      const visitedMem = payload.visitedMemoryBound === true
      const visitedComp = payload.visitedComputeBound === true
      passed = visitedMem && visitedComp
      diagnostic = passed
        ? {
            zh: '已完成 Roofline 带宽受限区与算力受限区的双区域探索！',
            en: 'Explored both Memory-bound and Compute-bound regimes on the Roofline model!',
          }
        : {
            zh: '请拖动算术强度或机器带宽滑块，分别观察一次 Memory-bound（斜坡区）和一次 Compute-bound（平顶区）后再确认完成。',
            en: 'Adjust sliders to observe both the Memory-bound slope and Compute-bound roof before completing.',
          }
    }

    const status: CheckStatus = passed ? 'passed' : 'failed'
    const help = this.store.help(id)
    const answerId = randomUUID()
    this.store.transaction(() => {
      this.store.record(id, 'answer', {
        id: answerId,
        attemptId: this.store.get('attempt:' + id, 'initial'),
        text: summaryJson,
        status,
        diagnostic,
        contentVersion: this.catalog.version,
        testVersion: exercise.testVersion,
        at: new Date().toISOString(),
      } satisfies AnswerRecord)
      if (passed) {
        this.recordEvidence(exercise, 'simulation', 'passed', help, 'program', { answerId })
      }
    })
    return { status, diagnostic }
  }

  hint(id: string, level: HelpLevel): BilingualText {
    const exercise = this.exercise(id)
    const order: HelpLevel[] = ['concept', 'steps', 'code', 'answer']
    const idx = order.indexOf(level)
    if (idx < 0) throw Error(`Invalid hint level: ${level}`)
    this.store.record(id, 'hint', level)
    if (level === 'answer' && exercise.kind === 'code') {
      return {
        zh: `参考实现：\n\`\`\`python\n${exercise.reference}\n\`\`\``,
        en: `Reference implementation:\n\`\`\`python\n${exercise.reference}\n\`\`\``,
      }
    }
    if (level === 'answer' && exercise.kind === 'estimate' && exercise.estimate) {
      return {
        zh: `标准参考值：${exercise.estimate.canonicalDisplay}`,
        en: `Canonical answer: ${exercise.estimate.canonicalDisplay}`,
      }
    }
    return exercise.hints[Math.min(idx, exercise.hints.length - 1)]!
  }

  beginIndependent(id: string): void {
    this.exercise(id)
    this.store.beginIndependent(id)
  }

  exportData(): string {
    return this.store.exportArchive(this.catalog.version)
  }

  importData(rawJson: string): { importedRuns: number; importedEvidence: number } {
    this.assertText(rawJson, 4_000_000)
    let parsed: Record<string, unknown>
    try {
      const obj = JSON.parse(rawJson)
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Root must be object')
      parsed = obj as Record<string, unknown>
    } catch {
      throw Error('导入格式错误：需要有效的 JSON 归档 / Invalid JSON archive')
    }
    if (parsed.format !== 'ai-infra-lab-archive/1' || parsed.schemaVersion !== 1) {
      throw Error('不支持的归档格式版本 / Unsupported archive format')
    }
    const runs = Array.isArray(parsed.runs) ? parsed.runs : []
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : []
    if (runs.length > 1000 || evidence.length > 5000) {
      throw Error('导入条目超出上限 / Archive item count exceeds safety limit')
    }

    const validExerciseIds = new Set(this.catalog.lessons.flatMap((l) => l.exercises.map((e) => e.id)))
    const validLessonIds = new Set(this.catalog.lessons.map((l) => l.id))
    let importedRuns = 0
    let importedEvidence = 0

    this.store.transaction(() => {
      if (Array.isArray(parsed.readLessons)) {
        const merged = [
          ...new Set([
            ...this.store.get<string[]>('readLessons', []),
            ...parsed.readLessons.filter((id): id is string => typeof id === 'string' && validLessonIds.has(id)),
          ]),
        ]
        this.store.set('readLessons', merged)
      }
      const existingRunIds = new Set(this.store.runs().map((r) => r.id))
      for (const item of runs) {
        if (!item || typeof item !== 'object') continue
        const r = item as RunRecord
        if (
          typeof r.id !== 'string' ||
          existingRunIds.has(r.id) ||
          !validExerciseIds.has(r.exerciseId) ||
          typeof r.code !== 'string' ||
          r.code.length > 100000 ||
          !Array.isArray(r.events)
        ) {
          continue
        }
        this.store.putRun(r)
        existingRunIds.add(r.id)
        importedRuns++
      }

      const existingEvIds = new Set(this.store.evidence().map((e) => e.id))
      for (const item of evidence) {
        if (!item || typeof item !== 'object') continue
        const ev = item as Evidence
        if (
          typeof ev.id !== 'string' ||
          existingEvIds.has(ev.id) ||
          !validExerciseIds.has(ev.exerciseId) ||
          typeof ev.concept !== 'string'
        ) {
          continue
        }
        this.store.record(ev.exerciseId, 'evidence', ev, typeof ev.at === 'string' ? ev.at : undefined)
        existingEvIds.add(ev.id)
        importedEvidence++
      }
    })

    return { importedRuns, importedEvidence }
  }

  async close(): Promise<void> {
    this.closing = true
    for (const item of this.active.values()) item.abort.abort()
    await Promise.allSettled([...this.active.values()].map((item) => item.done))
    await this.recovery?.catch(() => {})
    this.store.close()
    await this.releaseOwner()
  }
}

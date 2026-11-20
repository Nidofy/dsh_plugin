import { useEffect, useMemo, useState } from 'react'
import { parseQuantity } from '../estimator.ts'
import { completesActivity } from '../progress.ts'
import type {
  BilingualText,
  CheckStatus,
  EnvironmentStatus,
  Evidence,
  Exercise,
  GlossaryEntry,
  HelpLevel,
  Lesson,
  Locale,
  Overview,
  RunRecord,
  UnitDimension,
  Workspace,
} from '../types.ts'
import { LessonExplorer } from './LessonExplorer.tsx'
import { CodeEditor } from './CodeEditor.tsx'
import { DataSourceBadge } from './DataSourceBadge.tsx'
import { DecodeTimingChart } from './DecodeTimingChart.tsx'
import { MarkdownView } from './MarkdownView.tsx'
import { pickText, tr } from './i18n.ts'

export interface ActivityViewProps {
  readonly lesson: Lesson
  readonly workspace?: Workspace
  readonly activeExerciseId: string
  readonly code: string
  readonly note: string
  readonly prediction: string
  readonly activeRun?: RunRecord
  readonly hintTexts: Partial<Record<HelpLevel, BilingualText>>
  readonly latestFeedback?: {
    readonly exerciseId: string
    readonly status: CheckStatus
    readonly diagnostic: BilingualText
  }
  readonly saveStatus: string
  readonly busy: boolean
  readonly locale: Locale
  readonly glossary: readonly GlossaryEntry[]
  readonly environment?: EnvironmentStatus
  readonly evidence: readonly Evidence[]
  readonly fastTrackedLessons: readonly string[]
  readonly measuredRooflinePoints: Overview['measuredRooflinePoints']
  readonly hasNextLesson: boolean
  readonly onSelectExercise: (exerciseId: string) => void
  readonly onCodeChange: (nextCode: string) => void
  readonly onResetStarter: () => void
  readonly onRestoreRunCode: (runCode: string) => void
  readonly onNoteChange: (nextNote: string) => void
  readonly onPredictionChange: (nextPrediction: string) => void
  readonly onCodeSelection: (selected: string) => void
  readonly onStartRun: () => void
  readonly onCancelRun: (runId: string) => void
  readonly onSelectRun: (run: RunRecord) => void
  readonly onSubmitAnswer: (text: string, runId?: string) => void
  readonly onCompleteSimulator: (summaryJson: string) => void
  readonly onRequestHint: (level: HelpLevel) => void
  readonly onBeginIndependent: () => void
  readonly onJumpNextLesson: () => void
  readonly onJumpLesson: (lessonId: string) => void
}

const HINT_LADDER: readonly {
  readonly level: HelpLevel
  readonly zh: string
  readonly en: string
}[] = [
  { level: 'concept', zh: '1. 概念直觉', en: '1. Concept' },
  { level: 'steps', zh: '2. 推导步骤', en: '2. Steps' },
  { level: 'code', zh: '3. 代码骨架', en: '3. Code Skeleton' },
  { level: 'answer', zh: '4. 参考解答', en: '4. Reference' },
]

const UNIT_EXAMPLES: Record<UnitDimension, readonly string[]> = {
  scalar: ['2.5x', '4x', '50%', '16'],
  bytes: ['KiB', 'MiB', 'GiB', 'MB', 'GB'],
  flops: ['MFLOPs', 'GFLOPs', 'TFLOPs'],
  rate_flops: ['MFLOP/s', 'GFLOP/s', 'TFLOP/s'],
  bandwidth: ['MB/s', 'GB/s', 'GiB/s', 'TB/s'],
  time: ['ns', 'us', 'ms', 's'],
  token_rate: ['tok/s', 'tokens/s', 'ktok/s'],
}

function kindLabel(kind: Exercise['kind'], locale: Locale): string {
  switch (kind) {
    case 'code':
      return tr(locale, '💻 代码实验', '💻 Code')
    case 'estimate':
      return tr(locale, '📐 容量/算力估算', '📐 Estimate')
    case 'quiz':
      return tr(locale, '⚡ 概念小测', '⚡ Quiz')
    case 'simulator':
      return tr(locale, '🎛️ 交互模拟', '🎛️ Simulator')
    case 'explanation':
      return tr(locale, '✍️ 机制解释', '✍️ Explanation')
  }
}

function profileBadgeLabel(profile: Exercise['resourceProfile'], locale: Locale): string {
  if (profile === 'scalar-cpu') return tr(locale, '单核 CPU 配额 (scalar-cpu)', '1-Core CPU (scalar-cpu)')
  if (profile === 'multicore-cpu') return tr(locale, '多核 CPU 配额 (multicore-cpu)', 'Multicore CPU (multicore-cpu)')
  if (profile === 'distributed-gloo') return tr(locale, '多进程通信配额 (distributed-gloo)', 'Distributed Gloo')
  return ''
}

export function ActivityView({
  lesson,
  workspace,
  activeExerciseId,
  code,
  note,
  prediction,
  activeRun,
  hintTexts,
  latestFeedback,
  saveStatus,
  busy,
  locale,
  glossary,
  environment,
  evidence,
  fastTrackedLessons,
  measuredRooflinePoints,
  hasNextLesson,
  onSelectExercise,
  onCodeChange,
  onResetStarter,
  onRestoreRunCode,
  onNoteChange,
  onPredictionChange,
  onCodeSelection,
  onStartRun,
  onCancelRun,
  onSelectRun,
  onSubmitAnswer,
  onCompleteSimulator,
  onRequestHint,
  onBeginIndependent,
  onJumpNextLesson,
  onJumpLesson,
}: ActivityViewProps) {
  const exercise =
    workspace?.exercise.id === activeExerciseId
      ? workspace.exercise
      : (lesson.exercises.find((e) => e.id === activeExerciseId) ?? lesson.exercises[0])

  const [selectedQuizOption, setSelectedQuizOption] = useState<string>('')
  const [estimateInput, setEstimateInput] = useState<string>('')
  const [explanationInput, setExplanationInput] = useState<string>('')
  const [activeHintTab, setActiveHintTab] = useState<HelpLevel | undefined>(undefined)

  useEffect(() => {
    setSelectedQuizOption('')
    setEstimateInput('')
    setExplanationInput('')
    setActiveHintTab(undefined)
  }, [activeExerciseId, workspace?.attemptId])

  // Pre-fill previous answer if available in current attempt
  useEffect(() => {
    if (!workspace || workspace.exercise.id !== activeExerciseId) return
    const latestAns = workspace.answers.findLast(a => a.attemptId === workspace.attemptId)
    if (!latestAns) return
    if (workspace.exercise.kind === 'quiz' && !selectedQuizOption) {
      setSelectedQuizOption(latestAns.text)
    } else if (workspace.exercise.kind === 'estimate' && !estimateInput) {
      setEstimateInput(latestAns.text)
    } else if (workspace.exercise.kind === 'explanation' && !explanationInput) {
      setExplanationInput(latestAns.text)
    }
  }, [workspace, activeExerciseId])

  const passedExerciseIds = useMemo(
    () => new Set(evidence.filter(completesActivity).map(e => e.exerciseId)),
    [evidence],
  )

  if (!exercise) {
    return (
      <div className="ail-card">
        <p className="ail-muted">
          {tr(locale, '本单元暂无练习活动。', 'No exercises configured for this lesson.')}
        </p>
      </div>
    )
  }

  const isRunning =
    activeRun !== undefined &&
    (activeRun.run_status === 'queued' || activeRun.run_status === 'running')

  const feedbackForCurrent =
    latestFeedback?.exerciseId === exercise.id ? latestFeedback : undefined

  const lastWorkspaceAnswer =
    workspace?.exercise.id === exercise.id ? workspace.answers.findLast(a => a.attemptId === workspace.attemptId) : undefined

  const effectiveStatus: CheckStatus | undefined =
    feedbackForCurrent?.status ?? lastWorkspaceAnswer?.status

  const effectiveDiagnostic: BilingualText | undefined =
    feedbackForCurrent?.diagnostic ?? lastWorkspaceAnswer?.diagnostic

  const isFastTrackPassed =
    Boolean(exercise.fastTrackSkipLesson) &&
    (effectiveStatus === 'passed' ||
      fastTrackedLessons.includes(lesson.id) ||
      passedExerciseIds.has(exercise.id))

  // Step contract statuses from activeRun
  const stepStatuses = useMemo(() => {
    if (!exercise.steps || exercise.steps.length === 0) return []
    const checkEvents = (activeRun?.events ?? []).filter((ev) => ev.type === 'check')
    return exercise.steps.map((step) => {
      const matched = checkEvents.filter(
        (ev) => ev.step === step.name || ev.name === step.name,
      )
      if (matched.length === 0) {
        return { step, state: 'pending' as const, detail: '' }
      }
      const failed = matched.find((ev) => ev.passed === false)
      if (failed) {
        return { step, state: 'failed' as const, detail: failed.message?.[locale] ?? failed.detail ?? failed.name }
      }
      const allPassed = matched.every((ev) => ev.passed === true)
      return {
        step,
        state: allPassed ? ('passed' as const) : ('pending' as const),
        detail: matched[0]?.message?.[locale] ?? matched[0]?.detail ?? '',
      }
    })
  }, [exercise.steps, activeRun, locale])

  const metricEvents = useMemo(
    () =>
      (activeRun?.events ?? []).filter(
        (ev) => ev.type === 'metric' || ev.type === 'roofline_point',
      ),
    [activeRun],
  )

  const parsedPreview = useMemo(() => {
    if (exercise.kind !== 'estimate' || !estimateInput.trim()) return null
    return parseQuantity(estimateInput)
  }, [exercise.kind, estimateInput])

  const predictionMissing =
    exercise.kind === 'code' &&
    Boolean(exercise.requiresPrediction) &&
    prediction.trim().length === 0

  const unlockedHints = new Set(workspace?.hints ?? [])

  return (
    <div className="ail-activity-stack">
      {/* Exercise Selector Tabs within Lesson */}
      <div
        className="ail-ex-tabs"
        role="tablist"
        aria-label={tr(locale, '本课练习列表', 'Lesson Exercises')}
      >
        {lesson.exercises.map((ex, idx) => {
          const isCurrent = ex.id === exercise.id
          const isDone = passedExerciseIds.has(ex.id)
          return (
            <button
              key={ex.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              className={`ail-ex-tab ${isCurrent ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
              onClick={() => onSelectExercise(ex.id)}
            >
              <span className="ail-ex-tab-num">
                {isDone ? '✓' : `#${idx + 1}`}
              </span>
              <span className="ail-ex-tab-title">{pickText(ex.title, locale)}</span>
              <span className="ail-ex-tab-kind">{kindLabel(ex.kind, locale)}</span>
            </button>
          )
        })}
      </div>

      {/* Main Exercise Prompt & Metadata Header */}
      <section className="ail-card">
        <div className="ail-ex-header">
          <div>
            <div className="ail-ex-kicker">
              <span className="ail-pill">{exercise.id}</span>
              <span className="ail-pill">{kindLabel(exercise.kind, locale)}</span>
              {exercise.fastTrackSkipLesson && (
                <span className="ail-pill ail-pill-accent">
                  {tr(locale, '⚡ 快速通关检定题', '⚡ Fast-Track Gate')}
                </span>
              )}
              {exercise.resourceProfile && (
                <span className="ail-pill">
                  {profileBadgeLabel(exercise.resourceProfile, locale)}
                </span>
              )}
            </div>
            <h2 className="ail-ex-title">{pickText(exercise.title, locale)}</h2>
          </div>
          <DataSourceBadge
            kind={exercise.dataSource}
            locale={locale}
            showNote={exercise.dataSource === 'cpu_measured'}
          />
        </div>

        <div className="ail-ex-prompt">
          <MarkdownView
            markdown={pickText(exercise.prompt, locale)}
            locale={locale}
            glossary={glossary}
            onJumpLesson={onJumpLesson}
          />
        </div>

        {exercise.concepts.length > 0 && (
          <div className="ail-concept-row">
            <span className="ail-muted">
              {tr(locale, '关联概念：', 'Concepts:')}
            </span>
            {exercise.concepts.map((c) => (
              <code key={c} className="ail-inline-code">
                {c}
              </code>
            ))}
          </div>
        )}
      </section>

      {/* ==================== 1. CODE EXERCISE ==================== */}
      {exercise.kind === 'code' && (
        <section className="ail-card">
          {/* Micro-step contracts */}
          {stepStatuses.length > 0 && (
            <div className="ail-steps-box">
              <div className="ail-steps-title">
                {tr(locale, '📋 微步骤验证契约（Step Contracts）', '📋 Micro-Step Contracts')}
              </div>
              <div className="ail-steps-grid">
                {stepStatuses.map(({ step, state, detail }) => (
                  <div key={step.name} className={`ail-step-item is-${state}`}>
                    <span className="ail-step-icon" aria-hidden="true">
                      {state === 'passed' ? '✓' : state === 'failed' ? '✗' : '○'}
                    </span>
                    <div className="ail-step-body">
                      <strong>{pickText(step.title, locale)}</strong>
                      <code>{step.name}</code>
                      {detail && <small>{detail}</small>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mandatory Prediction-before-run box */}
          {exercise.requiresPrediction && (
            <div className="ail-prediction-box">
              <label>
                <strong>
                  {tr(
                    locale,
                    '🔮 先预测再运行（必填）：在执行实测前，先写下你预期的趋势、数量级或瓶颈原因',
                    '🔮 Predict Before Running (Required): State your expected magnitude, speedup, or bottleneck first',
                  )}
                </strong>
                <textarea
                  rows={2}
                  value={prediction}
                  placeholder={tr(
                    locale,
                    '例如：非连续切片会产生额外拷贝或破坏缓存局部性，预计吞吐下降 2x~5x…',
                    'e.g. Non-contiguous slicing hurts spatial locality or triggers copies, expecting 2x-5x slower throughput…',
                  )}
                  onChange={(e) => onPredictionChange(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* Code Editor Toolbar */}
          <div className="ail-editor-toolbar">
            <div className="ail-editor-toolbar-left">
              <strong>Python 3 (Sandbox)</strong>
              {saveStatus && <span className="ail-save-indicator">{saveStatus}</span>}
            </div>
            <div className="ail-editor-toolbar-right">
              {workspace && workspace.runs.length > 0 && (
                <select
                  aria-label={tr(locale, '选择历史运行记录', 'Select historical run')}
                  value={activeRun?.id ?? ''}
                  onChange={(e) => {
                    const found = workspace.runs.find((r) => r.id === e.target.value)
                    if (found) onSelectRun(found)
                  }}
                >
                  {workspace.runs.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      #{workspace.runs.length - i} · {r.run_status} ({r.check_status})
                    </option>
                  ))}
                </select>
              )}
              {activeRun && activeRun.code !== code && (
                <button
                  type="button"
                  className="ail-btn ail-btn-xs"
                  onClick={() => onRestoreRunCode(activeRun.code)}
                >
                  {tr(locale, '载入该次运行代码', 'Load Run Code')}
                </button>
              )}
              <button
                type="button"
                className="ail-btn ail-btn-xs"
                disabled={busy || isRunning}
                onClick={onResetStarter}
              >
                {tr(locale, '恢复起始代码', 'Reset to Starter')}
              </button>
            </div>
          </div>

          <CodeEditor
            value={code}
            label={tr(locale, '实验代码编辑器', 'Exercise Python Editor')}
            readOnly={isRunning}
            onChange={onCodeChange}
            onSelection={onCodeSelection}
            onRun={() => {
              if (!predictionMissing && !busy && !isRunning) {
                onStartRun()
              }
            }}
          />

          {environment && !environment.available && (
            <p className="ail-inline-warn">
              {tr(
                locale,
                '⚠️ 当前 Docker 实验环境尚未就绪，请先参考顶部环境提示卡准备镜像后再运行代码。',
                '⚠️ Docker sandbox is not ready yet. Prepare the image from the banner above to execute code.',
              )}
            </p>
          )}

          {predictionMissing && (
            <p className="ail-inline-warn">
              {tr(
                locale,
                '👆 请先填写上方的“先预测再运行”输入框，解锁运行按钮。',
                '👆 Fill in the prediction box above before running.',
              )}
            </p>
          )}

          <div className="ail-action-bar">
            <button
              type="button"
              className="ail-btn ail-btn-primary"
              disabled={busy || isRunning || predictionMissing}
              onClick={onStartRun}
            >
              {isRunning
                ? tr(locale, '⏳ 容器执行中…', '⏳ Running in Sandbox…')
                : tr(locale, '▶ 运行验证 (Ctrl+Enter)', '▶ Run & Verify (Ctrl+Enter)')}
            </button>

            {isRunning && activeRun && (
              <button
                type="button"
                className="ail-btn ail-btn-danger"
                onClick={() => onCancelRun(activeRun.id)}
              >
                {tr(locale, '⏹ 取消运行', '⏹ Cancel Run')}
              </button>
            )}
          </div>

          {/* Run Result Output */}
          {activeRun && (
            <div className="ail-run-panel">
              <div className="ail-run-head">
                <div className="ail-run-badges">
                  <span className={`ail-status-pill is-${activeRun.run_status}`}>
                    {tr(locale, '运行状态：', 'Run: ')}
                    {activeRun.run_status}
                  </span>
                  <span className={`ail-status-pill is-check-${activeRun.check_status}`}>
                    {tr(locale, '检验结果：', 'Checks: ')}
                    {activeRun.check_status}
                  </span>
                  <DataSourceBadge kind={activeRun.dataSource} locale={locale} />
                </div>
                <small className="ail-muted">
                  {activeRun.id} · {activeRun.resourceProfile}
                </small>
              </div>

              {activeRun.prediction && (
                <div className="ail-run-prediction-echo">
                  <strong>{tr(locale, '你的运行前预测：', 'Your Pre-run Prediction: ')}</strong>
                  <span>{activeRun.prediction}</span>
                </div>
              )}

              {metricEvents.length > 0 && (
                <div className="ail-metrics-grid">
                  {metricEvents.map((ev) => (
                    <div key={ev.seq} className="ail-metric-card">
                      <small>{ev.message?.[locale] ?? ev.name}</small>
                      <strong>
                        {ev.type === 'roofline_point'
                          ? `AI=${ev.arithmeticIntensity?.toFixed(2)} · ${ev.gflops?.toFixed(2)} GFLOP/s`
                          : `${ev.value ?? ''}${ev.unit ? ` ${ev.unit}` : ''}`}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              {activeRun.reason && (
                <p className="ail-feedback ail-feedback-fail">{activeRun.reason}</p>
              )}

              {activeRun.log && (
                <div className="ail-log-box">
                  <div className="ail-log-head">
                    {tr(locale, '容器标准输出 / 日志', 'Sandbox Output / Logs')}
                  </div>
                  <pre>{activeRun.log}</pre>
                </div>
              )}

              {activeRun.check_status === 'failed' && exercise.commonErrors.length > 0 && (
                <details className="ail-common-errors" open>
                  <summary>
                    {tr(locale, '🔍 常见错误排查线索', '🔍 Common Pitfalls & Troubleshooting')}
                  </summary>
                  <ul>
                    {exercise.commonErrors.map((err, idx) => (
                      <li key={idx}>{pickText(err, locale)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== 2. QUIZ EXERCISE ==================== */}
      {exercise.kind === 'quiz' && exercise.quiz && (
        <section className="ail-card">
          <div
            className="ail-quiz-options"
            role="radiogroup"
            aria-label={pickText(exercise.title, locale)}
          >
            {exercise.quiz.options.map((opt) => {
              const checked = selectedQuizOption === opt.id
              return (
                <label
                  key={opt.id}
                  className={checked ? 'ail-quiz-option is-selected' : 'ail-quiz-option'}
                >
                  <input
                    type="radio"
                    name={`quiz-${exercise.id}`}
                    value={opt.id}
                    checked={checked}
                    onChange={() => setSelectedQuizOption(opt.id)}
                  />
                  <span className="ail-quiz-opt-id">{opt.id.toUpperCase()}</span>
                  <span className="ail-quiz-opt-text">{pickText(opt.label, locale)}</span>
                </label>
              )
            })}
          </div>

          <div className="ail-action-bar">
            <button
              type="button"
              className="ail-btn ail-btn-primary"
              disabled={busy || !selectedQuizOption}
              onClick={() => onSubmitAnswer(selectedQuizOption)}
            >
              {tr(locale, '提交选项判定', 'Submit Answer')}
            </button>
          </div>

          {effectiveDiagnostic && (
            <div
              className={
                effectiveStatus === 'passed'
                  ? 'ail-feedback ail-feedback-pass'
                  : 'ail-feedback ail-feedback-fail'
              }
            >
              <strong>
                {effectiveStatus === 'passed'
                  ? tr(locale, '✓ 回答正确：', '✓ Passed: ')
                  : tr(locale, '✗ 请再思考：', '✗ Diagnostic: ')}
              </strong>
              <span>{pickText(effectiveDiagnostic, locale)}</span>
            </div>
          )}

          {isFastTrackPassed && (
            <div className="ail-fasttrack-banner">
              <div>
                <strong>
                  {tr(
                    locale,
                    '🎉 已完成快速通关检定！你已掌握本单元前置概念。',
                    '🎉 Fast-Track Passed! Mastery verified for this lesson.',
                  )}
                </strong>
              </div>
              {hasNextLesson && (
                <button
                  type="button"
                  className="ail-btn ail-btn-primary"
                  onClick={onJumpNextLesson}
                >
                  {tr(
                    locale,
                    '已完成快速通关，可直接前往下一单元 →',
                    'Fast-Track Complete — Jump to Next Lesson →',
                  )}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== 3. ESTIMATE EXERCISE ==================== */}
      {exercise.kind === 'estimate' && (
        <section className="ail-card">
          <div className="ail-estimate-box">
            <label className="ail-estimate-label">
              <strong>
                {tr(
                  locale,
                  '输入你的工程估算结果（必须携带正确量纲单位，除非是无量纲倍率）：',
                  'Enter your back-of-the-envelope estimate (include unit suffix):',
                )}
              </strong>
              <div className="ail-estimate-input-row">
                <input
                  type="text"
                  value={estimateInput}
                  placeholder={tr(
                    locale,
                    '例如：64 MiB、512 MFLOPs、12.5 GFLOP/s、2.5x',
                    'e.g. 64 MiB, 512 MFLOPs, 12.5 GFLOP/s, 2.5x',
                  )}
                  onChange={(e) => setEstimateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && estimateInput.trim() && !busy) {
                      e.preventDefault()
                      onSubmitAnswer(estimateInput.trim())
                    }
                  }}
                />
                <button
                  type="button"
                  className="ail-btn ail-btn-primary"
                  disabled={busy || !estimateInput.trim()}
                  onClick={() => onSubmitAnswer(estimateInput.trim())}
                >
                  {tr(locale, '提交估算并诊断', 'Check Estimate')}
                </button>
              </div>
            </label>

            <div className="ail-unit-chips">
              <span className="ail-muted">
                {tr(locale, '点击快捷补全常用单位：', 'Quick unit suffixes:')}
              </span>
              {(exercise.estimate
                ? UNIT_EXAMPLES[exercise.estimate.dimension]
                : ['MiB', 'GiB', 'MFLOPs', 'GFLOP/s', 'GB/s', 'ms', '2.5x']
              ).map((u) => (
                <button
                  key={u}
                  type="button"
                  className="ail-btn ail-btn-xs"
                  onClick={() => {
                    setEstimateInput((prev) => {
                      const numMatch = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(
                        prev.trim(),
                      )
                      if (u.endsWith('x') && !numMatch) return u
                      const cleanUnit = u === '2.5x' ? 'x' : u
                      return numMatch
                        ? `${numMatch[0]}${cleanUnit === 'x' || cleanUnit === '%' ? cleanUnit : ` ${cleanUnit}`}`
                        : `${prev.trim()} ${cleanUnit}`.trim()
                    })
                  }}
                >
                  {u}
                </button>
              ))}
            </div>

            {estimateInput.trim() && (
              <small className="ail-muted">
                {parsedPreview
                  ? tr(
                      locale,
                      `输入语法解析预览：数值 ${parsedPreview.rawNumber}，识别到单位 "${parsedPreview.unitKey || '(无量纲)'}"（量纲：${parsedPreview.dimension}）`,
                      `Parsed preview: value ${parsedPreview.rawNumber}, unit "${parsedPreview.unitKey || '(dimensionless)'}" (dimension: ${parsedPreview.dimension})`,
                    )
                  : tr(
                      locale,
                      '尚未识别到标准“数值 + 单位”格式，请检查拼写（如 64 MiB、128 MFLOPs）',
                      'Could not parse "number + unit" yet; check unit spelling (e.g. 64 MiB, 128 MFLOPs)',
                    )}
              </small>
            )}
          </div>

          {effectiveDiagnostic && (
            <div
              className={
                effectiveStatus === 'passed'
                  ? 'ail-feedback ail-feedback-pass'
                  : 'ail-feedback ail-feedback-fail'
              }
            >
              <strong>
                {effectiveStatus === 'passed'
                  ? tr(locale, '✓ 估算通过：', '✓ Estimate Passed: ')
                  : tr(locale, '📐 误差与量纲诊断：', '📐 Diagnostic: ')}
              </strong>
              <span>{pickText(effectiveDiagnostic, locale)}</span>
            </div>
          )}
        </section>
      )}

      {exercise.id === 'E01-code' && activeRun?.exerciseId === exercise.id && <DecodeTimingChart events={activeRun.events} locale={locale} />}
      {activeRun?.exerciseId === exercise.id && activeRun.events.some(e => e.timeline?.length) && <details>
        <summary>{{zh:'查看各进程通信时间线',en:'Inspect per-rank communication calls'}[locale]}</summary>
        <table><thead><tr><th>Rank</th><th>{{zh:'调用',en:'Call'}[locale]}</th>
          <th>{{zh:'开始 (ms)',en:'Start (ms)'}[locale]}</th><th>{{zh:'结束 (ms)',en:'End (ms)'}[locale]}</th></tr></thead>
          <tbody>{activeRun.events.flatMap(e => (e.timeline ?? []).map((t,i) =>
            <tr key={e.seq+'-'+i}><td>{t.rank}</td><td>{t.op}</td><td>{t.startMs.toFixed(2)}</td><td>{t.endMs.toFixed(2)}</td></tr>))}</tbody></table>
      </details>}

      {/* ==================== 4. SIMULATOR EXERCISE ==================== */}
      {exercise.kind === 'simulator' && exercise.simulator && <LessonExplorer key={exercise.id}
        locale={locale} widget={exercise.simulator.widget} measuredPoints={measuredRooflinePoints}
        simulatorExercise={{ goalDescription: exercise.simulator.goalDescription, busy, status: effectiveStatus,
          diagnostic: effectiveDiagnostic, onComplete: onCompleteSimulator }} />}

      {/* ==================== 5. EXPLANATION EXERCISE ==================== */}
      {exercise.kind === 'explanation' && (
        <section className="ail-card">
          <label className="ail-explanation-label">
            <strong>
              {tr(
                locale,
                '用自己的话阐述底层系统机制与因果链条：',
                'Explain the underlying hardware/system mechanism in your own words:',
              )}
            </strong>
            <textarea
              rows={5}
              value={explanationInput}
              placeholder={tr(
                locale,
                '建议结合字节数、访存步长、算术强度或数值表示位数写出清晰的定量推演…',
                'Explain the mechanism quantitatively referencing bytes, strides, arithmetic intensity, or bit width…',
              )}
              onChange={(e) => setExplanationInput(e.target.value)}
            />
          </label>

          <div className="ail-action-bar">
            <button
              type="button"
              className="ail-btn ail-btn-primary"
              disabled={busy || !explanationInput.trim()}
              onClick={() => onSubmitAnswer(explanationInput.trim(), activeRun?.id)}
            >
              {tr(locale, '提交机制解释', 'Submit Explanation')}
            </button>
          </div>

          {effectiveDiagnostic && (
            <div
              className={
                effectiveStatus === 'passed'
                  ? 'ail-feedback ail-feedback-pass'
                  : 'ail-feedback ail-feedback-fail'
              }
            >
              <strong>
                {effectiveStatus === 'passed'
                  ? tr(locale, '✓ 解释已通过检定：', '✓ Explanation Accepted: ')
                  : tr(locale, '💡 改进建议：', '💡 Feedback: ')}
              </strong>
              <span>{pickText(effectiveDiagnostic, locale)}</span>
            </div>
          )}
        </section>
      )}

      {/* ==================== HINT LADDER & INDEPENDENT ATTEMPT ==================== */}
      <section className="ail-card ail-scaffold-card">
        <div className="ail-scaffold-header">
          <div>
            <strong>
              {tr(locale, '🪜 四级渐进提示阶梯 & 独立尝试', '🪜 4-Level Hint Ladder & Independent Attempt')}
            </strong>
            <small>
              {tr(
                locale,
                '按需逐级获取提示；若使用了代码/答案提示后想证明已真正独立掌握，可点击“开启独立新尝试”。',
                'Request progressive hints when stuck; start a fresh Independent Attempt anytime to prove unassisted mastery.',
              )}
            </small>
          </div>
          <button
            type="button"
            className="ail-btn ail-btn-sm"
            disabled={busy}
            onClick={onBeginIndependent}
          >
            {tr(locale, '🔄 开启独立新尝试', '🔄 Begin Independent Attempt')}
          </button>
        </div>

        <div className="ail-hint-buttons">
          {HINT_LADDER.map((item) => {
            const unlocked = unlockedHints.has(item.level) || Boolean(hintTexts[item.level])
            const selected = activeHintTab === item.level
            return (
              <button
                key={item.level}
                type="button"
                className={`ail-btn ail-btn-sm ${selected ? 'ail-btn-primary' : ''}`}
                disabled={busy}
                onClick={() => {
                  setActiveHintTab(item.level)
                  if (!hintTexts[item.level]) {
                    onRequestHint(item.level)
                  }
                }}
              >
                {unlocked ? '🔓 ' : '🔒 '}
                {tr(locale, item.zh, item.en)}
              </button>
            )
          })}
        </div>

        {activeHintTab && hintTexts[activeHintTab] && (
          <div className="ail-hint-body">
            <MarkdownView
              markdown={pickText(hintTexts[activeHintTab], locale)}
              locale={locale}
              glossary={glossary}
              onJumpLesson={onJumpLesson}
            />
          </div>
        )}

        {/* Personal Lab Note */}
        <details className="ail-note-details">
          <summary>
            {tr(locale, '📝 当前练习实验随手记（自动保存）', '📝 Personal Exercise Lab Note (Auto-saved)')}
          </summary>
          <textarea
            rows={3}
            value={note}
            placeholder={tr(
              locale,
              '记录你观察到的实测吞吐数字、反直觉现象或推导草稿…',
              'Jot down observed throughput numbers, derivations, or takeaways…',
            )}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </details>
      </section>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { css } from './client-style.ts'
import { ActivityView } from './components/ActivityView.tsx'
import { BitLayoutExplorer } from './components/BitLayoutExplorer.tsx'
import { EnvironmentBanner } from './components/EnvironmentBanner.tsx'
import { GlossaryDrawer } from './components/GlossaryDrawer.tsx'
import { MarkdownView } from './components/MarkdownView.tsx'
import { MentorDrawer } from './components/MentorDrawer.tsx'
import { PrereqGraph } from './components/PrereqGraph.tsx'
import { RecordsView } from './components/RecordsView.tsx'
import { RooflineExplorer } from './components/RooflineExplorer.tsx'
import { detectInitialLocale, persistLocale, pickText, tr } from './components/i18n.ts'
import type {
  BilingualText,
  CheckStatus,
  EnvironmentStatus,
  HelpLevel,
  InfraLabApi,
  Locale,
  Overview,
  RunRecord,
  Workspace,
} from './types.ts'

let styleRefCount = 0

function useInfraLabStyles(): void {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    styleRefCount += 1
    let styleEl = document.head.querySelector(
      'style[data-ai-infra-lab-style]',
    ) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.setAttribute('data-ai-infra-lab-style', '')
      styleEl.textContent = css
      document.head.appendChild(styleEl)
    } else if (styleEl.textContent !== css) {
      styleEl.textContent = css
    }
    return () => {
      styleRefCount = Math.max(0, styleRefCount - 1)
      if (styleRefCount === 0) {
        document.head.querySelector('style[data-ai-infra-lab-style]')?.remove()
      }
    }
  }, [])
}

function isRunActive(run: RunRecord | undefined): boolean {
  return run !== undefined && (run.run_status === 'queued' || run.run_status === 'running')
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface DraftBuffer {
  exerciseId: string
  code: string
  savedCode: string
  revision: number
  note: string
  savedNote: string
  noteRevision: number
  conflictRemote?: Workspace
}

type MainTab = 'lesson' | 'activity' | 'records'

export function Workbench({ api }: { readonly api: InfraLabApi }) {
  useInfraLabStyles()

  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale())
  const [overview, setOverview] = useState<Overview>()
  const [environment, setEnvironment] = useState<EnvironmentStatus>()
  const [checkingEnv, setCheckingEnv] = useState(false)

  const [lessonId, setLessonId] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [tab, setTab] = useState<MainTab>('lesson')
  const [showTopology, setShowTopology] = useState(true)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [mentorOpen, setMentorOpen] = useState(true)

  const [workspace, setWorkspace] = useState<Workspace>()
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [prediction, setPrediction] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [activeRun, setActiveRun] = useState<RunRecord>()
  const [hintTexts, setHintTexts] = useState<Partial<Record<HelpLevel, BilingualText>>>({})
  const [latestFeedback, setLatestFeedback] = useState<{
    exerciseId: string
    status: CheckStatus
    diagnostic: BilingualText
  }>()

  const [conflictWorkspace, setConflictWorkspace] = useState<Workspace>()
  const [saveStatus, setSaveStatus] = useState('')
  const [errorBanner, setErrorBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [mentorBusy, setMentorBusy] = useState(false)

  const mountedRef = useRef(true)
  const wsGenerationRef = useRef(0)
  const bufferRef = useRef<DraftBuffer | undefined>(undefined)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mainScrollRef = useRef<HTMLDivElement>(null)

  const switchLocale = (next: Locale) => {
    setLocale(next)
    persistLocale(next)
  }

  const reportError = (err: unknown) => {
    if (mountedRef.current) {
      setErrorBanner(formatError(err))
    }
  }

  useLayoutEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [lessonId, tab])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshOverview = async (): Promise<Overview | undefined> => {
    const data = await api.overview()
    if (!mountedRef.current) return undefined
    setOverview(data)
    return data
  }

  const recheckEnvironment = async () => {
    setCheckingEnv(true)
    try {
      const env = await api.environment()
      if (mountedRef.current) setEnvironment(env)
    } catch (err) {
      reportError(err)
    } finally {
      if (mountedRef.current) setCheckingEnv(false)
    }
  }

  // Initial bootstrap
  useEffect(() => {
    void refreshOverview()
      .then((o) => {
        if (!o) return
        const initialLesson =
          o.catalog.lessons.find((l) => l.id === o.currentLesson) ?? o.catalog.lessons[0]
        if (initialLesson) {
          setLessonId(initialLesson.id)
          setExerciseId(initialLesson.exercises[0]?.id ?? '')
        }
      })
      .catch(reportError)

    void recheckEnvironment()
  }, [api])

  // Revision-guarded draft & note save without blind replay on uncertain error
  const flushSave = (): Promise<void> => {
    const buf = bufferRef.current
    if (!buf || buf.conflictRemote) return saveQueueRef.current

    const job = saveQueueRef.current.then(async () => {
      if (buf.conflictRemote) return

      if (buf.code !== buf.savedCode) {
        const submittedCode = buf.code
        const expectedRev = buf.revision
        try {
          const nextRev = await api.saveDraft(buf.exerciseId, submittedCode, expectedRev)
          buf.revision = nextRev
          buf.savedCode = submittedCode
        } catch (err) {
          // Uncertain outcome or revision conflict: read-only reconcile, never blind replay
          const remote = await api.workspace(buf.exerciseId)
          if (remote.draft === submittedCode) {
            buf.revision = remote.revision
            buf.savedCode = remote.draft
          } else {
            buf.conflictRemote = remote
            if (mountedRef.current && bufferRef.current === buf) {
              setConflictWorkspace(remote)
            }
            throw err
          }
        }
      }

      if (buf.note !== buf.savedNote) {
        const submittedNote = buf.note
        const expectedNoteRev = buf.noteRevision
        try {
          const nextNoteRev = await api.saveNote(
            buf.exerciseId,
            submittedNote,
            expectedNoteRev,
          )
          buf.noteRevision = nextNoteRev
          buf.savedNote = submittedNote
        } catch (err) {
          const remote = await api.workspace(buf.exerciseId)
          if (remote.note === submittedNote) {
            buf.noteRevision = remote.noteRevision
            buf.savedNote = remote.note
          } else {
            buf.conflictRemote = remote
            if (mountedRef.current && bufferRef.current === buf) {
              setConflictWorkspace(remote)
            }
            throw err
          }
        }
      }
    })

    saveQueueRef.current = job.catch((err) => {
      reportError(err)
    })
    return job
  }

  // Load workspace when exerciseId changes
  useEffect(() => {
    if (!exerciseId) return
    const gen = ++wsGenerationRef.current
    const abort = new AbortController()

    setSaveStatus('')
    setSelectedCode('')
    setConflictWorkspace(undefined)

    void flushSave()
      .catch(() => undefined)
      .then(() => api.workspace(exerciseId, abort.signal))
      .then((ws) => {
        if (!mountedRef.current || gen !== wsGenerationRef.current) return
        bufferRef.current = {
          exerciseId: ws.exercise.id,
          code: ws.draft,
          savedCode: ws.draft,
          revision: ws.revision,
          note: ws.note,
          savedNote: ws.note,
          noteRevision: ws.noteRevision,
        }
        setWorkspace(ws)
        setCode(ws.draft)
        setNote(ws.note)
        setActiveRun(ws.runs[0])
        setHintTexts({})
        // Restore local unsubmitted prediction memo per attempt
        try {
          const predKey = `ai-infra-lab:pred:${ws.profileId}:${ws.exercise.id}:${ws.attemptId}`
          setPrediction(localStorage.getItem(predKey) ?? '')
        } catch {
          setPrediction('')
        }
      })
      .catch((err) => {
        if (!abort.signal.aborted) reportError(err)
      })

    return () => {
      abort.abort()
    }
  }, [api, exerciseId])

  // Debounced auto-save when code or note changes
  useEffect(() => {
    const buf = bufferRef.current
    if (!buf || !workspace || buf.exerciseId !== workspace.exercise.id) return
    if (buf.code === buf.savedCode && buf.note === buf.savedNote) return

    const timer = setTimeout(() => {
      void flushSave()
        .then(() => {
          if (
            mountedRef.current &&
            bufferRef.current === buf &&
            buf.code === buf.savedCode &&
            buf.note === buf.savedNote
          ) {
            setSaveStatus(tr(locale, '草稿已保存', 'Saved'))
          }
        })
        .catch(() => undefined)
    }, 600)

    return () => clearTimeout(timer)
  }, [code, note, workspace, locale])

  // Poll active container run until terminal state
  useEffect(() => {
    if (!activeRun || !isRunActive(activeRun)) return
    let cancelled = false
    let inFlight = false
    const abort = new AbortController()

    const pollOnce = async () => {
      if (inFlight || cancelled) return
      inFlight = true
      try {
        const updated = await api.run(activeRun.id, abort.signal)
        if (cancelled || !mountedRef.current) return
        setActiveRun(updated)
        if (!isRunActive(updated)) {
          const [freshWs] = await Promise.all([
            api.workspace(updated.exerciseId, abort.signal),
            refreshOverview(),
          ])
          if (!cancelled && mountedRef.current) {
            setWorkspace((prev) =>
              prev && prev.exercise.id === freshWs.exercise.id
                ? { ...prev, runs: freshWs.runs, messages: freshWs.messages }
                : freshWs,
            )
          }
        }
      } catch (err) {
        if (!abort.signal.aborted && !cancelled) reportError(err)
      } finally {
        inFlight = false
      }
    }

    const interval = setInterval(() => {
      void pollOnce()
    }, 700)

    return () => {
      cancelled = true
      abort.abort()
      clearInterval(interval)
    }
  }, [api, activeRun?.id, activeRun?.run_status])

  const updateCode = (next: string) => {
    setCode(next)
    setSaveStatus(tr(locale, '未保存…', 'Editing…'))
    if (bufferRef.current && bufferRef.current.exerciseId === exerciseId) {
      bufferRef.current.code = next
    }
  }

  const updateNote = (next: string) => {
    setNote(next)
    setSaveStatus(tr(locale, '未保存…', 'Editing…'))
    if (bufferRef.current && bufferRef.current.exerciseId === exerciseId) {
      bufferRef.current.note = next
    }
  }

  const updatePrediction = (next: string) => {
    setPrediction(next)
    if (workspace) {
      try {
        const predKey = `ai-infra-lab:pred:${workspace.profileId}:${workspace.exercise.id}:${workspace.attemptId}`
        if (next) localStorage.setItem(predKey, next)
        else localStorage.removeItem(predKey)
      } catch {
        // Ignore storage quota errors
      }
    }
  }

  const selectLesson = async (nextLessonId: string, preferredExerciseId?: string) => {
    if (!overview) return
    const targetLesson = overview.catalog.lessons.find((l) => l.id === nextLessonId)
    if (!targetLesson) return
    setErrorBanner('')
    setLessonId(targetLesson.id)
    const nextEx =
      preferredExerciseId ??
      targetLesson.exercises[0]?.id ??
      ''
    setExerciseId(nextEx)
    if (preferredExerciseId) {
      setTab('activity')
    } else if (tab === 'records') {
      setTab('lesson')
    }
    try {
      await api.selectLesson(targetLesson.id)
    } catch (err) {
      reportError(err)
    }
  }

  const runGuardedAction = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setErrorBanner('')
    try {
      await fn()
    } catch (err) {
      reportError(err)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }

  if (!overview) {
    return (
      <main className="ai-infra-lab">
        <div className="ail-loading-shell">
          <div className="ail-spinner" aria-hidden="true" />
          <p>{tr(locale, '正在加载 AI Infra Lab 算力与系统实验室…', 'Loading AI Infra Lab…')}</p>
          {errorBanner && (
            <div className="ail-error-banner" role="alert">
              <span>{errorBanner}</span>
              <button
                type="button"
                className="ail-btn ail-btn-sm"
                onClick={() => {
                  setErrorBanner('')
                  void refreshOverview().catch(reportError)
                }}
              >
                {tr(locale, '重试', 'Retry')}
              </button>
            </div>
          )}
        </div>
      </main>
    )
  }

  const lessons = overview.catalog.lessons
  const currentLessonIndex = Math.max(
    0,
    lessons.findIndex((l) => l.id === lessonId),
  )
  const currentLesson = lessons[currentLessonIndex] ?? lessons[0]
  const nextLesson = lessons[currentLessonIndex + 1]
  const isCurrentLessonRead = currentLesson
    ? overview.readLessons.includes(currentLesson.id)
    : false
  const fastTrackExercise = currentLesson?.exercises.find((e) => e.fastTrackSkipLesson)

  return (
    <main className="ai-infra-lab">
      {/* Top Bar */}
      <header className="ail-topbar">
        <div className="ail-brand">
          <span className="ail-brand-icon" aria-hidden="true">
            ⚡
          </span>
          <div>
            <h1 className="ail-brand-title">
              {tr(locale, 'AI Infra Lab · 算力与系统实验室', 'AI Infra Lab')}
            </h1>
            <small className="ail-brand-sub">
              {tr(
                locale,
                `阶段 ${overview.catalog.stage} · 定量算账、内存局部性与 Roofline 实证`,
                `Stage ${overview.catalog.stage} · Quantitative Systems, Memory Locality & Roofline`,
              )}
            </small>
          </div>
        </div>

        <div className="ail-topbar-actions">
          <button
            type="button"
            className={`ail-btn ail-btn-sm ${showTopology ? 'ail-btn-active' : ''}`}
            onClick={() => setShowTopology((v) => !v)}
          >
            🗺️ {tr(locale, '依赖拓扑', 'Topology')}
          </button>

          <button
            type="button"
            className={`ail-btn ail-btn-sm ${glossaryOpen ? 'ail-btn-active' : ''}`}
            onClick={() => setGlossaryOpen((v) => !v)}
          >
            📖 {tr(locale, '术语词典', 'Glossary')} ({overview.catalog.glossary.length})
          </button>

          <button
            type="button"
            className={`ail-btn ail-btn-sm ${mentorOpen ? 'ail-btn-active' : ''}`}
            onClick={() => setMentorOpen((v) => !v)}
          >
            🤖 {tr(locale, 'AI 导师', 'Mentor')}
          </button>

          <div
            className="ail-locale-switch"
            role="group"
            aria-label={tr(locale, '界面语言切换', 'Language Switcher')}
          >
            <button
              type="button"
              className={locale === 'zh' ? 'is-active' : ''}
              onClick={() => switchLocale('zh')}
            >
              中文
            </button>
            <button
              type="button"
              className={locale === 'en' ? 'is-active' : ''}
              onClick={() => switchLocale('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Environment 3-state Banner */}
      <EnvironmentBanner
        environment={environment}
        locale={locale}
        checking={checkingEnv}
        onRecheck={() => void recheckEnvironment()}
      />

      {/* Error & Conflict Alerts */}
      {errorBanner && (
        <div className="ail-error-banner" role="alert">
          <span>⚠️ {errorBanner}</span>
          <button
            type="button"
            className="ail-btn ail-btn-ghost ail-btn-xs"
            onClick={() => setErrorBanner('')}
          >
            {tr(locale, '关闭', 'Dismiss')}
          </button>
        </div>
      )}

      {conflictWorkspace && (
        <div className="ail-conflict-banner" role="alert">
          <div>
            <strong>
              {tr(
                locale,
                '检测到草稿修订冲突或未确认写入：为保护数据，未自动覆盖服务端内容。',
                'Draft revision mismatch detected: automatic overwrite was halted to protect your work.',
              )}
            </strong>
          </div>
          <div className="ail-conflict-actions">
            <button
              type="button"
              className="ail-btn ail-btn-primary ail-btn-xs"
              onClick={() => {
                if (bufferRef.current) {
                  bufferRef.current.revision = conflictWorkspace.revision
                  bufferRef.current.savedCode = conflictWorkspace.draft
                  bufferRef.current.noteRevision = conflictWorkspace.noteRevision
                  bufferRef.current.savedNote = conflictWorkspace.note
                  bufferRef.current.conflictRemote = undefined
                }
                setConflictWorkspace(undefined)
                void flushSave()
              }}
            >
              {tr(locale, '基于最新修订保存本地修改', 'Keep Local Edits & Save')}
            </button>
            <button
              type="button"
              className="ail-btn ail-btn-xs"
              onClick={() => {
                bufferRef.current = {
                  exerciseId: conflictWorkspace.exercise.id,
                  code: conflictWorkspace.draft,
                  savedCode: conflictWorkspace.draft,
                  revision: conflictWorkspace.revision,
                  note: conflictWorkspace.note,
                  savedNote: conflictWorkspace.note,
                  noteRevision: conflictWorkspace.noteRevision,
                }
                setCode(conflictWorkspace.draft)
                setNote(conflictWorkspace.note)
                setConflictWorkspace(undefined)
              }}
            >
              {tr(locale, '采用服务端版本', 'Use Server Version')}
            </button>
          </div>
        </div>
      )}

      {/* 3-Pane Body */}
      <div className="ail-layout">
        {/* Left Sidebar: Lessons List */}
        <nav
          className="ail-lesson-nav"
          aria-label={tr(locale, '课程单元目录', 'Course Curriculum')}
        >
          <div className="ail-nav-section-label">
            {tr(locale, '课程单元 (Stage A)', 'Curriculum (Stage A)')}
          </div>

          <div className="ail-lesson-list">
            {lessons.map((item) => {
              const active = item.id === currentLesson?.id
              const read = overview.readLessons.includes(item.id)
              const fast = overview.fastTrackedLessons.includes(item.id)
              const doneCount = item.exercises.filter((ex) =>
                overview.evidence.some((ev) => ev.exerciseId === ex.id && ev.kind !== 'reading'),
              ).length

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ail-lesson-item ${active ? 'is-active' : ''}`}
                  onClick={() => void selectLesson(item.id)}
                >
                  <div className="ail-lesson-item-top">
                    <span className="ail-lesson-code">{item.id}</span>
                    <span className="ail-lesson-progress">
                      {fast
                        ? '⚡'
                        : doneCount === item.exercises.length && item.exercises.length > 0
                          ? '✓'
                          : read
                            ? '●'
                            : ''}
                      {item.exercises.length > 0 ? ` ${doneCount}/${item.exercises.length}` : ''}
                    </span>
                  </div>
                  <div className="ail-lesson-item-title">{pickText(item.title, locale)}</div>
                </button>
              )
            })}
          </div>

          {overview.reviews.length > 0 && (
            <button
              type="button"
              className="ail-review-shortcut"
              onClick={() => setTab('records')}
            >
              🔔{' '}
              {tr(
                locale,
                `${overview.reviews.length} 项待复习提醒 →`,
                `${overview.reviews.length} Review Items Due →`,
              )}
            </button>
          )}
        </nav>

        {/* Center Main Scrollable Area */}
        <div ref={mainScrollRef} className="ail-main-pane">
          {showTopology && (
            <PrereqGraph
              lessons={lessons}
              currentLessonId={currentLesson?.id ?? ''}
              readLessons={overview.readLessons}
              fastTrackedLessons={overview.fastTrackedLessons}
              evidence={overview.evidence}
              locale={locale}
              onSelectLesson={(id) => void selectLesson(id)}
            />
          )}

          {/* Primary Content View Tabs */}
          <div className="ail-main-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'lesson'}
              className={`ail-main-tab ${tab === 'lesson' ? 'is-active' : ''}`}
              onClick={() => setTab('lesson')}
            >
              📖 {tr(locale, '讲义与直觉模型', 'Lesson & Intuition')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'activity'}
              className={`ail-main-tab ${tab === 'activity' ? 'is-active' : ''}`}
              onClick={() => setTab('activity')}
            >
              🧪 {tr(locale, '实验与练习', 'Lab & Exercises')} (
              {currentLesson?.exercises.length ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'records'}
              className={`ail-main-tab ${tab === 'records' ? 'is-active' : ''}`}
              onClick={() => setTab('records')}
            >
              📊 {tr(locale, '学习档案与复习', 'Records & Reviews')}
              {overview.reviews.length > 0 && (
                <span className="ail-tab-badge">{overview.reviews.length}</span>
              )}
            </button>
          </div>

          {/* TAB 1: LESSON VIEW */}
          {tab === 'lesson' && currentLesson && (
            <div className="ail-lesson-stack">
              <article className="ail-card ail-lesson-card">
                <div className="ail-lesson-header">
                  <div className="ail-ex-kicker">
                    <span className="ail-pill">
                      {currentLesson.id} · Stage {currentLesson.stage}
                    </span>
                    {isCurrentLessonRead && (
                      <span className="ail-pill ail-pill-ok">
                        {tr(locale, '✓ 已读', '✓ Read')}
                      </span>
                    )}
                    {overview.fastTrackedLessons.includes(currentLesson.id) && (
                      <span className="ail-pill ail-pill-accent">
                        {tr(locale, '⚡ 快速通关', '⚡ Fast-Tracked')}
                      </span>
                    )}
                    {currentLesson.prerequisites.length > 0 && (
                      <span className="ail-muted">
                        {tr(locale, '前置单元：', 'Prerequisites: ')}
                        {currentLesson.prerequisites.join(', ')}
                      </span>
                    )}
                  </div>
                  <h2>{pickText(currentLesson.title, locale)}</h2>
                  <p className="ail-lesson-summary">
                    {pickText(currentLesson.summary, locale)}
                  </p>
                </div>

                {fastTrackExercise &&
                  !overview.fastTrackedLessons.includes(currentLesson.id) && (
                    <div className="ail-fasttrack-callout">
                      <span>
                        {tr(
                          locale,
                          '⚡ 已具备相关基础？可直接挑战本单元快速通关检定题跳过讲义。',
                          '⚡ Already know this topic? Take the Fast-Track Quiz to skip ahead.',
                        )}
                      </span>
                      <button
                        type="button"
                        className="ail-btn ail-btn-xs"
                        onClick={() => {
                          setExerciseId(fastTrackExercise.id)
                          setTab('activity')
                        }}
                      >
                        {tr(locale, '挑战快速通关 →', 'Try Fast-Track →')}
                      </button>
                    </div>
                  )}

                {currentLesson.objectives.length > 0 && (
                  <div className="ail-objectives-box">
                    <strong>{tr(locale, '🎯 本节核心能力目标', '🎯 Learning Objectives')}</strong>
                    <ul>
                      {currentLesson.objectives.map((obj, idx) => (
                        <li key={idx}>{pickText(obj, locale)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <MarkdownView
                  markdown={pickText(currentLesson.body, locale)}
                  locale={locale}
                  glossary={overview.catalog.glossary}
                  onJumpLesson={(id) => void selectLesson(id)}
                />
              </article>

              {/* Embedded Interactive Simulator in Lesson (A03 bit-layout / A07 roofline) */}
              {currentLesson.simulatorWidget === 'bit-layout' && (
                <BitLayoutExplorer locale={locale} />
              )}
              {currentLesson.simulatorWidget === 'roofline' && (
                <RooflineExplorer
                  locale={locale}
                  measuredPoints={overview.measuredRooflinePoints}
                />
              )}

              <div className="ail-lesson-footer">
                <button
                  type="button"
                  className="ail-btn ail-btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void runGuardedAction(async () => {
                      await api.readLesson(currentLesson.id)
                      await refreshOverview()
                      if (currentLesson.exercises.length > 0) {
                        setTab('activity')
                      }
                    })
                  }
                >
                  {isCurrentLessonRead
                    ? tr(locale, '进入本单元实验与练习 →', 'Go to Lab & Exercises →')
                    : tr(
                        locale,
                        '✓ 标记讲义已读并进入练习 →',
                        '✓ Mark Lesson Read & Start Exercises →',
                      )}
                </button>

                {nextLesson && (
                  <button
                    type="button"
                    className="ail-btn"
                    onClick={() => void selectLesson(nextLesson.id)}
                  >
                    {tr(
                      locale,
                      `下一单元：${nextLesson.id} ${pickText(nextLesson.title, locale)} →`,
                      `Next: ${nextLesson.id} ${pickText(nextLesson.title, locale)} →`,
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVITY VIEW */}
          {tab === 'activity' && currentLesson && (
            <ActivityView
              lesson={currentLesson}
              workspace={workspace}
              activeExerciseId={exerciseId}
              code={code}
              note={note}
              prediction={prediction}
              activeRun={activeRun}
              hintTexts={hintTexts}
              latestFeedback={latestFeedback}
              saveStatus={saveStatus}
              busy={busy}
              locale={locale}
              glossary={overview.catalog.glossary}
              environment={environment}
              evidence={overview.evidence}
              fastTrackedLessons={overview.fastTrackedLessons}
              measuredRooflinePoints={overview.measuredRooflinePoints}
              hasNextLesson={Boolean(nextLesson)}
              onSelectExercise={(id) => setExerciseId(id)}
              onCodeChange={updateCode}
              onResetStarter={() => {
                const targetStarter =
                  workspace?.exercise.id === exerciseId
                    ? workspace.exercise.starter
                    : (currentLesson.exercises.find((e) => e.id === exerciseId)?.starter ?? '')
                updateCode(targetStarter)
              }}
              onRestoreRunCode={(runCode) => updateCode(runCode)}
              onNoteChange={updateNote}
              onPredictionChange={updatePrediction}
              onCodeSelection={setSelectedCode}
              onStartRun={() =>
                void runGuardedAction(async () => {
                  if (!exerciseId) return
                  await flushSave().catch(() => undefined)
                  const created = await api.start(
                    exerciseId,
                    code,
                    {},
                    prediction.trim() ? prediction.trim() : undefined,
                  )
                  if (!mountedRef.current) return
                  setActiveRun(created)
                  if (!isRunActive(created)) {
                    const [freshWs] = await Promise.all([
                      api.workspace(exerciseId),
                      refreshOverview(),
                    ])
                    if (mountedRef.current) setWorkspace(freshWs)
                  }
                })
              }
              onCancelRun={(runId) =>
                void runGuardedAction(async () => {
                  await api.cancel(runId)
                  const latest = await api.run(runId)
                  if (mountedRef.current) setActiveRun(latest)
                })
              }
              onSelectRun={(run) => setActiveRun(run)}
              onSubmitAnswer={(text, runId) =>
                void runGuardedAction(async () => {
                  if (!exerciseId) return
                  const result = await api.answer(exerciseId, text, runId)
                  if (!mountedRef.current) return
                  setLatestFeedback({
                    exerciseId,
                    status: result.status,
                    diagnostic: result.diagnostic,
                  })
                  const [freshWs] = await Promise.all([
                    api.workspace(exerciseId),
                    refreshOverview(),
                  ])
                  if (mountedRef.current) setWorkspace(freshWs)
                })
              }
              onCompleteSimulator={(summaryJson) =>
                void runGuardedAction(async () => {
                  if (!exerciseId) return
                  const result = await api.completeSimulator(exerciseId, summaryJson)
                  if (!mountedRef.current) return
                  setLatestFeedback({
                    exerciseId,
                    status: result.status,
                    diagnostic: result.diagnostic,
                  })
                  const [freshWs] = await Promise.all([
                    api.workspace(exerciseId),
                    refreshOverview(),
                  ])
                  if (mountedRef.current) setWorkspace(freshWs)
                })
              }
              onRequestHint={(level) =>
                void runGuardedAction(async () => {
                  if (!exerciseId) return
                  const text = await api.hint(exerciseId, level)
                  if (!mountedRef.current) return
                  setHintTexts((prev) => ({ ...prev, [level]: text }))
                  const freshWs = await api.workspace(exerciseId)
                  if (mountedRef.current) setWorkspace(freshWs)
                })
              }
              onBeginIndependent={() =>
                void runGuardedAction(async () => {
                  if (!exerciseId) return
                  await flushSave().catch(() => undefined)
                  await api.beginIndependent(exerciseId)
                  const freshWs = await api.workspace(exerciseId)
                  if (!mountedRef.current) return
                  bufferRef.current = {
                    exerciseId: freshWs.exercise.id,
                    code: freshWs.draft,
                    savedCode: freshWs.draft,
                    revision: freshWs.revision,
                    note: freshWs.note,
                    savedNote: freshWs.note,
                    noteRevision: freshWs.noteRevision,
                  }
                  setWorkspace(freshWs)
                  setCode(freshWs.draft)
                  setNote(freshWs.note)
                  setActiveRun(freshWs.runs[0])
                  setHintTexts({})
                  setLatestFeedback(undefined)
                  setSaveStatus(
                    tr(
                      locale,
                      '✓ 已开启无提示独立新尝试',
                      '✓ Started fresh independent attempt',
                    ),
                  )
                })
              }
              onJumpNextLesson={() => {
                if (nextLesson) void selectLesson(nextLesson.id)
              }}
              onJumpLesson={(id) => void selectLesson(id)}
            />
          )}

          {/* TAB 3: RECORDS & DATA VIEW */}
          {tab === 'records' && (
            <RecordsView
              overview={overview}
              locale={locale}
              busy={busy}
              onOpenReviewExercise={(targetLessonId, targetExId) => {
                void selectLesson(targetLessonId, targetExId)
              }}
              onDismissReview={(targetExId) =>
                void runGuardedAction(async () => {
                  await api.dismissReview(targetExId)
                  await refreshOverview()
                })
              }
              onSaveProfile={async (profileDraft, rev) => {
                await runGuardedAction(async () => {
                  await api.saveProfile(profileDraft, rev)
                  await refreshOverview()
                })
              }}
              onExportData={async () => {
                return await api.exportData()
              }}
              onImportData={async (rawJson) => {
                const res = await api.importData(rawJson)
                await refreshOverview()
                if (exerciseId) {
                  const freshWs = await api.workspace(exerciseId)
                  if (mountedRef.current) setWorkspace(freshWs)
                }
                return res
              }}
            />
          )}
        </div>

        {/* Optional Glossary Drawer */}
        <GlossaryDrawer
          open={glossaryOpen}
          glossary={overview.catalog.glossary}
          locale={locale}
          onClose={() => setGlossaryOpen(false)}
          onSelectLesson={(id) => void selectLesson(id)}
        />

        {/* Right Collapsible AI Mentor Drawer */}
        <MentorDrawer
          open={mentorOpen}
          locale={locale}
          workspace={workspace}
          activeRun={activeRun}
          selectedCode={selectedCode}
          mentorBusy={mentorBusy}
          glossary={overview.catalog.glossary}
          onToggle={() => setMentorOpen((v) => !v)}
          onClearSelection={() => setSelectedCode('')}
          onAsk={async (questionText, mode, runId) => {
            if (!exerciseId) return
            setMentorBusy(true)
            setErrorBanner('')
            try {
              await api.tutor(exerciseId, questionText, mode, runId)
              const freshWs = await api.workspace(exerciseId)
              if (mountedRef.current) {
                setWorkspace((prev) =>
                  prev && prev.exercise.id === freshWs.exercise.id
                    ? { ...prev, messages: freshWs.messages }
                    : freshWs,
                )
              }
            } catch (err) {
              reportError(err)
            } finally {
              if (mountedRef.current) setMentorBusy(false)
            }
          }}
          onJumpLesson={(id) => void selectLesson(id)}
        />
      </div>
    </main>
  )
}

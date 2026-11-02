import { trainingDataset } from './training-protocol.ts'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  LabApi,
  Overview,
  Workspace,
  RunRecord,
  EnvironmentStatus,
  HelpLevel,
} from './types.ts'
import { css } from './client-style.ts'
import { TrainingComparison } from './components/TrainingComparison.tsx'
import { ActivityTab } from './components/ActivityTab.tsx'
import { LectureTab } from './components/LectureTab.tsx'
import { RecordsTab } from './components/RecordsTab.tsx'
import { MentorSidebar } from './components/MentorSidebar.tsx'
import { RunResults } from './components/RunResults.tsx'
export { RunResults }
const active = (run: RunRecord) => run.run_status === 'queued' || run.run_status === 'running'
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
type BufferState = {
  key: string
  id: string
  code: string
  note: string
  draft: string
  savedNote: string
  revision: number
  noteRevision: number
  conflict?: Workspace
  uncertain?: boolean
  inflight?: { field: 'code' | 'note'; submitted: string; expected: number }
}
function cacheBuffer(b: BufferState) {
  const { key, id, code, note, draft, savedNote, revision, noteRevision } = b
  if (code === draft && note === savedNote && !b.inflight && !b.conflict)
    sessionStorage.removeItem(key)
  else
    sessionStorage.setItem(
      key,
      JSON.stringify({
        id,
        code,
        note,
        draft,
        savedNote,
        revision,
        noteRevision,
        requiresMerge: !!b.conflict || !!b.uncertain,
        inflight: b.inflight,
      }),
    )
}
function openBuffer(w: Workspace): BufferState {
  const key = 'neural-lab-buffer/' + w.profileId + '/' + w.exercise.id
  const b: BufferState = {
    key,
    id: w.exercise.id,
    code: w.draft,
    draft: w.draft,
    note: w.note,
    savedNote: w.note,
    revision: w.revision,
    noteRevision: w.noteRevision,
  }
  const raw = sessionStorage.getItem(key)
  if (!raw) return b
  let previous: Partial<BufferState> & { requiresMerge?: boolean }
  try {
    previous = JSON.parse(raw) ?? {}
  } catch {
    return b
  }
  for (const [field, baseline, rev] of [
    ['code', 'draft', 'revision'],
    ['note', 'savedNote', 'noteRevision'],
  ] as const) {
    const inflight = previous.inflight
    if (
      typeof previous[field] !== 'string' ||
      previous[field] === b[field] ||
      (previous[field] === previous[baseline] && inflight?.field !== field)
    )
      continue
    const recovered =
      inflight?.field === field &&
      inflight.expected + 1 === b[rev] &&
      inflight.submitted === b[field]
    if (previous.requiresMerge || (previous[rev] !== b[rev] && !recovered)) b.conflict = w
    b[field] = previous[field]!
  }
  return b
}
export function Workbench({ api }: { api: LabApi }) {
  const [overview, setOverview] = useState<Overview>(),
    [ws, setWs] = useState<Workspace>(),
    [lessonId, setLesson] = useState(''),
    [exerciseId, setExercise] = useState(''),
    [tab, setTab] = useState('lecture'),
    [code, setCode] = useState(''),
    [note, setNote] = useState(''),
    [run, setRun] = useState<RunRecord>(),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState<Workspace>(),
    [mentorBusy, setMentorBusy] = useState(false),
    [prediction, setPrediction] = useState(''),
    [learningRate, setLearningRate] = useState(0.05),
    [reviewRun, setReviewRun] = useState(''),
    [explanation, setExplanation] = useState(''),
    [mode, setMode] = useState<HelpLevel>('unknown'),
    [checking, setChecking] = useState(false),
    [environment, setEnvironment] = useState<EnvironmentStatus>(),
    [hint, setHint] = useState(''),
    [question, setQuestion] = useState(''),
    [selection, setSelection] = useState(''),
    [reply, setReply] = useState(''),
    [profile, setProfile] = useState<Record<string, string>>({}),
    [seed, setSeed] = useState(42),
    [sidebarWidth, setSidebarWidth] = useState(220)
  const generation = useRef(0),
    current = useRef<BufferState>(),
    initializedProfile = useRef(false),
    queue = useRef<Promise<void>>(Promise.resolve()),
    mounted = useRef(true),
    actionPending = useRef(false),
    contentPane = useRef<HTMLElement>(null)
  // Navigation starts a new reading context; saves and run polling preserve the viewport.
  useLayoutEffect(() => {
    contentPane.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [lessonId, exerciseId, tab])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void save().catch(report)
    }
  }, [])
  const report = (e: unknown) => {
    if (mounted.current) setError(errorText(e))
  }
  async function refresh() {
    const o = await api.overview()
    if (!mounted.current) return
    setOverview(o)
    if (!initializedProfile.current) {
      initializedProfile.current = true
      setProfile(o.profile)
    }
    return o
  }
  useEffect(() => {
    void refresh()
      .then((o) => {
        if (o) {
          const l = o.catalog.lessons.find((l) => l.id === o.currentLesson) ?? o.catalog.lessons[0]
          if (l) {
            setLesson(l.id)
            setExercise(l.exercises[0]?.id ?? '')
          }
        }
      })
      .catch(report)
    void api.environment().then(setEnvironment).catch(report)
  }, [api])
  function save(): Promise<void> {
    const pending = current.current
    if (!pending) return queue.current
    const operation = queue.current.then(async () => {
      if (pending.conflict) throw Error('请先处理保存冲突 / Resolve save conflict')
      for (const field of ['code', 'note'] as const) {
        const baseline = field === 'code' ? 'draft' : 'savedNote'
        const version = field === 'code' ? 'revision' : 'noteRevision'
        const write = field === 'code' ? api.saveDraft : api.saveNote
        while (pending[field] !== pending[baseline]) {
          const submitted = pending[field]
          const expected = pending[version]
          if (pending.uncertain) {
            const remote = await api.workspace(pending.id)
            pending.conflict = remote
            cacheBuffer(pending)
            pending.uncertain = false
            if (mounted.current && current.current === pending) setConflict(remote)
            throw Error('上次写入未确认，请核对 / Verify the previous write')
          }
          pending.inflight = { field, submitted, expected }
          cacheBuffer(pending)
          try {
            pending[version] = await write(pending.id, submitted, expected)
          } catch (failure) {
            pending.uncertain = true
            const remote = await api.workspace(pending.id)
            pending.uncertain = false
            const confirmed = field === 'code' ? remote.draft : remote.note
            if (confirmed !== submitted) {
              pending.conflict = remote
              cacheBuffer(pending)
              if (mounted.current && current.current === pending) setConflict(remote)
              throw failure
            }
            pending[version] = remote[version]
          }
          pending.inflight = undefined
          pending[baseline] = submitted
          cacheBuffer(pending)
        }
      }
    })
    queue.current = operation.catch(report)
    return operation
  }
  useEffect(() => {
    if (!exerciseId) return
    const g = ++generation.current
    setWs(undefined)
    setRun(undefined)
    setHint('')
    setReply('')
    setQuestion('')
    setPrediction('')
    setExplanation('')
    setSelection('')
    setConflict(undefined)
    void save()
      .then(() => api.workspace(exerciseId))
      .then((w) => {
        if (g !== generation.current || !mounted.current) return
        const b = openBuffer(w)
        current.current = b
        setConflict(b.conflict)
        setWs(w)
        setCode(b.code)
        setNote(b.note)
        setRun(w.runs[0])
      })
      .catch(report)
  }, [api, exerciseId])
  useEffect(() => {
    if (!ws) return
    const buffer = current.current
    const timer = setTimeout(() => {
      void save()
        .then(() => {
          if (
            mounted.current &&
            buffer &&
            buffer === current.current &&
            buffer.code === buffer.draft &&
            buffer.note === buffer.savedNote
          )
            setStatus('草稿已保存 / Saved')
        })
        .catch(report)
    }, 600)
    return () => clearTimeout(timer)
  }, [code, note, ws])
  useEffect(() => {
    if (!run || !active(run)) return
    let disposed = false
    const abort = new AbortController()
    let polling = false
    const tick = async () => {
      if (polling) return
      polling = true
      try {
        const latest = await api.run(run.id, abort.signal)
        if (disposed) return
        if (!active(latest)) {
          const w = await api.workspace(latest.exerciseId, abort.signal)
          if (!disposed) setWs((old) => (old ? { ...old, runs: w.runs, messages: w.messages } : w))
          if (disposed) return
          void refresh().catch(report)
        }
        setRun(latest)
      } catch (e) {
        if (!disposed) report(e)
      } finally {
        polling = false
      }
    }
    const timer = setInterval(() => void tick(), 700)
    return () => {
      abort.abort()
      disposed = true
      clearInterval(timer)
    }
  }, [api, run?.id, run?.run_status])
  const finishedTraining =
    ws && trainingDataset(ws.exercise.runtimeKey)
      ? ws.runs.filter((r) => r.run_status === 'completed')
      : []
  const reflectionRun = finishedTraining.find((r) => r.id === reviewRun) ?? finishedTraining[0]
  const reflections = ws?.answers?.filter((a) => a.runId === reflectionRun?.id) ?? []
  const lesson = overview?.catalog.lessons.find((l) => l.id === lessonId)
  async function syncActivity() {
    const g = generation.current
    const w = await api.workspace(exerciseId)
    if (g !== generation.current || !mounted.current) return
    setWs((old) =>
      old
        ? {
            ...old,
            runs: w.runs,
            messages: w.messages,
            hints: w.hints,
            answers: w.answers,
            snapshots: w.snapshots,
          }
        : w,
    )
  }
  function editCode(value: string) {
    if (actionPending.current) return
    if (current.current) {
      current.current.code = value
      cacheBuffer(current.current)
    }
    setStatus('未保存 / Unsaved')
    setCode(value)
  }
  function editNote(value: string) {
    if (actionPending.current) return
    if (current.current) {
      current.current.note = value
      cacheBuffer(current.current)
    }
    setStatus('未保存 / Unsaved')
    setNote(value)
  }
  function switchTab(value: string) {
    if (actionPending.current) return
    setTab(value)
    if (value === 'experiment') {
      const experiment = lesson?.exercises.find((e) => e.kind === 'experiment')
      if (experiment && experiment.id !== exerciseId) choose(experiment.id, experiment.lessonId)
    }
  }
  async function action(fn: () => Promise<void>) {
    if (actionPending.current) return
    actionPending.current = true
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      report(e)
    } finally {
      actionPending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function start() {
    if (busy || (run && active(run))) return
    if (trainingDataset(ws?.exercise.runtimeKey) && !prediction.trim())
      throw Error('请先写下预测 / Prediction required')
    setRun(undefined)
    await save()
    const r = trainingDataset(ws?.exercise.runtimeKey)
      ? await api.start(exerciseId, code, { seed, learningRate }, prediction)
      : await api.start(exerciseId, code, { seed })
    setReviewRun('')
    setExplanation('')
    setRun(r)
    setTab('exercise')
  }
  function choose(id: string, lid: string, reviewId?: string) {
    void action(async () => {
      await save()
      await api.selectLesson(lid)
      setLesson(lid)
      setExercise(id)
      setReviewRun(reviewId ?? '')
      setExplanation('')
      if (reviewId) setTab('exercise')
    })
  }
  async function download() {
    const raw = await api.exportData(),
      url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'neural-lab-learning.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function restore(text: string) {
    if (actionPending.current) return
    editCode(text)
    setTab('exercise')
  }
  async function requestHint(level: HelpLevel) {
    await save()
    const value = await api.hint(exerciseId, level)
    setHint(
      level === 'answer' && ws && ['code', 'experiment'].includes(ws.exercise.kind)
        ? '```python\n' + value + '\n```'
        : value,
    )
    await syncActivity()
    await refresh()
  }
  async function askMentor() {
    if (mentorBusy) return
    setMentorBusy(true)
    const g = generation.current
    try {
      await save()
      const result = await api.tutor(exerciseId, question, selection, mode)
      if (g !== generation.current || !mounted.current) return
      setReply(result.text)
      setQuestion((value) => (value === question ? '' : value))
      await syncActivity()
    } catch (e) {
      report(e)
    } finally {
      if (mounted.current) setMentorBusy(false)
    }
  }
  if (!overview)
    return (
      <main className="neural-lab">
        <style>{css}</style>
        <h1>Neural Lab</h1>
        <p role={error ? 'alert' : 'status'}>{error || '加载课程 / Loading…'}</p>
        <button
          onClick={() =>
            void action(async () => {
              await refresh()
            })
          }
        >
          重试 Retry
        </button>
      </main>
    )
  return (
    <main className="neural-lab">
      <style>{css}</style>
      <header className="nl-top">
        <div className="nl-brand">
          <span className="nl-brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <h1>Neural Lab</h1>
            <small>从张量到 Transformer · Learn by building</small>
          </div>
        </div>
        <div className="nl-actions">
          {tab !== 'profile' && (
            <button
              onClick={() =>
                document.querySelector('.neural-lab .nl-mentor')?.scrollIntoView({ block: 'start' })
              }
            >
              导师 Mentor
            </button>
          )}
          <button onClick={() => setTab('profile')}>学习档案 Profile</button>
          <button onClick={() => void action(download)}>导出 Export</button>
          <button
            disabled={checking}
            onClick={() => {
              setChecking(true)
              void api
                .environment()
                .then(setEnvironment)
                .catch(report)
                .finally(() => setChecking(false))
            }}
          >
            环境自检 Check CPU
          </button>
        </div>
      </header>
      {conflict && (
        <section role="alert">
          <p>保存冲突。请对照远端内容编辑本地草稿，再重试。 / Compare and merge before retrying.</p>
          <details>
            <summary>
              远端版本 Remote revisions {conflict.revision}/{conflict.noteRevision}
            </summary>
            <pre>{conflict.draft}</pre>
            <pre>{conflict.note}</pre>
          </details>
          <button
            onClick={() => {
              const b = current.current
              if (!b || b.conflict !== conflict) return
              const url = URL.createObjectURL(
                new Blob([JSON.stringify({ exerciseId: b.id, code: b.code, note: b.note })]),
              )
              const a = document.createElement('a')
              a.href = url
              a.download = b.id + '-local.json'
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            下载本地副本 / Save local copy
          </button>
          <button
            onClick={() => {
              const b = current.current
              if (!b || b.conflict !== conflict) return
              const cleanCode = b.code === b.draft,
                cleanNote = b.note === b.savedNote
              Object.assign(b, {
                draft: conflict.draft,
                savedNote: conflict.note,
                revision: conflict.revision,
                noteRevision: conflict.noteRevision,
                conflict: undefined,
              })
              if (cleanCode) editCode(conflict.draft)
              if (cleanNote) editNote(conflict.note)
              setConflict(undefined)
              void action(save)
            }}
          >
            保存合并结果 / Retry merged edits
          </button>
        </section>
      )}
      {error && (
        <p className="nl-error" role="alert">
          {error} <button onClick={() => setError('')}>关闭 Dismiss</button>
        </p>
      )}
      <div className="nl-status" role="status">
        <span>{busy ? '正在处理 / Working…' : status}</span>
        {environment && (
          <details>
            <summary>
              {environment.available ? '● CPU 就绪 Ready' : '○ CPU 不可用 Unavailable'}
            </summary>
            <pre>{environment.detail}</pre>
          </details>
        )}
      </div>
      <div
        className="nl-layout"
        style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}
      >
        <aside className="nl-sidebar" aria-label="课程列表 Curriculum" tabIndex={0}>
          <details>
            <summary>路线宽度 / Width</summary>
            <input
              aria-label="路线宽度 Width"
              type="range"
              min="170"
              max="300"
              value={sidebarWidth}
              onChange={(e) => setSidebarWidth(Number(e.target.value))}
            />
          </details>
          <details open>
            <summary>学习路线 / Curriculum</summary>
            <nav>
              {overview.catalog.lessons.map((item) => (
                <button
                  key={item.id}
                  disabled={busy}
                  aria-label={`${item.id} ${item.title}`}
                  aria-current={item.id === lessonId ? 'page' : undefined}
                  onClick={() => choose(item.exercises[0]?.id ?? '', item.id)}
                >
                  <strong>
                    <span className="nl-lesson-id">{item.id}</span>
                    {item.title}
                  </strong>
                  <small>
                    {overview.readLessons.includes(item.id) ? '已读 Read' : '未读 Unread'} ·{' '}
                    {item.kind}
                  </small>
                  <small>先修: {item.prerequisites.join(', ') || '无 None'}</small>
                </button>
              ))}
            </nav>
          </details>
          {['due', 'future'].map((group) => {
            const reviews = overview.reviews.filter(
              (r) => Date.parse(r.due) <= Date.now() === (group === 'due'),
            )
            return (
              <details open key={group}>
                <summary>
                  {group === 'due' ? '待复习 / Review' : '稍后复习 / Scheduled'} ({reviews.length})
                </summary>
                {reviews.map((review, i) => (
                  <div key={i}>
                    <button
                      onClick={() => {
                        const target = overview.catalog.lessons.find((item) =>
                          item.exercises.some((e) => e.id === review.exerciseId),
                        )
                        if (target) choose(review.exerciseId, target.id, review.runId)
                      }}
                    >
                      {review.exerciseId} · {review.reason}{' '}
                      {review.runId && <small>{review.runId}</small>}
                    </button>
                    <small>{review.due}</small>
                    <button
                      onClick={() =>
                        void action(async () => {
                          await api.snooze(review.exerciseId, review.runId)
                          await refresh()
                        })
                      }
                    >
                      稍后 Later
                    </button>
                  </div>
                ))}
              </details>
            )
          })}
        </aside>
        <section
          className="nl-center"
          ref={contentPane}
          aria-label="课程内容 Lesson content"
          tabIndex={0}
        >
          <div className="nl-tabs" role="tablist" aria-label="工作台 Tabs">
            {[
              ['lecture', '讲义 Lecture'],
              ['exercise', '练习 Exercise'],
              ['experiment', '实验 Experiment'],
              ['records', '记录 Records'],
              ['profile', '档案 Profile'],
            ].map(([id, title]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => switchTab(id!)}>
                {title}
              </button>
            ))}
          </div>
          {tab === 'profile' ? (
            <h2>学习档案 / Learning profile</h2>
          ) : (
            lesson && (
              <h2>
                {lesson.id} · {lesson.title}
              </h2>
            )
          )}
          {tab === 'lecture' && lesson && (
            <LectureTab
              lesson={lesson}
              onSelection={setSelection}
              onPractice={() => setTab('exercise')}
              onRead={() =>
                void action(async () => {
                  await api.readLesson(lesson.id)
                  await refresh()
                  setStatus('已记录阅读；阅读不等于掌握 / Reading recorded')
                })
              }
            />
          )}
          {(tab === 'exercise' || tab === 'experiment') && lesson && (
            <ActivityTab
              lesson={lesson}
              workspace={ws}
              contentVersion={overview.catalog.version}
              experimentOnly={tab === 'experiment'}
              exerciseId={exerciseId}
              draft={code}
              prediction={prediction}
              onPrediction={setPrediction}
              learningRate={learningRate}
              onLearningRate={setLearningRate}
              seed={seed}
              run={run}
              busy={busy}
              onChoose={(id) => choose(id, lesson.id)}
              onEdit={editCode}
              onSeed={setSeed}
              onSelection={setSelection}
              onRun={() => void action(start)}
              onCancel={() =>
                void action(async () => {
                  if (run) {
                    await api.cancel(run.id)
                    setRun(await api.run(run.id))
                  }
                })
              }
              onSave={() => void action(save)}
              onAnswer={() =>
                void action(async () => {
                  await save()
                  setStatus(`作答结果 / Answer: ${await api.answer(exerciseId, code)}`)
                  await syncActivity()
                  await refresh()
                })
              }
            />
          )}
          {tab === 'exercise' && ws && trainingDataset(ws.exercise.runtimeKey) && (
            <>
              <TrainingComparison runs={ws.runs} />
              {reflectionRun && (
                <section>
                  <h3>解释与复习 / Reflection</h3>
                  <label>
                    解释对应运行 Run
                    <select
                      value={reflectionRun.id}
                      onChange={(e) => {
                        setReviewRun(e.target.value)
                        setExplanation('')
                      }}
                    >
                      {finishedTraining.map((r) => (
                        <option key={r.id}>{r.id}</option>
                      ))}
                    </select>
                  </label>
                  <p>预测 / Prediction: {reflectionRun.prediction}</p>
                  {reflectionRun.id !== run?.id && (
                    <details>
                      <summary>这次运行的结果 / Review this result</summary>
                      <RunResults run={reflectionRun} />
                    </details>
                  )}
                  <p>
                    自评标准 /
                    Rubric：引用某一步的训练与验证误差，比较预测，解释梯度或参数更新怎样影响结果，并提出下一次对照实验。
                  </p>
                  {reflectionRun.trainingManifest?.protocol === 'train-char-v1' && (
                    <p>
                      指出哪个未来字符被扰动、哪些前缀输出应保持不变。对比训练与留出集损失，说明四步后的一次采样能说明什么。
                      / Discuss causal invariance and held-out loss.
                    </p>
                  )}
                  <label>
                    我的解释 Reflection
                    <textarea
                      value={explanation}
                      maxLength={12000}
                      onChange={(e) => {
                        setReviewRun(reflectionRun.id)
                        setExplanation(e.target.value)
                      }}
                    />
                  </label>
                  <button
                    disabled={busy || !explanation.trim()}
                    onClick={() =>
                      void action(async () => {
                        await api.answer(exerciseId, explanation, reflectionRun.id)
                        await syncActivity()
                        await refresh()
                        setStatus('解释已记录 / Reflection saved')
                      })
                    }
                  >
                    提交训练解释 / Save reflection
                  </button>
                  {reflections.map((a) => (
                    <p key={a.id}>先前解释 / Reflection: {a.text}</p>
                  ))}
                  {overview.reviews.some(
                    (r) => r.exerciseId === exerciseId && r.runId === reflectionRun.id,
                  ) &&
                    reflections.length > 0 && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api.finishReview(reflectionRun.id)
                            await refresh()
                          })
                        }
                      >
                        标记已复习 / Finish review
                      </button>
                    )}
                </section>
              )}
            </>
          )}
          {tab === 'exercise' && exerciseId === 'L09-transfer' && (
            <section>
              <label>
                解释未来扰动为何适用于传感器数据 / Explain future invariance
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              </label>
              <p>
                自评标准：指出预测时刻可见的数据，说明改变未来读数后哪些输出必须不变。 / Identify
                the visible prefix and unaffected predictions.
              </p>
              <button
                disabled={busy || !explanation.trim()}
                onClick={() =>
                  void action(async () => {
                    await api.answer(exerciseId, explanation)
                    await syncActivity()
                    await refresh()
                    setStatus('已记录自述解释 / Explanation recorded for review')
                  })
                }
              >
                记录解释 / Submit explanation
              </button>
            </section>
          )}
          {tab === 'records' && (
            <RecordsTab
              busy={busy}
              workspace={ws}
              overview={overview}
              exerciseId={exerciseId}
              note={note}
              onNote={editNote}
              onSave={() => void action(save)}
              onRestore={restore}
            />
          )}
          {tab === 'profile' && (
            <section className="nl-profile">
              <p>档案属于学习者，贯穿整条课程路线。/ Your profile applies across all lessons.</p>
              {[
                ['background', '已有基础 Background'],
                ['goal', '学习目标 Goal'],
                ['difficulties', '常见卡点 Difficulties'],
                ['explanations', '有效讲法 Preferred explanation'],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <textarea
                    value={profile[key!] ?? ''}
                    onChange={(e) => setProfile({ ...profile, [key!]: e.target.value })}
                  />
                </label>
              ))}
              <button
                className="nl-primary"
                onClick={() =>
                  void action(async () => {
                    await api.saveProfile(profile)
                    await refresh()
                    setStatus('档案已保存 / Profile saved')
                  })
                }
              >
                保存档案 Save profile
              </button>
            </section>
          )}
          {tab !== 'profile' && (
            <MentorSidebar
              workspace={ws}
              busy={busy}
              hint={hint}
              question={question}
              selection={selection}
              reply={reply}
              onQuestion={setQuestion}
              onSelection={setSelection}
              onHint={(level) => void action(() => requestHint(level))}
              onAsk={() => void askMentor()}
              mentorBusy={mentorBusy}
              mode={mode}
              onMode={setMode}
              onIndependent={() =>
                void action(async () => {
                  await api.independent(exerciseId)
                  setHint('')
                  setStatus(
                    '已开始自述独立尝试；外部帮助不可验证 / Independent attempt, self-reported',
                  )
                })
              }
            />
          )}
        </section>
      </div>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import type {
  LabApi,
  Overview,
  Workspace,
  RunRecord,
  EnvironmentStatus,
  HelpLevel,
} from './types.ts'
import { css } from './client-style.ts'
import { ActivityTab } from './components/ActivityTab.tsx'
import { LectureTab } from './components/LectureTab.tsx'
import { RecordsTab } from './components/RecordsTab.tsx'
import { MentorSidebar } from './components/MentorSidebar.tsx'
export { RunResults } from './components/RunResults.tsx'
const active = (run: RunRecord) => run.run_status === 'queued' || run.run_status === 'running'
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))
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
    [environment, setEnvironment] = useState<EnvironmentStatus>(),
    [hint, setHint] = useState(''),
    [question, setQuestion] = useState(''),
    [selection, setSelection] = useState(''),
    [reply, setReply] = useState(''),
    [profile, setProfile] = useState<Record<string, string>>({}),
    [seed, setSeed] = useState(42),
    [sidebarWidth, setSidebarWidth] = useState(220)
  const generation = useRef(0),
    current = useRef<{ ws: Workspace; code: string; note: string }>(),
    queue = useRef<Promise<void>>(Promise.resolve()),
    mounted = useRef(true),
    actionPending = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void save()
    }
  }, [])
  const report = (e: unknown) => {
    if (mounted.current) setError(errorText(e))
  }
  async function refresh() {
    const o = await api.overview()
    if (!mounted.current) return
    setOverview(o)
    setProfile(o.profile)
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
      if (pending.code !== pending.ws.draft) {
        const revision = await api.saveDraft(
          pending.ws.exercise.id,
          pending.code,
          pending.ws.revision,
        )
        pending.ws.revision = revision
        pending.ws.draft = pending.code
      }
      if (pending.note !== pending.ws.note) {
        const revision = await api.saveNote(
          pending.ws.exercise.id,
          pending.note,
          pending.ws.noteRevision,
        )
        pending.ws.noteRevision = revision
        pending.ws.note = pending.note
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
    void save()
      .then(() => api.workspace(exerciseId))
      .then((w) => {
        if (g !== generation.current || !mounted.current) return
        current.current = { ws: w, code: w.draft, note: w.note }
        setWs(w)
        setCode(w.draft)
        setNote(w.note)
        setRun(w.runs[0])
      })
      .catch(report)
  }, [api, exerciseId])
  useEffect(() => {
    if (!ws) return
    current.current = { ws, code, note }
    const timer = setTimeout(() => {
      void save()
        .then(() => {
          if (mounted.current) setStatus('草稿已保存 / Saved')
        })
        .catch(report)
    }, 600)
    return () => clearTimeout(timer)
  }, [code, note, ws])
  useEffect(() => {
    if (!run || !active(run)) return
    let disposed = false
    const tick = async () => {
      try {
        const latest = await api.run(run.id)
        if (disposed) return
        setRun(latest)
        if (!active(latest)) {
          const w = await api.workspace(latest.exerciseId)
          if (!disposed) setWs((old) => (old ? { ...old, runs: w.runs, messages: w.messages } : w))
          void refresh()
        }
      } catch (e) {
        if (!disposed) report(e)
      }
    }
    const timer = setInterval(() => void tick(), 700)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [api, run?.id, run?.run_status])
  const lesson = overview?.catalog.lessons.find((l) => l.id === lessonId)
  async function syncActivity() {
    const w = await api.workspace(exerciseId)
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
    if (current.current) current.current.code = value
    setCode(value)
  }
  function editNote(value: string) {
    if (actionPending.current) return
    if (current.current) current.current.note = value
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
    setRun(undefined)
    await save()
    const r = await api.start(exerciseId, code, { seed })
    setRun(r)
    setTab('exercise')
  }
  function choose(id: string, lid: string) {
    void action(async () => {
      await save()
      await api.selectLesson(lid)
      setLesson(lid)
      setExercise(id)
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
    await save()
    const result = await api.tutor(exerciseId, question, selection)
    setReply(`${result.status}\n\n${result.text}`)
    setQuestion('')
    await syncActivity()
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
          <button onClick={() => setTab('profile')}>学习档案 Profile</button>
          <button onClick={() => void action(download)}>导出 Export</button>
          <button onClick={() => void action(async () => setEnvironment(await api.environment()))}>
            环境自检 Check CPU
          </button>
        </div>
      </header>
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
        <aside className="nl-sidebar">
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
          <details open>
            <summary>待复习 / Review ({overview.reviews.length})</summary>
            {overview.reviews.map((review, i) => (
              <div key={i}>
                <button
                  onClick={() => {
                    const target = overview.catalog.lessons.find((item) =>
                      item.exercises.some((e) => e.id === review.exerciseId),
                    )
                    if (target) choose(review.exerciseId, target.id)
                  }}
                >
                  {review.exerciseId} · {review.reason}
                </button>
                <small>{review.due}</small>
                <button
                  onClick={() =>
                    void action(async () => {
                      await api.snooze(review.exerciseId)
                      await refresh()
                    })
                  }
                >
                  稍后 Later
                </button>
              </div>
            ))}
          </details>
        </aside>
        <section className="nl-center">
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
              experimentOnly={tab === 'experiment'}
              exerciseId={exerciseId}
              draft={code}
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
              onAsk={() => void action(askMentor)}
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

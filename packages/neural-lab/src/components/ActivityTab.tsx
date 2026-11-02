import { trainingDataset } from '../training-protocol.ts'
import { useRef, useState, type PointerEvent } from 'react'
import type { Lesson, Workspace, RunRecord } from '../types.ts'
import { Markdown } from './Markdown.tsx'
import { CodeEditor } from './CodeEditor.tsx'
import { RunResults } from './RunResults.tsx'
interface Props {
  lesson: Lesson
  workspace?: Workspace
  contentVersion: string
  experimentOnly: boolean
  exerciseId: string
  draft: string
  prediction: string
  learningRate: number
  onPrediction: (v: string) => void
  onLearningRate: (v: number) => void
  seed: number
  run?: RunRecord
  busy: boolean
  onChoose: (id: string) => void
  onEdit: (text: string) => void
  onSeed: (seed: number) => void
  onSelection: (text: string) => void
  onRun: () => void
  onCancel: () => void
  onSave: () => void
  onAnswer: () => void
}
export function ActivityTab(props: Props) {
  const [split, setSplit] = useState(40)
  const pane = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const exercise =
    props.workspace?.exercise.id === props.exerciseId ? props.workspace.exercise : undefined
  const running = props.run?.run_status === 'queued' || props.run?.run_status === 'running'
  const written = exercise?.kind === 'numeric' || exercise?.kind === 'explanation'
  const resize = (event: PointerEvent) => {
    if (!drag.current || !pane.current) return
    const rect = pane.current.getBoundingClientRect()
    setSplit(Math.min(65, Math.max(25, ((event.clientX - rect.left) / rect.width) * 100)))
  }
  if (props.experimentOnly && !props.lesson.exercises.some((e) => e.kind === 'experiment'))
    return <p>本单元无独立实验，请完成练习。/ No experiment in this unit.</p>
  return (
    <div
      className="nl-activity"
      ref={pane}
      style={{ gridTemplateColumns: `${split}% 7px minmax(0, 1fr)` }}
    >
      <section className="nl-description">
        <header className="nl-pane-heading">题目 / Description</header>
        <label>
          当前活动 Activity
          <select
            disabled={props.busy}
            value={props.exerciseId}
            onChange={(event) => props.onChoose(event.target.value)}
          >
            {props.lesson.exercises
              .filter((e) => !props.experimentOnly || e.kind === 'experiment')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {e.kind}
                </option>
              ))}
          </select>
        </label>
        {exercise ? (
          <>
            <h3>{exercise.title}</h3>
            <Markdown text={exercise.prompt} />
            <div className="nl-domain">
              <h4>输入域 / Input domain</h4>
              <Markdown text={exercise.inputDomain} />
            </div>
            <details>
              <summary>常见错误 / Common pitfalls</summary>
              <ul>
                {exercise.commonErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
            {!!trainingDataset(exercise.runtimeKey) && (
              <>
                <label>
                  运行前预测 Prediction
                  <textarea
                    maxLength={2000}
                    value={props.prediction}
                    disabled={props.busy}
                    onChange={(e) => props.onPrediction(e.target.value)}
                    placeholder="改变学习率后，你预计验证误差如何变化？"
                  />
                </label>
                <label>
                  学习率 Learning rate
                  <input
                    type="number"
                    min="0.001"
                    max="0.3"
                    step="0.001"
                    value={props.learningRate}
                    disabled={props.busy}
                    onChange={(e) => props.onLearningRate(Number(e.target.value))}
                  />
                </label>
              </>
            )}
            {exercise.kind === 'experiment' && (
              <p className="nl-callout">
                实验参数只来自代码中的 <code>configure()</code>
                。请按本题输入域修改参数；运行后会显示实际采用值。Seed 单独控制随机性。/ Experiment
                parameters come only from configure(); seed controls randomness.
              </p>
            )}
          </>
        ) : (
          <p>加载活动 / Loading activity…</p>
        )}
      </section>
      <div
        className="nl-separator"
        role="separator"
        tabIndex={0}
        aria-label="阅读与代码分隔器 Reading and code divider"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={65}
        aria-valuenow={Math.round(split)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            setSplit((value) =>
              Math.max(25, Math.min(65, value + (event.key === 'ArrowLeft' ? -2 : 2))),
            )
          }
        }}
        onPointerDown={(event) => {
          drag.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={resize}
        onPointerUp={(event) => {
          drag.current = false
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = false
        }}
      />
      <section className="nl-code-pane">
        <header className="nl-pane-heading">
          <span>{written ? '我的作答 / Answer' : 'Python · 代码 / Code'}</span>
          <small>{written ? '文字草稿自动保存' : 'Ctrl/⌘ + Enter 运行'}</small>
        </header>
        {exercise &&
          (written ? (
            <>
              <label>
                我的作答 Answer
                <textarea
                  readOnly={props.busy}
                  value={props.draft}
                  onChange={(e) => props.onEdit(e.target.value)}
                />
              </label>
              <button className="nl-primary" disabled={props.busy} onClick={props.onAnswer}>
                提交作答 Submit
              </button>
            </>
          ) : (
            <>
              <CodeEditor
                value={props.draft}
                readOnly={props.busy}
                language="python"
                label="Python 编辑器 Editor"
                completionLabel="代码补全 Completions"
                completionHint="↑↓ 选择 · Tab/Enter 插入 · Esc 关闭 · Ctrl/⌘+J 补全"
                onChange={props.onEdit}
                onSelection={props.onSelection}
                onRun={props.onRun}
                onSubmit={props.onRun}
              />
              <div className="nl-editor-actions">
                <label className="nl-seed">
                  Seed
                  <input
                    type="number"
                    disabled={props.busy}
                    min="0"
                    max="10000"
                    value={props.seed}
                    onChange={(e) => props.onSeed(Number(e.target.value))}
                  />
                </label>
                <button disabled={props.busy} onClick={() => props.onEdit(exercise.starter)}>
                  重置 Reset
                </button>
                <button disabled={props.busy} onClick={props.onSave}>
                  保存 Save
                </button>
                {running ? (
                  <button disabled={props.busy} onClick={props.onCancel}>
                    取消 Cancel
                  </button>
                ) : (
                  <button
                    className="nl-primary"
                    disabled={
                      props.busy ||
                      (!!trainingDataset(exercise.runtimeKey) && !props.prediction.trim())
                    }
                    onClick={props.onRun}
                  >
                    运行 / 提交 Run & check
                  </button>
                )}
              </div>
              {props.run ? (
                <>
                  {props.run.code === props.draft &&
                    (props.run.testVersion !== exercise?.testVersion ||
                      props.run.contentVersion !== props.contentVersion ||
                      props.run.seed !== props.seed) && (
                      <p className="nl-callout">
                        历史版本或种子不同 / Prior version or seed. 请重新运行。
                      </p>
                    )}
                  {props.run.code !== props.draft && (
                    <p className="nl-callout" role="status">
                      代码已修改；以下为先前快照结果，请重新运行。/ Code changed; previous snapshot
                      result.
                    </p>
                  )}
                  <RunResults run={props.run} />
                </>
              ) : (
                <div className="nl-empty">
                  运行后查看检查项、张量和曲线。/ Run to inspect checks, tensors and curves.
                </div>
              )}
            </>
          ))}
      </section>
    </div>
  )
}

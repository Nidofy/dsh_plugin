import { learningDimensions } from '../learning-progress.ts'
import type { Evidence, HelpLevel, Overview, Workspace } from '../types.ts'
import { RunResults } from './RunResults.tsx'
export function RecordsTab({
  workspace,
  busy,
  overview,
  exerciseId,
  note,
  onNote,
  onSave,
  onRestore,
}: {
  workspace?: Workspace
  busy: boolean
  overview: Overview
  exerciseId: string
  note: string
  onNote: (text: string) => void
  onSave: () => void
  onRestore: (text: string) => void
}) {
  return (
    <section>
      <label>
        学习笔记 Notes
        <textarea readOnly={busy} value={note} onChange={(e) => onNote(e.target.value)} />
      </label>
      <button disabled={busy} onClick={onSave}>
        保存笔记 Save note
      </button>
      <h3>作答与运行历史 / History</h3>
      {workspace?.runs.map((run) => (
        <details key={run.id} id={'nl-record-' + run.id}>
          <summary>
            {run.createdAt} · {run.run_status} / {run.check_status} · {run.help}
          </summary>
          <button disabled={busy} onClick={() => onRestore(run.code)}>
            恢复此代码 Restore code
          </button>
          <pre>{run.code}</pre>
          <RunResults run={run} />
        </details>
      ))}
      <h3>帮助前快照 / Before assistance</h3>
      {workspace?.snapshots?.map((snapshot, i) => (
        <details key={i}>
          <summary>
            {snapshot.at} · {snapshot.reason} · rev {snapshot.revision}
          </summary>
          <button disabled={busy} onClick={() => onRestore(snapshot.code)}>
            恢复此代码 Restore code
          </button>
          <pre>{snapshot.code}</pre>
        </details>
      ))}
      <h3>文字作答历史 / Written answers</h3>
      {workspace?.answers?.map((answer, i) => (
        <details key={i} id={'nl-record-' + answer.id}>
          <summary>
            {answer.status} · {answer.contentVersion}/{answer.testVersion}
          </summary>
          {answer.runId ? (
            <small>Run {answer.runId}</small>
          ) : (
            <button disabled={busy} onClick={() => onRestore(answer.text)}>
              恢复此作答 Restore answer
            </button>
          )}
          <pre>{answer.text}</pre>
        </details>
      ))}
      <h3>分维度学习证据 / Learning dimensions</h3>
      <p>解释是自述而非程序判定；旧内容/测试版本不会自动完成当前活动。 / Reflections are self-reports; old versions do not complete current activities.</p>
      {workspace && <div className="nl-table-wrap"><table><thead><tr><th>维度 / Dimension</th><th>当前来源 / Current evidence</th><th>旧版记录 / Historical</th></tr></thead><tbody>{learningDimensions(workspace.exercise,overview.catalog.version,overview.evidence).map(d=><tr key={d.kind}><th>{d.kind}</th><td>{d.records} · {d.programPassed?'程序通过 / Program passed':d.learnerRecorded?'已自述 / Self-reported':'未证实 / Unverified'} · {d.last?.runId ?? d.last?.answerId ?? '—'} · Help {d.last?.answerHelp ?? d.last?.help ?? '—'}</td><td>{d.legacy}</td></tr>)}</tbody></table></div>}
      <h3>知识点证据 / Evidence</h3>
      {overview.evidence
        .filter((e) => e.exerciseId === exerciseId)
        .map((e: Evidence & { answerHelp?: HelpLevel }, i) => (
          <p key={i}>
            {e.concept} · {e.kind} · {e.source} · 来源帮助 / Source help: {e.help}
            {e.answerHelp !== undefined && <> · 解释时帮助 / Reflection help: {e.answerHelp}</>}
            {' · '}{e.result} ·{' '}
            {e.contentVersion ?? '历史来源未知 / legacy'}/{e.testVersion ?? '?'}
            {(e.runId || e.answerId) && (
              <button
                onClick={() => {
                  const item = document.getElementById(
                    'nl-record-' + (e.answerId ?? e.runId),
                  ) as HTMLDetailsElement | null
                  if (item) {
                    item.open = true
                    item.scrollIntoView({ block: 'nearest' })
                  }
                }}
              >
                查看来源 / Show source
              </button>
            )}
          </p>
        ))}
    </section>
  )
}

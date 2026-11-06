import { useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Exercise, RunRecord } from '../types.ts'
import { componentObservations, debugHint, debugModel, type DebugObservation } from '../debug-model.ts'

export interface DebugTutorContext {
  runId: string
  component: string
  check?: string
  level: 'concept' | 'steps' | 'code'
}
export interface DebugWorkbenchProps {
  run: RunRecord
  exercise: Exercise
  draft: string
  onTutor?: (context: DebugTutorContext) => void
}
const panel: CSSProperties = { border: '1px solid var(--nl-border)', borderRadius: 8, padding: 12, minWidth: 0, background: 'var(--nl-card)', color: 'var(--nl-fg)' }
const muted: CSSProperties = { color: 'var(--nl-muted)', overflowWrap: 'anywhere' }
const labels: Record<string, string> = { embed: 'Embedding 嵌入', attention: 'Attention 注意力', block: 'Block 残差块', ffn: 'FFN 前馈', lm_head: 'Head 输出头' }

function Evidence({ observations }: { observations: DebugObservation[] }) {
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}>
    <caption>本次运行证据 / Run evidence</caption>
    <thead><tr>{['事件 / Event', '数值 / Value', '来源 / Source', 'Step', 'Layer', '映射 / Mapping'].map((s) => <th key={s} scope="col">{s}</th>)}</tr></thead>
    <tbody>{observations.map(({ event: e, layer, mapping }) => <tr key={e.runId + ':' + e.seq}>
      <td>#{e.seq} {e.name}<br /><small>{e.detail}</small></td>
      <td>{e.type === 'check' ? e.passed === true ? '通过 / Passed' : e.passed === false ? '失败 / Failed' : '未判定 / Unknown' : e.shape ? '[' + e.shape.join(', ') + ']' : e.value === undefined ? '未采集 / Not sampled' : String(e.value)}</td>
      <td>{e.source ?? '未记录 / Unknown'}</td><td>{e.step ?? '未记录 / Unknown'}</td><td>{layer ?? '未采集 / Not sampled'}</td><td>{mapping}</td>
    </tr>)}</tbody>
  </table></div>
}

export function DebugWorkbench({ run, exercise, draft, onTutor }: DebugWorkbenchProps) {
  const model = debugModel(run, exercise)
  const [selection, setSelection] = useState({ runId: run.id, component: '', layer: 'all', level: 'concept' as DebugTutorContext['level'] })
  // Synchronous ownership check prevents even one render of the previous run's selection.
  const current = selection.runId === run.id ? selection : { runId: run.id, component: '', layer: 'all', level: 'concept' as const }
  const component = model.contracts.some((c) => c.name === current.component) ? current.component : model.contracts[0]?.name ?? ''
  const choose = (name: string) => setSelection({ ...current, component: name })
  const layer = current.layer === 'all' ? undefined : Number(current.layer)
  const observations = componentObservations(model.observations, component, layer)
  const selectedFailure = observations.find((o) => o.event.type === 'check' && o.event.passed === false)
  const source = model.parts.find((p) => p.name === component)
  const snapshot = run.components?.find((c) => c.name === component)
  const pending = run.run_status === 'queued' || run.run_status === 'running'
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
    if (!direction && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? model.contracts.length - 1 : (index + direction + model.contracts.length) % model.contracts.length
    choose(model.contracts[next]!.name)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-debug-component]')
    buttons?.[next]?.focus()
  }
  return <section aria-label="组件调试工作台 / Component debug workbench" style={{ ...panel, marginBlock: 12 }}>
    <h3>组件调试工作台 / Component debugger</h3>
    <p style={muted}>Run {run.id} · {run.run_status} · Check {run.check_status}<br />codeHash: {run.codeHash ?? '旧记录未采集 / Not recorded'}</p>
    <p role="status">{pending ? '等待本次执行采样 / Waiting for run samples' : run.run_status === 'completed' ? '执行已结束；检查结果单独判定 / Execution ended; checks are separate' : '运行未完整结束，以下为已收集证据 / Run incomplete; collected evidence only'}{run.reason ? ' · ' + run.reason : ''}</p>
    {draft !== run.code && <p role="status">草稿已变化；以下全部绑定运行快照。请重跑验证修改。 / Draft changed; evidence uses the frozen run. Rerun to verify edits.</p>}
    {!model.compatible ? <p role="alert">活动不匹配，已阻止显示其他活动证据。 / Exercise mismatch; evidence blocked.</p> : <>
      {model.foreignEvents > 0 && <p role="alert">已忽略其他运行事件 / Foreign-run events ignored: {model.foreignEvents}</p>}
      {!model.contracts.length ? <p>旧活动没有组件契约；无法建立组件关系。 / No component contracts in this activity.</p> : <>
        <p>数据流导览 / Flow guide: Embedding → Attention → 残差 / Residual → FFN → Head</p>
        <p style={muted}>下列箭头来自组件 dependsOn；描述接口依赖，不证明失败因果。方向键可选择组件。 / Edges follow dependsOn, not causal attribution. Arrow keys select components.</p>
        <div role="group" aria-label="组件关系图 / Component dependency graph" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {model.contracts.map((c, index) => <button key={c.name} type="button" data-debug-component={c.name} aria-pressed={component === c.name} onClick={() => choose(c.name)} onKeyDown={(e) => navigate(e, index)} style={{ ...panel, flex: '1 1 145px', textAlign: 'left', borderColor: component === c.name ? 'var(--nl-accent)' : 'var(--nl-border)', borderWidth: component === c.name ? 2 : 1 }}>
            <strong>{labels[c.name] ?? c.name}</strong><br /><small>{c.dependsOn.length ? c.dependsOn.join(' + ') + ' → ' + c.name : '入口 / Input'}<br />{model.observations.some((o) => o.component === c.name && o.event.passed === false) ? '检查失败 / Failed check' : model.observations.some((o) => o.component === c.name) ? '有采样 / Sampled' : '未采集 / Not sampled'}</small>
          </button>)}
        </div>
        <p><label>层 / Layer <select value={current.layer} onChange={(e) => setSelection({ ...current, layer: e.target.value })}><option value="all">全部（含层未知） / All incl. unknown</option>{model.layers.map((n) => <option key={n} value={String(n)}>Layer {n}</option>)}</select></label></p>
        {!model.layers.length && <p style={muted}>层信息未采集；不会推断每层数值。 / Layer information not sampled.</p>}
        <h4>{component} · v{snapshot?.version ?? 'Unknown'}</h4>
        <p style={muted}>组件快照 / Component hash: {snapshot?.sha256 ?? '未记录 / Unknown'}</p>
        {(['shape', 'check', 'gradient'] as const).map((kind) => {
          const rows = observations.filter((o) => kind === 'gradient' ? /grad|parameter_delta/.test(o.event.name) : kind === 'shape' ? o.event.type === 'shape' || o.event.type === 'tensor' && !!o.event.shape : o.event.type === kind)
          return <details key={kind} open><summary>{kind === 'shape' ? '张量形状 / Shapes' : kind === 'check' ? '程序检查 / Checks' : '梯度与更新 / Gradients & updates'} ({rows.length})</summary>{rows.length ? <Evidence observations={rows} /> : <p>该组件及所选层未采集 / Not sampled for this component and layer</p>}</details>
        })}
        <details open><summary>运行源码切片 / Frozen component source</summary>{source ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 320, overflow: 'auto' }}>{source.code}</pre> : <p>此运行缺少有效组件标记，无法可靠切片。 / Component markers unavailable.</p>}</details>
        <aside style={{ ...panel, marginTop: 12 }} aria-label="分级诊断 / Graded diagnosis">
          <h4>诊断路径 / Diagnosis</h4>
          {model.firstFailure ? <p>最早失败观察 / Earliest failed observation: #{model.firstFailure.event.seq} {model.firstFailure.event.name}。后续失败 {model.failures.length - 1} 项仅为后续观察，不断言因果。 / Later failures are observations, not proven consequences.</p> : <p>尚无失败检查证据；缺失采样不等于通过。 / No failed check observed; missing samples do not imply success.</p>}
          {selectedFailure && model.firstFailure !== selectedFailure && <p>当前组件的后续失败观察 / Later failed observation in this component: #{selectedFailure.event.seq} {selectedFailure.event.name}</p>}
          {(['concept', 'steps', 'code'] as const).map((level) => <button type="button" key={level} aria-pressed={current.level === level} onClick={() => setSelection({ ...current, level })}>{level === 'concept' ? '概念 / Concept' : level === 'steps' ? '步骤 / Steps' : '代码提示 / Code hint'}</button>)}
          <p>{debugHint(component, current.level)}</p>
          <button type="button" disabled={!onTutor} onClick={() => onTutor?.({ runId: run.id, component, check: selectedFailure?.event.name, level: current.level })}>请求导师解释当前组件 / Ask tutor about component</button>
          {!onTutor && <p style={muted}>导师入口未连接 / Tutor unavailable</p>}
        </aside>
      </>}
      <details><summary>未归属组件的运行证据 / Unassigned run evidence ({model.observations.filter((o) => !o.component).length})</summary><p>全局指标不能当作单个组件梯度。 / Global metrics are not per-component gradients.</p><Evidence observations={model.observations.filter((o) => !o.component)} /></details>
    </>}
  </section>
}

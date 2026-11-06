import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ExperimentGroup, Exercise, GroupRequest, LabApi, RunRecord } from '../types.ts'
import { groupSummary } from '../group-summary.ts'

export interface ExperimentGroupPanelProps {
  api: LabApi
  exercise: Exercise
  code: string
  config: Record<string, number>
  busy: boolean
  runs: RunRecord[]
  onChanged?: () => void
}
export function parseGroupRequest(seeds: string, rates: string, seconds: string, hypothesis: string, config: Record<string, number>): GroupRequest {
  const parse = (text: string) => text.trim().split(/[,，\s]+/).map(Number)
  const seedList = parse(seeds), learningRates = parse(rates), budget = Number(seconds)
  if (!seeds.trim() || !rates.trim() || seedList.some((s) => !Number.isSafeInteger(s) || s < 0 || s > 10000) || learningRates.some((r) => !Number.isFinite(r) || r < .001 || r > .3)) throw Error('种子须为 0–10000 整数，学习率须在 [0.001, 0.3] / Invalid seeds or learning rates')
  if (new Set(seedList).size !== seedList.length || new Set(learningRates).size !== learningRates.length || seedList.length * learningRates.length > 6) throw Error('最多 6 个不重复的组合 / At most 6 unique pairs')
  if (!Number.isInteger(budget) || budget < 1 || budget > 600) throw Error('总预算须为 1–600 秒 / Budget must be 1–600 seconds')
  if (!hypothesis.trim() || hypothesis.length > 2000) throw Error('请填写假设（最多 2000 字） / Hypothesis required (max 2000 characters)')
  return { seeds: seedList, learningRates, hypothesis: hypothesis.trim(), budgetMs: budget * 1000,
    config: Object.fromEntries(Object.entries(config).filter(([key]) => !['seed', 'learningRate', 'lr', 'rate'].includes(key))) }
}
const box: CSSProperties = { padding: 12, marginBlock: 12, border: '1px solid var(--nl-border)', borderRadius: 8, background: 'var(--nl-card)', color: 'var(--nl-fg)', minWidth: 0 }
const active = (g: ExperimentGroup) => g.status === 'queued' || g.status === 'running'
const emptyDraft = { id: '', revision: 0, conclusion: '', limitations: '' }

export function ExperimentGroupPanel({ api, exercise, code, config, busy, runs, onChanged }: ExperimentGroupPanelProps) {
  const [seeds, setSeeds] = useState('42,43'), [rates, setRates] = useState('0.05,0.1')
  const [seconds, setSeconds] = useState('300'), [hypothesis, setHypothesis] = useState('')
  const [data, setData] = useState<{ api: LabApi; exerciseId: string; groups: ExperimentGroup[]; runs: RunRecord[] }>()
  const [selected, select] = useState(''), [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [working, setWorking] = useState(false)
  const epoch = useRef(0), refreshId = useRef(0), mutation = useRef(false)
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const changedRef = useRef(onChanged)
  changedRef.current = onChanged
  useLayoutEffect(() => {
    const generation = ++epoch.current
    let timer: ReturnType<typeof setTimeout> | undefined
    setData(undefined); select(''); setDraft(emptyDraft); setError(''); setNotice(''); setWorking(false); mutation.current = false
    setHypothesis('')
    const refresh = async () => {
      const request = ++refreshId.current
      try {
        const groups = (await api.groups(exercise.id)).filter((g) => g.exerciseId === exercise.id)
        if (generation !== epoch.current || request !== refreshId.current) return
        const ids = [...new Set(groups.flatMap((g) => g.items.filter((i) => i.status !== 'queued').map((i) => i.runId)))]
        const results = await Promise.allSettled(ids.map((id) => api.run(id)))
        if (generation !== epoch.current || request !== refreshId.current) return
        const fetched = results.flatMap((r) => r.status === 'fulfilled' && r.value.exerciseId === exercise.id ? [r.value] : [])
        setData({ api, exerciseId: exercise.id, groups, runs: fetched })
        setNotice(results.some((r) => r.status === 'rejected') ? '部分运行暂不可读取，统计不补零 / Some runs unavailable; no zero filling' : '')
      } catch (e) { if (generation === epoch.current && request === refreshId.current) setNotice('刷新失败 / Refresh failed: ' + String(e)) }
    }
    refreshRef.current = refresh
    const poll = async () => { await refresh(); if (generation === epoch.current) timer = setTimeout(poll, 1000) }
    void poll()
    return () => { epoch.current++; refreshId.current++; if (timer !== undefined) clearTimeout(timer) }
  }, [api, exercise.id])
  const owned = data?.api === api && data.exerciseId === exercise.id ? data : undefined
  const groups = owned?.groups ?? []
  const group = groups.find((g) => g.id === selected)
  const groupRuns = group ? [...(owned?.runs ?? []), ...runs].filter((r, index, all) =>
    all.findIndex((other) => other.id === r.id) === index && r.exerciseId === exercise.id && r.groupId === group.id && r.codeHash === group.codeHash && r.resolvedImageId === group.imageId && group.items.some((i) => i.runId === r.id))
    .map((r) => ({ ...r, events: r.events.filter((e) => e.runId === r.id) })) : []
  const summaries = group ? groupSummary(group, groupRuns) : []
  const openGroup = (g: ExperimentGroup) => { select(g.id); setDraft({ id: g.id, revision: g.revision, conclusion: g.conclusion, limitations: g.limitations }); setError('') }
  const act = async (action: () => Promise<void>) => {
    if (busy || mutation.current) return
    const generation = epoch.current
    mutation.current = true; setWorking(true); setError('')
    try { await action(); if (generation === epoch.current) { await refreshRef.current(); if (generation === epoch.current) changedRef.current?.() } }
    catch (e) { if (generation === epoch.current) setError(String(e)) }
    finally { if (generation === epoch.current) { mutation.current = false; setWorking(false) } }
  }
  const start = () => {
    let request: GroupRequest
    try { request = parseGroupRequest(seeds, rates, seconds, hypothesis, config) } catch (e) { setError(String(e)); return }
    const frozenCode = code, generation = epoch.current
    void act(async () => { const created = await api.startGroup(exercise.id, frozenCode, request); if (generation === epoch.current && created.exerciseId === exercise.id) openGroup(created) })
  }
  const save = () => {
    if (!group || active(group) || draft.id !== group.id || !draft.conclusion.trim() || !draft.limitations.trim()) return
    const generation = epoch.current
    void act(async () => { const saved = await api.concludeGroup(group.id, draft.revision, draft.conclusion, draft.limitations); if (generation === epoch.current) setDraft((current) => current.id === saved.id ? { id: saved.id, revision: saved.revision, conclusion: saved.conclusion, limitations: saved.limitations } : current) })
  }
  const editConclusion = (key: 'conclusion' | 'limitations', value: string) => {
    if (!group) return
    setDraft({ ...draft, id: group.id, revision: !draft.conclusion && !draft.limitations ? group.revision : draft.revision, [key]: value })
  }
  return <section style={box} aria-label="分组实验 / Experiment groups">
    <h3>分组实验 / Experiment groups</h3>
    <p>固定当前源码和环境，比较多个种子与学习率。最多 6 次，串行执行。 / Freeze source and environment; compare up to 6 seed/rate pairs sequentially.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <label>种子列表 / Seeds<input value={seeds} onChange={(e) => setSeeds(e.target.value)} disabled={working} /></label>
      <label>学习率列表 / Learning rates<input value={rates} onChange={(e) => setRates(e.target.value)} disabled={working} /></label>
      <label>总预算（秒） / Total seconds<input type="number" min={1} max={600} value={seconds} onChange={(e) => setSeconds(e.target.value)} disabled={working} /></label>
    </div>
    <label style={{ display: 'block', marginBlock: 8 }}>实验假设 / Hypothesis<textarea value={hypothesis} maxLength={2000} onChange={(e) => setHypothesis(e.target.value)} disabled={working} style={{ display: 'block', width: '100%' }} /></label>
    <button type="button" onClick={start} disabled={busy || working || !hypothesis.trim() || groups.some(active)}>启动分组实验（冻结当前代码） / Start group with frozen code</button>
    <p role="status">{working ? '正在处理，请等待 / Processing' : !owned ? '正在读取实验组 / Loading groups' : !groups.length ? '尚无实验组 / No groups yet' : `${groups.length} 个实验组 / groups`}{notice && ' · ' + notice}</p>
    {error && <p role="alert">{error}</p>}
    <div role="group" aria-label="选择实验组 / Select group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{groups.map((g) => <button type="button" key={g.id} aria-pressed={g.id === selected} onClick={() => openGroup(g)}>{g.createdAt} · {g.status} · {g.id}</button>)}</div>
    {group && <div style={box}>
      <h4>{group.id} · {group.status}</h4>
      <p>{group.status === 'completed' ? '队列完成不等于掌握；结论须考虑失败项和样本数量。 / Queue completion does not establish mastery.' : '运行状态与程序检查分别记录。 / Execution and checks are recorded separately.'}</p>
      <p style={{ overflowWrap: 'anywhere' }}>codeHash: {group.codeHash}<br />Image: {group.imageId}<br />Attempt: {group.attemptId} · Help: {group.help}<br />Dataset: {group.dataset} · Content: {group.contentVersion} · Test: {group.testVersion}<br />预算 / Budget: {group.budgetMs / 1000}s · Revision: {group.revision}</p>
      <p>假设 / Hypothesis: {group.hypothesis}</p>
      {code !== group.code && <p>当前草稿与组快照不同；本组保留原代码。 / Current draft differs from the frozen group.</p>}
      <details><summary>冻结源码 / Frozen source</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto' }}>{group.code}</pre></details>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}><caption>组内运行 / Group runs</caption><thead><tr>{['Run ID', 'Seed', 'Learning rate', '状态 / Status', '检查 / Check', '说明 / Reason'].map((s) => <th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{group.items.map((item) => <tr key={item.runId}><td>{item.runId}</td><td>{item.seed}</td><td>{item.learningRate}</td><td>{item.status}</td><td>{groupRuns.find((r) => r.id === item.runId)?.check_status ?? '未读取 / Unavailable'}</td><td>{item.reason ?? '—'}</td></tr>)}</tbody></table></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}><caption>程序验证损失，按学习率统计 / Program validation loss by learning rate</caption><thead><tr>{['Learning rate', 'n / total', '均值 / Mean', '样本 SD / Sample SD', '失败 / Failed', '取消或中断 / Cancelled', '缺指标 / Missing'].map((s) => <th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{summaries.map((s) => <tr key={s.learningRate}><td>{s.learningRate}</td><td>{s.n} / {s.total}</td><td>{s.mean ?? '未定义 / Undefined'}</td><td>{s.sampleStd ?? '未定义（n < 2） / Undefined (n < 2)'}</td><td>{s.failed}</td><td>{s.cancelled}</td><td>{s.missing}</td></tr>)}</tbody></table></div>
      <p>仅统计代码、镜像与组归属一致且程序检查通过的完成运行。失败、取消与缺指标不补零；这些计数可能重叠。 / Only matching completed, passed runs enter summaries; excluded categories may overlap. No zero filling.</p>
      {active(group) ? <button type="button" disabled={busy || working} onClick={() => void act(() => api.cancelGroup(group.id))}>取消此实验组 / Cancel this group</button> : <>
        <label style={{ display: 'block' }}>实验结论 / Conclusion<textarea maxLength={4000} value={draft.id === group.id ? draft.conclusion : ''} onChange={(e) => editConclusion('conclusion', e.target.value)} disabled={working} style={{ display: 'block', width: '100%' }} /></label>
        <label style={{ display: 'block' }}>局限与不确定性 / Limitations<textarea maxLength={4000} value={draft.id === group.id ? draft.limitations : ''} onChange={(e) => editConclusion('limitations', e.target.value)} disabled={working} style={{ display: 'block', width: '100%' }} /></label>
        {draft.id === group.id && draft.revision !== group.revision && <p role="status">组记录已更新，保存将检查修订。点击组按钮重新载入会替换未保存文字。 / Group changed; saving checks revision. Reselecting reloads and replaces unsaved text.</p>}
        <button type="button" disabled={busy || working || !draft.conclusion.trim() || !draft.limitations.trim()} onClick={save}>保存结论与局限 / Save conclusion and limitations</button>
      </>}
    </div>}
  </section>
}

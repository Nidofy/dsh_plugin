import { useState } from 'react'
import type { Locale, RunEvent, RunRecord } from '../types.ts'

function indexEvents(run: RunRecord) {
  const indexed = new Map<string, { event: RunEvent; sample: number }>()
  const counts = new Map<string,number>()
  for (const event of run.events) {
    if (event.type !== 'metric' && event.type !== 'check') continue
    const key = JSON.stringify([event.type, event.step ?? '', event.name, event.unit ?? ''])
    const sample = (counts.get(key) ?? 0) + 1
    counts.set(key, sample)
    indexed.set(key+':'+sample, { event, sample })
  }
  return indexed
}

function formatChange(a: number | undefined, b: number | undefined, locale: Locale) {
  if (a === undefined || b === undefined) return '—'
  const delta = b-a
  const fmt = (n: number) => n.toLocaleString(locale, {maximumSignificantDigits: 5})
  const signed = (n: number) => (n > 0 ? '+' : '') + fmt(n)
  if (a === 0) return signed(delta) + ' · ' + {zh:'基线为零，倍率无定义',en:'zero baseline, ratio undefined'}[locale]
  const percentage = signed(100*delta/Math.abs(a))+'%'
  const ratio = fmt(b/a)+'×'
  const reduction = a>b && b>0 ? ' · '+fmt(a/b)+{zh:' 倍缩减',en:'× reduction'}[locale] : ''
  return signed(delta)+' · '+percentage+' · '+ratio+reduction
}

export function RunComparison({ runs, exerciseId, locale }: {
  runs: readonly RunRecord[]; exerciseId: string; locale: Locale
}) {
  const eligible = runs.filter(r => r.exerciseId === exerciseId && r.run_status === 'completed')
  const [selection,setSelection] = useState<[string,string]>(['',''])
  if (eligible.length < 2) return null
  const a = eligible.find(r => r.id===selection[0]) ?? eligible[1]!
  const b = eligible.find(r => r.id===selection[1] && r.id!==a.id) ?? eligible.find(r=>r.id!==a.id)!
  const choose = (side:number, id:string) => {
    if (side===0) setSelection([id,id===b.id ? a.id : b.id])
    else setSelection([id===a.id ? b.id : a.id,id])
  }
  const first = indexEvents(a), second = indexEvents(b)
  const keys = [...new Set([...first.keys(),...second.keys()])]
  const configs = [...new Set([...Object.keys(a.config), ...Object.keys(b.config)])].sort()
  const display = (event: RunEvent | undefined) => {
    if (!event) return '—'
    if (event.type==='check') return event.passed ? {zh:'通过',en:'Passed'}[locale] : {zh:'失败',en:'Failed'}[locale]
    return event.value === undefined ? '—' : event.value.toLocaleString(locale,{maximumSignificantDigits:7})+' '+(event.unit ?? '')
  }
  return <section className="ail-card ail-chart ail-comparison">
    <h3>{{zh:'两次运行对照',en:'Compare two runs'}[locale]}</h3>
    <div className="ail-controls">{[a,b].map((r,i) => <label key={i}>
      {i===0 ? {zh:'基准 A',en:'Baseline A'}[locale] : {zh:'对照 B',en:'Comparison B'}[locale]}
      <select value={r.id} onChange={e=>choose(i,e.target.value)}>
        {eligible.map(item=><option key={item.id} value={item.id}>
          {new Date(item.createdAt).toLocaleString(locale)} · {item.id.slice(0,8)}
        </option>)}
      </select>
    </label>)}</div>
    <div className="ail-table-scroll"><table><thead><tr><th>{{zh:'配置与结果',en:'Configuration and results'}[locale]}</th>
      <th>A</th><th>B</th><th>{{zh:'变化（B 相对 A）',en:'Change (B relative to A)'}[locale]}</th></tr></thead>
      <tbody>
        {[
          [{zh:'资源档位',en:'Resource profile'}[locale],a.resourceProfile,b.resourceProfile],
          [{zh:'随机种子',en:'Seed'}[locale],a.seed,b.seed],
          [{zh:'课程版本 / 测试版本',en:'Content / test version'}[locale],a.contentVersion+' / '+a.testVersion,b.contentVersion+' / '+b.testVersion],
          ...configs.map(key=>[key,a.config[key] ?? '—',b.config[key] ?? '—']),
          [{zh:'运行前预测',en:'Prediction'}[locale],a.prediction || '—',b.prediction || '—'],
        ].map(([title,left,right])=><tr key={title} data-changed={left!==right}>
          <th scope="row">{title}</th><td>{left}</td><td>{right}</td><td>{left===right?'=':'≠'}</td></tr>)}
        {keys.map(key => {
          const left = first.get(key), right = second.get(key)
          const {event,sample} = (left ?? right)!
          const valueA=display(left?.event), valueB=display(right?.event)
          return <tr key={key} data-changed={valueA!==valueB}>
            <th scope="row">{event.step && event.step!==event.name && <small>{event.step} · </small>}{event.name}{sample>1?' #'+sample:''}</th>
            <td>{valueA}</td><td>{valueB}</td>
            <td>{event.type==='metric' ? formatChange(left?.event.value,right?.event.value,locale) : valueA===valueB?'=':'≠'}</td>
          </tr>
        })}
      </tbody>
    </table></div>
  </section>
}

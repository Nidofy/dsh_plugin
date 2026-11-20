import { completedServing, servingExample, simulateServing } from '../sim-stage-e.ts'
import { Choice, ExplorerPanel, useObservations, type ExplorerProps } from './ExplorerPanel.tsx'

export function ServingSchedulerExplorer(props: ExplorerProps) {
  const {locale} = props
  const {input,select,observations} = useObservations(servingExample)
  const run = simulateServing(input)
  const other = simulateServing({...input,policy:input.policy==='static'?'continuous':'static'})
  const x = (ms:number) => 50 + 460*ms/Math.max(1,run.wallMs)
  return <ExplorerPanel {...props} title={{zh:'请求队列与 KV 占用',en:'Request queue and KV occupancy'}}
    observations={observations} complete={completedServing(observations)}>
    <div className="ail-controls">
      <Choice label={{zh:'调度',en:'Batching'}[locale]} values={['static','continuous'] as const} value={input.policy}
        format={v=>v==='static'?{zh:'静态',en:'Static'}[locale]:{zh:'连续',en:'Continuous'}[locale]} onChange={policy=>select({...input,policy})}/>
      <Choice label={{zh:'同时服务槽位',en:'Serving slots'}[locale]} values={[1,2,4,8]} value={input.slots} onChange={slots=>select({...input,slots})}/>
      <Choice label={{zh:'KV 块预算',en:'KV block budget'}[locale]} values={[2,8,24,64]} value={input.pages} onChange={pages=>select({...input,pages})}/>
      <Choice label={{zh:'请求数',en:'Requests'}[locale]} values={[4,12,24]} value={input.requestCount} onChange={requestCount=>select({...input,requestCount})}/>
      <Choice label={{zh:'到达间隔 (ms)',en:'Arrival gap (ms)'}[locale]} values={[0,1,4,12]} value={input.arrivalGap} onChange={arrivalGap=>select({...input,arrivalGap})}/>
      <Choice label={{zh:'输入长度上界',en:'Maximum input length'}[locale]} values={[8,24,64]} value={input.promptLength} onChange={promptLength=>select({...input,promptLength})}/>
      <Choice label={{zh:'输出长度上界',en:'Maximum output length'}[locale]} values={[1,8,16,32]} value={input.outputLength} onChange={outputLength=>select({...input,outputLength})}/>
    </div>
    <p>{{zh:'TTFT 从到达到首个输出。TPOT 取各多 token 请求的平均输出间隔，再按请求统计。',en:'TTFT runs from arrival to first output. TPOT summarizes mean inter-token gaps per multi-token request.'}[locale]}</p>
    <table><thead><tr><th>{{zh:'策略',en:'Policy'}[locale]}</th><th>TTFT μ / P95 (ms)</th><th>TPOT μ / P95 (ms)</th><th>tok/s</th></tr></thead>
      <tbody>{[run,other].map((r,i)=><tr key={i}><td>{(i===0)===(input.policy==='static')?{zh:'静态',en:'Static'}[locale]:{zh:'连续',en:'Continuous'}[locale]}</td>
        <td>{r.ttft.mean.toFixed(1)} / {r.ttft.p95.toFixed(1)}</td><td>{r.tpot.mean.toFixed(1)} / {r.tpot.p95.toFixed(1)}</td><td>{r.tokensPerSecond.toFixed(1)}</td></tr>)}</tbody></table>
    <p>{{zh:'每行一个请求，圆点表示到达，浅色为预填充，实色为解码。',en:'One row per request. A dot marks arrival, light fill is prefill and solid fill is decode.'}[locale]}
      {' '}{run.wallMs.toFixed(1)} ms · {{zh:'单请求超过块预算',en:'Requests exceeding block budget'}[locale]} {run.rejected}</p>
    <svg viewBox={`0 0 520 ${Math.max(18,run.requests.length*18)}`} role="img" aria-label={{zh:'请求时间线',en:'Request timeline'}[locale]}>
      {run.requests.map((r,i)=><g key={r.id} transform={`translate(0 ${i*18})`}>
        <text x={0} y={12} fill="currentColor" fontSize={11}>#{r.id}</text>
        <rect x={x(r.start)} y={3} width={x(r.first)-x(r.start)} height={10} fill="var(--ail-accent-soft)" />
        <rect x={x(r.first)} y={3} width={x(r.end)-x(r.first)} height={10} fill="var(--ail-accent)" />
        <circle cx={x(r.arrival)} cy={8} r={2} fill="currentColor"/></g>)}
    </svg>
    <p>{{zh:'KV 物理块占用（纵轴 0–100%，横轴为模拟时间）。每块 16 个 token，入场时为增长预留额度，用到时分配。',en:'Physical KV occupancy (0–100% vertically, simulated time horizontally). Each block holds 16 tokens. Admission reserves room for growth and blocks materialize on demand.'}[locale]}</p>
    <svg viewBox="0 0 520 65" role="img" aria-label={{zh:'KV 利用率',en:'KV utilization'}[locale]}>
      <path d="M50 5 V60 H510" fill="none" stroke="currentColor"/>
      <polyline points={run.curve.map(p=>x(p.ms)+','+(60-55*p.utilization)).join(' ')} stroke="var(--ail-accent)" fill="none" strokeWidth={2}/>
    </svg>
  </ExplorerPanel>
}

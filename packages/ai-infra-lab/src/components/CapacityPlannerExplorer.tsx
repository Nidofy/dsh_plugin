import { capacityExample, completedCapacity, evaluateCapacityPlan } from '../sim-stage-e.ts'
import { Choice, ExplorerPanel, useObservations, type ExplorerProps } from './ExplorerPanel.tsx'

export function CapacityPlannerExplorer(props: ExplorerProps) {
  const {locale} = props
  const {input,select,observations} = useObservations(capacityExample)
  const r = evaluateCapacityPlan(input)
  const labels = {weights:{zh:'权重与量化比例',en:'Weights and group scales'},gradients:{zh:'梯度',en:'Gradients'},
    optimizer:{zh:'主权重和矩',en:'Master and moments'},kv:{zh:'KV 缓存',en:'KV cache'},
    activations:{zh:'激活',en:'Activations'},reserve:{zh:'工作区预留',en:'Workspace reserve'}}
  const checks = {topology:{zh:'TP×PP 整除 8',en:'TP×PP divides eight'},precision:{zh:'精度和分片适用于任务',en:'Precision and sharding suit the task'},
    memory:{zh:'每卡 ≤80 GiB',en:'At most 80 GiB per GPU'},batch:{zh:'达到批量目标',en:'Batch target met'},
    latency:{zh:'达到时间目标',en:'Time target met'},link:{zh:'通信处于预算内',en:'Within link budget'}}
  return <ExplorerPanel {...props} title={{zh:'八卡容量规划台',en:'Eight-GPU capacity planner'}}
    observations={observations} complete={completedCapacity(observations)}>
    <div className="ail-controls">
      <Choice label={{zh:'任务',en:'Workload'}[locale]} values={['serve70b','train13b'] as const} value={input.scenario}
        format={s=>s==='serve70b'?{zh:'70B 推理',en:'70B serving'}[locale]:{zh:'13B 训练',en:'13B training'}[locale]} onChange={scenario=>select({...input,scenario})}/>
      <Choice label={{zh:'权重精度',en:'Weight precision'}[locale]} values={['fp16','bf16','int8','int4'] as const} value={input.precision} onChange={precision=>select({...input,precision})}/>
      <Choice label="TP" values={[1,2,4,8]} value={input.tp} onChange={tp=>select({...input,tp})}/>
      <Choice label="PP" values={[1,2,4,8]} value={input.pp} onChange={pp=>select({...input,pp})}/>
      <Choice label="ZeRO" values={[0,1,2,3]} value={input.zero} onChange={zero=>select({...input,zero})}/>
      <Choice label={{zh:'总批量',en:'Total batch'}[locale]} values={[1,8,16,32,64,128]} value={input.batch} onChange={batch=>select({...input,batch})}/>
    </div>
    <p>{input.scenario==='serve70b'?
      {zh:'目标为 32 路并发、首 token ≤500 ms、通信 ≤100 ms。提示词 128，KV 按 2048 个位置计。',en:'Target 32 concurrent requests, TTFT ≤500 ms and communication ≤100 ms. Prefill uses 128 tokens and KV budgets 2,048 positions.'}[locale]:
      {zh:'目标为总批量 ≥8、训练步 ≤2 s、通信 ≤500 ms。序列长 512，混合精度 AdamW。',en:'Target batch ≥8, step ≤2 s and communication ≤500 ms. Sequence length is 512 with mixed AdamW.'}[locale]}</p>
    <p>{{zh:'每卡按有效 200 TFLOP/s，单向链路按 400 GB/s、每轮 3 μs 计算。整机 8 × 80 GiB。',en:'Assume 200 effective TFLOP/s per GPU and 400 GB/s one-way links with 3 μs startup per round, on 8 × 80 GiB.'}[locale]}</p>
    <dl>{(Object.keys(labels) as (keyof typeof labels)[]).map(k=><div key={k}><dt>{labels[k][locale]}</dt><dd>{(r[k]/2**30).toFixed(2)} GiB</dd></div>)}</dl>
    <p>{(r.totalBytes/2**30).toFixed(2)} / 80 GiB · {{zh:'计算',en:'Compute'}[locale]} {r.computeMs.toFixed(1)} ms +
      {' '}{{zh:'通信',en:'Communication'}[locale]} {r.linkMs.toFixed(1)} ms = {r.latencyMs.toFixed(1)} ms</p>
    <ul>{(Object.keys(checks) as (keyof typeof checks)[]).map(k=><li key={k}>
      {r.checks[k]?'✓':'×'} {checks[k][locale]}</li>)}</ul>
  </ExplorerPanel>
}

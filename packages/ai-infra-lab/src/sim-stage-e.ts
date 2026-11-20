import { alphaBetaCost, ringCost } from './sim-stage-d.ts'

export interface ServingInput {
  policy: 'static' | 'continuous'
  slots: number
  pages: number
  requestCount: number
  arrivalGap: number
  promptLength: number
  outputLength: number
}

export const servingExample: ServingInput = {
  policy:'static', slots:4, pages:24, requestCount:12, arrivalGap:1, promptLength:24, outputLength:16,
}

const integer = (n: unknown, lo: number, hi: number) => Number.isSafeInteger(n) && Number(n)>=lo && Number(n)<=hi
function validServing(v: unknown): v is ServingInput {
  const c = v as ServingInput | null
  return !!c && ['static','continuous'].includes(c.policy) && integer(c.slots,1,16) && integer(c.pages,1,256) &&
    integer(c.requestCount,1,64) && integer(c.arrivalGap,0,20) && integer(c.promptLength,1,128) && integer(c.outputLength,1,64)
}

export function simulateServing(c: ServingInput) {
  if (!validServing(c)) throw RangeError('服务配置超出模型范围 / Serving settings outside model limits')
  const requests = Array.from({length:c.requestCount}, (_,i) => ({
    id:i, arrival:i*c.arrivalGap, input:1+(i*7+c.promptLength-1)%c.promptLength,
    output:i%4===0 ? c.outputLength : 1+(i*3)%Math.max(1,Math.ceil(c.outputLength/3)),
    start:0, first:0, end:0, produced:0,
  }))
  type Request = typeof requests[number]
  const capacity = (r:Request) => Math.ceil((r.input+r.output)/16)
  const pending = requests.filter(r=>capacity(r)<=c.pages)
  const rejected = requests.length-pending.length
  const active: Request[] = []
  const curve: {ms:number; blocks:number; utilization:number}[] = []
  let now = 0
  while (pending.length || active.length) {
    if (!active.length && pending.length) now = Math.max(now,pending[0]!.arrival)
    if (c.policy==='continuous' || !active.length) {
      // Reserve growth room at admission; materialize blocks only as tokens arrive.
      let reserved = active.reduce((n,r)=>n+capacity(r),0)
      while (active.length<c.slots && pending.length && pending[0]!.arrival<=now &&
             reserved+capacity(pending[0]!)<=c.pages) {
        const r = pending.shift()!
        r.start = now
        active.push(r)
        reserved += capacity(r)
      }
    }
    const advancing = active.filter(r=>r.produced<r.output)
    const prefill = advancing.reduce((sum,r)=>sum+(r.produced===0?r.input:0),0)
    // A prefill emits the first token. Each later iteration emits one token per live request.
    now += 1 + prefill/8 + advancing.length/4
    for (const r of advancing) {
      if (r.produced===0) r.first = now
      if (++r.produced===r.output) r.end = now
    }
    const blocks = active.reduce((n,r)=>n+Math.ceil((r.input+r.produced)/16),0)
    curve.push({ms:now, blocks, utilization:blocks/c.pages})
    if (c.policy==='continuous') {
      for (let i=active.length-1;i>=0;i--) if (active[i]!.end) active.splice(i,1)
    } else if (active.every(r=>r.end>0)) active.length=0
  }
  const completed = requests.filter(r=>r.end>0)
  const stats = (values:number[]) => {
    values.sort((a,b)=>a-b)
    return {mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:0,
      p95:values[Math.ceil(.95*values.length)-1] ?? 0}
  }
  const ttft = stats(completed.map(r=>r.first-r.arrival))
  const tpot = stats(completed.filter(r=>r.output>1).map(r=>(r.end-r.first)/(r.output-1)))
  const tokens = completed.reduce((n,r)=>n+r.output,0)
  return { requests:completed, rejected, curve, ttft, tpot, tokens, wallMs:now, tokensPerSecond:now?1000*tokens/now:0 }
}

export function completedServing(observations: unknown): boolean {
  if (!Array.isArray(observations) || observations.length>32 || !observations.every(validServing)) return false
  const configs: ServingInput[] = observations
  return configs.some(a => a.policy === 'static' && a.slots > 1 && configs.some(b => {
    if (b.policy !== 'continuous' || !(Object.keys(servingExample) as (keyof ServingInput)[]).every(
      k => k === 'policy' || a[k] === b[k])) return false
    const continuous = simulateServing(b)
    return simulateServing(a).requests.some((r,i) => r.start !== continuous.requests[i]?.start)
  }))
}

export interface CapacityPlan {
  scenario: 'serve70b' | 'train13b'
  precision: 'fp16' | 'bf16' | 'int8' | 'int4'
  tp: number
  pp: number
  zero: number
  batch: number
}

export const capacityExample: CapacityPlan = {scenario:'serve70b',precision:'fp16',tp:1,pp:1,zero:0,batch:32}
const GiB = 2**30

function validPlan(v: unknown): v is CapacityPlan {
  const c = v as CapacityPlan | null
  return !!c && ['serve70b','train13b'].includes(c.scenario) && ['fp16','bf16','int8','int4'].includes(c.precision) &&
    [1,2,4,8].includes(c.tp) && [1,2,4,8].includes(c.pp) && integer(c.zero,0,3) && integer(c.batch,1,128)
}

export function evaluateCapacityPlan(c: CapacityPlan) {
  if (!validPlan(c)) throw RangeError('容量方案参数无效 / Invalid capacity plan')
  const serve = c.scenario==='serve70b'
  const p = serve ? 70e9 : 13e9
  const layers = serve ? 80 : 40
  const hidden = serve ? 8192 : 5120
  const sequence = serve ? 128 : 512
  const shards = c.tp*c.pp
  const topologyOK = shards<=8 && 8%shards===0
  // Infeasible layouts still have a one-replica ledger for diagnosis.
  const replicas = Math.max(1,Math.floor(8/shards))
  const localBatch = Math.ceil(c.batch/replicas)
  const width = {fp16:2,bf16:2,int8:1,int4:0.5}[c.precision]
  const scaleBytes = width<2 ? 2/64 : 0
  const zero = serve ? 0 : c.zero
  const weights = p*(width+scaleBytes)/shards/(zero===3?replicas:1)
  const gradients = serve?0:2*p/shards/(zero>=2?replicas:1)
  const optimizer = serve?0:12*p/shards/(zero>=1?replicas:1)
  const kv = serve ? 2*layers*8*128*2048*2*localBatch/shards : 0
  const activations = serve ? 0 : 4*(layers/c.pp)*localBatch*sequence*hidden*2
  const reserve = 2*GiB
  const totalBytes = weights+gradients+optimizer+kv+activations+reserve
  const flops = (serve?2:6)*p*sequence*localBatch
  // One prefill microbatch traverses PP stages serially; no PP latency speedup is assumed.
  const computeMs = 1000*flops/(200e12*c.tp)
  const message = localBatch*sequence*hidden*2
  const tpSeconds = c.tp===1 ? 0 : (serve?2:4)*layers*ringCost(c.tp,3,400e9,message).elapsedSeconds
  const ppSeconds = (serve?1:2)*(c.pp-1)*alphaBetaCost(3,400e9,message)
  const dpSeconds = serve || replicas===1 ? 0 : ringCost(replicas,3,400e9,2*p/shards).elapsedSeconds*(zero===3?1.5:1)
  const linkMs = 1000*(tpSeconds+ppSeconds+dpSeconds)
  const latencyMs = computeMs+linkMs
  const checks = { topology:topologyOK, precision:serve?c.zero===0:width===2, memory:totalBytes<=80*GiB,
    batch:c.batch>=(serve?32:8), latency:latencyMs<=(serve?500:2000), link:linkMs<=(serve?100:500) }
  return { weights,gradients,optimizer,kv,activations,reserve,totalBytes,replicas,localBatch,
    computeMs,linkMs,latencyMs,checks,passes:Object.values(checks).every(Boolean) }
}

export function completedCapacity(observations: unknown): boolean {
  if (!Array.isArray(observations) || observations.length>32 || !observations.every(validPlan)) return false
  const passed = observations.filter(c=>evaluateCapacityPlan(c).passes)
  return passed.some(c=>c.scenario==='serve70b') && passed.some(c=>c.scenario==='train13b')
}

export function alphaBetaCost(alphaUs: number, betaBytesPerSec: number, messageBytes: number) {
  if (![alphaUs, betaBytesPerSec, messageBytes].every(Number.isFinite) ||
      alphaUs < 0 || betaBytesPerSec <= 0 || messageBytes < 0) throw RangeError('通信参数无效 / Invalid link model')
  return alphaUs * 1e-6 + messageBytes / betaBytesPerSec
}

export function ringCost(n: number, alphaUs: number, bandwidth: number, bytes: number) {
  if (!Number.isInteger(n) || n < 2 || n > 256) throw RangeError('进程数无效 / Invalid rank count')
  const rounds = 2 * (n - 1)
  const elapsedSeconds = rounds * alphaBetaCost(alphaUs, bandwidth, bytes / n)
  return { rounds, elapsedSeconds, normalizedSeconds: elapsedSeconds / n }
}

export interface PipelineInput { stages: number; microbatches: number; schedule: 'GPipe' | '1F1B' }
interface Slot { stage: number; microbatch: number; phase: 'F' | 'B'; tick: number }

function valid(value: unknown): value is PipelineInput {
  const v = value as PipelineInput | null
  return !!v && Number.isInteger(v.stages) && v.stages >= 1 && v.stages <= 8 &&
    Number.isInteger(v.microbatches) && v.microbatches >= 1 && v.microbatches <= 32 &&
    (v.schedule === 'GPipe' || v.schedule === '1F1B')
}

export function pipelineSchedule(input: PipelineInput) {
  if (!valid(input)) throw RangeError('流水线参数无效 / Invalid pipeline configuration')
  const { stages, microbatches, schedule } = input
  const queues = Array.from({ length: stages }, (_, stage) => {
    const ops: Omit<Slot,'tick'>[] = []
    const add = (phase: Slot['phase'], microbatch: number) => ops.push({ stage, phase, microbatch })
    if (schedule === 'GPipe') {
      for (let i = 0; i < microbatches; i++) add('F', i)
      for (let i = microbatches - 1; i >= 0; i--) add('B', i)
    } else {
      const warm = Math.min(stages - stage - 1, microbatches)
      for (let i = 0; i < warm; i++) add('F', i)
      for (let i = 0; i < microbatches - warm; i++) { add('F', warm+i); add('B', i) }
      for (let i = microbatches - warm; i < microbatches; i++) add('B', i)
    }
    return ops
  })
  const key = (s: number, phase: string, m: number) => [s,phase,m].join('/')
  const done = new Set<string>()
  const live = Array<number>(stages).fill(0)
  const peaks = [...live]
  const slots: Slot[] = []
  let ticks = 0
  while (slots.length < 2 * stages * microbatches) {
    const ready = queues.map(q => q[0]).filter(op => {
      if (!op) return false
      const { stage, phase, microbatch: m } = op
      return phase === 'F' ? stage === 0 || done.has(key(stage-1,'F',m)) :
        done.has(key(stage,'F',m)) && (stage === stages-1 || done.has(key(stage+1,'B',m)))
    })
    if (!ready.length) throw Error('调度缺少就绪任务 / No ready pipeline task')
    for (const op of ready) {
      slots.push({ ...op, tick: ticks })
      queues[op.stage]!.shift()
      done.add(key(op.stage,op.phase,op.microbatch))
      live[op.stage] += op.phase === 'F' ? 1 : -1
      peaks[op.stage] = Math.max(peaks[op.stage]!, live[op.stage]!)
    }
    ticks++
  }
  const idleTicks = ticks * stages - slots.length
  return { slots, ticks, idleTicks, peaks, bubble: idleTicks / (ticks * stages) }
}

export function completedPipeline(observations: unknown): boolean {
  if (!Array.isArray(observations) || observations.length > 32 || !observations.every(valid)) return false
  return observations.some(a => a.schedule === 'GPipe' && observations.some(b =>
    b.schedule === '1F1B' && a.stages === b.stages && a.microbatches === b.microbatches &&
    pipelineSchedule(a).peaks[0]! > pipelineSchedule(b).peaks[0]!))
}

import { splitProject } from './project.ts'
import type { Exercise, RunEvent, RunRecord } from './types.ts'

export type DebugEvent = RunEvent & { component?: string; layer?: number }
export interface DebugObservation {
  event: DebugEvent
  component?: string
  layer?: number
  mapping: 'explicit' | 'legacy-name' | 'unassigned'
}

// Exact historical controller names only. Aggregate gradients do not identify a component.
const legacyNames: Record<string, string> = {
  embedding: 'embed', 'token and position embedding': 'embed',
  'embedding input gradient': 'embed', 'head weights': 'head_weights',
  logits: 'logits', 'decoder logits': 'logits',
  tokens: 'shifted', targets: 'shifted', 'next-token windows': 'shifted',
  'cross entropy': 'loss_fn', 'SGD parameter updates': 'update',
  'attention alternate B/T/heads': 'attention',
}
export function debugObservation(event: DebugEvent, names: Set<string>): DebugObservation {
  const module = /^module ([a-z_]+)$/.exec(event.name)
  const tensor = /^attention\.layer(\d+)\.head\d+$/.exec(event.name)
  const candidate = event.component ?? module?.[1] ?? (tensor ? 'attention' : legacyNames[event.name])
  const component = candidate && names.has(candidate) ? candidate : undefined
  const layer = Number.isInteger(event.layer) && event.layer! >= 0 ? event.layer
    : tensor ? Number(tensor[1]) : undefined
  return { event, component, layer, mapping: component ? event.component ? 'explicit' : 'legacy-name' : 'unassigned' }
}

export function debugModel(run: RunRecord, exercise: Exercise) {
  const compatible = run.exerciseId === exercise.id
  const contracts = compatible ? exercise.components ?? [] : []
  const names = new Set(contracts.map((c) => c.name))
  const observations = compatible ? run.events.filter((e) => e.runId === run.id)
    .map((e) => debugObservation(e, names)).sort((a, b) => a.event.seq - b.event.seq) : []
  const failures = observations.filter((o) => o.event.type === 'check' && o.event.passed === false)
  const layers = [...new Set(observations.flatMap((o) => o.layer === undefined ? [] : [o.layer]))].sort((a, b) => a - b)
  let parts: { name: string; code: string }[] = []
  try { parts = splitProject(run.code, contracts).parts } catch { /* Historical source may have no markers. */ }
  return {
    compatible, contracts, observations, failures, layers, parts,
    firstFailure: failures[0],
    foreignEvents: run.events.filter((e) => e.runId !== run.id).length,
    edges: contracts.flatMap((c) => c.dependsOn.map((from) => ({ from, to: c.name, known: names.has(from) }))),
  }
}

export function componentObservations(observations: DebugObservation[], component: string, layer?: number) {
  return observations.filter((o) => o.component === component && (layer === undefined || o.layer === layer))
}

export function debugHint(component: string, level: 'concept' | 'steps' | 'code'): string {
  const concept = /attention|head_weights|causal_mask|merge_heads/.test(component)
    ? '检查 Q/K/V 的轴、缩放与允许关注的位置。 / Check Q/K/V axes, scaling and allowed positions.'
    : /block|pre_norm|ffn/.test(component)
      ? '核对归一化位置、子层输出与残差的 shape。 / Check normalization placement, sublayer and residual shapes.'
      : '核对该组件输入、输出和可求导路径。 / Check inputs, outputs and differentiability.'
  if (level === 'concept') return concept
  if (level === 'steps') return '先读取本次运行最早失败检查；核对选中组件的 shape、层与 step，再只改一个因素重跑。观察顺序不证明因果。 / Inspect the earliest failed check, shapes, layer and step; change one factor and rerun. Order does not prove causality.'
  return '对照下面的运行源码定位接口；保留计算图，避免 detach 或转成 NumPy。具体改法需结合失败检查，不能从缺失采样推断。 / Locate the interface in the frozen source; preserve autograd. A code fix needs check evidence, not missing samples.'
}

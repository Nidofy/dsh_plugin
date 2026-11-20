import type { BilingualText, CheckStatus, EstimateSpec, UnitDimension } from './types.ts'

interface UnitEntry {
  dimension: UnitDimension
  factor: number
}

const UNITS: Record<string, UnitEntry> = {
  // Scalar / ratios
  '': { dimension: 'scalar', factor: 1 },
  x: { dimension: 'scalar', factor: 1 },
  '%': { dimension: 'scalar', factor: 0.01 },

  // Bytes (decimal & binary IEC)
  b: { dimension: 'bytes', factor: 1 },
  byte: { dimension: 'bytes', factor: 1 },
  bytes: { dimension: 'bytes', factor: 1 },
  kb: { dimension: 'bytes', factor: 1e3 },
  mb: { dimension: 'bytes', factor: 1e6 },
  gb: { dimension: 'bytes', factor: 1e9 },
  tb: { dimension: 'bytes', factor: 1e12 },
  kib: { dimension: 'bytes', factor: 1024 },
  mib: { dimension: 'bytes', factor: 1024 ** 2 },
  gib: { dimension: 'bytes', factor: 1024 ** 3 },
  tib: { dimension: 'bytes', factor: 1024 ** 4 },

  // FLOPs (work count)
  flop: { dimension: 'flops', factor: 1 },
  flops: { dimension: 'flops', factor: 1 },
  kflops: { dimension: 'flops', factor: 1e3 },
  mflops: { dimension: 'flops', factor: 1e6 },
  gflops: { dimension: 'flops', factor: 1e9 },
  tflops: { dimension: 'flops', factor: 1e12 },
  pflops: { dimension: 'flops', factor: 1e15 },

  // Compute rate (FLOP/s)
  'flop/s': { dimension: 'rate_flops', factor: 1 },
  'flops/s': { dimension: 'rate_flops', factor: 1 },
  'mflop/s': { dimension: 'rate_flops', factor: 1e6 },
  'gflop/s': { dimension: 'rate_flops', factor: 1e9 },
  'tflop/s': { dimension: 'rate_flops', factor: 1e12 },
  'pflop/s': { dimension: 'rate_flops', factor: 1e15 },

  // Memory / network bandwidth (B/s)
  'b/s': { dimension: 'bandwidth', factor: 1 },
  'kb/s': { dimension: 'bandwidth', factor: 1e3 },
  'mb/s': { dimension: 'bandwidth', factor: 1e6 },
  'gb/s': { dimension: 'bandwidth', factor: 1e9 },
  'tb/s': { dimension: 'bandwidth', factor: 1e12 },
  'kib/s': { dimension: 'bandwidth', factor: 1024 },
  'mib/s': { dimension: 'bandwidth', factor: 1024 ** 2 },
  'gib/s': { dimension: 'bandwidth', factor: 1024 ** 3 },

  'tok/s': { dimension: 'token_rate', factor: 1 },
  'tokens/s': { dimension: 'token_rate', factor: 1 },
  'ktok/s': { dimension: 'token_rate', factor: 1000 },

  // Time (seconds)
  s: { dimension: 'time', factor: 1 },
  sec: { dimension: 'time', factor: 1 },
  ms: { dimension: 'time', factor: 1e-3 },
  us: { dimension: 'time', factor: 1e-6 },
  'μs': { dimension: 'time', factor: 1e-6 },
  ns: { dimension: 'time', factor: 1e-9 },
}

const DIMENSION_HINTS: Record<UnitDimension, BilingualText> = {
  scalar: {
    zh: '无量纲数值或倍率（例如 3.2、4x、50%）',
    en: 'a dimensionless number or speedup ratio (e.g. 3.2, 4x, 50%)',
  },
  bytes: {
    zh: '存储容量单位（如 B、KB、MB、GB 或 KiB、MiB、GiB）',
    en: 'a byte capacity unit (e.g. B, KB, MB, GB or KiB, MiB, GiB)',
  },
  flops: {
    zh: '浮点运算次数单位（如 FLOPs、MFLOPs、GFLOPs、TFLOPs）',
    en: 'a FLOP count unit (e.g. FLOPs, MFLOPs, GFLOPs, TFLOPs)',
  },
  rate_flops: {
    zh: '算力吞吐率单位（如 MFLOP/s、GFLOP/s、TFLOP/s）',
    en: 'a compute throughput unit (e.g. MFLOP/s, GFLOP/s, TFLOP/s)',
  },
  bandwidth: {
    zh: '带宽单位（如 MB/s、GB/s、GiB/s、TB/s）',
    en: 'a bandwidth unit (e.g. MB/s, GB/s, GiB/s, TB/s)',
  },
  token_rate: { zh: '每秒生成的 token 数（tok/s 或 ktok/s）', en: 'an output rate in tok/s or ktok/s' },
  time: {
    zh: '时间单位（如 ns、us、ms、s）',
    en: 'a time unit (e.g. ns, us, ms, s)',
  },
}

export interface ParsedQuantity {
  rawNumber: number
  unitKey: string
  dimension: UnitDimension
  baseValue: number
}

export function parseQuantity(input: string): ParsedQuantity | null {
  const cleaned = input.trim().replace(/,/g, '')
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zA-Zμ%/]*)$/i.exec(cleaned)
  if (!match) return null
  const rawNumber = Number(match[1])
  if (!Number.isFinite(rawNumber)) return null
  const unitKey = (match[2] ?? '').trim().toLowerCase()
  const entry = UNITS[unitKey]
  if (!entry) return null
  return {
    rawNumber,
    unitKey,
    dimension: entry.dimension,
    baseValue: rawNumber * entry.factor,
  }
}

export function evaluateEstimate(
  input: string,
  spec: EstimateSpec,
): { status: CheckStatus; diagnostic: BilingualText } {
  const parsed = parseQuantity(input)
  if (!parsed) {
    return {
      status: 'failed',
      diagnostic: {
        zh: `无法解析输入“${input.trim().slice(0, 60)}”。请填写数值与单位，本题需要${DIMENSION_HINTS[spec.dimension].zh}。`,
        en: `Could not parse "${input.trim().slice(0, 60)}". Enter a number and unit; expected ${DIMENSION_HINTS[spec.dimension].en}.`,
      },
    }
  }

  if (spec.dimension !== 'scalar' && parsed.unitKey === '') {
    return {
      status: 'failed',
      diagnostic: {
        zh: `缺少单位：你输入了纯数字 ${parsed.rawNumber}，请附上${DIMENSION_HINTS[spec.dimension].zh}，避免工程算账时发生数量级混淆。`,
        en: `Missing unit: you entered bare number ${parsed.rawNumber}. Include ${DIMENSION_HINTS[spec.dimension].en} to avoid order-of-magnitude mistakes.`,
      },
    }
  }

  if (parsed.dimension !== spec.dimension) {
    return {
      status: 'failed',
      diagnostic: {
        zh: `量纲不匹配：本题需要${DIMENSION_HINTS[spec.dimension].zh}，请检查是否混淆了“总量”与“每秒速率”。`,
        en: `Dimension mismatch: expected ${DIMENSION_HINTS[spec.dimension].en}. Check whether you mixed up total volume and per-second rate.`,
      },
    }
  }

  const denom = Math.max(Math.abs(spec.expectedBase), 1e-12)
  const relError = Math.abs(parsed.baseValue - spec.expectedBase) / denom
  if (relError <= spec.relativeTolerance + 1e-9) {
    return {
      status: 'passed',
      diagnostic: {
        zh: `估算通过（相对误差 ${(relError * 100).toFixed(2)}%，标准参考值 ${spec.canonicalDisplay}）。`,
        en: `Estimate passed (relative error ${(relError * 100).toFixed(2)}%, reference ${spec.canonicalDisplay}).`,
      },
    }
  }

  const ratio = spec.expectedBase !== 0 ? parsed.baseValue / spec.expectedBase : 0
  const scaleHintZh =
    ratio > 500 && ratio < 1500
      ? '（提示：接近 1000 倍偏差，请检查单位换算或元素字节数）'
      : ratio > 0.45 && ratio < 0.55
        ? '（提示：相差约 2 倍，请检查一次乘加是否算作了 2 FLOPs，或字节数是否漏乘）'
        : ''
  const scaleHintEn =
    ratio > 500 && ratio < 1500
      ? ' (Hint: ~1000x off — check unit prefix or bytes per element)'
      : ratio > 0.45 && ratio < 0.55
        ? ' (Hint: ~2x off — check whether multiply-add counts as 2 FLOPs or element width)'
        : ''

  return {
    status: 'failed',
    diagnostic: {
      zh: `数值超出允许容差（±${Math.round(spec.relativeTolerance * 100)}%）：换算后相对偏差为 ${(relError * 100).toFixed(1)}%${scaleHintZh}。`,
      en: `Outside tolerance (±${Math.round(spec.relativeTolerance * 100)}%): relative error is ${(relError * 100).toFixed(1)}%${scaleHintEn}.`,
    },
  }
}

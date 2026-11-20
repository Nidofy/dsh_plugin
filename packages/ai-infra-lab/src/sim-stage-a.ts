/**
 * Deterministic single-source Stage A simulators shared by Browser UI and Host validation:
 * 1) IEEE-754 floating-point bit-layout inspector (fp32 / fp16 / bf16)
 * 2) Roofline performance & bottleneck analyzer
 */

export type FloatFormatId = 'fp32' | 'fp16' | 'bf16'

export interface FloatFormatSpec {
  id: FloatFormatId
  label: string
  totalBits: number
  exponentBits: number
  mantissaBits: number
  bias: number
  bytes: number
}

export const FLOAT_FORMATS: Record<FloatFormatId, FloatFormatSpec> = {
  fp32: { id: 'fp32', label: 'FP32 (float32)', totalBits: 32, exponentBits: 8, mantissaBits: 23, bias: 127, bytes: 4 },
  fp16: { id: 'fp16', label: 'FP16 (float16)', totalBits: 16, exponentBits: 5, mantissaBits: 10, bias: 15, bytes: 2 },
  bf16: { id: 'bf16', label: 'BF16 (bfloat16)', totalBits: 16, exponentBits: 8, mantissaBits: 7, bias: 127, bytes: 2 },
}

export interface DecodedFloat {
  format: FloatFormatSpec
  bits: number[] // length === totalBits, MSB (sign) at index 0
  signBit: number
  exponentRaw: number
  mantissaRaw: number
  category: 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan'
  unbiasedExponent: number
  significand: number
  value: number
  formula: string
}

export function decodeFloatBits(formatId: FloatFormatId, bits: readonly number[]): DecodedFloat {
  const spec = FLOAT_FORMATS[formatId]
  const clean = Array.from({ length: spec.totalBits }, (_, i) => (bits[i] ? 1 : 0))
  const signBit = clean[0]!
  const sign = signBit === 1 ? -1 : 1

  let exponentRaw = 0
  for (let i = 1; i <= spec.exponentBits; i++) {
    exponentRaw = (exponentRaw << 1) | clean[i]!
  }

  let mantissaRaw = 0
  for (let i = 1 + spec.exponentBits; i < spec.totalBits; i++) {
    mantissaRaw = mantissaRaw * 2 + clean[i]!
  }

  const maxExp = (1 << spec.exponentBits) - 1
  const mantissaScale = 2 ** spec.mantissaBits

  if (exponentRaw === maxExp) {
    if (mantissaRaw === 0) {
      return {
        format: spec,
        bits: clean,
        signBit,
        exponentRaw,
        mantissaRaw,
        category: 'infinity',
        unbiasedExponent: Infinity,
        significand: Infinity,
        value: sign * Infinity,
        formula: signBit ? '-Infinity (exp all 1s, mantissa = 0)' : '+Infinity (exp all 1s, mantissa = 0)',
      }
    }
    return {
      format: spec,
      bits: clean,
      signBit,
      exponentRaw,
      mantissaRaw,
      category: 'nan',
      unbiasedExponent: NaN,
      significand: NaN,
      value: NaN,
      formula: 'NaN (exp all 1s, mantissa != 0)',
    }
  }

  if (exponentRaw === 0) {
    if (mantissaRaw === 0) {
      return {
        format: spec,
        bits: clean,
        signBit,
        exponentRaw,
        mantissaRaw,
        category: 'zero',
        unbiasedExponent: 1 - spec.bias,
        significand: 0,
        value: signBit ? -0 : 0,
        formula: `${signBit ? '-' : '+'}0.0`,
      }
    }
    const unbiasedExponent = 1 - spec.bias
    const significand = mantissaRaw / mantissaScale
    const value = sign * significand * 2 ** unbiasedExponent
    return {
      format: spec,
      bits: clean,
      signBit,
      exponentRaw,
      mantissaRaw,
      category: 'subnormal',
      unbiasedExponent,
      significand,
      value,
      formula: `${signBit ? '-' : '+'} (0 + ${mantissaRaw}/${mantissaScale}) × 2^(${unbiasedExponent})`,
    }
  }

  const unbiasedExponent = exponentRaw - spec.bias
  const significand = 1 + mantissaRaw / mantissaScale
  const value = sign * significand * 2 ** unbiasedExponent
  return {
    format: spec,
    bits: clean,
    signBit,
    exponentRaw,
    mantissaRaw,
    category: 'normal',
    unbiasedExponent,
    significand,
    value,
    formula: `${signBit ? '-' : '+'} (1 + ${mantissaRaw}/${mantissaScale}) × 2^(${exponentRaw} - ${spec.bias})`,
  }
}

export function encodeNumberToBits(formatId: FloatFormatId, num: number): number[] {
  // Encode via IEEE-754 float32 first, then round/truncate for bf16 or convert for fp16
  const buf = new ArrayBuffer(4)
  const view = new DataView(buf)
  view.setFloat32(0, num, false)
  const u32 = view.getUint32(0, false)
  if (formatId === 'fp32') {
    return Array.from({ length: 32 }, (_, i) => (u32 >>> (31 - i)) & 1)
  }
  if (formatId === 'bf16') {
    // Round-to-nearest-even from float32 upper 16 bits
    const lsb = (u32 >>> 16) & 1
    const roundingBias = 0x7fff + lsb
    const rounded = Number.isNaN(num) ? 0x7fc0 : ((u32 + roundingBias) >>> 16) & 0xffff
    return Array.from({ length: 16 }, (_, i) => (rounded >>> (15 - i)) & 1)
  }
  // fp16 conversion
  const sign = (u32 >>> 31) & 1
  const exp32 = (u32 >>> 23) & 0xff
  const mant32 = u32 & 0x7fffff
  let u16 = sign << 15
  if (exp32 === 0xff) {
    u16 |= (0x1f << 10) | (mant32 ? 0x200 : 0)
  } else {
    const unbiased = exp32 - 127
    if (unbiased > 15) {
      u16 |= 0x1f << 10 // overflow to Inf
    } else if (unbiased < -24) {
      // underflow to signed zero
    } else if (unbiased < -14) {
      // subnormal fp16
      const fullMant = mant32 | 0x800000
      const shift = -14 - unbiased + 13
      u16 |= (fullMant >>> shift) & 0x3ff
    } else {
      const exp16 = unbiased + 15
      const mant16 = Math.min(0x3ff, (mant32 + 0x1000) >>> 13)
      u16 |= (exp16 << 10) | mant16
    }
  }
  return Array.from({ length: 16 }, (_, i) => (u16 >>> (15 - i)) & 1)
}

export interface RooflineModelInput {
  peakGflops: number
  peakBandwidthGBps: number
  arithmeticIntensity: number
}

export interface RooflineEvaluation {
  ridgePoint: number
  attainableGflops: number
  regime: 'memory-bound' | 'compute-bound'
  computeUtilization: number
  bandwidthUtilization: number
}

export function evaluateRoofline(input: RooflineModelInput): RooflineEvaluation {
  const peakGflops = Math.max(input.peakGflops, 0.1)
  const peakBw = Math.max(input.peakBandwidthGBps, 0.1)
  const ai = Math.max(input.arithmeticIntensity, 1e-4)
  const ridgePoint = peakGflops / peakBw
  const memCeiling = ai * peakBw
  const attainableGflops = Math.min(peakGflops, memCeiling)
  const regime = ai < ridgePoint ? 'memory-bound' : 'compute-bound'
  return {
    ridgePoint,
    attainableGflops,
    regime,
    computeUtilization: Math.min(1, attainableGflops / peakGflops),
    bandwidthUtilization: Math.min(1, attainableGflops / memCeiling),
  }
}

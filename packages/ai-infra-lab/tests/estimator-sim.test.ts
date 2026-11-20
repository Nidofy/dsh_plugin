import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateEstimate, parseQuantity } from '../src/estimator.ts'
import { decodeFloatBits, encodeNumberToBits, evaluateRoofline, FLOAT_FORMATS } from '../src/sim-stage-a.ts'

describe('estimator', () => {
  it('parses binary and decimal byte units and enforces dimension checks', () => {
    const q = parseQuantity('4 MiB')
    assert.ok(q)
    assert.equal(q.dimension, 'bytes')
    assert.equal(q.baseValue, 4 * 1024 * 1024)

    const spec = {
      dimension: 'bytes' as const,
      expectedBase: 4 * 1024 * 1024,
      canonicalDisplay: '4 MiB',
      relativeTolerance: 0.05,
    }
    assert.equal(evaluateEstimate('4 MiB', spec).status, 'passed')
    assert.equal(evaluateEstimate('4096 KiB', spec).status, 'passed')
    assert.equal(evaluateEstimate('4.19 MB', spec).status, 'passed')
    // Missing unit on non-scalar must fail clearly
    const bare = evaluateEstimate('4194304', spec)
    assert.equal(bare.status, 'failed')
    assert.match(bare.diagnostic.zh, /缺少单位/)

    // Dimension mismatch (rate vs bytes)
    const wrongDim = evaluateEstimate('4 GB/s', spec)
    assert.equal(wrongDim.status, 'failed')
    assert.match(wrongDim.diagnostic.en, /Dimension mismatch/)
  })

  it('distinguishes FLOPs count from FLOP/s throughput and supports scalar speedups', () => {
    const flopSpec = {
      dimension: 'flops' as const,
      expectedBase: 2_000_000,
      canonicalDisplay: '2 MFLOPs',
      relativeTolerance: 0.02,
    }
    assert.equal(evaluateEstimate('2 MFLOPs', flopSpec).status, 'passed')
    assert.equal(evaluateEstimate('2 GFLOP/s', flopSpec).status, 'failed')

    const speedupSpec = {
      dimension: 'scalar' as const,
      expectedBase: 2.5,
      canonicalDisplay: '2.5x',
      relativeTolerance: 0.03,
    }
    assert.equal(evaluateEstimate('2.5x', speedupSpec).status, 'passed')
    assert.equal(evaluateEstimate('2.5', speedupSpec).status, 'passed')
  })
})

describe('sim-stage-a', () => {
  it('encodes and decodes fp32, fp16, and bf16 including overflow and subnormals', () => {
    for (const fmt of ['fp32', 'fp16', 'bf16'] as const) {
      const oneBits = encodeNumberToBits(fmt, 1.0)
      assert.equal(oneBits.length, FLOAT_FORMATS[fmt].totalBits)
      const decoded = decodeFloatBits(fmt, oneBits)
      assert.equal(decoded.category, 'normal')
      assert.equal(decoded.value, 1.0)
    }

    // 70000 overflows FP16 (max 65504) to +Infinity, whereas BF16 represents it normally!
    const fp16Overflow = decodeFloatBits('fp16', encodeNumberToBits('fp16', 70000))
    assert.equal(fp16Overflow.category, 'infinity')
    assert.equal(fp16Overflow.value, Infinity)

    const bf16Ok = decodeFloatBits('bf16', encodeNumberToBits('bf16', 70000))
    assert.equal(bf16Ok.category, 'normal')
    assert.ok(Math.abs(bf16Ok.value - 70000) / 70000 < 0.01)

    // Subnormal in FP16 (exp=0, mantissa=1 -> 2^-24)
    const subBits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    const subDecoded = decodeFloatBits('fp16', subBits)
    assert.equal(subDecoded.category, 'subnormal')
    assert.equal(subDecoded.value, 2 ** -24)
  })

  it('computes Roofline ridge point and regime transitions accurately', () => {
    const memBound = evaluateRoofline({
      peakGflops: 200,
      peakBandwidthGBps: 50,
      arithmeticIntensity: 0.5,
    })
    assert.equal(memBound.ridgePoint, 4)
    assert.equal(memBound.regime, 'memory-bound')
    assert.equal(memBound.attainableGflops, 25)

    const compBound = evaluateRoofline({
      peakGflops: 200,
      peakBandwidthGBps: 50,
      arithmeticIntensity: 8,
    })
    assert.equal(compBound.regime, 'compute-bound')
    assert.equal(compBound.attainableGflops, 200)
  })
})

import { useMemo, useState } from 'react'
import {
  FLOAT_FORMATS,
  decodeFloatBits,
  encodeNumberToBits,
  type FloatFormatId,
} from '../sim-stage-a.ts'
import type { BilingualText, CheckStatus, Locale } from '../types.ts'
import { DataSourceBadge } from './DataSourceBadge.tsx'
import { pickText, tr } from './i18n.ts'

export interface BitLayoutExplorerProps {
  readonly locale: Locale
  readonly simulatorExercise?: {
    readonly goalDescription?: BilingualText
    readonly busy?: boolean
    readonly status?: CheckStatus
    readonly diagnostic?: BilingualText
    readonly onComplete: (summaryJson: string) => void
  }
}

interface PresetItem {
  readonly label: string
  readonly numericValue: number
}

const PRESETS: readonly PresetItem[] = [
  { label: '0', numericValue: 0 },
  { label: '1.0', numericValue: 1.0 },
  { label: '-0.1', numericValue: -0.1 },
  { label: '65504 (FP16 Max)', numericValue: 65504 },
  { label: '70000 (Overflow in FP16, OK in BF16)', numericValue: 70000 },
  { label: '1e-8', numericValue: 1e-8 },
]

const FORMAT_ORDER: readonly FloatFormatId[] = ['fp32', 'fp16', 'bf16']

function formatDecodedValue(val: number, signBit: number): string {
  if (Number.isNaN(val)) return 'NaN'
  if (!Number.isFinite(val)) return val > 0 ? '+Infinity' : '-Infinity'
  if (val === 0) return signBit === 1 ? '-0.0' : '+0.0'
  const abs = Math.abs(val)
  if (abs >= 1e6 || abs < 1e-4) {
    return `${val.toPrecision(8)} (${val.toExponential(6)})`
  }
  return val.toPrecision(9).replace(/\.?0+$/, '')
}

export function BitLayoutExplorer({ locale, simulatorExercise }: BitLayoutExplorerProps) {
  const [formatId, setFormatId] = useState<FloatFormatId>('fp32')
  const [numericSeed, setNumericSeed] = useState<number>(-0.1)
  const [customInput, setCustomInput] = useState<string>('-0.1')
  const [bits, setBits] = useState<number[]>(() => encodeNumberToBits('fp32', -0.1))
  const [visitedFormats, setVisitedFormats] = useState<Set<FloatFormatId>>(
    () => new Set<FloatFormatId>(['fp32']),
  )
  const [flippedCount, setFlippedCount] = useState<number>(0)
  const [inputError, setInputError] = useState<string>('')

  const spec = FLOAT_FORMATS[formatId]
  const decoded = useMemo(() => decodeFloatBits(formatId, bits), [formatId, bits])

  const crossFormatComparison = useMemo(() => {
    return FORMAT_ORDER.map((fmt) => {
      const encoded = encodeNumberToBits(fmt, numericSeed)
      const dec = decodeFloatBits(fmt, encoded)
      return { fmt, spec: FLOAT_FORMATS[fmt], dec }
    })
  }, [numericSeed])

  const switchFormat = (nextFormat: FloatFormatId) => {
    setFormatId(nextFormat)
    const nextBits = encodeNumberToBits(nextFormat, numericSeed)
    setBits(nextBits)
    setVisitedFormats((prev) => {
      if (prev.has(nextFormat)) return prev
      const next = new Set(prev)
      next.add(nextFormat)
      return next
    })
  }

  const applyNumber = (num: number, rawLabel?: string) => {
    setInputError('')
    setNumericSeed(num)
    if (rawLabel !== undefined) setCustomInput(rawLabel)
    setBits(encodeNumberToBits(formatId, num))
  }

  const handleEncodeCustom = () => {
    const trimmed = customInput.trim()
    let parsed: number
    if (/^[+-]?inf(inity)?$/i.test(trimmed)) {
      parsed = trimmed.startsWith('-') ? -Infinity : Infinity
    } else if (/^nan$/i.test(trimmed)) {
      parsed = NaN
    } else {
      parsed = Number(trimmed)
      if (trimmed === '' || Number.isNaN(parsed)) {
        setInputError(
          tr(
            locale,
            '请输入有效十进制数字、科学计数法（如 1e-8）或 Infinity / NaN',
            'Enter a valid decimal number, scientific notation (e.g. 1e-8), or Infinity / NaN',
          ),
        )
        return
      }
    }
    applyNumber(parsed)
  }

  const flipBit = (index: number) => {
    setBits((prev) => {
      const next = prev.slice()
      next[index] = next[index] ? 0 : 1
      const nextDecoded = decodeFloatBits(formatId, next)
      setNumericSeed(nextDecoded.value)
      return next
    })
    setFlippedCount((c) => c + 1)
  }

  const categoryLabel: Record<typeof decoded.category, string> = {
    normal: tr(locale, 'Normal（规格化数）', 'Normal'),
    subnormal: tr(locale, 'Subnormal（非规格化渐进下溢）', 'Subnormal'),
    zero: tr(locale, 'Zero（有符号零）', 'Signed Zero'),
    infinity: tr(locale, 'Infinity（上溢无穷大）', 'Infinity (Overflow)'),
    nan: tr(locale, 'NaN（非数值）', 'NaN (Not a Number)'),
  }

  const hasTwoFormats = visitedFormats.size >= 2
  const hasBitFlip = flippedCount >= 1
  const canCompleteSim = hasTwoFormats && hasBitFlip

  return (
    <section
      className="ail-sim-card"
      aria-label={tr(locale, 'IEEE-754 浮点比特位探测器', 'IEEE-754 Floating-Point Bit Layout Explorer')}
    >
      <div className="ail-sim-header">
        <div>
          <h3 className="ail-sim-title">
            {tr(
              locale,
              '🔬 IEEE-754 浮点位宽与精度探测器 (FP32 / FP16 / BF16)',
              '🔬 IEEE-754 Floating-Point Bit Layout Explorer',
            )}
          </h3>
          <p className="ail-sim-sub">
            {tr(
              locale,
              '点击任意比特方块直接翻转 0/1，观察阶码动态范围与尾数有效精度的硬件权衡。',
              'Click any bit cell to flip 0/1 and inspect dynamic range vs. mantissa precision.',
            )}
          </p>
        </div>
        <DataSourceBadge kind="simulated" locale={locale} />
      </div>

      {simulatorExercise?.goalDescription && (
        <div className="ail-sim-goal">
          <strong>{tr(locale, '🎯 模拟实验目标：', '🎯 Simulator Goal: ')}</strong>
          <span>{pickText(simulatorExercise.goalDescription, locale)}</span>
        </div>
      )}

      {/* Format Switcher */}
      <div className="ail-sim-toolbar">
        <div className="ail-btn-group" role="tablist" aria-label={tr(locale, '浮点格式选择', 'Floating-point format')}>
          {FORMAT_ORDER.map((fmt) => {
            const fSpec = FLOAT_FORMATS[fmt]
            const active = fmt === formatId
            return (
              <button
                key={fmt}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? 'ail-btn ail-btn-primary' : 'ail-btn'}
                onClick={() => switchFormat(fmt)}
              >
                {fSpec.label} · {fSpec.bytes}B (1+{fSpec.exponentBits}+{fSpec.mantissaBits})
              </button>
            )
          })}
        </div>
      </div>

      {/* Presets & Custom Number Input */}
      <div className="ail-sim-presets">
        <span className="ail-sim-presets-label">
          {tr(locale, '典型数值预设：', 'Presets:')}
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="ail-btn ail-btn-xs"
            onClick={() => applyNumber(preset.numericValue, String(preset.numericValue))}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="ail-sim-custom-row">
        <label className="ail-inline-label">
          <span>{tr(locale, '自定义输入数值：', 'Custom Number:')}</span>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleEncodeCustom()
              }
            }}
            placeholder="e.g. 3.14159, 65520, 1e-6"
          />
        </label>
        <button type="button" className="ail-btn ail-btn-sm" onClick={handleEncodeCustom}>
          {tr(locale, '编码到比特位', 'Encode to Bits')}
        </button>
        {inputError && <span className="ail-inline-error">{inputError}</span>}
      </div>

      {/* Bit Legend */}
      <div className="ail-bit-legend">
        <span className="ail-bit-tag ail-bit-sign">
          {tr(locale, 'Sign 符号位 (1 bit)', 'Sign (1 bit)')}
        </span>
        <span className="ail-bit-tag ail-bit-exp">
          {tr(
            locale,
            `Exponent 阶码位 (${spec.exponentBits} bits, bias=${spec.bias})`,
            `Exponent (${spec.exponentBits} bits, bias=${spec.bias})`,
          )}
        </span>
        <span className="ail-bit-tag ail-bit-mant">
          {tr(
            locale,
            `Mantissa 尾数位 (${spec.mantissaBits} bits)`,
            `Mantissa (${spec.mantissaBits} bits)`,
          )}
        </span>
      </div>

      {/* Interactive Bit Grid */}
      <div className="ail-bit-grid" role="group" aria-label={tr(locale, `${spec.label} 二进制位`, `${spec.label} bits`)}>
        {bits.map((bit, idx) => {
          const bitPos = spec.totalBits - 1 - idx
          const zone =
            idx === 0 ? 'sign' : idx <= spec.exponentBits ? 'exp' : 'mant'
          const zoneName =
            zone === 'sign'
              ? tr(locale, '符号位', 'Sign bit')
              : zone === 'exp'
                ? tr(locale, '阶码位', 'Exponent bit')
                : tr(locale, '尾数位', 'Mantissa bit')
          return (
            <button
              key={`${formatId}-${idx}`}
              type="button"
              className={`ail-bit-cell ail-bit-${zone} ${bit ? 'is-one' : 'is-zero'}`}
              aria-label={`${zoneName} b${bitPos}: ${bit}`}
              aria-pressed={bit === 1}
              onClick={() => flipBit(idx)}
            >
              <span className="ail-bit-pos">{bitPos}</span>
              <span className="ail-bit-val">{bit}</span>
            </button>
          )
        })}
      </div>

      {/* Real-time Decoded Breakdown */}
      <div className="ail-decode-grid">
        <div className="ail-decode-box">
          <small>{tr(locale, '数值分类 / Category', 'Category')}</small>
          <strong className={`ail-cat-${decoded.category}`}>
            {categoryLabel[decoded.category]}
          </strong>
        </div>
        <div className="ail-decode-box">
          <small>{tr(locale, '阶码解码 / Exponent', 'Exponent')}</small>
          <strong>
            raw = {decoded.exponentRaw}{' '}
            {Number.isFinite(decoded.unbiasedExponent)
              ? `(E = ${decoded.unbiasedExponent})`
              : '(All 1s)'}
          </strong>
        </div>
        <div className="ail-decode-box">
          <small>{tr(locale, '尾数原始整数 / Mantissa Raw', 'Mantissa Raw')}</small>
          <strong>
            {decoded.mantissaRaw} / {2 ** spec.mantissaBits}
          </strong>
        </div>
        <div className="ail-decode-box ail-decode-wide">
          <small>{tr(locale, 'IEEE-754 求值公式 / Formula', 'Evaluation Formula')}</small>
          <code className="ail-formula-code">{decoded.formula}</code>
        </div>
        <div className="ail-decode-box ail-decode-wide">
          <small>{tr(locale, '十进制解码精确值 / Decoded Decimal Value', 'Decoded Value')}</small>
          <strong className="ail-decoded-number">
            {formatDecodedValue(decoded.value, decoded.signBit)}
          </strong>
        </div>
      </div>

      {/* Side-by-side 3-format comparison */}
      <div className="ail-compare-strip">
        <div className="ail-compare-head">
          {tr(
            locale,
            '三格式同源数值编码对照（直观对比 FP16 上溢风险 vs BF16 量化步长）：',
            'Cross-format quantization & range comparison for current value:',
          )}
        </div>
        <div className="ail-compare-cards">
          {crossFormatComparison.map((item) => (
            <div
              key={item.fmt}
              className={
                item.fmt === formatId
                  ? 'ail-compare-item is-selected'
                  : 'ail-compare-item'
              }
            >
              <div className="ail-compare-item-top">
                <strong>{item.spec.id.toUpperCase()}</strong>
                <span>{item.dec.category}</span>
              </div>
              <div className="ail-compare-item-val">
                {formatDecodedValue(item.dec.value, item.dec.signBit)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulator Exercise Completion Footer */}
      {simulatorExercise && (
        <div className="ail-sim-complete-bar">
          <div className="ail-sim-checklist">
            <span className={hasTwoFormats ? 'is-done' : ''}>
              {hasTwoFormats ? '✓' : '○'}{' '}
              {tr(
                locale,
                `切换对比至少 2 种格式（已探索 ${visitedFormats.size}/2）`,
                `Compare at least 2 formats (${visitedFormats.size}/2 explored)`,
              )}
            </span>
            <span className={hasBitFlip ? 'is-done' : ''}>
              {hasBitFlip ? '✓' : '○'}{' '}
              {tr(
                locale,
                `手动翻转至少 1 个比特位（已翻转 ${flippedCount} 次）`,
                `Flip at least 1 bit (${flippedCount} flipped)`,
              )}
            </span>
          </div>

          <button
            type="button"
            className="ail-btn ail-btn-primary"
            disabled={!canCompleteSim || simulatorExercise.busy}
            onClick={() =>
              simulatorExercise.onComplete(
                JSON.stringify({
                  widget: 'bit-layout',
                  formatsVisited: Array.from(visitedFormats),
                  formatsExplored: Array.from(visitedFormats),
                  bitFlips: flippedCount,
                  activeFormat: formatId,
                  category: decoded.category,
                  value: Number.isFinite(decoded.value)
                    ? decoded.value
                    : String(decoded.value),
                }),
              )
            }
          >
            {simulatorExercise.status === 'passed'
              ? tr(locale, '✓ 已记录完成（可再次提交更新）', '✓ Completed (Update Record)')
              : tr(locale, '确认完成模拟探索', 'Confirm Simulator Exploration')}
          </button>

          {simulatorExercise.diagnostic && (
            <p
              className={
                simulatorExercise.status === 'passed'
                  ? 'ail-feedback ail-feedback-pass'
                  : 'ail-feedback ail-feedback-fail'
              }
            >
              {pickText(simulatorExercise.diagnostic, locale)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

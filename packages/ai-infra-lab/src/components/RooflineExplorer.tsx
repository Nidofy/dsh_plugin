import { useEffect, useMemo, useState } from 'react'
import { evaluateRoofline } from '../sim-stage-a.ts'
import type { BilingualText, CheckStatus, Locale, Overview } from '../types.ts'
import { DataSourceBadge } from './DataSourceBadge.tsx'
import { pickText, tr } from './i18n.ts'

export interface RooflineExplorerProps {
  readonly locale: Locale
  readonly measuredPoints?: Overview['measuredRooflinePoints']
  readonly simulatorExercise?: {
    readonly goalDescription?: BilingualText
    readonly busy?: boolean
    readonly status?: CheckStatus
    readonly diagnostic?: BilingualText
    readonly onComplete: (summaryJson: string) => void
  }
}

const AI_MIN = 0.0625
const AI_MAX = 64
const AI_TICKS = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64] as const
const PERF_MIN = 0.25
const PERF_MAX = 2048
const PERF_TICKS = [0.5, 2, 8, 32, 128, 512, 2048] as const

const SVG_W = 680
const SVG_H = 350
const PLOT_L = 62
const PLOT_R = 656
const PLOT_T = 24
const PLOT_B = 304

function xFromAi(ai: number): number {
  const clamped = Math.min(AI_MAX, Math.max(AI_MIN, ai))
  const ratio =
    (Math.log2(clamped) - Math.log2(AI_MIN)) /
    (Math.log2(AI_MAX) - Math.log2(AI_MIN))
  return PLOT_L + ratio * (PLOT_R - PLOT_L)
}

function yFromPerf(gflops: number): number {
  const clamped = Math.min(PERF_MAX, Math.max(PERF_MIN, gflops))
  const ratio =
    (Math.log2(clamped) - Math.log2(PERF_MIN)) /
    (Math.log2(PERF_MAX) - Math.log2(PERF_MIN))
  return PLOT_B - ratio * (PLOT_B - PLOT_T)
}

function formatAiTick(val: number): string {
  if (val < 1) return val.toString()
  return String(val)
}

export function RooflineExplorer({
  locale,
  measuredPoints = [],
  simulatorExercise,
}: RooflineExplorerProps) {
  const [peakGflops, setPeakGflops] = useState<number>(128)
  const [peakBandwidthGBps, setPeakBandwidthGBps] = useState<number>(32)
  // Log2 slider in [-4, 6] => [0.0625, 64]
  const [logAi, setLogAi] = useState<number>(0) // 2^0 = 1.0 FLOPs/Byte
  const arithmeticIntensity = useMemo(() => Number((2 ** logAi).toPrecision(4)), [logAi])

  const evaluation = useMemo(
    () =>
      evaluateRoofline({
        peakGflops,
        peakBandwidthGBps,
        arithmeticIntensity,
      }),
    [peakGflops, peakBandwidthGBps, arithmeticIntensity],
  )

  const [visitedRegimes, setVisitedRegimes] = useState<
    Set<'memory-bound' | 'compute-bound'>
  >(() => new Set([evaluation.regime]))

  useEffect(() => {
    setVisitedRegimes((prev) => {
      if (prev.has(evaluation.regime)) return prev
      const next = new Set(prev)
      next.add(evaluation.regime)
      return next
    })
  }, [evaluation.regime])

  // Reference operators plotted on the Roofline
  const referenceOps = useMemo(() => {
    // Vector Add FP32: 1 FLOP / (3 * 4 Bytes) ≈ 0.083 or classic FP16/mixed AI=0.17
    const vecAddAi = 0.17
    const vecAddCeiling = evaluateRoofline({
      peakGflops,
      peakBandwidthGBps,
      arithmeticIntensity: vecAddAi,
    }).attainableGflops

    // FP32 GEMM N=512: 2*512^3 / (3 * 512^2 * 4 Bytes) = 512 / 6 ≈ 85.3 -> Naive/Tiled cache block or 2*N^3/(4*4*N^2)=32, classic reference AI=42.7 (within 0.0625..64)
    const gemmAi = 42.7
    const gemmCeiling = evaluateRoofline({
      peakGflops,
      peakBandwidthGBps,
      arithmeticIntensity: gemmAi,
    }).attainableGflops

    return [
      {
        id: 'vec-add',
        label: tr(locale,'向量加法 (AI=0.17)','Vector Add (AI=0.17)'),
        ai: vecAddAi,
        gflops: vecAddCeiling * 0.85, // realistic 85% of ceiling reference marker
      },
      {
        id: 'gemm-512',
        label: 'FP32 GEMM N=512 (AI≈42.7)',
        ai: gemmAi,
        gflops: gemmCeiling * 0.88,
      },
    ]
  }, [peakGflops, peakBandwidthGBps, locale])

  // Roofline polyline coordinates
  const ridgeX = xFromAi(evaluation.ridgePoint)
  const ridgeClampedX = Math.min(PLOT_R, Math.max(PLOT_L, ridgeX))
  const leftPerf = AI_MIN * peakBandwidthGBps
  const rightPerf = peakGflops

  const roofPoints = useMemo(() => {
    const pts: string[] = []
    pts.push(`${xFromAi(AI_MIN)},${yFromPerf(Math.min(peakGflops, leftPerf))}`)
    if (evaluation.ridgePoint > AI_MIN && evaluation.ridgePoint < AI_MAX) {
      pts.push(`${xFromAi(evaluation.ridgePoint)},${yFromPerf(peakGflops)}`)
    }
    pts.push(
      `${xFromAi(AI_MAX)},${yFromPerf(Math.min(peakGflops, AI_MAX * peakBandwidthGBps))}`,
    )
    return pts.join(' ')
  }, [evaluation.ridgePoint, leftPerf, peakBandwidthGBps, peakGflops])

  const probeX = xFromAi(arithmeticIntensity)
  const probeY = yFromPerf(evaluation.attainableGflops)

  const bothRegimesExplored =
    visitedRegimes.has('memory-bound') && visitedRegimes.has('compute-bound')

  return (
    <section
      className="ail-sim-card"
      aria-label={tr(locale, 'Roofline 性能与瓶颈分析仪', 'Roofline Performance & Bottleneck Explorer')}
    >
      <div className="ail-sim-header">
        <div>
          <h3 className="ail-sim-title">
            {tr(
              locale,
              '📈 Roofline 算力天花板与瓶颈分析仪（对数坐标）',
              '📈 Log-Log Roofline Model & Bottleneck Explorer',
            )}
          </h3>
          <p className="ail-sim-sub">
            {tr(
              locale,
              '调节峰值算力、内存带宽与算术强度（FLOPs/Byte），定位算子处于访存斜坡区还是算力平顶区。',
              'Tune peak compute, memory bandwidth, and arithmetic intensity to locate memory-bound vs. compute-bound regimes.',
            )}
          </p>
        </div>
        <div className="ail-sim-badges">
          <DataSourceBadge kind="simulated" locale={locale} />
          {measuredPoints.length > 0 && (
            <DataSourceBadge kind="cpu_measured" locale={locale} />
          )}
        </div>
      </div>

      {simulatorExercise?.goalDescription && (
        <div className="ail-sim-goal">
          <strong>{tr(locale, '🎯 模拟实验目标：', '🎯 Simulator Goal: ')}</strong>
          <span>{pickText(simulatorExercise.goalDescription, locale)}</span>
        </div>
      )}

      {/* Hardware Profile Quick Presets */}
      <div className="ail-sim-presets">
        <span className="ail-sim-presets-label">
          {tr(locale, '硬件配置预设：', 'Hardware Profiles:')}
        </span>
        <button
          type="button"
          className="ail-btn ail-btn-xs"
          onClick={() => {
            setPeakGflops(64)
            setPeakBandwidthGBps(32)
          }}
        >
          {tr(locale, '单核/轻量 CPU (64 GFLOP/s · 32 GB/s)', 'Scalar/Light CPU (64 GF/s · 32 GB/s)')}
        </button>
        <button
          type="button"
          className="ail-btn ail-btn-xs"
          onClick={() => {
            setPeakGflops(256)
            setPeakBandwidthGBps(64)
          }}
        >
          {tr(locale, '多核 AVX CPU (256 GFLOP/s · 64 GB/s)', 'Multicore AVX CPU (256 GF/s · 64 GB/s)')}
        </button>
        <button
          type="button"
          className="ail-btn ail-btn-xs"
          onClick={() => {
            setPeakGflops(1024)
            setPeakBandwidthGBps(128)
          }}
        >
          {tr(locale, '高算密加速器模型 (1024 GFLOP/s · 128 GB/s)', 'High-Compute Sim (1024 GF/s · 128 GB/s)')}
        </button>
      </div>

      {/* Sliders */}
      <div className="ail-roofline-controls">
        <label className="ail-slider-item">
          <div className="ail-slider-top">
            <span>{tr(locale, '峰值算力 Peak Compute', 'Peak Compute')}</span>
            <strong>{peakGflops} GFLOP/s</strong>
          </div>
          <input
            type="range"
            min={8}
            max={1536}
            step={8}
            value={peakGflops}
            onChange={(e) => setPeakGflops(Number(e.target.value))}
          />
        </label>

        <label className="ail-slider-item">
          <div className="ail-slider-top">
            <span>{tr(locale, '峰值内存带宽 Peak Bandwidth', 'Peak Memory Bandwidth')}</span>
            <strong>{peakBandwidthGBps} GB/s</strong>
          </div>
          <input
            type="range"
            min={4}
            max={512}
            step={4}
            value={peakBandwidthGBps}
            onChange={(e) => setPeakBandwidthGBps(Number(e.target.value))}
          />
        </label>

        <label className="ail-slider-item">
          <div className="ail-slider-top">
            <span>{tr(locale, '探针算术强度 Probe AI', 'Probe Arithmetic Intensity')}</span>
            <strong>{arithmeticIntensity} FLOPs/Byte</strong>
          </div>
          <input
            type="range"
            min={-4}
            max={6}
            step={0.05}
            value={logAi}
            onChange={(e) => setLogAi(Number(e.target.value))}
          />
        </label>
      </div>

      {/* SVG Log-Log Roofline Chart */}
      <div className="ail-roofline-svg-wrap">
        <svg
          className="ail-roofline-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label={tr(
            locale,
            `Roofline 对数图：拐点 ${evaluation.ridgePoint.toFixed(2)} FLOPs/Byte，当前上限 ${evaluation.attainableGflops.toFixed(2)} GFLOP/s`,
            `Roofline log-log plot: ridge ${evaluation.ridgePoint.toFixed(2)} FLOPs/Byte, attainable ${evaluation.attainableGflops.toFixed(2)} GFLOP/s`,
          )}
        >
          {/* Shaded Memory-bound & Compute-bound Regions */}
          <rect
            x={PLOT_L}
            y={PLOT_T}
            width={Math.max(0, ridgeClampedX - PLOT_L)}
            height={PLOT_B - PLOT_T}
            className="ail-roof-zone-mem"
          />
          <rect
            x={ridgeClampedX}
            y={PLOT_T}
            width={Math.max(0, PLOT_R - ridgeClampedX)}
            height={PLOT_B - PLOT_T}
            className="ail-roof-zone-comp"
          />

          {/* Grid Lines */}
          {AI_TICKS.map((tick) => {
            const x = xFromAi(tick)
            return (
              <g key={`x-${tick}`}>
                <line x1={x} y1={PLOT_T} x2={x} y2={PLOT_B} className="ail-roof-grid" />
                <text x={x} y={PLOT_B + 16} textAnchor="middle" className="ail-roof-tick">
                  {formatAiTick(tick)}
                </text>
              </g>
            )
          })}

          {PERF_TICKS.map((tick) => {
            const y = yFromPerf(tick)
            return (
              <g key={`y-${tick}`}>
                <line x1={PLOT_L} y1={y} x2={PLOT_R} y2={y} className="ail-roof-grid" />
                <text x={PLOT_L - 8} y={y + 4} textAnchor="end" className="ail-roof-tick">
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Axes Borders */}
          <line x1={PLOT_L} y1={PLOT_B} x2={PLOT_R} y2={PLOT_B} className="ail-roof-axis" />
          <line x1={PLOT_L} y1={PLOT_T} x2={PLOT_L} y2={PLOT_B} className="ail-roof-axis" />

          {/* Region Headers */}
          {ridgeClampedX - PLOT_L > 95 && (
            <text x={PLOT_L + 10} y={PLOT_T + 18} className="ail-roof-zone-label is-mem">
              {tr(locale, '斜坡区 Memory-bound', 'Memory-bound (Bandwidth Slope)')}
            </text>
          )}
          {PLOT_R - ridgeClampedX > 95 && (
            <text x={PLOT_R - 10} y={PLOT_T + 18} textAnchor="end" className="ail-roof-zone-label is-comp">
              {tr(locale, '平顶区 Compute-bound', 'Compute-bound (Peak Ceiling)')}
            </text>
          )}

          {/* Ridge Point Vertical Dashed Line */}
          {evaluation.ridgePoint >= AI_MIN && evaluation.ridgePoint <= AI_MAX && (
            <g>
              <line
                x1={ridgeX}
                y1={yFromPerf(rightPerf)}
                x2={ridgeX}
                y2={PLOT_B}
                className="ail-roof-ridge"
              />
              <circle
                cx={ridgeX}
                cy={yFromPerf(rightPerf)}
                r={4.5}
                className="ail-roof-ridge-dot"
              />
              <text
                x={Math.min(PLOT_R - 60, Math.max(PLOT_L + 60, ridgeX))}
                y={Math.max(PLOT_T + 34, yFromPerf(rightPerf) - 8)}
                textAnchor="middle"
                className="ail-roof-ridge-text"
              >
                {tr(
                  locale,
                  `拐点 Ridge = ${evaluation.ridgePoint.toFixed(2)}`,
                  `Ridge = ${evaluation.ridgePoint.toFixed(2)}`,
                )}
              </text>
            </g>
          )}

          {/* Main Roofline Ceiling Curve */}
          <polyline points={roofPoints} className="ail-roof-curve" />

          {/* Classic Reference Kernels */}
          {referenceOps.map((op) => {
            const cx = xFromAi(op.ai)
            const cy = yFromPerf(op.gflops)
            const anchor = op.ai > 8 ? 'end' : 'start'
            const dx = op.ai > 8 ? -8 : 8
            return (
              <g key={op.id} className="ail-roof-ref">
                <rect x={cx - 4} y={cy - 4} width={8} height={8} transform={`rotate(45 ${cx} ${cy})`} />
                <text x={cx + dx} y={cy + 4} textAnchor={anchor}>
                  {op.label}
                </text>
              </g>
            )
          })}

          {/* Learner Measured CPU Points from A04 / A05 */}
          {measuredPoints.map((pt, idx) => {
            const cx = xFromAi(pt.arithmeticIntensity)
            const cy = yFromPerf(pt.gflops)
            const anchor = pt.arithmeticIntensity > 8 ? 'end' : 'start'
            const dx = pt.arithmeticIntensity > 8 ? -9 : 9
            return (
              <g key={`${pt.exerciseId}-${pt.label}-${idx}`} className="ail-roof-measured">
                <circle cx={cx} cy={cy} r={6} />
                <text x={cx + dx} y={cy - 6} textAnchor={anchor}>
                  ★ {pt.label} ({pt.gflops.toFixed(2)} GF/s)
                </text>
              </g>
            )
          })}

          {/* Active Probe Operating Point */}
          <g className="ail-roof-probe">
            <line x1={probeX} y1={probeY} x2={probeX} y2={PLOT_B} className="ail-roof-probe-drop" />
            <circle cx={probeX} cy={probeY} r={7} className="ail-roof-probe-dot" />
            <text
              x={probeX > PLOT_R - 110 ? probeX - 10 : probeX + 10}
              y={Math.max(PLOT_T + 16, probeY - 8)}
              textAnchor={probeX > PLOT_R - 110 ? 'end' : 'start'}
              className="ail-roof-probe-label"
            >
              {tr(
                locale,
                `探针上限 ${evaluation.attainableGflops.toFixed(1)} GF/s`,
                `Probe ${evaluation.attainableGflops.toFixed(1)} GF/s`,
              )}
            </text>
          </g>

          {/* Axis Titles */}
          <text
            x={(PLOT_L + PLOT_R) / 2}
            y={SVG_H - 8}
            textAnchor="middle"
            className="ail-roof-axis-title"
          >
            {tr(
              locale,
              '算术强度 Arithmetic Intensity (FLOPs / Byte, log₂ 刻度)',
              'Arithmetic Intensity (FLOPs / Byte, log₂ scale)',
            )}
          </text>
          <text
            x={16}
            y={(PLOT_T + PLOT_B) / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${(PLOT_T + PLOT_B) / 2})`}
            className="ail-roof-axis-title"
          >
            {tr(locale, '可达算力 GFLOP/s (log₂)', 'Attainable GFLOP/s (log₂)')}
          </text>
        </svg>
      </div>

      {/* Legend & Live Metrics */}
      <div className="ail-roof-legend">
        <span>
          <i className="ail-legend-swatch is-probe" />
          {tr(locale, '当前探针理论上限', 'Active Probe Ceiling')}
        </span>
        <span>
          <i className="ail-legend-swatch is-ref" />
          {tr(locale, '经典参考算子 (Vector Add / GEMM)', 'Reference Kernels (Vector Add / GEMM)')}
        </span>
        <span>
          <i className="ail-legend-swatch is-measured" />
          {tr(
            locale,
            `你的实测算子 (${measuredPoints.length} 个点，来自 A04/A05 运行记录)`,
            `Your CPU Measured Kernels (${measuredPoints.length} points from A04/A05 runs)`,
          )}
        </span>
      </div>

      <div className="ail-decode-grid">
        <div className="ail-decode-box">
          <small>{tr(locale, '当前瓶颈区间 / Regime', 'Bottleneck Regime')}</small>
          <strong
            className={
              evaluation.regime === 'memory-bound' ? 'ail-regime-mem' : 'ail-regime-comp'
            }
          >
            {evaluation.regime === 'memory-bound'
              ? tr(locale, '访存受限 Memory-bound', 'Memory-bound')
              : tr(locale, '算力受限 Compute-bound', 'Compute-bound')}
          </strong>
        </div>
        <div className="ail-decode-box">
          <small>{tr(locale, '理论可达算力上限 / Attainable', 'Attainable Ceiling')}</small>
          <strong>{evaluation.attainableGflops.toFixed(2)} GFLOP/s</strong>
        </div>
        <div className="ail-decode-box">
          <small>{tr(locale, '拐点算术强度 / Ridge Point', 'Ridge Point')}</small>
          <strong>{evaluation.ridgePoint.toFixed(2)} FLOPs/Byte</strong>
        </div>
        <div className="ail-decode-box">
          <small>{tr(locale, '峰值算力 / 带宽利用率', 'Compute / BW Utilization')}</small>
          <strong>
            {(evaluation.computeUtilization * 100).toFixed(1)}% /{' '}
            {(evaluation.bandwidthUtilization * 100).toFixed(1)}%
          </strong>
        </div>
      </div>

      {/* Simulator Exercise Completion Bar */}
      {simulatorExercise && (
        <div className="ail-sim-complete-bar">
          <div className="ail-sim-checklist">
            <span className={visitedRegimes.has('memory-bound') ? 'is-done' : ''}>
              {visitedRegimes.has('memory-bound') ? '✓' : '○'}{' '}
              {tr(
                locale,
                '探索斜坡区（Memory-bound，AI < Ridge）',
                'Explore Memory-bound slope (AI < Ridge)',
              )}
            </span>
            <span className={visitedRegimes.has('compute-bound') ? 'is-done' : ''}>
              {visitedRegimes.has('compute-bound') ? '✓' : '○'}{' '}
              {tr(
                locale,
                '探索平顶区（Compute-bound，AI ≥ Ridge）',
                'Explore Compute-bound ceiling (AI ≥ Ridge)',
              )}
            </span>
          </div>

          <button
            type="button"
            className="ail-btn ail-btn-primary"
            disabled={!bothRegimesExplored || simulatorExercise.busy}
            onClick={() =>
              simulatorExercise.onComplete(
                JSON.stringify({
                  widget: 'roofline',
                  visitedMemoryBound: visitedRegimes.has('memory-bound'),
                  visitedComputeBound: visitedRegimes.has('compute-bound'),
                  regimesVisited: Array.from(visitedRegimes),
                  peakGflops,
                  peakBandwidthGBps,
                  arithmeticIntensity,
                  ridgePoint: evaluation.ridgePoint,
                  attainableGflops: evaluation.attainableGflops,
                }),
              )
            }
          >
            {simulatorExercise.status === 'passed'
              ? tr(locale, '✓ 已记录完成（可再次提交更新）', '✓ Completed (Update Record)')
              : tr(locale, '确认完成 Roofline 探索', 'Confirm Roofline Exploration')}
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

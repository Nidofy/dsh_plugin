import type { DataSourceKind, Locale } from '../types.ts'
import { tr } from './i18n.ts'

export interface DataSourceBadgeProps {
  readonly kind: DataSourceKind
  readonly locale: Locale
  readonly showNote?: boolean
}

export function DataSourceBadge({ kind, locale, showNote = false }: DataSourceBadgeProps) {
  if (kind === 'formula') {
    const label = tr(locale, '公式估算', 'Formula Estimate')
    const tooltip = tr(
      locale,
      '基于硬件规格与张量维度的精确数学公式估算',
      'Analytical calculation from tensor shapes and hardware specs',
    )
    return (
      <span className="ail-ds-wrap">
        <span className="ail-badge ail-badge-formula" title={tooltip}>
          <span className="ail-badge-dot" aria-hidden="true" />
          {label}
        </span>
      </span>
    )
  }

  if (kind === 'cpu_measured') {
    const label = tr(locale, 'CPU 实测', 'CPU Measured')
    const note = tr(
      locale,
      '受宿主机与容器环境影响，不等同于 GPU 倍数',
      'Affected by host & container environment; not equivalent to GPU speedups',
    )
    return (
      <span className="ail-ds-wrap">
        <span className="ail-badge ail-badge-measured" title={note}>
          <span className="ail-badge-dot" aria-hidden="true" />
          {label}
        </span>
        {showNote && <span className="ail-ds-note">{note}</span>}
      </span>
    )
  }

  const label = tr(locale, '架构模拟', 'Architecture Sim')
  const tooltip = tr(
    locale,
    '确定性硬件架构与数值表示模型模拟',
    'Deterministic architecture & numerical representation model simulation',
  )
  return (
    <span className="ail-ds-wrap">
      <span className="ail-badge ail-badge-simulated" title={tooltip}>
        <span className="ail-badge-dot" aria-hidden="true" />
        {label}
      </span>
    </span>
  )
}

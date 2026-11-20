import { useState, type ReactNode } from 'react'
import type { BilingualText, CheckStatus, Locale } from '../types.ts'
import { DataSourceBadge } from './DataSourceBadge.tsx'

export interface ExplorerProps {
  locale: Locale
  simulatorExercise?: {
    goalDescription?: BilingualText
    busy?: boolean
    status?: CheckStatus
    diagnostic?: BilingualText
    onComplete(summaryJson: string): void
  }
}

export function Presets<T extends object>({ locale, value, items, onSelect }: {
  locale: Locale; value: T; items: readonly { label: BilingualText; value: T }[]; onSelect(next: T): void
}) {
  return <div className="ail-presets" role="group" aria-label={{zh:'教学预设', en:'Teaching presets'}[locale]}>
    {items.map(item => <button key={item.label.en} type="button" className="ail-btn ail-btn-sm"
      aria-pressed={Object.entries(item.value).every(([k, v]) => value[k as keyof T] === v)}
      onClick={() => onSelect(item.value)}>{item.label[locale]}</button>)}
  </div>
}

export function LegendItem({ color, children }: { color: string; children: ReactNode }) {
  return <span className="ail-legend-item"><i aria-hidden="true" style={{backgroundColor:color}}/>{children}</span>
}

export function useObservations<T>(initial: T) {
  const [observations, set] = useState<T[]>([initial])
  const select = (value: T) => set(previous =>
    [...previous.filter(v => JSON.stringify(v) !== JSON.stringify(value)).slice(-31), value])
  return { observations, input: observations[observations.length - 1]!, select }
}

export function ExplorerPanel({ locale, simulatorExercise: task, title, children, observations, complete }:
  ExplorerProps & { title: BilingualText; children: ReactNode; observations: unknown[]; complete: boolean }) {
  return <section className="ail-explorer" aria-label={title[locale]}>
    <header><h3>{title[locale]}</h3><DataSourceBadge kind="simulated" locale={locale} /></header>
    {children}
    {task && <footer>
      <p>{task.goalDescription?.[locale]}</p>
      <button className="ail-btn" disabled={!complete || task.busy}
        onClick={() => task.onComplete(JSON.stringify({ observations }))}>
        {{ zh: '提交观察记录', en: 'Submit observations' }[locale]}
      </button>
      {task.diagnostic && <p role="status">{task.diagnostic[locale]}</p>}
    </footer>}
  </section>
}

export function Choice<T extends number | string>({ label, values, value, onChange, format }:
  { label: string; values: readonly T[]; value: T; onChange(next: T): void; format?(v: T): string }) {
  return <label>{label} <select value={value} onChange={e => {
    const selected = values.find(v => String(v) === e.target.value)
    if (selected !== undefined) onChange(selected)
  }}>{values.map(v => <option key={v} value={v}>{format ? format(v) : v}</option>)}</select></label>
}

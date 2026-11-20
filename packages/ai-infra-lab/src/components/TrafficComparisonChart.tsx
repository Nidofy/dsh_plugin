import type { Locale, RunEvent } from '../types.ts'
import { LegendItem } from './ExplorerPanel.tsx'

const steps = ['naive_matmul_step', 'tiled_matmul_step'] as const
const columns = [
  ['hbm_reads_bytes', {zh:'显存读取',en:'HBM reads'}],
  ['hbm_writes_bytes', {zh:'显存写回',en:'HBM writes'}],
  ['sram_reads_bytes', {zh:'片上读取',en:'SRAM reads'}],
  ['sram_writes_bytes', {zh:'片上写入',en:'SRAM writes'}],
] as const
const series = [{zh:'朴素',en:'Naive'}, {zh:'分块',en:'Tiled'}]
const colors = ['var(--ail-measured-fg)', 'var(--ail-accent-hover)']

export function TrafficComparisonChart({ events, locale }: { events: readonly RunEvent[]; locale: Locale }) {
  const rows = columns.map(([name,label]) => ({
    label:label[locale],
    values:steps.map(step => events.find(e=>e.type==='metric' && e.name===name && e.step===step && e.unit==='B')?.value),
  }))
  const values = rows.flatMap(row => row.values.filter((n): n is number => n !== undefined))
  if (!values.length) return null
  const max = Math.max(1,...values)
  return <figure className="ail-card ail-chart ail-traffic">
    <figcaption>{{zh:'朴素与分块乘法的搬运字节',en:'Bytes moved by naive and tiled matmul'}[locale]}</figcaption>
    <p>{{zh:'容器中的模拟缓冲区按元素大小累计每次读写。上下两条分别对应朴素与分块实现，横条共用同一字节刻度。',
      en:'The simulated buffers count each read or write using the element size. The upper bar is the naive implementation and the lower bar is tiled. Every bar uses the same byte scale.'}[locale]}</p>
    <div className="ail-legend">{series.map((s,i) => <LegendItem key={s.en} color={colors[i]!}>{s[locale]}</LegendItem>)}</div>
    {rows.map(row => <div className="ail-traffic-row" key={row.label}>
      <strong>{row.label}</strong>
      {row.values.map((n,i) => <div className="ail-traffic-series" key={i}>
        <span className="ail-track"><i style={{width:(n === undefined ? 0 : 100*n/max)+'%', background:colors[i]}}/></span>
        <span aria-label={series[i]![locale]}>{n === undefined ? '—' : n.toLocaleString(locale)+' B'}</span>
      </div>)}
    </div>)}
  </figure>
}

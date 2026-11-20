import type { Locale, RunEvent } from '../types.ts'

export function DecodeTimingChart({ events, locale }: { events: RunEvent[]; locale: Locale }) {
  const get = (name: string) => events.find(e => e.type === 'metric' && e.name === name)?.value
  const samples = [12, 48, 96].flatMap(length => {
    const cached = get('cached_ms_' + length)
    const full = get('full_ms_' + length)
    return cached === undefined || full === undefined ? [] : [{ length, cached, full }]
  })
  if (!samples.length) return null
  const max = Math.max(0.001, ...samples.flatMap(p => [p.cached, p.full]))
  const x = (n: number) => 55 + 375 * n / 96
  const y = (ms: number) => 132 - 110 * ms / max
  const labels = { cached: {zh:'增量解码',en:'Incremental decode'}, full: {zh:'全前缀重算',en:'Full prefix recompute'} }
  return <figure>
    <figcaption>{{zh:'CPU 耗时随序列长度的变化（三次中位数）',en:'CPU time by sequence length (median of three runs)'}[locale]}</figcaption>
    <svg viewBox="0 0 465 175" role="img" aria-label={{zh:'增量与重算的 CPU 毫秒曲线',en:'CPU milliseconds for incremental and full decoding'}[locale]}>
      <path d="M55 15 V132 H440" fill="none" stroke="currentColor"/>
      <text x={0} y={23} fontSize={10} fill="currentColor">{max.toFixed(1)} ms</text>
      <text x={37} y={136} fontSize={10} fill="currentColor">0</text>
      {samples.map(p=><text key={p.length} x={x(p.length)} y={149} textAnchor="middle" fontSize={11} fill="currentColor">{p.length}</text>)}
      <text x={240} y={168} textAnchor="middle" fontSize={11} fill="currentColor">{{zh:'序列长 S',en:'Sequence length S'}[locale]}</text>
      {(['cached','full'] as const).map(key=><g key={key} stroke={key==='cached'?'var(--ail-accent)':'var(--ail-measured-fg)'}>
        <polyline points={samples.map(p=>x(p.length)+','+y(p[key])).join(' ')} fill="none" strokeWidth={2} strokeDasharray={key==='full'?'5 3':undefined}/>
        {samples.map(p=><circle key={p.length} cx={x(p.length)} cy={y(p[key])} r={3} fill="var(--ail-surface)">
          <title>{labels[key][locale]} · S={p.length} · {p[key].toFixed(3)} ms</title></circle>)}
      </g>)}
    </svg>
    <small>{labels.cached[locale]} (━) · {labels.full[locale]} (┄)</small>
  </figure>
}

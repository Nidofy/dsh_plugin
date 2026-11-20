import { completedWarpAccess, STRIDES, warpAccess } from '../sim-stage-b.ts'
import { Choice, ExplorerPanel, useObservations, type ExplorerProps } from './ExplorerPanel.tsx'

export function GpuCoalescingExplorer(props: ExplorerProps) {
  const { locale } = props
  const { observations, input, select } = useObservations({ stride: 1, baseOffsetElements: 0, broadcast: false })
  const result = warpAccess(input)
  return <ExplorerPanel {...props} title={{ zh: '一个 Warp 的访存轨迹', en: 'Memory accesses in one warp' }}
    observations={observations} complete={completedWarpAccess(observations)}>
    <div className="ail-controls">
      <Choice label={{ zh: '步长（元素）', en: 'Stride (elements)' }[locale]} values={STRIDES} value={input.stride}
        onChange={stride => select({ ...input, stride })} />
      <Choice label={{ zh: '起点偏移（元素）', en: 'Starting offset (elements)' }[locale]}
        values={[0, 1, 15, 31]} value={input.baseOffsetElements} onChange={baseOffsetElements => select({ ...input, baseOffsetElements })} />
      <label><input type="checkbox" checked={input.broadcast} onChange={e => select({ ...input, broadcast: e.target.checked })} />
        {{ zh: '广播同一地址', en: 'Broadcast one address' }[locale]}</label>
    </div>
    <p aria-live="polite">{result.transactionsCount} × 128 B · {result.usefulBytes} / {result.transferredBytes} B
      {' = '}{(100 * result.utilization).toFixed(1)}% · {result.maxWayConflict}{{ zh: ' 路 Bank 访问', en: '-way bank access' }[locale]}</p>
    <p>{{ zh: '每格对应一条线程通道。S 是 128 B 段号，B 是片上 Bank 编号。同一 Bank 中不同字地址越多，服务轮数越多。', en: 'Each cell is one lane. S identifies its 128 B segment and B its on-chip bank. Distinct words in the same bank need successive service rounds.' }[locale]}</p>
    <div className="ail-lane-grid">{result.lanes.map(l => <div key={l.lane} data-band={l.segment % 2}>
      <strong>#{l.lane}</strong><span>{l.address} B</span><span>S{l.segment} → B{l.bank}</span>
    </div>)}</div>
    <details><summary>{{zh:'按 Bank 查看通道分布',en:'Inspect lanes grouped by bank'}[locale]}</summary>
      <div className="ail-lane-grid">{result.bankDistribution.map(b=><div key={b.bank} data-band={b.ways>1?1:0}>
        <strong>B{b.bank}</strong><span>{b.lanes.length ? b.lanes.map(n=>'#'+n).join(' ') : '—'}</span>
        <span>{b.ways} {{zh:'个字',en:'words'}[locale]}</span>
      </div>)}</div>
    </details>
  </ExplorerPanel>
}

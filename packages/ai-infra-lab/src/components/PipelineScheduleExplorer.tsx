import { completedPipeline, pipelineSchedule, ringCost, type PipelineInput } from '../sim-stage-d.ts'
import { Choice, ExplorerPanel, useObservations, type ExplorerProps } from './ExplorerPanel.tsx'
import { useState } from 'react'

export function PipelineScheduleExplorer(props: ExplorerProps) {
  const { locale } = props
  const { input, select, observations } = useObservations<PipelineInput>({ stages: 4, microbatches: 12, schedule: 'GPipe' })
  const [bytes, setBytes] = useState(2**20)
  const r = pipelineSchedule(input)
  const net = ringCost(4, 5, 25e9, bytes)
  return <ExplorerPanel {...props} title={{ zh:'流水线与通信时间', en:'Pipeline and communication time' }}
    observations={observations} complete={completedPipeline(observations)}>
    <div className="ail-controls">
      <Choice label={{zh:'流水级数',en:'Stages'}[locale]} value={input.stages} values={[1,2,4,8]} onChange={stages=>select({...input,stages})} />
      <Choice label={{zh:'微批数',en:'Microbatches'}[locale]} value={input.microbatches} values={[1,4,8,12,16]} onChange={microbatches=>select({...input,microbatches})} />
      <Choice label={{zh:'调度',en:'Schedule'}[locale]} value={input.schedule} values={['GPipe','1F1B'] as const} onChange={schedule=>select({...input,schedule})} />
    </div>
    <p>{{zh:'每行是一级，每列一拍。F 为前向，B 为反向，数字是微批编号。空白格表示等待。',en:'Each row is a stage and each column a tick. F means forward, B backward, and the number identifies the microbatch. Empty cells are idle.'}[locale]}</p>
    <div style={{overflowX:'auto'}}><svg width={r.ticks*35+32} height={input.stages*27} role="img"
      aria-label={{zh:'逐级前反向调度',en:'Forward and backward schedule by stage'}[locale]}>
      {r.peaks.map((_,i)=><text key={i} x={1} y={i*27+16} fill="currentColor">P{i}</text>)}
      {r.slots.map(s=><g key={s.stage+'-'+s.tick} transform={`translate(${32+s.tick*35} ${s.stage*27})`}>
        <rect width={34} height={24} rx={2} fill={s.phase==='F'?'var(--ail-accent-soft)':'var(--ail-sim-bg)'} />
        <text x={3} y={17} fill="currentColor" fontSize={12}>{s.phase}{s.microbatch}</text>
      </g>)}
    </svg></div>
    <p>{{zh:'设备空闲拍数',en:'Idle device-ticks'}[locale]} {r.idleTicks} · {{zh:'气泡',en:'Bubble'}[locale]} {(100*r.bubble).toFixed(1)}% ·
      {' '}{{zh:'各级激活峰值（微批份数）',en:'Peak live microbatches per stage'}[locale]} {r.peaks.join(' / ')}</p>
    <Choice<number> label={{zh:'四进程 Ring 消息字节数',en:'Four-rank ring message (bytes)'}[locale]} value={bytes} values={[1024,2**20,2**26]} onChange={setBytes} />
    <p>{net.rounds} {{zh:'轮，每轮启动 5 μs，链路 25 GB/s。总耗时',en:'rounds, 5 μs startup each, 25 GB/s link. Elapsed'}[locale]} {(net.elapsedSeconds*1e6).toFixed(2)} μs ·
      {' '}{{zh:'路线图归一化值（总耗时除以进程数）',en:'Normalized cost (elapsed divided by ranks)'}[locale]} {(net.normalizedSeconds*1e6).toFixed(2)} μs</p>
  </ExplorerPanel>
}

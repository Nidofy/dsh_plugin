import { completedMemoryLedger, trainingExample, trainingLedger, type TrainingConfig } from '../sim-stage-c.ts'
import { Choice, ExplorerPanel, LegendItem, Presets, useObservations, type ExplorerProps } from './ExplorerPanel.tsx'

export function MemoryWaterfallExplorer(props: ExplorerProps) {
  const { locale } = props
  const { input, select, observations } = useObservations(trainingExample)
  const update = (patch: Partial<TrainingConfig>) => select({ ...input, ...patch })
  const r = trainingLedger(input)
  const colors = ['var(--ail-accent)','var(--ail-measured-fg)','var(--ail-sign-fg)','var(--ail-sim-fg)','var(--ail-formula-fg)']
  const parts = [
    [{ zh: '参数', en: 'Weights' }, r.parameters], [{ zh: '梯度', en: 'Gradients' }, r.gradients],
    [{ zh: '主权重', en: 'Master weights' }, r.master], [{ zh: '优化器矩', en: 'Moments' }, r.moments],
    [{ zh: '激活', en: 'Activations' }, r.activations],
  ] as const
  return <ExplorerPanel {...props} title={{ zh: '训练一步的显存账本', en: 'Memory for one training step' }}
    observations={observations} complete={completedMemoryLedger(observations)}>
    <Presets<typeof input> locale={locale} value={input} onSelect={select} items={[
      { label: {zh:'7B 混合精度基线', en:'7B mixed baseline'}, value: { ...trainingExample, parameters:7e9, layers:32, hidden:4096 } },
      { label: {zh:'8K 长序列', en:'8K context'}, value: { ...trainingExample, parameters:7e9, layers:32, hidden:4096, sequence:8192 } },
      { label: {zh:'8K 激活重算', en:'8K with checkpointing'}, value: { ...trainingExample, parameters:7e9, layers:32, hidden:4096, sequence:8192, checkpoint:true } },
    ]}/>
    <div className="ail-controls">
      <Choice label={{zh:'参数量',en:'Parameters'}[locale]} values={[0,1e9,7e9,13e9]} value={input.parameters}
        format={n => n ? n/1e9+' B' : {zh:'按层推算',en:'From layers'}[locale]} onChange={parameters => update({parameters})} />
      <Choice label={{zh:'层数',en:'Layers'}[locale]} values={[4,12,32]} value={input.layers} onChange={layers=>update({layers})} />
      <Choice label={{zh:'隐藏宽度',en:'Hidden width'}[locale]} values={[256,768,4096]} value={input.hidden} onChange={hidden=>update({hidden})} />
      <Choice label={{zh:'词表',en:'Vocabulary'}[locale]} values={[32000,64000]} value={input.vocabulary} onChange={vocabulary=>update({vocabulary})} />
      <Choice label={{zh:'序列长',en:'Sequence'}[locale]} values={[128,512,2048,8192]} value={input.sequence} onChange={sequence=>update({sequence})} />
      <Choice label={{zh:'微批大小',en:'Microbatch'}[locale]} values={[1,2,8,32]} value={input.batch} onChange={batch=>update({batch})} />
      <Choice label={{zh:'精度',en:'Precision'}[locale]} values={['fp32','mixed-bf16-fp32-master'] as const}
        format={v=>v==='fp32'?'FP32':{zh:'BF16 计算，FP32 主权重',en:'BF16 compute, FP32 master weights'}[locale]}
        value={input.precision} onChange={precision=>update({precision})} />
      <Choice label={{zh:'优化器',en:'Optimizer'}[locale]} values={['SGD','AdamW'] as const} value={input.optimizer} onChange={optimizer=>update({optimizer})} />
      <label><input type="checkbox" checked={input.fp32Gradients} onChange={e=>update({fp32Gradients:e.target.checked})} />FP32 {{zh:'梯度',en:'gradients'}[locale]}</label>
      <label><input type="checkbox" checked={input.checkpoint} onChange={e=>update({checkpoint:e.target.checked})} />{{zh:'重算激活',en:'Recompute activations'}[locale]}</label>
    </div>
    <p>{r.p.toLocaleString(locale)} {{zh:'个参数',en:'parameters'}[locale]} · {(r.totalBytes/2**30).toFixed(3)} GiB · {(r.stepFlops/1e12).toFixed(3)} TFLOPs</p>
    <div className="ail-memory-stack" aria-hidden="true">{parts.map(([name, bytes],i) =>
      <span key={name.en} style={{width: (100*bytes/r.totalBytes)+'%', background: colors[i]}} />)}</div>
    <dl className="ail-memory-legend">{parts.map(([name,bytes],i)=><div key={name.en}>
      <dt><LegendItem color={colors[i]!}>{name[locale]}</LegendItem></dt>
      <dd>{bytes.toLocaleString(locale)} B · {(100*bytes/r.totalBytes).toFixed(1)}%</dd></div>)}</dl>
    <p>{{zh:'每层计四个隐藏向量；重计算只保留每层输入。假设普通 SGD 无动量，AdamW 保存两个 FP32 矩。',en:'Each layer saves four hidden-width tensors, or just its input with checkpointing. SGD has no momentum and AdamW stores two FP32 moments.'}[locale]}</p>
  </ExplorerPanel>
}

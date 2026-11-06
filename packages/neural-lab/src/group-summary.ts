import type { ExperimentGroup, RunRecord } from './types.ts'
/** Descriptive summaries within each learning rate; failed/missing measurements are never zero-filled. */
export function groupSummary(group: ExperimentGroup, runs: RunRecord[]) {
  return [...new Set(group.items.map(i=>i.learningRate))].map(learningRate=> {
    const items=group.items.filter(i=>i.learningRate===learningRate)
    const values:number[]=[]
    let failed=0,cancelled=0,missing=0
    for(const item of items) {
      const run=runs.find(r=>r.id===item.runId && r.groupId===group.id && r.codeHash===group.codeHash && r.resolvedImageId===group.imageId)
      if(['cancelled','timed_out','interrupted'].includes(item.status)) cancelled++
      if(item.status==='failed'||run?.check_status==='failed') failed++
      const event=run?.events.filter(e=>e.type==='metric'&&e.name==='validation_loss'&&e.source==='program').at(-1)
      if(run?.run_status==='completed'&&run.check_status==='passed'&&Number.isFinite(event?.value)) values.push(event!.value!)
      else missing++
    }
    const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined
    const sampleStd=values.length>1?Math.sqrt(values.reduce((sum,v)=>sum+(v-mean!)**2,0)/(values.length-1)):undefined
    return {learningRate,n:values.length,total:items.length,mean,sampleStd,failed,cancelled,missing}
  })
}

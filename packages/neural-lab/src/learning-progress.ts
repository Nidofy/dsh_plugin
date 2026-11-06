import type { Evidence, Exercise } from './types.ts'
export function learningDimensions(exercise:Exercise, contentVersion:string, evidence:Evidence[]) {
 const own=evidence.filter(e=>e.exerciseId===exercise.id)
 const current=own.filter(e=>e.contentVersion===contentVersion && e.testVersion===exercise.testVersion)
 const kinds=['implementation','explanation','transfer','debugging','observation'] as const
 return kinds.map(kind=>{
  const rows=current.filter(e=>e.kind===kind)
  return {kind,records:rows.length,programPassed:rows.some(e=>e.source==='program'&&e.result==='passed'),
    learnerRecorded:rows.some(e=>e.source==='learner'),last:rows.at(-1),legacy:own.filter(e=>e.kind===kind&&!current.includes(e)).length}
 })
}
export function reviewRule(exercise:Exercise,result:string,source:'program'|'learner',help:string) {
 if(result==='failed')return {id:'repair-check',text:'定位最早失败检查，再修复并重跑 / Locate earliest failed check and rerun',delay:0}
 if(source==='program')return {id:exercise.mode==='observe'?'explain-observation':'explain-implementation',text:'解释该运行的预测与程序证据 / Explain this run and prediction',delay:0}
 if(help!=='none')return {id:'independent-transfer',text:'解释包含帮助：重新开始自述独立迁移 / Assisted explanation: attempt an independent transfer',delay:86400000}
 return {id:'delayed-recall',text:'次日不看代码解释同一运行与变式 / Recall this run and variation tomorrow',delay:86400000}
}

export function trainingDataset(key?: string): string | undefined {
  if (key === 'train-mlp-multi-v1') return 'quadratic-2d-multi-v1'
  if (['project-char-flex-v1', 'project-char-two-v1', 'project-char-observe-v1'].includes(key ?? '')) return 'tiny-char-v2'
  if (key === 'project-char-v1' || key === 'project-char-wide-v1') return 'tiny-char-v1'
  if (key === 'project-signal-v1') return 'damped-signal-v1'
  if (key === 'train-mlp-v1') return 'quadratic-2d-v1'
  if (key === 'train-char-v1') return 'tiny-char-v1'
}

export interface TrainingConfigRule { min?:number; max?:number; integer?:boolean; values?:number[] }
/** Shared Host validation and tutor executable-action contract. */
export function allowedTrainingConfig(key?:string):Record<string,TrainingConfigRule> {
 const rules:Record<string,TrainingConfigRule>={seed:{min:0,max:10000,integer:true}}
 if(trainingDataset(key))rules.learningRate={min:.001,max:.3}
 if(['project-char-flex-v1','project-char-two-v1','project-char-observe-v1'].includes(key??'')) {
  rules.batchSize={min:1,max:4,integer:true}
  rules.context={min:2,max:8,integer:true}
  rules.heads={values:[1,2,3,6],integer:true}
  if(key==='project-char-observe-v1')rules.steps={min:8,max:24,integer:true}
 }
 return rules
}
export function validateTrainingConfig(key: string | undefined, config: Record<string, number>): void {
 const rules=allowedTrainingConfig(key)
 for(const [name,value] of Object.entries(config)) {
  if(!Number.isFinite(value))throw Error('Nonfinite configuration')
  const rule=Object.hasOwn(rules,name)?rules[name]:undefined
  if(!rule || (rule.integer&&!Number.isInteger(value)) || (rule.min!==undefined&&value<rule.min) ||
    (rule.max!==undefined&&value>rule.max) || (rule.values&&!rule.values.includes(value)))
    throw Error('Invalid experiment configuration: '+name)
 }
}

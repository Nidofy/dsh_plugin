import type { LabApi } from './types.ts'
export function createApi(): LabApi {
  async function call<T>(method:string,args:unknown[]=[]):Promise<T> {
    const response=await fetch('/api/neural-lab/rpc',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({method,args})})
    const value:unknown=await response.json()
    if(!response.ok) throw new Error(typeof value==='object'&&value!==null&&'error' in value?String(value.error):`HTTP ${response.status}`)
    return value as T
  }
  return { selectLesson:(...a)=>call('selectLesson',a), independent:(...a)=>call('independent',a), overview:()=>call('overview'),workspace:(...a)=>call('workspace',a),saveDraft:(...a)=>call('saveDraft',a),saveNote:(...a)=>call('saveNote',a),readLesson:(...a)=>call('readLesson',a),saveProfile:(...a)=>call('saveProfile',a),start:(...a)=>call('start',a),run:(...a)=>call('run',a),cancel:(...a)=>call('cancel',a),answer:(...a)=>call('answer',a),hint:(...a)=>call('hint',a),tutor:(...a)=>call('tutor',a),environment:()=>call('environment'),exportData:()=>call('exportData'),snooze:(...a)=>call('snooze',a) }
}

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { acquireOwner } from './owner.ts'
import { Store } from './store.ts'
import { Runner,type RunnerLimits } from './runner.ts'
import { loadCatalog } from './catalog.ts'
import type { Catalog, Exercise, HelpLevel, Overview, RunRecord, Workspace, CheckStatus } from './types.ts'
export class Engine {
  private active=new Map<string,{abort:AbortController;done:Promise<void>}>()
  private closing=false
  constructor(readonly catalog:Catalog,readonly store:Store,readonly runner:Runner,private releaseOwner:()=>Promise<void>=async()=>{}){}
  static async open(root:string,image?:string,limits?:RunnerLimits):Promise<Engine> {await mkdir(root,{recursive:true});const release=await acquireOwner(join(root,'owner.sqlite'));try{return new Engine(await loadCatalog(),new Store(join(root,'neural-lab.sqlite')),new Runner(join(root,'runs'),image,limits),release)}catch(error){await release();throw error}}
  exercise(id:string):Exercise {const e=this.catalog.lessons.flatMap(l=>l.exercises).find(e=>e.id===id);if(!e)throw Error('Unknown exercise');return e}
  text(value:string,max=100000):void {if(typeof value!=='string'||value.length>max)throw Error('Invalid or oversized text')}
  overview():Overview {return {catalog:{...this.catalog,lessons:this.catalog.lessons.map(l=>({...l,exercises:l.exercises.map(e=>({...e,reference:"",answer:undefined}))}))},currentLesson:this.store.get('currentLesson',this.catalog.lessons[0]?.id??''),readLessons:this.store.get('readLessons',[]),profile:this.store.get('profile',{}),reviews:this.store.get('reviews',[]),evidence:this.store.evidence()}}
  workspace(id:string):Workspace {const exercise=this.exercise(id),draft=this.store.draft(id);return {exercise:{...exercise,reference:"",answer:undefined},draft:draft?.code??exercise.starter,revision:draft?.revision??0,note:this.store.draft('note:'+id)?.code??'',noteRevision:this.store.draft('note:'+id)?.revision??0,runs:this.store.runs(id),hints:this.store.history(id,'hint'),messages:this.store.history(id,'message'),answers:this.store.history(id,'answer'),snapshots:this.store.history(id,'attempt-snapshot')}}
  saveDraft(id:string,code:string,revision:number):number {this.exercise(id);this.text(code);if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid draft revision');return this.store.saveDraft(id,code,revision)}
  saveNote(id:string,note:string,revision:number):number {this.exercise(id);this.text(note);return this.store.saveDraft('note:'+id,note,revision)}
  readLesson(id:string):void {if(!this.catalog.lessons.some(l=>l.id===id))throw Error('Unknown lesson');this.store.set('currentLesson',id);this.store.set('readLessons',[...new Set([...this.store.get<string[]>('readLessons',[]),id])])}
  saveProfile(profile:Record<string,string>):void {const valid:Record<string,string>={};for(const [key,value] of Object.entries(profile)){if(!['background','goal','difficulties','explanations'].includes(key))throw Error('Unknown profile field');this.text(value,3000);valid[key]=value}this.store.set('profile',valid)}
  start(id:string,code:string,config:Record<string,number>):RunRecord {
    if(this.closing)throw Error('Plugin is stopping');if(this.active.size>=2)throw Error('Two runs are already active')
    const exercise=this.exercise(id);this.text(code);if(!['code','experiment'].includes(exercise.kind))throw Error('This activity accepts a written answer')
    for(const [key,v] of Object.entries(config))if(!['seed','learningRate','steps'].includes(key)||!Number.isFinite(v)||v<0||v>10000)throw Error('Invalid experiment configuration')
    if(config.learningRate!==undefined&&(config.learningRate<.0001||config.learningRate>1))throw Error('Learning rate must be .0001..1');if(config.seed!==undefined&&!Number.isSafeInteger(config.seed))throw Error('Seed must be an integer');if(config.steps!==undefined&&(!Number.isSafeInteger(config.steps)||config.steps<1||config.steps>200))throw Error('Steps must be an integer in 1..200')
    const run:RunRecord={id:randomUUID(),exerciseId:id,code,contentVersion:this.catalog.version,testVersion:exercise.testVersion,seed:config.seed??42,config,environment:'pending environment inspection',run_status:'queued',check_status:'not_run',createdAt:new Date().toISOString(),events:[],log:'',help:this.store.help(id)}
    this.store.putRun(run);const abort=new AbortController()
    const done=Promise.resolve().then(async()=>{try{const result=await this.runner.execute(run,exercise,abort.signal,r=>this.store.putRun(r));this.store.putRun(result);if(result.check_status==='passed'||result.check_status==='failed')this.recordEvidence(exercise,result.check_status,result.help,'program')}catch(error){this.store.putRun({...this.store.run(run.id),run_status:abort.signal.aborted?'cancelled':'failed',check_status:'inconclusive',reason:String(error),finishedAt:new Date().toISOString()})}finally{this.active.delete(run.id)}})
    this.active.set(run.id,{abort,done});return run
  }
  run(id:string):RunRecord {return this.store.run(id)}
  cancel(id:string):void {this.store.run(id);this.active.get(id)?.abort.abort()}
  answer(id:string,text:string):CheckStatus {const e=this.exercise(id);this.text(text,12000);if(!['numeric','explanation'].includes(e.kind))throw Error('Use the code runner');const status=e.kind==='explanation'?'inconclusive':this.matchesAnswer(text,e.answer)?'passed':'failed';this.store.record(id,'answer',{text,status,contentVersion:this.catalog.version,testVersion:e.testVersion});this.recordEvidence(e,status,this.store.help(id),e.kind==='explanation'?'learner':'program');return status}
  matchesAnswer(text:string,expected?:string):boolean {if(expected===undefined)return false;const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;if(numeric.test(expected.trim())){if(!numeric.test(text.trim()))return false;const a=Number(text),b=Number(expected);return Number.isFinite(a)&&Math.abs(a-b)<=1e-8+1e-6*Math.abs(b)}return text.trim().replace(/\s+/g,'')===expected.trim().replace(/\s+/g,'')}
  recordEvidence(e:Exercise,result:string,help:HelpLevel,source:'program'|'learner'):void {for(const concept of e.concepts)this.store.record(e.id,'evidence',{exerciseId:e.id,concept,kind:e.evidenceKind??(['numeric','explanation'].includes(e.kind)?'explanation':'implementation'),source,help,result,at:new Date().toISOString()});const reviews=this.store.get<Overview['reviews']>('reviews',[]).filter(r=>r.exerciseId!==e.id);if(result!=='passed'||help!=='none')reviews.push({exerciseId:e.id,reason:help==='answer'?'请独立完成变式 / Retry independently':result==='failed'?'检查失败 / Failed checks':'解释或独立迁移仍需证据 / More evidence needed',due:new Date().toISOString()});this.store.set('reviews',reviews)}
  hint(id:string,level:HelpLevel):string {const e=this.exercise(id);const ix=['concept','steps','code','answer'].indexOf(level);if(ix<0)throw Error('Invalid hint level');if(level==='answer')this.snapshotAttempt(id,'answer-reveal');this.store.record(id,'hint',level);return level==='answer'?e.reference:e.hints[ix]??e.hints[0]??'请重读输入域 / Review the input domain'}
  snapshotAttempt(id:string,reason:string):void {const e=this.exercise(id),draft=this.store.draft(id);this.store.record(id,'attempt-snapshot',{code:draft?.code??e.starter,revision:draft?.revision??0,reason,contentVersion:this.catalog.version,testVersion:e.testVersion,at:new Date().toISOString()})}
  snooze(id:string):void {this.exercise(id);this.store.set('reviews',this.store.get<Overview['reviews']>('reviews',[]).map(r=>r.exerciseId===id?{...r,due:new Date(Date.now()+86400000).toISOString()}:r))}
  async close():Promise<void> {this.closing=true;for(const task of this.active.values())task.abort.abort();await Promise.allSettled([...this.active.values()].map(t=>t.done));this.store.close();await this.releaseOwner()}
}

import { randomUUID, createHash } from 'node:crypto'
import { trainingDataset, validateTrainingConfig } from './training-protocol.ts'
import type { Engine } from './engine.ts'
import type { ExperimentGroup, GroupRequest } from './types.ts'

/** Same SQLite owner; never resumes uncertain work after process restart. */
export class ExperimentGroups {
  private active = new Map<string, { stop: AbortController; done: Promise<void> }>()
  constructor(private engine: Engine) {
    for (const id of this.ids()) {
      const g = this.get(id)
      if (['queued', 'running'].includes(g.status)) {
        g.status = 'interrupted'
        g.finishedAt = new Date().toISOString()
        for (const item of g.items) if (['queued','running'].includes(item.status)) {
          item.status = 'interrupted'; item.reason = 'Process restarted; no automatic replay'
        }
        this.put(g)
      }
    }
  }
  private ids(): string[] { return this.engine.store.get('experiment-group-ids', []) }
  get(id: string): ExperimentGroup {
    if (!this.ids().includes(id)) throw Error('Unknown experiment group')
    const value = this.engine.store.get<ExperimentGroup | null>('experiment-group:' + id, null)
    if (!value) throw Error('Missing experiment group')
    return value
  }
  list(exerciseId: string): ExperimentGroup[] {
    this.engine.exercise(exerciseId)
    return this.ids().map(id => this.get(id)).filter(g => g.exerciseId === exerciseId).reverse()
  }
  private put(g: ExperimentGroup): void {
    g.revision++
    this.engine.store.set('experiment-group:' + g.id, g)
  }
  async start(exerciseId: string, code: string, request: GroupRequest): Promise<ExperimentGroup> {
    const e = this.engine.exercise(exerciseId)
    const dataset = trainingDataset(e.runtimeKey)
    if (!dataset || this.active.size) throw Error('Only one training group may execute at a time')
    if (this.ids().length >= 20) throw Error('Experiment group archive full; export and back up first')
    this.engine.text(code)
    if (!request || typeof request !== 'object') throw Error('Invalid group request')
    this.engine.text(request.hypothesis, 2000)
    if (!request.hypothesis.trim() || !Array.isArray(request.seeds) || !Array.isArray(request.learningRates) ||
      request.seeds.length < 1 || request.learningRates.length < 1 || request.seeds.length * request.learningRates.length > 6 ||
      new Set(request.seeds).size !== request.seeds.length || new Set(request.learningRates).size !== request.learningRates.length ||
      !Number.isInteger(request.budgetMs) || request.budgetMs < 1000 || request.budgetMs > 600000)
      throw Error('Group requires 1–6 unique seed/rate pairs and a 1–600 second total budget')
    const startedAt = Date.now()
    const attemptId = this.engine.workspace(exerciseId).attemptId
    const help = this.engine.store.help(exerciseId)
    const config = request.config ?? {}
    if (typeof config !== 'object' || Array.isArray(config) || config === null || 'seed' in config || 'learningRate' in config)
      throw Error('Group configuration cannot override seed/rate grid')
    const items: ExperimentGroup['items'] = []
    for (const learningRate of request.learningRates) for (const seed of request.seeds) {
      const frozen = { ...config, seed, learningRate }
      validateTrainingConfig(e.runtimeKey, frozen)
      items.push({runId: randomUUID(), seed, learningRate, config: frozen, status:'queued'})
    }
    // Reserve before asynchronous environment inspection so concurrent calls cannot race.
    const stop = new AbortController()
    const id = randomUUID()
    let prepared!: () => void
    const preparation = new Promise<void>(resolve => {prepared = resolve})
    this.active.set(id, {stop, done: preparation})
    try {
      const env = await this.engine.runner.environment()
      if (!env.available || !env.resolvedImageId) throw Error(env.detail)
      if (Date.now() - startedAt >= request.budgetMs) throw Error('Group total budget exhausted during environment inspection')
      if (stop.signal.aborted) throw Error('Group cancelled during environment inspection')
      const g: ExperimentGroup = {id,revision:0,exerciseId,code,codeHash:createHash('sha256').update(code).digest('hex'),
        contentVersion:this.engine.catalog.version,testVersion:e.testVersion,attemptId,
        help,imageId:env.resolvedImageId,dataset,hypothesis:request.hypothesis.trim(),
        conclusion:'',limitations:'',createdAt:new Date(startedAt).toISOString(),status:'queued',budgetMs:request.budgetMs,items}
      this.engine.store.transaction(()=> {this.engine.store.set('experiment-group-ids',[...this.ids(),id]);this.put(g)})
      const done = this.execute(g, stop).finally(()=>this.active.delete(id))
      this.active.set(id,{stop,done})
      void done.catch(()=>{})
      return this.get(id)
    } catch(error) {this.active.delete(id);throw error} finally {prepared()}
  }
  private async execute(g: ExperimentGroup, stop: AbortController): Promise<void> {
    let expired = false
    const timer = setTimeout(()=> {expired=true;stop.abort()},Math.max(1, g.budgetMs - (Date.now() - Date.parse(g.createdAt))))
    g.status='running';this.put(g)
    try {
      for (const item of g.items) {
        if(stop.signal.aborted) break
        try {
          if(this.engine.catalog.version !== g.contentVersion || this.engine.exercise(g.exerciseId).testVersion !== g.testVersion)
            throw Error('Frozen course contract changed')
          const run = this.engine.start(g.exerciseId,g.code,item.config,g.hypothesis,undefined,{
            id:item.runId,attemptId:g.attemptId,help:g.help,groupId:g.id,expectedImageId:g.imageId})
          item.status='running';this.put(g)
          const abort = ()=>this.engine.cancel(run.id)
          stop.signal.addEventListener('abort',abort,{once:true})
          if(stop.signal.aborted) abort()
          try {await this.engine.waitRun(run.id)} finally {stop.signal.removeEventListener('abort',abort)}
          const result=this.engine.run(run.id)
          item.status=result.check_status === 'failed' ? 'failed' : result.run_status;item.reason=result.reason ?? (result.check_status === 'failed' ? 'Program checks failed' : undefined)
          this.put(g)
          if(result.reason?.includes('Frozen image')) {g.status='failed';break}
        } catch(error) {item.status='failed';item.reason=String(error);this.put(g)}
      }
      if(stop.signal.aborted) g.status=expired?'timed_out':'cancelled'
      else if(g.status !== 'failed') g.status=g.items.some(i=>i.status!=='completed')?'failed':'completed'
    } finally {
      clearTimeout(timer)
      for(const item of g.items) if(item.status==='queued') {item.status='cancelled';item.reason='Group ended before execution'}
      g.finishedAt=new Date().toISOString();this.put(g)
    }
  }
  async cancel(id:string):Promise<void> {
    this.get(id)
    const active=this.active.get(id)
    active?.stop.abort()
    await active?.done
  }
  conclude(id:string,revision:number,conclusion:string,limitations:string):ExperimentGroup {
    this.engine.text(conclusion,4000);this.engine.text(limitations,4000)
    if(!conclusion.trim()||!limitations.trim()) throw Error('Record a conclusion and its limitations')
    const g=this.get(id)
    if(['queued','running'].includes(g.status)||g.revision!==revision) throw Error('Group is active or revision changed')
    g.conclusion=conclusion;g.limitations=limitations;this.put(g)
    this.engine.store.record(g.exerciseId,'group-reflection',{groupId:id,attemptId:g.attemptId,source:'learner',conclusion,limitations,runIds:g.items.map(i=>i.runId),contentVersion:g.contentVersion,testVersion:g.testVersion})
    return g
  }
  async close():Promise<void> {
    const active=[...this.active.values()]
    for(const item of active) item.stop.abort()
    await Promise.allSettled(active.map(i=>i.done))
  }
}


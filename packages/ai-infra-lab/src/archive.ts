import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { validateRunEvent } from './runner.ts'
import type { Store } from './store.ts'
import type { AnswerRecord, Catalog, Evidence, Exercise, RunEvent, RunRecord } from './types.ts'

function requireField(ok: unknown, field: string): asserts ok {
  if (!ok) throw Error('归档内容无效 / Invalid archive field: ' + field)
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function onlyFields(v: Record<string,unknown>, names: string) {
  const allowed = new Set(names.split(' '))
  requireField(Object.keys(v).every(k=>allowed.has(k)),'unexpected field')
}
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const id = (v: unknown): v is string => typeof v === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const stamp = (v: unknown) => string(v,32) && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v))
const oneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v)
const helpLevels = ['unknown','none','concept','steps','code','answer']
const bilingual = (v: unknown) => object(v) && string(v.zh,4000) && !!v.zh && string(v.en,4000) && !!v.en
const versions = ['0.1.0','0.2.0','0.3.0','0.4.0','0.5.0']
function released(v: unknown, lesson: string, ceiling: string) {
  return typeof v === 'string' && versions.includes(v) && versions.indexOf(v) <= versions.indexOf(ceiling) &&
    versions.indexOf(v) >= 'ABCDE'.indexOf(lesson[0] === 'X' ? 'E' : lesson[0]!)
}
function rows(v: unknown, max: number, field: string): unknown[] {
  requireField(Array.isArray(v) && v.length <= max,field)
  return v
}
function identity(v: unknown): Record<string, unknown> & {id:string; exerciseId:string} {
  requireField(object(v) && id(v.id) && string(v.exerciseId,80),'identity')
  return v as Record<string, unknown> & {id:string; exerciseId:string}
}

function checkRun(v: unknown, exercises: Map<string,Exercise>, version: string): RunRecord {
  const r = identity(v)
  onlyFields(r,'id exerciseId code codeHash dataSource resourceProfile prediction contentVersion testVersion seed config requestedImage resolvedImageId cleanupPending attemptId environment run_status check_status createdAt finishedAt events log reason help')
  const ex = exercises.get(r.exerciseId)
  requireField(ex?.kind==='code' && released(r.contentVersion,ex.lessonId,version) && r.testVersion===ex.testVersion,'run.exercise')
  requireField(string(r.code,100000) && createHash('sha256').update(r.code).digest('hex')===r.codeHash,'run.codeHash')
  requireField(r.dataSource===ex.dataSource && r.resourceProfile===(ex.resourceProfile??'scalar-cpu'),'run.profile')
  requireField(oneOf(r.run_status,['completed','failed','cancelled','timed_out','interrupted']) && r.cleanupPending===undefined,'run.lifecycle')
  requireField(oneOf(r.check_status,['not_run','passed','failed','inconclusive','not_applicable']) &&
    string(r.attemptId,120) && !!r.attemptId && oneOf(r.help,helpLevels),'run.result')
  requireField(stamp(r.createdAt) && (r.finishedAt===undefined || stamp(r.finishedAt)) && string(r.log,4194304) &&
    string(r.environment,4000) && Number.isSafeInteger(r.seed) && object(r.config),'run.metadata')
  requireField(Object.entries(r.config).every(([k,n])=>/^[a-zA-Z0-9_]{1,40}$/.test(k) && Number.isFinite(n)),'run.config')
  for (const [field,limit] of [['reason',4000],['prediction',2000],['requestedImage',255]] as const) {
    requireField(r[field]===undefined || string(r[field],limit),'run.'+field)
  }
  requireField(r.resolvedImageId===undefined || (typeof r.resolvedImageId==='string' && /^sha256:[a-f0-9]{64}$/.test(r.resolvedImageId)),'run.image')
  const events = rows(r.events,512,'run.events')
  events.forEach((event,i)=>{
    requireField(object(event),'event')
    onlyFields(event,'runId seq type name step value unit passed detail message timeline arithmeticIntensity gflops bandwidthGBps')
    try { validateRunEvent(event as unknown as RunEvent,r.id,i+1) }
    catch { requireField(false,'event identity or payload') }
    requireField(event.unit===undefined || string(event.unit,64),'event.unit')
    requireField(event.step===undefined || ex.steps?.some(s=>s.name===event.step),'event.step')
    for (const field of ['arithmeticIntensity','gflops','bandwidthGBps']) {
      requireField(event[field]===undefined || Number.isFinite(event[field]),'event.'+field)
    }
  })
  const checks = (events as RunEvent[]).filter(e=>e.type==='check')
  if (r.run_status==='completed') {
    requireField(r.check_status===(checks.length ? checks.every(e=>e.passed)?'passed':'failed' : 'inconclusive'),'run.checks')
  } else requireField(r.check_status!=='passed' && r.check_status!=='failed','run.terminal')
  return r as unknown as RunRecord
}

type ArchivedAnswer = AnswerRecord & {exerciseId:string}

export function importArchive(raw: string, catalog: Catalog, store: Store) {
  requireField(typeof raw==='string' && Buffer.byteLength(raw,'utf8')<=4_000_000,'4 MB')
  let archive: unknown
  try { archive = JSON.parse(raw) } catch { throw Error('归档需为有效 JSON / Expected a JSON archive') }
  requireField(object(archive) && archive.format==='ai-infra-lab-archive/1' && archive.schemaVersion===1 &&
    released(archive.contentVersion,'A',catalog.version) && stamp(archive.exportedAt),'header')
  onlyFields(archive,'format schemaVersion contentVersion exportedAt readLessons fastTrackedLessons runs evidence answers legacyAnswerIds')
  const version = String(archive.contentVersion)
  const lessons = new Set(catalog.lessons.map(l=>l.id))
  const exercises = new Map(catalog.lessons.flatMap(l=>l.exercises.map(e=>[e.id,e] as const)))
  const readIds = (v:unknown) => rows(v,lessons.size,'lessons').map(l=>{
    requireField(typeof l==='string' && lessons.has(l) && released(version,l,version),'lesson id')
    return l
  })
  const read = readIds(archive.readLessons)
  const fast = readIds(archive.fastTrackedLessons ?? [])
  requireField(fast.every(id=>catalog.lessons.find(l=>l.id===id)?.exercises.some(e=>e.fastTrackSkipLesson)),'fast-track')
  const runs = rows(archive.runs,1000,'runs').map(r=>checkRun(r,exercises,version))
  const evidence = rows(archive.evidence,5000,'evidence')
  const answers = rows(archive.answers ?? [],5000,'answers')
  const hasAnswers = archive.answers !== undefined
  const legacyIds = new Set(rows(archive.legacyAnswerIds ?? [],5000,'legacyAnswerIds').map(v=>{
    requireField(id(v),'legacy answer id')
    return v
  }))
  requireField(hasAnswers || version !== '0.5.0','missing answer index')
  const kindMap = {code:'implementation',quiz:'quiz',estimate:'estimate',simulator:'simulation',explanation:'explanation'} as const

  return store.transaction(()=>{
    const currentRuns = new Map(store.runs().map(r=>[r.id,r]))
    const currentEvidence = new Map(store.evidence().map(e=>[e.id,e]))
    const currentAnswers = new Map(store.archiveAnswers().map(a=>[a.id,a]))
    const seen = new Set<string>()
    const unique = (key:string) => { requireField(!seen.has(key),'duplicate id'); seen.add(key) }
    const answerOwners = new Map<string,string>()
    for (const ev of currentEvidence.values()) if (ev.answerId) answerOwners.set(ev.answerId,ev.exerciseId)
    let importedRuns=0, importedEvidence=0
    for (const run of runs) {
      unique(run.id)
      const old=currentRuns.get(run.id)
      requireField(!old || isDeepStrictEqual(old,run),'conflicting run id')
      if (!old) { store.putRun(run); currentRuns.set(run.id,run); importedRuns++ }
    }
    for (const item of answers) {
      const a=identity(item)
      unique(a.id)
      onlyFields(a,'id exerciseId attemptId runId text status diagnostic contentVersion testVersion at')
      const ex=exercises.get(a.exerciseId)
      requireField(ex && ex.kind!=='code' && released(a.contentVersion,ex.lessonId,version) && a.testVersion===ex.testVersion &&
        string(a.attemptId,120) && a.attemptId && string(a.text,16000) && bilingual(a.diagnostic) && stamp(a.at) &&
        oneOf(a.status,ex.kind==='explanation'?['inconclusive']:['passed','failed']),'answer')
      requireField(a.runId===undefined || (id(a.runId) && currentRuns.get(a.runId)?.exerciseId===ex.id),'answer.runId')
      const answer=a as unknown as ArchivedAnswer
      const old=currentAnswers.get(a.id)
      requireField(!old || isDeepStrictEqual(old,answer),'conflicting answer id')
      if (!old) {
        const {exerciseId,...record}=answer
        store.record(exerciseId,'answer',record,record.at)
        currentAnswers.set(a.id,answer)
      }
    }
    for (const item of evidence) {
      const ev=identity(item)
      unique(ev.id)
      onlyFields(ev,'id runId answerId attemptId exerciseId concept kind dataSource source help result contentVersion testVersion at')
      const ex=exercises.get(ev.exerciseId)
      requireField(ex && released(ev.contentVersion,ex.lessonId,version) && stamp(ev.at) && oneOf(ev.help,helpLevels) &&
        string(ev.attemptId,120) && ev.attemptId,'evidence')
      if (ev.kind==='reading') {
        requireField(ev.concept===ex.lessonId && ev.source==='learner' && ev.result==='read' &&
          !ev.runId && !ev.answerId && catalog.lessons.find(l=>l.id===ex.lessonId)?.exercises[0]?.id===ex.id,'reading')
      } else {
        requireField(ev.kind===kindMap[ex.kind] && typeof ev.concept==='string' && (ex.concepts.length?ex.concepts:[ex.lessonId]).includes(ev.concept) &&
          ev.testVersion===ex.testVersion && ev.dataSource===ex.dataSource && ev.source===(ex.kind==='explanation'?'learner':'program') &&
          oneOf(ev.result,ex.kind==='explanation'?['inconclusive']:['passed','failed']),'evidence.activity')
        if (ev.runId!==undefined || ex.kind==='code') {
          requireField(id(ev.runId),'evidence.runId')
          const run=currentRuns.get(ev.runId)
          requireField(run && run.exerciseId===ex.id && run.check_status===ev.result &&
            run.contentVersion===ev.contentVersion && run.help===ev.help,'evidence.run binding')
        }
        if (ex.kind==='code') requireField(ev.answerId===undefined,'implementation.answerId')
        else {
          requireField(id(ev.answerId) && !currentRuns.has(ev.answerId),'evidence.answerId')
          const answer=currentAnswers.get(ev.answerId)
          // v0.1–v0.4 exported evidence and its answer ID but omitted answer bodies.
          const legacy = ev.contentVersion !== '0.5.0' && (!hasAnswers || legacyIds.has(ev.answerId))
          requireField((answer || legacy) &&
            (!answer || (answer.exerciseId===ex.id && answer.attemptId===ev.attemptId &&
              answer.status===ev.result && answer.contentVersion===ev.contentVersion)), 'evidence.answer binding')
          const owner=answerOwners.get(ev.answerId)
          requireField(!owner || owner===ex.id,'answer owner')
          answerOwners.set(ev.answerId,ex.id)
        }
      }
      const record=ev as unknown as Evidence
      const old=currentEvidence.get(ev.id)
      requireField(!old || isDeepStrictEqual(old,record),'conflicting evidence id')
      if (!old) { store.record(ex.id,'evidence',record,record.at); importedEvidence++ }
    }
    for (const [key,ids] of [['readLessons',read],['fastTrackedLessons',fast]] as const) {
      store.set(key,[...new Set([...store.get<string[]>(key,[]),...ids])])
    }
    return {importedRuns,importedEvidence}
  })
}

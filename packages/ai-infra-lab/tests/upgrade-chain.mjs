import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir,mkdtemp,rm } from 'node:fs/promises'
import { join,resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Engine as Candidate } from '../src/engine.ts'

const pkg=resolve(import.meta.dirname,'..')
const repo=resolve(pkg,'../..')
const root=await mkdtemp(join(pkg,'.build/upgrade-chain-'))
const profile=join(root,'synthetic-profile')
const snapshot=e=>['kv','drafts','runs','history'].map(t=>e.store.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all())
const archives = new Map()
let original, runId
try {
  for (const [version,revision] of [
    ['0.1.0','145f85e'], ['0.2.0','58492c3'], ['0.3.0','3d0f63b'],
    ['0.4.0','e689c13'], ['0.5.0','f88bad2'], ['0.6.0',null],
  ]) {
    let Engine=Candidate
    if (revision) {
      const dir=join(root,version), tar=join(dir,'source.tar')
      await mkdir(dir)
      execFileSync('git',['archive','-o',tar,revision,'--','packages/ai-infra-lab'],{cwd:repo,windowsHide:true})
      execFileSync('tar',['-xf',tar,'-C',dir],{windowsHide:true})
      Engine=(await import(pathToFileURL(join(dir,'packages/ai-infra-lab/src/engine.ts')).href)).Engine
    }
    const engine=await Engine.open(profile,'dsh-ai-infra-lab-cpu:0.1')
    try {
      assert.equal(engine.catalog.version,version)
      engine.overview()
      if (!original) {
        engine.readLesson('A00')
        engine.hint('A00-code','concept')
        engine.saveDraft('A00-code','# synthetic saved draft',0)
        engine.saveNote('A00-code','合成升级样本 / upgrade fixture',0)
        engine.answer('A01-fasttrack',engine.exercise('A01-fasttrack').quiz.correctOptionId)
        engine.answer('A02-estimate','0 B')
        const run=await engine.start('A00-code',engine.exercise('A00-code').reference,{seed:42})
        assert.equal((await engine.waitRun(run.id)).check_status,'passed')
        runId=run.id
        original=snapshot(engine)
      }
      assert.deepEqual(snapshot(engine),original,version+' changed learner rows')
      assert.equal(engine.workspace('A00-code').noteRevision,1)
      assert.equal(engine.run(runId).contentVersion,'0.1.0')
      assert.deepEqual(engine.overview().fastTrackedLessons,['A01'])
      assert.ok(engine.overview().reviews.length>0)
      assert.equal(engine.store.db.prepare('PRAGMA application_id').get().application_id,1229734210)
      archives.set(version,engine.exportData())
      console.log('PASS '+version+' opened the same v0.1.0 database and preserved every learner row')
    } finally { await engine.close() }
  }
  const ordered = items => items.slice().sort((a,b)=>a.id.localeCompare(b.id))
  for (const [version,raw] of archives) {
    const restored=await Candidate.open(join(root,'restore-'+version))
    try {
      const source=JSON.parse(raw)
      assert.equal(source.contentVersion,version)
      assert.deepEqual(restored.importData(raw),{importedRuns:1,importedEvidence:source.evidence.length})
      const copy=JSON.parse(restored.exportData())
      for (const field of ['runs','answers','evidence']) {
        assert.deepEqual(ordered(copy[field]),ordered(source[field] ?? []),version+' '+field)
      }
      assert.deepEqual(copy.readLessons,source.readLessons)
      assert.deepEqual(copy.fastTrackedLessons,source.fastTrackedLessons ?? [])
      assert.deepEqual(restored.importData(raw),{importedRuns:0,importedEvidence:0})
      assert.deepEqual(restored.importData(restored.exportData()),{importedRuns:0,importedEvidence:0})
      console.log('PASS restored '+version+' archive twice: '+copy.runs.length+' run, '+copy.answers.length+' answers, '+copy.evidence.length+' evidence')
    } finally { await restored.close() }
  }
} finally { await rm(root,{recursive:true,force:true}) }

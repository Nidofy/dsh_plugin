import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadCatalog } from '../src/catalog.ts'
test('curriculum has complete distinct activities and consistent dependencies',async()=>{
 const c=await loadCatalog();assert.equal(c.lessons.length,12)
 const all=c.lessons.flatMap(l=>l.exercises);assert.ok(all.filter(e=>e.kind==='code').length>=16);assert.equal(all.filter(e=>e.kind==='experiment').length,6)
 assert.equal(new Set(all.map(e=>e.id)).size,all.length)
 for(const l of c.lessons){assert.ok(l.body.length>300);assert.ok(l.objectives.length>=3);assert.ok(l.summary.length>30);for(const e of l.exercises){assert.equal(e.lessonId,l.id);assert.ok(e.hints.length>=3);assert.ok(e.inputDomain);if(e.kind==='code'){assert.notEqual(e.reference,e.starter);if(e.id!=='L01-debug')assert.match(e.starter,/NotImplementedError/);assert.ok(e.runtimeKey)}}}
})
import { validateCatalog } from '../src/catalog.ts'
test('dependency validator rejects missing references, cycles and duplicate lessons',async()=>{
 const original=await loadCatalog()
 const missing=structuredClone(original);missing.lessons[0]!.prerequisites=['missing'];assert.throws(()=>validateCatalog(missing),/Missing prerequisite/)
 const cycle=structuredClone(original);cycle.lessons[0]!.prerequisites=['L12'];assert.throws(()=>validateCatalog(cycle),/cycle/)
 const duplicate=structuredClone(original);duplicate.lessons[1]!.id='L01';assert.throws(()=>validateCatalog(duplicate),/Duplicate lesson/)
})

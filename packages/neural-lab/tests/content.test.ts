import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadCatalog } from '../src/catalog.ts'
test('curriculum has complete distinct activities and consistent dependencies', async () => {
  const c = await loadCatalog()
  assert.equal(c.lessons.length, 12)
  const all = c.lessons.flatMap((l) => l.exercises)
  assert.ok(all.filter((e) => e.kind === 'code').length >= 16)
  assert.equal(all.filter((e) => e.kind === 'experiment').length, 6)
  assert.equal(new Set(all.map((e) => e.id)).size, all.length)
  for (const l of c.lessons) {
    assert.ok(l.body.length > 300)
    assert.ok(l.objectives.length >= 3)
    assert.ok(l.summary.length > 30)
    for (const e of l.exercises) {
      assert.equal(e.lessonId, l.id)
      assert.ok(e.hints.length >= 3)
      assert.ok(e.inputDomain)
      if (e.kind === 'code') {
        assert.notEqual(e.reference, e.starter)
        if (e.id !== 'L01-debug') assert.match(e.starter, /NotImplementedError/)
        assert.ok(e.runtimeKey)
      }
    }
  }
})
import { validateCatalog } from '../src/catalog.ts'
test('dependency validator rejects missing references, cycles and duplicate lessons', async () => {
  const original = await loadCatalog()
  const missing = structuredClone(original)
  missing.lessons[0]!.prerequisites = ['missing']
  assert.throws(() => validateCatalog(missing), /Missing prerequisite/)
  const cycle = structuredClone(original)
  cycle.lessons[0]!.prerequisites = ['L12']
  assert.throws(() => validateCatalog(cycle), /cycle/)
  const duplicate = structuredClone(original)
  duplicate.lessons[1]!.id = 'L01'
  assert.throws(() => validateCatalog(duplicate), /Duplicate lesson/)
})
test('v0.2.1 activities have specific guidance and experiment contracts', async () => {
  const catalog = await loadCatalog()
  assert.equal(catalog.version, '0.2.1')
  const activities = catalog.lessons.flatMap((l) => l.exercises)
  assert.equal(activities.length, 38)
  assert.equal(
    new Set(activities.map((e) => e.hints.join('\n'))).size,
    38,
    'Every activity needs its own progressive guidance',
  )
  for (const exercise of activities) {
    assert.equal(
      exercise.testVersion,
      ['L04-train', 'L12-transformer'].includes(exercise.id) ? '1' : '3',
    )
    assert.ok(exercise.commonErrors.length >= 2)
  }
  const expectedKeys: Record<string, string[]> = {
    grad: ['eps'],
    softmax: ['offset', 'temperature'],
    attention: ['dim', 'scale'],
    causal: ['perturbation'],
    mlp: ['steps', 'lr'],
    lm: ['steps', 'lr'],
  }
  for (const exercise of activities.filter((e) => e.kind === 'experiment'))
    for (const key of expectedKeys[exercise.runtimeKey!]!)
      assert.ok(exercise.starter.includes("'" + key + "'"), exercise.id + ' missing ' + key)
})

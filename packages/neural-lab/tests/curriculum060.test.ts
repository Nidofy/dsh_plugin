import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const activities = read('../content/v060/activities.json')
const lessons = read('../content/v060/lessons.json')
const catalog = read('../content/catalog.json')
const old = catalog.lessons.flatMap((l: any) => l.exercises)
const byId = (id: string) => activities.find((e: any) => e.id === id)

test('six independently versioned runnable activities have bounded protocols and evidence origins', () => {
  const expected = [
    ['L04-multi', 'train-mlp-multi-v1', 'L04-train', 'transfer'],
    ['L12-flex', 'project-char-flex-v1', 'L12-assembly', 'transfer'],
    ['L12-two', 'project-char-two-v1', 'L12-flex', 'transfer'],
    ['L12-observe', 'project-char-observe-v1', 'L12-two', undefined],
    ['L12-repair-mask', 'project-char-two-v1', 'L12-two', 'debugging'],
    ['L12-repair-gradient', 'project-char-two-v1', 'L12-two', 'debugging'],
  ]
  assert.equal(activities.length, expected.length)
  assert.equal(new Set(activities.map((e: any) => e.id)).size, expected.length)
  for (const [id, protocol, origin, evidence] of expected) {
    const e = byId(id!)
    assert.equal(e.runtimeKey, protocol)
    assert.equal(e.transferFrom, origin)
    assert.equal(e.evidenceKind, evidence)
    assert.equal(e.kind, 'code')
    assert.equal(e.testVersion, '1')
    assert.equal(e.mode, id === 'L12-observe' ? 'observe' : 'check')
    assert.ok(e.diagnosis.length > 50)
    assert.ok([...activities, ...old].some((x: any) => x.id === origin))
  }
})

test('MLP repair changes only the two reductions and retains a correct validation return', () => {
  const e = byId('L04-multi')
  assert.equal(e.reference, old.find((x: any) => x.id === 'L04-train').reference)
  const expected = e.reference
    .replaceAll('.square().mean()', '.square().sum() / x.size(0)')
    .replace('return (model(x) - y).square().sum() / x.size(0).item()', 'return ((model(x) - y).square().sum() / x.size(0)).item()')
  assert.equal(e.starter, expected)
  assert.doesNotMatch(e.starter, /NotImplemented/)
  // Independent derivative check: averaging over B*O must match finite differences.
  const errors = [0.2, -0.7, 1.1, 0.5, -0.1, 0.8]
  const mse = (values: number[]) => values.reduce((sum, x) => sum + x * x, 0) / values.length
  for (let i = 0; i < errors.length; i++) {
    const plus = [...errors], minus = [...errors], h = 1e-6
    plus[i] += h; minus[i] -= h
    assert.ok(Math.abs((mse(plus) - mse(minus)) / (2 * h) - 2 * errors[i] / 6) < 1e-8)
  }
  assert.equal(errors.reduce((sum, x) => sum + x * x, 0) / 2, mse(errors) * 3)
})

test('decoder references preserve both layers and all fourteen existing contracts', () => {
  const contract = old.find((e: any) => e.id === 'L12-assembly').components
  const reference = byId('L12-two').reference
  for (const e of activities.filter((e: any) => e.lessonId === 'L12')) {
    assert.deepEqual(e.components, contract)
    assert.equal(e.reference, reference)
    assert.match(e.reference, /if p.layers == 2:/)
    assert.match(e.reference, /z = block\(z, second\)/)
    assert.doesNotMatch(e.reference, /detach\(|NotImplemented/)
  }
})

test('debugging starters contain exactly one executable fault and no placeholder', () => {
  const mask = byId('L12-repair-mask')
  assert.equal(mask.starter, mask.reference.replace(
    'return scores.masked_fill(~torch.ones(scores.size(-2), scores.size(-1), dtype=torch.bool).tril(), -torch.inf)',
    'return scores  # BUG: future keys remain visible'))
  const grad = byId('L12-repair-gradient')
  assert.equal(grad.starter, grad.reference.replace('second = Layer(second)',
    'second = Layer(second)\n        second["q"] = second["q"].detach()  # BUG: disconnect layer 1 query gradient'))
  for (const e of [mask, grad]) assert.doesNotMatch(e.starter, /NotImplemented|raise /)
})

test('append-only lesson material includes full learning cycle and observation limits', () => {
  assert.deepEqual(lessons.map((l: any) => l.lessonId), ['L04', 'L12'])
  for (const lesson of lessons) {
    for (const stage of ['预测', '实现', '可信检查', '解释', '变式', '复习']) assert.ok(lesson.body.includes(stage))
    assert.ok(lesson.body.includes('帮助'))
  }
  const body = lessons[1].body
  for (const e of activities.filter((e: any) => e.lessonId === 'L12')) assert.ok(body.includes(e.id))
  for (const phrase of ['未采集', 'n≥2', '失败不填0', '不授实现掌握', '8..24', '原Parameter']) assert.ok(body.includes(phrase))
})

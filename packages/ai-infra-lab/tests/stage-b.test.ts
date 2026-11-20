import assert from 'node:assert/strict'
import { it } from 'node:test'
import { loadCatalog, validateCatalog } from '../src/catalog.ts'
import { completedWarpAccess, warpAccess } from '../src/sim-stage-b.ts'

it('counts aligned, shifted, strided and broadcast words using unique addresses', () => {
  const a = { stride: 1, baseOffsetElements: 0, broadcast: false }
  const b = { ...a, stride: 32 }
  assert.deepEqual(warpAccess(a).segments, [0])
  assert.equal(warpAccess({ ...a, baseOffsetElements: 1 }).utilization, 0.5)
  assert.equal(warpAccess({ ...a, stride: 2 }).maxWayConflict, 2)
  assert.equal(warpAccess(b).maxWayConflict, 32)
  const broadcast = warpAccess({ ...b, broadcast: true })
  assert.equal(broadcast.maxWayConflict, 1)
  assert.equal(broadcast.usefulBytes, 4)
  assert.equal(broadcast.bankDistribution[0]!.lanes.length, 32)
  assert.equal(broadcast.bankDistribution[0]!.ways, 1)
  assert.equal(warpAccess(b).bankDistribution[0]!.ways, 32)
  assert.equal(completedWarpAccess([a,b]), true)
  for (const invalid of [[a], [b], [a,b,null], [a,{ ...b, stride: 33 }], Array(33).fill(a), true]) {
    assert.equal(completedWarpAccess(invalid), false)
  }
})

it('requires the exact catalog size for the release and a known widget', async () => {
  const c = await loadCatalog()
  validateCatalog(c)
  assert.throws(() => validateCatalog({ ...c, lessons: c.lessons.slice(1) }))
  c.lessons.flatMap(l => l.exercises).find(e => e.id === 'B04-sim')!.simulator!.widget = 'invalid' as never
  assert.throws(() => validateCatalog(c))
})

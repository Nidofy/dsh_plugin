import { expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { teaSquareFixture } from './tea-square.fixture.ts'
import { startAfternoon, actAfternoon } from '../src/core/afternoon-engine.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { sceneInteractions, sceneInteractionAt } from '../src/core/scene-interactions.ts'
import { validUIInput } from '../src/core/frame-protocol.ts'
import { migrateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { switchRegion } from '../src/core/region-engine.ts'

function ready(w: LivingWorld) { for (let i = 0; i < 1265 && w.afternoon.active?.phase !== 'ready'; i++) stepLiving(w, scene); expect(w.afternoon.active?.phase).toBe('ready'); return w }
function use(w: LivingWorld, id: string) {
  const hit = sceneInteractions(w).find(h => h.id === id)!
  expect(sceneInteractionAt(w, hit.point)).toEqual(hit)
  expect(validUIInput({ kind: 'story-object', id: hit.id, token: hit.token, point: hit.point })).toBe(true)
  if (hit.command.kind !== 'act') throw Error('Expected an act')
  return actAfternoon(w, scene, hit.token, hit.command.action, hit.command.choice)
}
it('a player discovers, reads, folds, presses and hangs the scene object, then recalls a confirmed saved source', () => {
  let w = teaSquareFixture(true)
  const discovery = sceneInteractions(w).find(h => h.id === 'discover:tea-bookmark')!
  expect(discovery.region).toBe('tea-square'); expect(discovery.command).toEqual({ kind: 'start', story: 'tea-bookmark' })
  w = startAfternoon(w, scene, 'tea-bookmark', ['bluewhale', 'claude'], crypto.randomUUID())
  expect(sceneInteractions(w)).toEqual([]); expect(() => switchRegion(w, scene, 'courtyard')).toThrow()
  w = use(ready(w), 'afternoon:note')
  expect(sceneInteractions(w).some(h => h.id === 'afternoon:press')).toBe(false)
  const before = sceneInteractions(w)[0]!
  w = use(w, 'afternoon:leaf'); expect(sceneInteractions(w).find(h => h.id === 'afternoon:leaf')?.selected).toBe(true)
  expect(() => actAfternoon(w, scene, before.token, 'fold', 'wave')).toThrow('STALE_PLAY_ACTION')
  w = use(w, 'afternoon:press'); expect(w.afternoon.memories).toHaveLength(0)
  w = use(ready(w), 'afternoon:keep'); const saved = JSON.stringify(w)
  w = migrateLivingWorld(JSON.parse(saved), scene)
  const recall = sceneInteractions(w).find(h => h.id === 'recall:tea-bookmark')!
  expect(recall.token).toBe(`recall:${w.afternoon.memories[0]!.eventId}`)
  expect(sceneInteractionAt(w, { x: -1, y: -1 })).toBeNull()
  expect(sceneInteractionAt(w, { x: NaN, y: 145 })).toBeNull()
})
it('validates the bounded intent shape and refuses extra reward/action fields', () => {
  const valid = { kind: 'story-object', id: 'afternoon:leaf', token: `${crypto.randomUUID()}:1:1`, point: { x: 116, y: 332 } }
  expect(validUIInput(valid)).toBe(true)
  for (const bad of [{ ...valid, action: 'remember' }, { ...valid, token: 'a'.repeat(161) }, { ...valid, point: { x: 500, y: 0 } }, { ...valid, point: { x: 1, y: 2, reward: true } }]) expect(validUIInput(bad)).toBe(false)
})

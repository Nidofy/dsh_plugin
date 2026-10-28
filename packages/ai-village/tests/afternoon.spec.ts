import { expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { actors, available } from '../src/core/world.ts'
import { createLivingWorld, migrateLivingWorld, validateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { afternoonStory, type AfternoonStoryId } from '../src/core/afternoon-catalog.ts'
import { afternoonToken, blankAfternoon } from '../src/core/afternoon-state.ts'
import { startAfternoon, actAfternoon, cancelAfternoon, stepAfternoon, placeAfternoonKeepsake } from '../src/core/afternoon-engine.ts'
import { startTeaSquareStory } from '../src/core/tea-square-engine.ts'
import { requestManualMove } from '../src/core/manual-move.ts'

function fixture(seven = true) {
  const c = new LivingController(createLivingWorld(scene), scene, () => {})
  for (const id of seven ? ['claude', 'gemini', 'grok', 'gpt', 'kimi', 'seedance'] : ['claude', 'gemini', 'grok']) c.setCharacterPresent(id, true)
  return switchRegion(c.snapshot(), scene, 'tea-square')
}
function start(w: LivingWorld, id: AfternoonStoryId, eventId = crypto.randomUUID()) { return startAfternoon(w, scene, id, [...afternoonStory(id).participants], eventId) }
function act(w: LivingWorld, action: Parameters<typeof actAfternoon>[3], choice?: string) { return actAfternoon(w, scene, afternoonToken(w.afternoon.active!), action, choice) }
function ready(w: LivingWorld) {
  for (let i = 0; i < 1265 && w.afternoon.active?.phase !== 'ready'; i++) {
    const before = actors(w).map(a => ({ ...a.position })), ticks = w.ticks
    stepLiving(w, scene); expect(w.ticks).toBe(ticks + 1)
    actors(w).forEach((a, j) => { expect(available(w, a.position, a.id)).toBe(true); expect(Math.hypot(a.position.x - before[j]!.x, a.position.y - before[j]!.y)).toBeLessThanOrEqual(17 / 30 + 1e-6) })
    if (i % 180 === 0) w = validateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
  }
  expect(w.afternoon.active?.phase).toBe('ready'); return w
}
function solve(w: LivingWorld, alternate = false) {
  w = ready(w)
  if (w.afternoon.active!.storyId === 'tea-bookmark') { w = act(w, 'listen'); w = act(w, 'fold', alternate ? 'wave' : 'leaf'); w = act(w, 'press') }
  else { w = act(w, 'observe', alternate ? 'right' : 'left'); w = act(w, 'match', 'mirror') }
  return act(ready(w), 'remember')
}

for (const id of ['tea-bookmark', 'reflection-shapes'] as const) it(`${id}: seven residents walk, stop and choose within 90 seconds; replays retain the first fact and do not replace placement`, () => {
  let w = start(fixture(), id), initialTicks = w.ticks, firstId = w.afternoon.active!.id, rng = w.rng
  const outside = actors(w).filter(a => !w.afternoon.active!.participants.includes(a.id)).map(a => ({ id: a.id, position: { ...a.position } }))
  expect(() => act(w, id === 'tea-bookmark' ? 'listen' : 'observe', id === 'tea-bookmark' ? undefined : 'left')).toThrow('PLAY_NOT_READY')
  w = solve(w); expect(w.ticks - initialTicks).toBeLessThan(2700); expect(w.rng).toBe(rng)
  expect(w.afternoon.memories).toHaveLength(1); const first = structuredClone(w.afternoon.memories[0]!)
  expect(first.eventId).toBe(firstId); expect(first.participants).toEqual(afternoonStory(id).participants); expect(first.count).toBe(1); expect(w.afternoon.keepsakes[id]).toBe('message-tree')
  for (const a of outside) expect(actors(w).find(b => a.id === b.id)!.position).toEqual(a.position)
  w = placeAfternoonKeepsake(w, scene, id, null); w = solve(start(w, id), true)
  expect(w.afternoon.memories).toEqual([{ ...first, count: 2 }]); expect(w.afternoon.keepsakes[id]).toBeNull(); expect(w.afternoon.lastEventIds[id]).not.toBe(firstId)
  expect(migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene)).toEqual(w)
  expect(switchRegion(w, scene, 'courtyard').afternoon).toEqual(w.afternoon)
})

it('uses distinct effective operations, rejects stale and malformed choices, and keeps two bounded memories', () => {
  let w = ready(start(fixture(), 'tea-bookmark')), old = afternoonToken(w.afternoon.active!)
  expect(() => act(w, 'observe', 'left')).toThrow('INVALID_PLAY_ACTION')
  w = act(w, 'listen'); expect(() => actAfternoon(w, scene, old, 'listen')).toThrow('STALE_PLAY_ACTION')
  expect(() => act(w, 'press')).toThrow('INVALID_PLAY_ACTION'); expect(() => act(w, 'fold', 'mirror')).toThrow('INVALID_PLAY_ACTION')
  w = act(w, 'fold', 'wave'); old = afternoonToken(w.afternoon.active!); w = act(w, 'fold', 'leaf')
  expect(() => actAfternoon(w, scene, old, 'press')).toThrow('STALE_PLAY_ACTION')
  w = act(ready(act(w, 'press')), 'remember'); const first = structuredClone(w.afternoon.memories[0])
  w = ready(start(w, 'reflection-shapes')); expect(() => act(w, 'listen')).toThrow('INVALID_PLAY_ACTION')
  w = act(w, 'observe', 'right'); w = act(w, 'match', 'same'); expect(w.afternoon.active).toMatchObject({ stage: 1, attempts: 1, selection: 'right' }); expect(w.afternoon.memories).toEqual([first])
  w = act(ready(act(w, 'match', 'mirror')), 'remember'); expect(w.afternoon.memories).toHaveLength(2); expect(w.afternoon.memories[0]).toEqual(first); expect(w.afternoon.memories[1]!.selection).toBe('right')
})

it('cancels every phase without rewards; paused frames and cold restore preserve exact state', () => {
  let w = start(fixture(), 'reflection-shapes')
  w.userPaused = true; const paused = JSON.stringify(w); for (let i = 0; i < 30; i++) stepAfternoon(w); expect(JSON.stringify(w)).toBe(paused); w.userPaused = false
  for (let i = 0; i < 90; i++) stepLiving(w, scene)
  const cold = migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
  for (let i = 0; i < 90; i++) { stepLiving(w, scene); stepLiving(cold, scene) }
  expect(cold).toEqual(w); const canceled = structuredClone(w); cancelAfternoon(canceled); expect(canceled.afternoon).toEqual(blankAfternoon()); expect(validateLivingWorld(canceled, scene)).toEqual(canceled)
  w = act(ready(w), 'observe', 'left'); const atChoice = structuredClone(w); cancelAfternoon(atChoice); expect(atChoice.afternoon).toEqual(blankAfternoon())
  w = act(w, 'match', 'mirror'); cancelAfternoon(w); expect(w.afternoon).toEqual(blankAfternoon())
  const bounded = start(fixture(), 'tea-bookmark'); bounded.afternoon.active!.approachRemainingTicks = 1
  expect(stepAfternoon(bounded)).toBe('blocked'); expect(bounded.afternoon).toEqual(blankAfternoon())
})

it('guards casts, event collisions, travel, manual movement and old tea; rejected starts do not mutate sources', () => {
  const empty = fixture(), original = JSON.stringify(empty), eventId = crypto.randomUUID()
  expect(() => startAfternoon(empty, scene, 'tea-bookmark', ['bluewhale', 'gemini'], eventId)).toThrow('INVALID_INVITATION'); expect(JSON.stringify(empty)).toBe(original)
  const absent = switchRegion(createLivingWorld(scene), scene, 'tea-square'); expect(() => start(absent, 'tea-bookmark')).toThrow('INVALID_INVITATION')
  const w = start(empty, 'tea-bookmark')
  expect(() => start(w, 'reflection-shapes')).toThrow('EVENT_ACTIVE'); expect(() => switchRegion(w, scene, 'courtyard')).toThrow('EVENT_ACTIVE'); expect(() => requestManualMove(w, scene, { x: 218, y: 420 })).toThrow('EVENT_ACTIVE')
  expect(() => startTeaSquareStory(w, scene, ['bluewhale', 'claude', 'gemini'], crypto.randomUUID())).toThrow('EVENT_ACTIVE')
  const complete = solve(w); expect(() => start(complete, 'reflection-shapes', complete.afternoon.memories[0]!.eventId)).toThrow('INVALID_INVITATION')
  expect(() => placeAfternoonKeepsake(empty, scene, 'tea-bookmark', 'message-tree')).toThrow('DECORATION_LOCKED')
})

it('rejects forged and unbounded states at the durable boundary', () => {
  const w = start(fixture(), 'tea-bookmark')
  for (const change of [
    (v: any) => v.afternoon.extra = true,
    (v: any) => v.afternoon.active.storyId = 'invented',
    (v: any) => v.afternoon.active.participants.reverse(),
    (v: any) => v.afternoon.active.phase = 'ready',
    (v: any) => v.afternoon.active.approachRemainingTicks = 1201,
    (v: any) => v.afternoon.active.serial = -1,
    (v: any) => v.afternoon.active.targets[0] = { x: 180, y: 310 },
    (v: any) => v.afternoon.active.routes[0] = Array(10).fill(v.afternoon.active.targets[0]),
    (v: any) => v.afternoon.keepsakes['tea-bookmark'] = 'message-tree',
  ]) { const bad = structuredClone(w); change(bad); expect(() => validateLivingWorld(bad, scene)).toThrow() }
  const done = solve(w)
  for (const change of [
    (v: any) => v.afternoon.memories.push(structuredClone(v.afternoon.memories[0])),
    (v: any) => v.afternoon.memories[0].count = 0,
    (v: any) => v.afternoon.memories[0].completedTick = v.ticks + 1,
    (v: any) => v.afternoon.memories[0].selection = 'left',
    (v: any) => v.afternoon.lastEventIds['tea-bookmark'] = crypto.randomUUID(),
    (v: any) => v.afternoon.keepsakes['tea-bookmark'] = 'forged-place',
  ]) { const bad = structuredClone(done); change(bad); expect(() => validateLivingWorld(bad, scene)).toThrow() }
})

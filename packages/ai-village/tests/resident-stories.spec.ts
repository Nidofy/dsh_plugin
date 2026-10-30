import { expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { actors } from '../src/core/world.ts'
import { characterIds } from '../src/core/roster.ts'
import { createLivingWorld, validateLivingWorld, migrateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import * as oldWorld from '../src/core/living-state-v15.ts'
import { blankAfternoon as oldAfternoon } from '../src/core/afternoon-state-v1.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { afternoonStory, afternoonOperations, type AfternoonStoryId } from '../src/core/afternoon-catalog.ts'
import { residentStories, residentStory, type ResidentStoryId } from '../src/core/resident-stories-catalog.ts'
import { afternoonToken } from '../src/core/afternoon-state.ts'
import { startAfternoon, actAfternoon, stepAfternoon, cancelAfternoon, placeAfternoonKeepsake } from '../src/core/afternoon-engine.ts'

function fixture(id: AfternoonStoryId) {
  const c = new LivingController(createLivingWorld(scene), scene, () => {})
  const cast = [...new Set(['bluewhale', ...afternoonStory(id).participants, ...characterIds])] .slice(0, 7)
  for (const member of cast) c.setCharacterPresent(member, true)
  const world = c.snapshot(), region = afternoonStory(id).region
  return region === 'courtyard' ? world : switchRegion(world, scene, region)
}
function start(w: LivingWorld, id: AfternoonStoryId) { return startAfternoon(w, scene, id, [...afternoonStory(id).participants], crypto.randomUUID()) }
function act(w: LivingWorld, choice: string) { return actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'interact', choice) }
function ready(w: LivingWorld) {
  for (let tick = 0; tick < 1265 && w.afternoon.active?.phase !== 'ready'; tick++) {
    const before = actors(w).map(a => ({ ...a.position }))
    stepAfternoon(w, scene)
    actors(w).forEach((a, i) => expect(Math.hypot(a.position.x - before[i]!.x, a.position.y - before[i]!.y)).toBeLessThanOrEqual(17 / 30 + 1e-6))
    if (tick % 120 === 0) w = validateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
  }
  expect(w.afternoon.active?.phase).toBe('ready')
  return w
}
function solve(w: LivingWorld, id: ResidentStoryId, wrong = false) {
  w = act(ready(start(w, id)), 'inspect')
  const steps = residentStory(id)!.steps
  for (const [index, step] of steps.entries()) {
    expect(w.afternoon.active!.step).toBe(index)
    if (wrong) {
      const bad = step.choices.find(choice => !step.accept.includes(choice.id))!
      const token = afternoonToken(w.afternoon.active!)
      w = act(w, bad.id)
      expect(w.afternoon.active!.step).toBe(index)
      expect(w.afternoon.memories.some(m => m.storyId === id)).toBe(false)
      expect(() => actAfternoon(w, scene, token, 'interact', step.accept[0])).toThrow('STALE_PLAY_ACTION')
    }
    w = act(migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene), step.accept[0]!)
  }
  w = ready(w)
  return actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'remember')
}

// First vertical content pair: different scene, different cast and different effective operations.
for (const id of ['rice-and-tea', 'wind-scroll'] as const) it(`${id}: seven residents, retries, cold restores, stable first fact and placement`, () => {
  const initial = fixture(id), rng = initial.rng
  const complete = solve(initial, id, true), first = structuredClone(complete.afternoon.memories[0]!)
  expect(complete.rng).toBe(rng)
  expect(first.participants).toEqual(afternoonStory(id).participants)
  expect(complete.afternoon.keepsakes[id]).toBe(afternoonStory(id).placement)
  let replay = placeAfternoonKeepsake(complete, scene, id, null)
  replay = solve(replay, id)
  expect(replay.afternoon.memories).toEqual([{ ...first, count: 2 }])
  expect(replay.afternoon.keepsakes[id]).toBeNull()
  expect(new TextEncoder().encode(JSON.stringify(replay)).length).toBeLessThan(48 * 1024)
})

for (const id of ['odd-answers', 'broken-rhythm', 'tomorrow-plan', 'reading-corner'] as const) it(`${id}: distinct valid object choices complete once and retain original participants`, () => {
  const initial = fixture(id), complete = solve(initial, id, true)
  expect(complete.afternoon.memories).toHaveLength(1)
  expect(complete.afternoon.memories[0]!.participants).toEqual(afternoonStory(id).participants)
  expect(complete.afternoon.memories[0]!.count).toBe(1)
  expect(validateLivingWorld(JSON.parse(JSON.stringify(complete)), scene)).toEqual(complete)
})

it('lost diary: three committed chapter boundaries, actual clues in each area, no early reward and cold continuation', () => {
  const c = new LivingController(createLivingWorld(scene), scene, () => {})
  for (const member of ['claude', 'kimi', 'qwen', 'gpt', 'minimax', 'llama']) c.setCharacterPresent(member, true)
  let w = c.snapshot()
  expect(() => start(w, 'lost-diary-home')).toThrow('STORY_LOCKED')
  w = switchRegion(w, scene, 'tea-square')
  expect(() => start(w, 'lost-diary-tea')).toThrow('STORY_LOCKED')
  w = switchRegion(switchRegion(w, scene, 'courtyard'), scene, 'bookhouse')
  const active = start(w, 'lost-diary-page')
  expect(() => switchRegion(active, scene, 'courtyard')).toThrow('EVENT_ACTIVE')
  const before = JSON.stringify(active); const canceled = structuredClone(active); cancelAfternoon(canceled)
  expect(canceled.afternoon.memories).toHaveLength(0)
  expect(JSON.stringify(active)).toBe(before)
  w = solve(w, 'lost-diary-page', true)
  expect(w.afternoon.keepsakes['lost-diary-page']).toBeNull()
  expect(w.afternoon.active).toBeNull()
  w = switchRegion(switchRegion(migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene), scene, 'courtyard'), scene, 'tea-square')
  w = solve(w, 'lost-diary-tea', true)
  expect(w.afternoon.keepsakes['lost-diary-tea']).toBeNull()
  w = switchRegion(migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene), scene, 'courtyard')
  w = solve(w, 'lost-diary-home', true)
  expect(w.afternoon.memories.map(m => m.storyId)).toEqual(['lost-diary-page', 'lost-diary-tea', 'lost-diary-home'])
  expect(w.afternoon.keepsakes['lost-diary-home']).toBe('courtyard-card')
  expect(new Set(w.afternoon.memories.map(m => m.eventId)).size).toBe(3)
  const forged = structuredClone(w); forged.afternoon.memories.shift(); forged.afternoon.lastEventIds['lost-diary-page'] = null
  expect(() => validateLivingWorld(forged, scene)).toThrow('INVALID_AFTERNOON')
  expect(new TextEncoder().encode(JSON.stringify(w)).length).toBeLessThan(48 * 1024)
})

it('v15 active stories migrate narrowly and idempotently without changing the old bytes', () => {
  const w = start(fixture('tea-bookmark'), 'tea-bookmark')
  const { step: _step, ...active } = w.afternoon.active!
  const old = { ...w, schemaVersion: 15, contentRevision: 11, afternoon: { ...oldAfternoon(), active: { ...active, version: 1 } } }
  const bytes = JSON.stringify(old)
  expect(oldWorld.validateLivingWorld(old, scene)).toEqual(old)
  const migrated = migrateLivingWorld(old, scene)
  expect(migrated.schemaVersion).toBe(16)
  expect(migrated.afternoon.active).toEqual({ ...active, version: 2, step: 0 })
  expect(migrateLivingWorld(migrated, scene)).toEqual(migrated)
  expect(JSON.stringify(old)).toBe(bytes)
  expect(() => oldWorld.validateLivingWorld(migrated, scene)).toThrow('UNSUPPORTED_WORLD_VERSION')
})

it('only saved choices and bounded progress are legal; operations reflect the next actual object task', () => {
  const w = act(ready(start(fixture('rice-and-tea'), 'rice-and-tea')), 'inspect')
  expect(afternoonOperations(w.afternoon.active!).map(o => o.choice)).toEqual(['rice', 'cake'])
  const progressed = act(w, 'rice')
  expect(afternoonOperations(progressed.afternoon.active!).map(o => o.choice)).toEqual(['share-rice', 'keep-all'])
  for (const mutate of [
    (x: any) => x.afternoon.active.step = 99,
    (x: any) => x.afternoon.active.step = 2,
    (x: any) => x.afternoon.active.selection = 'invented',
    (x: any) => x.afternoon.active.serial = 0,
    (x: any) => x.afternoon.active.participants.reverse(),
  ]) { const bad = structuredClone(progressed); mutate(bad); expect(() => validateLivingWorld(bad, scene)).toThrow() }
  expect(residentStories.filter(s => !s.arc).flatMap(s => s.participants).sort()).toEqual([...characterIds].sort())
})

it('all authored memories stay bounded across changing rosters and cannot be forged from later choices', () => {
  let w = createLivingWorld(scene)
  for (const story of residentStories) {
    if (w.region.active !== 'courtyard') w = switchRegion(w, scene, 'courtyard')
    const c = new LivingController(w, scene, () => {})
    c.selectCharacter('bluewhale')
    const roster = [...new Set(['bluewhale', ...story.participants, ...characterIds])].slice(0, 7)
    for (const actor of actors(c.world)) if (!roster.includes(actor.id)) c.setCharacterPresent(actor.id, false)
    for (const id of roster) c.setCharacterPresent(id, true)
    w = c.snapshot()
    if (story.region !== 'courtyard') w = switchRegion(w, scene, story.region)
    w = solve(w, story.id)
  }
  expect(w.afternoon.memories).toHaveLength(9)
  expect(new TextEncoder().encode(JSON.stringify(w)).length).toBeLessThan(12 * 1024)
  expect(migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene)).toEqual(w)
  const forged = structuredClone(w)
  forged.afternoon.memories.find(m => m.storyId === 'rice-and-tea')!.selection = 'share-rice'
  expect(() => validateLivingWorld(forged, scene)).toThrow('INVALID_AFTERNOON')
  const duplicate = structuredClone(w)
  duplicate.afternoon.memories.push(structuredClone(w.afternoon.memories[0]!))
  expect(() => validateLivingWorld(duplicate, scene)).toThrow('INVALID_AFTERNOON')
  const teaMemory = w.afternoon.memories.find(m => m.storyId === 'rice-and-tea')!
  expect(() => placeAfternoonKeepsake(w, scene, teaMemory.storyId, 'message-tree')).toThrow('STORY_REGION_REQUIRED')
})

it('an active courtyard cast rejects additions and removals before mutation; selection stays available', () => {
  const w = start(fixture('wind-scroll'), 'wind-scroll'), c = new LivingController(w, scene, () => {})
  const before = c.snapshot()
  expect(() => c.setCharacterPresent('kimi', false)).toThrow('EVENT_ACTIVE')
  expect(() => c.setCharacterPresent('mistral', false)).toThrow('EVENT_ACTIVE')
  const bystander = actors(w).find(a => !w.afternoon.active!.participants.includes(a.id))!
  expect(() => c.setCharacterPresent(bystander.id, false)).toThrow('EVENT_ACTIVE')
  const absent = characterIds.find(id => !actors(w).some(a => a.id === id))!
  expect(() => c.setCharacterPresent(absent, true)).toThrow('EVENT_ACTIVE')
  expect(c.snapshot()).toEqual(before)
  c.selectCharacter('kimi')
  expect(c.world.actor.id).toBe('kimi')
  expect(c.snapshot().afternoon).toEqual(before.afternoon)
})

it('twelve residents across six seven-person casts resume ordinary life deterministically after stories in all three regions', () => {
  const visited = new Set<string>()
  for (const story of residentStories.filter(story => !story.arc)) {
    let w = solve(fixture(story.id), story.id), cold = migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
    expect(actors(w)).toHaveLength(7)
    actors(w).forEach(a => visited.add(a.id))
    const activeAgain = new Set<string>()
    const memory = structuredClone(w.afternoon.memories)
    for (let tick = 0; tick < 6000; tick++) {
      stepLiving(w, scene); stepLiving(cold, scene)
      for (const a of actors(w)) if (story.participants.includes(a.id) && (a.destination || a.behavior !== 'idle')) activeAgain.add(a.id)
      if (tick % 300 === 0) {
        expect(cold).toEqual(w)
        w = validateLivingWorld(w, scene)
        cold = migrateLivingWorld(JSON.parse(JSON.stringify(cold)), scene)
        expect(w.community.recent.length).toBeLessThanOrEqual(12)
        expect(w.afternoon.active).toBeNull()
      }
    }
    expect([...activeAgain].sort()).toEqual([...story.participants].sort())
    expect(w.afternoon.memories).toEqual(memory)
    expect(cold).toEqual(w)
    expect(new TextEncoder().encode(JSON.stringify(w)).length).toBeLessThan(48 * 1024)
  }
  expect([...visited].sort()).toEqual([...characterIds].sort())
})

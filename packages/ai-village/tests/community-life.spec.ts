import { describe, expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { createLivingWorld, migrateLivingWorld, validateLivingWorld } from '../src/core/living-state.ts'
import { createLivingWorld as createV14 } from '../src/core/living-state-v14.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { stepLiving } from '../src/core/living-engine.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { placeTeaSquareKeepsake } from '../src/core/tea-square-engine.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { teaSquareScene } from '../src/core/tea-square-scene.ts'
import { cancelLifeSocial, chooseLifeSocial, validateLifeState } from '../src/core/life-engine.ts'
import { reachable, type Scene } from '../src/core/world.ts'
import { cancelCommunitySocial, communityCollection, communityDialogue, communityHistoryLimit, communityMemorySources, initialCommunityState, settleCommunitySocial, stepCommunitySocial, syncCommunitySocial, validateCommunityState, type CommunityRegion } from '../src/core/community-life.ts'

function neighbors(region: CommunityRegion = 'courtyard') {
  const w = createLivingWorld(scene)
  w.ticks = 900; w.region.active = region; w.community = initialCommunityState()
  const y = region === 'courtyard' ? 340 : 400
  w.actor.position = { x: 180, y }; w.actor.safe = { ...w.actor.position }; w.actor.behavior = 'idle'; w.actor.intent = null; w.actor.destination = null
  w.companions = [{ ...structuredClone(w.actor), id: 'claude', position: { x: 260, y }, safe: { x: 260, y } }]
  return w
}
function confirmedTea(w: ReturnType<typeof neighbors>) {
  w.teaSquare.memory = { eventId: '11111111-1111-1111-1111-111111111111', participants: ['bluewhale', 'claude', 'gemini'], completedTick: 100, day: 1, count: 1 }
  w.teaSquare.keepsake = 'message-tree'
  w.teaSquare.lastEventId = w.teaSquare.memory.eventId
}
function advance(w: ReturnType<typeof neighbors>, geometry: Scene, count: number) {
  for (let i = 0; i < count; i++) { stepCommunitySocial(w, geometry); w.ticks++; settleCommunitySocial(w, geometry) }
}

it('projects only first saved participants and stable event provenance, with no new memory database', () => {
  const w = neighbors()
  expect(communityMemorySources(w)).toEqual([])
  confirmedTea(w)
  w.bookhouse.memory = { eventId: '22222222-2222-2222-2222-222222222222', participants: ['gemini', 'grok'], completedTick: 200, count: 1, theme: 'light' }
  w.afternoon.memories.push({ storyId: 'tea-bookmark', eventId: '33333333-3333-3333-3333-333333333333', participants: ['bluewhale', 'claude'], completedTick: 300, day: 1, count: 1, selection: 'leaf' })
  w.afternoon.keepsakes['tea-bookmark'] = 'message-tree'
  const before = structuredClone(w), sources = communityMemorySources(w)
  expect(sources.map(s => [s.id, s.eventId, s.participants])).toEqual([
    ['bookhouse-light', w.bookhouse.memory.eventId, ['gemini', 'grok']],
    ['tea-square-three-cups', w.teaSquare.memory!.eventId, ['bluewhale', 'claude', 'gemini']],
    ['afternoon-tea-bookmark', w.afternoon.memories[0]!.eventId, ['bluewhale', 'claude']],
  ])
  expect(w).toEqual(before)
  w.teaSquare.memory!.count = 999; w.afternoon.memories[0]!.count = 44
  expect(communityMemorySources(w)).toEqual(sources)
  sources[0]!.participants = ['kimi', 'gpt']
  expect(w.bookhouse.memory.participants).toEqual(['gemini', 'grok'])
})

describe.each([['courtyard', scene], ['bookhouse', bookhouseScene], ['tea-square', teaSquareScene]] as const)('autonomous social in %s', (region, geometry) => {
  it('really approaches, respects geometry, holds a bounded exchange and returns to ordinary life without reward', () => {
    const w = neighbors(region), progress = JSON.stringify([w.progress, w.journal, w.neighborhood, w.bookhouse, w.teaSquare, w.afternoon]), rng = w.rng
    const before = structuredClone([w.actor, ...w.companions])
    expect(stepCommunitySocial(w, geometry)).toHaveLength(2)
    expect(w.community.active?.kind).toBe('greet')
    const texts = new Set<string>()
    for (let i = 0; i < 310; i++) {
      const previous = [w.actor, ...w.companions].map(a => ({ ...a.position }))
      stepCommunitySocial(w, geometry); w.ticks++; settleCommunitySocial(w, geometry)
      for (const [index, a] of [w.actor, ...w.companions].entries()) {
        expect(reachable(geometry, previous[index]!, a.position)).toBe(true)
        expect(Math.hypot(a.position.x - previous[index]!.x, a.position.y - previous[index]!.y)).toBeLessThanOrEqual(17 / 30 + 1e-7)
      }
      communityDialogue(w, 'en').forEach(line => texts.add(line.text))
      expect(validateLifeState(w.life, w, geometry)).toEqual(w.life)
      expect(validateCommunityState(w.community, w)).toEqual(w.community)
    }
    expect([w.actor, ...w.companions].some((a, i) => Math.hypot(a.position.x - before[i]!.position.x, a.position.y - before[i]!.position.y) > 20)).toBe(true)
    expect(texts.size).toBeGreaterThan(0)
    expect(w.life.social).toBeNull(); expect(w.community.active).toBeNull()
    expect([w.actor, ...w.companions].every(a => a.behavior === 'idle' && !a.destination && !a.intent)).toBe(true)
    expect(JSON.stringify([w.progress, w.journal, w.neighborhood, w.bookhouse, w.teaSquare, w.afternoon])).toBe(progress); expect(w.rng).toBe(rng)
  })
})

it('remembers an actual shared tea story in another region, exposing exact source ID and event ID in both locales', () => {
  const w = neighbors('bookhouse'); confirmedTea(w)
  stepCommunitySocial(w, bookhouseScene)
  expect(w.community.active).toMatchObject({ kind: 'recall', sourceId: 'tea-square-three-cups', region: 'bookhouse' })
  advance(w, bookhouseScene, 90)
  const zh = communityDialogue(w, 'zh')[0]!, en = communityDialogue(w, 'en')[0]!
  expect(zh.text).toContain('三杯不同的下午'); expect(zh.text).toContain('书屋')
  expect(en.text).toContain('Three cups, one afternoon')
  expect(zh.eventId).toBe(w.teaSquare.memory!.eventId); expect(en.sourceId).toBe('tea-square-three-cups')
  const unrelated = neighbors('bookhouse'); confirmedTea(unrelated); unrelated.companions[0]!.id = 'gpt'
  stepCommunitySocial(unrelated, bookhouseScene)
  expect(unrelated.community.active?.sourceId).toBeNull()
})

it('can notice a placed keepsake, but putting it away does not erase its unlock or fabricate a visible prop', () => {
  const w = neighbors('tea-square'); confirmedTea(w)
  stepCommunitySocial(w, teaSquareScene)
  expect(w.community.active?.kind).toBe('keepsake')
  advance(w, teaSquareScene, 90)
  expect(communityDialogue(w, 'zh')[0]?.text).toContain('三叶茶签')
  cancelCommunitySocial(w)
  w.teaSquare.keepsake = null; w.ticks = 4500
  stepCommunitySocial(w, teaSquareScene)
  expect(w.community.active?.sourceId).toBeNull()
  expect(communityCollection(w).keepsakes).toHaveLength(1)
  expect(communityCollection(w).keepsakes[0]?.placedRegion).toBeNull()
})

it('persists cooldown through cold restore, prevents modulo bypass and bounds long running history', () => {
  const w = neighbors(); confirmedTea(w); stepCommunitySocial(w, scene); advance(w, scene, 300)
  const restored = JSON.parse(JSON.stringify(w)) as typeof w
  restored.community = validateCommunityState(restored.community, restored)
  restored.ticks = 1800
  expect(stepCommunitySocial(restored, scene)).toEqual([])
  expect(restored.life.social).toBeNull()
  restored.ticks = 2700
  expect(stepCommunitySocial(restored, scene)).toHaveLength(2)
  expect(restored.community.active?.sourceId).toBeNull() // source cooldown outlasts pair cooldown
  cancelCommunitySocial(restored)
  restored.ticks = 4500
  stepCommunitySocial(restored, scene)
  expect(restored.community.active?.sourceId).toBe('tea-square-three-cups')
  cancelCommunitySocial(restored)
  for (let i = 0; i < 30; i++) { restored.ticks += 1800; stepCommunitySocial(restored, scene); cancelCommunitySocial(restored) }
  expect(restored.community.recent).toHaveLength(communityHistoryLimit)
  expect(validateCommunityState(restored.community, restored)).toEqual(restored.community)
})

it('supports invitation as a short interaction without launching or completing any explicit wish', () => {
  const w = neighbors(); w.ticks = 1800
  stepCommunitySocial(w, scene); expect(w.community.active?.kind).toBe('invite')
  advance(w, scene, 90)
  expect(communityDialogue(w, 'en')[0]?.text).toContain('pause together')
  expect(w.activeEvent).toBeNull(); expect(w.progress.completedWishes).toEqual([])
  expect(w.afternoon.memories).toEqual([]); expect(w.neighborhood.memories).toEqual([])
})

it('pause is inert, dragged/newly owned residents are preserved and legacy social migrates without metadata', () => {
  const w = neighbors(); w.userPaused = true
  const before = structuredClone(w); stepCommunitySocial(w, scene); expect(w).toEqual(before)
  w.userPaused = false; stepCommunitySocial(w, scene)
  const id = w.life.social!.pair[0], a = [w.actor, ...w.companions].find(a => a.id === id)!
  a.behavior = 'put_down'; a.destination = null; a.remaining = .5
  const protectedActor = structuredClone(a)
  stepCommunitySocial(w, scene, [id]); expect(a).toEqual(protectedActor)
  expect(w.life.social).toBeNull(); expect(w.community.active).toBeNull()
  const old = neighbors(); old.life.social = chooseLifeSocial(old, scene)
  expect(validateCommunityState(old.community, old).active).toBeNull()
  const active = neighbors(); stepCommunitySocial(active, scene); cancelLifeSocial(active)
  expect(() => validateCommunityState(active.community, active)).toThrow('INVALID_COMMUNITY_STATE')
  syncCommunitySocial(active); expect(validateCommunityState(active.community, active).active).toBeNull()
})

it('rejects impossible sources, invented casts, timing/cooldown violations and unbounded saved metadata', () => {
  const w = neighbors(); confirmedTea(w); stepCommunitySocial(w, scene)
  for (const mutate of [
    (v: typeof w.community) => { v.recent[0]!.sourceId = 'invented' },
    (v: typeof w.community) => { v.recent[0]!.pair = ['gpt', 'kimi'] },
    (v: typeof w.community) => { v.active!.startTick++ },
    (v: typeof w.community) => { v.nextAttemptTick = Number.POSITIVE_INFINITY },
    (v: typeof w.community) => { v.recent = Array(13).fill(v.recent[0]) },
    (v: typeof w.community) => { v.recent.push({ ...structuredClone(v.recent[0]!), startTick: 901 }) },
  ]) { const value = structuredClone(w.community); mutate(value); expect(() => validateCommunityState(value, w)).toThrow('INVALID_COMMUNITY_STATE') }
})

it('derives the visible three-place card only from confirmed facts, independent of travel, replay, prop visibility and social', () => {
  const w = neighbors('tea-square')
  expect(communityCollection(w).visitedRegions).toEqual([])
  confirmedTea(w)
  w.bookhouse.memory = { eventId: '22222222-2222-2222-2222-222222222222', participants: ['bluewhale', 'claude'], completedTick: 200, count: 1, theme: 'wind' }
  expect(communityCollection(w).threeRegions.unlocked).toBe(false)
  w.journal.push({ id: 'first-table', templateId: 'first-table', eventId: '33333333-3333-3333-3333-333333333333', participants: ['bluewhale', 'claude'], food: 'tea', completedTick: 50, count: 1 })
  const collection = communityCollection(w)
  expect(collection.visitedRegions).toEqual(['courtyard', 'bookhouse', 'tea-square'])
  expect(collection.threeRegions.placement).toEqual({ region: 'courtyard', x: 304, y: 198 })
  w.teaSquare.keepsake = null; w.teaSquare.memory!.count++
  expect(communityCollection(w).threeRegions).toEqual(collection.threeRegions)
})

it('integrates tea social through the frozen v14 projection, cold save and normal life after cancellation', () => {
  const home = neighbors(); confirmedTea(home)
  let w = switchRegion(validateLivingWorld(home, scene), scene, 'tea-square')
  stepLiving(w, scene)
  expect(w.community.active?.kind).toBe('keepsake')
  expect(w.life.social).not.toBeNull()
  w = validateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
  for (let i = 0; i < 350; i++) { stepLiving(w, scene); expect(validateLivingWorld(w, scene)).toEqual(w) }
  expect(w.community.active).toBeNull(); expect(w.life.social).toBeNull()
  expect(w.community.recent).toHaveLength(1)
  expect(w.teaSquare.memory).toEqual(home.teaSquare.memory)
})

it('observes a bookhouse keepsake with a valid room gesture through save, cold decode and normal completion', () => {
  const home = neighbors()
  home.bookhouse.memory = { eventId: '22222222-2222-2222-2222-222222222222', participants: ['bluewhale', 'claude'], completedTick: 200, count: 1, theme: 'light' }
  home.bookhouse.lastEventId = home.bookhouse.memory.eventId
  home.bookhouse.keepsake = 'bookhouse'
  let w = switchRegion(validateLivingWorld(home, scene), scene, 'bookhouse')
  const savedMemory = structuredClone(w.bookhouse.memory)
  stepLiving(w, scene)
  expect(w.community.active).toMatchObject({ kind: 'keepsake', sourceId: 'bookhouse-light' })
  expect(w.life.social?.kind).toBe('chat')
  w = migrateLivingWorld(JSON.parse(JSON.stringify(w)), scene)
  const lines: string[] = []
  for (let i = 0; i < 350; i++) {
    stepLiving(w, scene)
    expect(validateLivingWorld(w, scene)).toEqual(w)
    lines.push(...communityDialogue(w, 'zh').map(line => line.text))
  }
  expect(lines.some(line => line.includes('微光书签'))).toBe(true)
  expect(w.community.active).toBeNull(); expect(w.life.social).toBeNull()
  expect(w.bookhouse.memory).toEqual(savedMemory)
})

it('travel and removing a resident clear active metadata but preserve cooldown and confirmed facts', () => {
  const w = neighbors(); confirmedTea(w); stepLiving(w, scene)
  const recent = structuredClone(w.community.recent)
  const book = switchRegion(w, scene, 'bookhouse')
  expect(book.community.active).toBeNull(); expect(book.life.social).toBeNull(); expect(book.community.recent).toEqual(recent)
  const controller = new LivingController(w, scene, () => {})
  controller.setCharacterPresent('claude', false)
  expect(controller.snapshot().community.active).toBeNull()
  expect(controller.world.community.recent).toEqual(recent)
  expect(controller.world.teaSquare.memory?.participants).toEqual(['bluewhale', 'claude', 'gemini'])
})

it('hiding an observed keepsake cancels only the transient encounter and keeps the saved discovery', () => {
  const home = neighbors(); confirmedTea(home)
  const w = switchRegion(home, scene, 'tea-square'); stepLiving(w, scene)
  expect(w.community.active?.kind).toBe('keepsake')
  const hidden = placeTeaSquareKeepsake(w, scene, null)
  expect(hidden.community.active).toBeNull(); expect(hidden.life.social).toBeNull()
  expect(hidden.community.recent).toEqual(w.community.recent)
  expect(hidden.teaSquare.memory).toEqual(w.teaSquare.memory)
  expect(communityCollection(hidden).keepsakes).toHaveLength(1)
})

it('migrates an in-flight legacy social without inventing recent encounters or changing actors', () => {
  const old = createV14(scene)
  old.ticks = 900
  old.companions.push({ ...structuredClone(old.actor), id: 'claude', position: { x: 260, y: 340 }, safe: { x: 260, y: 340 } })
  old.life.social = chooseLifeSocial(old, scene)
  expect(old.life.social).not.toBeNull()
  const migrated = migrateLivingWorld(old, scene)
  expect(migrated.life).toEqual(old.life)
  expect(migrated.community).toEqual({ version: 1, nextAttemptTick: 1800, recent: [], active: null })
  for (let i = 0; i < 310; i++) stepLiving(migrated, scene)
  expect(validateLivingWorld(migrated, scene).community.recent).toEqual([])
  expect(migrated.life.social).toBeNull()
})

it('rechecks a missed idle window without shortening successful pair or source cooldowns',()=>{
 const w=neighbors();confirmedTea(w)
 expect(stepCommunitySocial(w,scene,['bluewhale','claude'])).toEqual([])
 expect(w.community.recent).toEqual([]);expect(w.community.nextAttemptTick).toBe(990)
 w.ticks=989;expect(stepCommunitySocial(w,scene)).toEqual([])
 w.ticks=990;expect(stepCommunitySocial(w,scene).length).toBe(2)
 const first=structuredClone(w.community.recent[0]!);cancelCommunitySocial(w)
 w.ticks=1890;expect(stepCommunitySocial(w,scene)).toEqual([])
 expect(w.community.recent).toEqual([first]);expect(w.community.nextAttemptTick).toBe(1980)
 expect(validateCommunityState(w.community,w)).toEqual(w.community)
 w.ticks=2789;expect(stepCommunitySocial(w,scene)).toEqual([])
 expect(w.community.recent).toHaveLength(1)
})

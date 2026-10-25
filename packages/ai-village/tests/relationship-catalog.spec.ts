import { expect, it } from 'vitest'
import { createLivingWorld } from '../src/core/living-state.ts'
import { relationshipFacts } from '../src/core/relationship-catalog.ts'
import { scene } from '../src/definitions.ts'

it('projects all 66 possibilities without inventing a record from presence or pending play', () => {
  const world = createLivingWorld(scene), before = structuredClone(world)
  const facts = relationshipFacts(world)
  expect(facts.pairs).toHaveLength(66)
  expect(new Set(facts.pairs.map(pair => pair.id)).size).toBe(66)
  expect(facts.discoveredCount).toBe(0)
  expect(facts.pairs.every(pair => !pair.discovered && pair.sharedCount === null && !pair.sources.length)).toBe(true)
  expect(world).toEqual(before)
})

it('never spreads the first bookhouse cast, theme, keepsake or global replay count into other bonds', () => {
  const world = createLivingWorld(scene)
  world.bookhouse.memory = { eventId: crypto.randomUUID(), participants: ['bluewhale', 'claude'], completedTick: 42, count: 9, theme: 'wind' }
  world.bookhouse.keepsake = null
  world.neighborhood.bonds = [{ pair: ['bluewhale', 'claude'], count: 2, lastTick: 80 }, { pair: ['gemini', 'glm'], count: 7, lastTick: 90 }]
  const facts = relationshipFacts(world), first = facts.pairs.find(pair => pair.id === 'bluewhale/claude')!, later = facts.pairs.find(pair => pair.id === 'gemini/glm')!
  expect(facts.discoveredCount).toBe(2)
  expect(first.sharedCount).toBe(2)
  expect(first.sources).toHaveLength(1)
  expect(first.sources[0]).toMatchObject({ completedTick: 42, participants: ['bluewhale', 'claude'], keepsake: { id: 'little-light-bookmark', location: { en: 'Put away; still unlocked' } } })
  expect(first.sources[0]!.detail.en).toContain('theme: wind')
  expect(later).toMatchObject({ discovered: true, sharedCount: 7, sources: [] })
  expect(facts.pairs.filter(pair => pair.sources.length)).toHaveLength(1)
})

it('keeps the actual first group cast on each genuine pair while ignoring single-resident memories', () => {
  const world = createLivingWorld(scene)
  world.neighborhood.memories.push(
    { id: 'stargazing', eventId: crypto.randomUUID(), participants: ['bluewhale', 'kimi', 'mistral'], count: 12, completedTick: 24 },
    { id: 'find-whale', eventId: crypto.randomUUID(), participants: ['gpt'], count: 8, completedTick: 25 },
  )
  world.play.decorations['star-mobile'] = 'wall'
  const before = structuredClone(world), facts = relationshipFacts(world), discovered = facts.pairs.filter(pair => pair.discovered)
  expect(discovered.map(pair => pair.id)).toEqual(['bluewhale/kimi', 'bluewhale/mistral', 'kimi/mistral'])
  expect(discovered.every(pair => pair.sharedCount === null)).toBe(true)
  expect(discovered.every(pair => pair.sources[0]!.participants.length === 3)).toBe(true)
  expect(discovered[0]!.sources[0]!.keepsake).toMatchObject({ id: 'star-mobile', location: { en: 'Courtyard · wall' } })
  expect(facts.milestones.map(item => item.unlocked)).toEqual([true, false, false])
  expect(world).toEqual(before)
})

it('derives optional 3/8/15 titles from distinct saved pairs rather than activity counts', () => {
  const world = createLivingWorld(scene), possibilities = relationshipFacts(world).pairs
  for (const count of [2, 3, 7, 8, 14, 15]) {
    world.neighborhood.bonds = possibilities.slice(0, count).map(item => ({ pair: [...item.pair].sort() as typeof world.neighborhood.bonds[number]['pair'], count: 999, lastTick: 100 }))
    expect(relationshipFacts(world).milestones.map(item => item.unlocked)).toEqual([count >= 3, count >= 8, count >= 15])
  }
})

it('retains first table food and unlocked keepsake independently of placement', () => {
  const world = createLivingWorld(scene)
  world.journal.push({ id: 'first-table', templateId: 'first-table', eventId: crypto.randomUUID(), participants: ['llama', 'qwen'], food: 'tea', completedTick: 40, count: 10 })
  world.decorations.windChime = { id: 'first-wind-chime', slot: null }
  const facts = relationshipFacts(world), actual = facts.pairs.find(pair => pair.id === 'llama/qwen')!
  expect(actual).toMatchObject({ discovered: true, sharedCount: null, lastTick: null })
  expect(actual.sources[0]).toMatchObject({ detail: { en: 'The first shared serving was tea.' }, keepsake: { id: 'wind-chime', location: { en: 'Put away; still unlocked' } } })
})

it('records the first puzzle pair independently of the first reading and does not invent a puzzle keepsake', () => {
  const world = createLivingWorld(scene)
  world.bookhouse.puzzleMemory = { eventId: crypto.randomUUID(), participants: ['glm', 'gemini'], completedTick: 85, count: 20 }
  const facts = relationshipFacts(world), actual = facts.pairs.find(pair => pair.id === 'gemini/glm')!
  expect(facts.discoveredCount).toBe(1)
  expect(actual.sources).toHaveLength(1)
  expect(actual.sources[0]).toMatchObject({ id: 'bookhouse-puzzle', participants: ['glm', 'gemini'], keepsake: null })
  expect(actual.sharedCount).toBeNull()
})

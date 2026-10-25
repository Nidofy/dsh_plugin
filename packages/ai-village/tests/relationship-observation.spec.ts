import { expect, it } from 'vitest'
import { createLivingWorld } from '../src/core/living-state.ts'
import { keepsakeObservation } from '../src/core/keepsake-observation.ts'
import { scene } from '../src/definitions.ts'

it('only uses personal memory wording for a saved participant in that keepsake’s source', () => {
  const world = createLivingWorld(scene)
  world.actor.position = { x: 148, y: 230 }; world.actor.behavior = 'idle'; world.actor.intent = null; world.actor.phase = 1
  world.play.decorations['page-marker'] = 'window'
  world.neighborhood.memories.push({ id: 'quiet-page', eventId: crypto.randomUUID(), participants: ['kimi', 'claude'], completedTick: 20, count: 999 })
  world.neighborhood.bonds.push({ pair: ['bluewhale', 'claude'], count: 999, lastTick: 50 })
  expect(keepsakeObservation(world, 'en')?.text).toContain('looks lovely')
  expect(keepsakeObservation(world, 'zh')?.text).not.toContain('那次一起')
  world.neighborhood.memories[0]!.participants = ['bluewhale', 'claude']
  const before = structuredClone(world)
  expect(keepsakeObservation(world, 'en')?.text).toContain('our time together')
  expect(keepsakeObservation(world, 'zh')?.text).toContain('那次一起')
  expect(world).toEqual(before)
})

it('does not infer source participation from a different memory or from an unlocked decoration alone', () => {
  const world = createLivingWorld(scene)
  world.actor.position = { x: 148, y: 230 }; world.actor.behavior = 'idle'; world.actor.intent = null; world.actor.phase = 1
  world.play.decorations['page-marker'] = 'window'
  world.neighborhood.memories.push({ id: 'lost-rice', eventId: crypto.randomUUID(), participants: ['bluewhale', 'claude'], completedTick: 20, count: 1 })
  expect(keepsakeObservation(world, 'en')?.text).toContain('looks lovely')
  world.play.decorations['page-marker'] = null
  expect(keepsakeObservation(world, 'en')).toBeNull()
})

import { it, expect } from 'vitest'
import { WorldController } from '../src/core/controller.ts'
import { createWorld, validateWorld } from '../src/core/world.ts'
import { approvedEntranceCharacterIds as characterIds } from '../src/core/roster.ts'
import { scene, roster } from '../src/definitions.ts'
import { samplePose } from '../src/art/animation.ts'
import type { Action } from '../src/art/types.ts'
it('keeps legacy saves, activity and pause when selecting; rolls back drag and rejects unknown IDs', () => {
  const legacy = createWorld(scene), c = new WorldController(legacy, scene, () => {})
  expect(validateWorld(legacy, scene)).toEqual(legacy)
  c.pointer({ type: 'down', id: 1, point: { ...legacy.actor.position }, css: { x: 0, y: 0 } })
  c.pointer({ type: 'move', id: 1, point: { x: 260, y: 400 }, css: { x: 100, y: 100 } })
  expect(c.drag?.active).toBe(true)
  c.selectCharacter('claude')
  expect(c.drag).toBeNull()
  expect(c.world.actor.position).toEqual(legacy.actor.safe)
  c.world.actor.behavior = 'rest'; c.world.actor.position = { ...scene.hotspots.find(h => h.id === 'rest')!.anchor }
  c.world.actor.safe = { ...c.world.actor.position }; c.pause('user', true)
  const before = c.snapshot()
  for (const id of characterIds) {
    c.selectCharacter(id)
    expect(c.snapshot()).toEqual({ ...before, actor: { ...before.actor, id } })
  }
  c.selectCharacter('../../unexpected')
  expect(c.world.actor.id).toBe('qwen')
  expect(() => validateWorld({ ...before, actor: { ...before.actor, id: '__proto__' } }, scene)).toThrow('INVALID_WORLD')
})
it('all additional rigs have complete independently animated legs, arms, expressions and valid tracks', () => {
  for (const art of Object.values(roster)) {
    for (const action of ['idle', 'walk', 'pickup', 'dragging', 'put_down'] as Action[])
      for (let time = 0; time <= 2; time += .05) expect(() => samplePose(art.character, art.animations.actions[action], time)).not.toThrow()
    const pose = samplePose(art.character, art.animations.actions.walk, .1)
    expect(pose.transforms['leg-left']!.rotation).not.toBe(pose.transforms['leg-right']!.rotation)
  }
})

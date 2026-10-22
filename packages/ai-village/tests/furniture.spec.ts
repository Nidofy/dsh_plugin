import { expect, it } from 'vitest'
import scene from './fixtures/legacy/scene-v1.json'
import { createWorld } from '../src/core/world.ts'
import { activityDepth, furnitureDepth, propVisible, seatProps } from '../src/frame/furniture.ts'
import { candidateScene } from '../experiments/content-ui/scene.ts'

it('keeps legacy tabletop depths and derives moved double-seat props independently', () => {
  expect(furnitureDepth(scene, 'eat')).toBe(3080)
  expect(seatProps(scene)[0]!.rect).toEqual({ x: 277, y: 241, width: 22, height: 17 })
  const actor = createWorld(candidateScene).actor
  Object.assign(actor, { behavior: 'eat', position: candidateScene.hotspots[1]!.anchor,
    intent: { furnitureId: 'eat', seat: 'left', activity: 'eat', stage: 'use', route: [], expires: 900 } })
  const [left, right] = seatProps(candidateScene)
  expect(activityDepth(candidateScene, actor, 0)).toBe(3990)
  expect(propVisible(left!, [actor])).toBe(false)
  expect(propVisible(right!, [actor])).toBe(true)
  expect(propVisible(left!, [actor], actor.id)).toBe(true)
})

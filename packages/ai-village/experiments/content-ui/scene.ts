import { legacySceneV1 } from '../../src/core/migrations.ts'
import { scene as legacy } from '../../src/definitions.ts'
import { createWorld, actors, abandon, walkable, available, routeTo, validateWorld } from '../../src/core/world.ts'
import type { Point, World } from '../../src/core/world.ts'
import { legacyCharacterIds as characterIds } from '../../src/core/roster-policy.ts'
import type { SceneArt } from '../../src/frame/furniture.ts'

/** Candidate geometry only. This module is not imported by the installed plugin. */
export const candidateScene: SceneArt = {
  ...structuredClone(legacy), version: 2,
  obstacles: [{ x: 38, y: 290, width: 124, height: 27 }, { x: 115, y: 381, width: 220, height: 27 }],
  spawn: { x: 174, y: 340 },
  hotspots: [
    { id: 'work', activity: 'work', seat: 'main', hit: { x: 46, y: 225, width: 112, height: 64 }, anchor: { x: 102, y: 283 } },
    { id: 'eat', activity: 'eat', seat: 'left', hit: { x: 123, y: 316, width: 100, height: 64 }, anchor: { x: 175, y: 374 } },
    { id: 'eat', activity: 'eat', seat: 'right', hit: { x: 225, y: 316, width: 102, height: 64 }, anchor: { x: 273, y: 374 } },
    { id: 'rest', activity: 'rest', seat: 'main', hit: { x: 233, y: 211, width: 90, height: 44 }, anchor: { x: 274, y: 245 } },
  ],
  furniture: [legacy.furniture[0]!, { id: 'eat', asset: 'table', rect: { x: 123, y: 330, width: 204, height: 68 }, split: .1 }],
  cushion: { x: 235, y: 219, width: 78, height: 44 },
  seatProps: [
    { furnitureId: 'eat', seat: 'left', asset: 'scene/bowl.png', rect: { x: 184, y: 332, width: 22, height: 17 } },
    { furnitureId: 'eat', seat: 'right', asset: 'scene/bowl.png', rect: { x: 282, y: 332, width: 22, height: 17 } },
  ],
}
export const bellSlots = [
  { id: 'window', zh: '窗边', en: 'Window', x: 185, y: 105 },
  { id: 'door', zh: '门旁', en: 'Doorway', x: 234, y: 130 },
  { id: 'wall', zh: '院墙', en: 'Garden wall', x: 96, y: 117 },
] as const
export type BellSlot = typeof bellSlots[number]['id']
const starts: Point[] = [{ x: 175, y: 344 }, { x: 273, y: 344 }, { x: 54, y: 230 },
  { x: 166, y: 230 }, { x: 230, y: 230 }, { x: 55, y: 350 }, { x: 60, y: 429 }]
export function previewWorld(): World {
  const world = createWorld(candidateScene)
  const residents = characterIds.map((id, index) => ({ ...structuredClone(world.actor), id, position: { ...starts[index]! }, safe: { ...starts[index]! }, remaining: 60 }))
  world.actor = residents[0]!; world.companions = residents.slice(1)
  return validateWorld(world, candidateScene)
}

/** Geometry migration probe, not schema-4 persistence. Validate against legacy geometry first. */
export function migrateGeometryProbe(value: unknown): World {
  const world = validateWorld(value, legacySceneV1)
  world.sceneVersion = candidateScene.version
  const residents = actors(world).sort((a, b) => a.id.localeCompare(b.id))
  const occupied: Point[] = []
  for (const actor of residents) {
    abandon(actor)
    const safe = (p: Point) => walkable(candidateScene, p) && occupied.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 24)
      && candidateScene.hotspots.every(h => Math.hypot(h.anchor.x - p.x, h.anchor.y - p.y) >= 24)
      && !!routeTo(candidateScene, candidateScene.spawn, p)
    if (!safe(actor.position)) {
      const choices: Point[] = []
      for (let y = 220; y <= 430; y += 30) for (let x = 50; x <= 290; x += 30) choices.push({ x, y })
      const target = choices.find(safe)
      if (!target) throw Error('NO_SAFE_MIGRATION_POSITION')
      actor.position = target
    }
    actor.safe = { ...actor.position }; occupied.push(actor.position)
  }
  if (!actors(world).every(a => available(world, a.position, a.id))) throw Error('OVERLAPPING_MIGRATION')
  return validateWorld(world, candidateScene)
}

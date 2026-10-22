import { describe, expect, it } from 'vitest'
import { ContentPreview } from '../experiments/content-ui/model.ts'
import { candidateScene, migrateGeometryProbe } from '../experiments/content-ui/scene.ts'
import { actors, available, createWorld, reachable, routeTo, validateWorld, walkable } from '../src/core/world.ts'
import { legacySceneV1 as scene } from '../src/core/migrations.ts'

describe('M0/M1 real geometry and memory-only story', () => {
  it('both seats are reachable from all seven starting positions without obstacle crossings', () => {
    const preview = new ContentPreview()
    for (const actor of actors(preview.controller.world)) for (const seat of candidateScene.hotspots.filter(h => h.id === 'eat')) {
      const path = routeTo(candidateScene, actor.position, seat.anchor)
      expect(path).not.toBeNull()
      let from = actor.position
      for (const point of path!) { expect(reachable(candidateScene, from, point)).toBe(true); from = point }
    }
  })
  it('requires actual arrival and conversation, then grants one journal and one bell', () => {
    const preview = new ContentPreview()
    expect(preview.invite(['bluewhale', 'claude'], 'tea')).toBe(true)
    for (let n = 0; n < 30; n++) preview.advance(1 / 30)
    expect(preview.stage).toBe('approaching'); expect(preview.journal).toHaveLength(0)
    for (let n = 0; n < 270; n++) preview.advance(1 / 30)
    expect(preview.stage).toBe('completed'); expect(preview.journal).toHaveLength(1)
    expect(preview.unlocked).toBe(true)
    expect(preview.invite(['bluewhale', 'claude'], 'rice')).toBe(false)
    preview.preview('window'); expect(preview.placed).toBeNull()
    preview.discard(); expect(preview.placed).toBeNull()
    preview.preview('door'); preview.confirm(); expect(preview.placed).toBe('door')
    for (let n = 0; n < 180; n++) preview.advance(1 / 30)
    expect(preview.journal).toHaveLength(1)
  })
  it('pause stops the story clock and cancellation releases reservations without reward', () => {
    const preview = new ContentPreview()
    preview.invite(['bluewhale', 'claude'], 'rice')
    preview.controller.pause('hidden', true)
    for (let n = 0; n < 300; n++) preview.advance(1 / 30)
    expect(preview.controller.world.ticks).toBe(0)
    preview.cancel(); expect(preview.unlocked).toBe(false)
    expect(actors(preview.controller.world).every(a => !a.intent)).toBe(true)
  })
  it('rejects occupied seats and releases both seats if a participant is interrupted', () => {
    const preview = new ContentPreview()
    preview.invite(['bluewhale', 'claude'], 'tea')
    preview.controller.world.actor.intent = null
    preview.advance(1 / 30)
    expect(preview.stage).toBe('cancelled'); expect(preview.reason).toBe('blocked')
    expect(preview.journal).toHaveLength(0)
    const other = actors(preview.controller.world)[2]!
    other.intent = { furnitureId: 'eat', seat: 'left', activity: 'eat', stage: 'use', route: [], expires: 900 }
    expect(preview.invite(['bluewhale', 'claude'], 'tea')).toBe(false)
  })
  it('probes legacy geometry without mutating input, preserving identity and clocks', () => {
    const old = createWorld(scene)
    old.actor.position = { x: 274, y: 411 }; old.actor.safe = { ...old.actor.position }
    old.ticks = 900; old.userPaused = true
    const original = JSON.stringify(old), next = migrateGeometryProbe(old)
    expect(JSON.stringify(old)).toBe(original)
    expect(next.actor.id).toBe(old.actor.id); expect(next.rng).toBe(old.rng)
    expect(next.ticks).toBe(900); expect(next.userPaused).toBe(true)
    expect(actors(next).every(a => walkable(candidateScene, a.position) && available(next, a.position, a.id))).toBe(true)
    expect(validateWorld(next, candidateScene)).toEqual(next)
  })
})

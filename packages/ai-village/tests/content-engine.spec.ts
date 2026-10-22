import { describe, expect, it } from 'vitest'
import { candidateScene, previewWorld } from '../experiments/content-ui/scene.ts'
import { emptyContent, validateContentWorld } from '../src/core/content-state.ts'
import { inviteTea, placeBell, settleTea, stepTea } from '../src/core/content-engine.ts'
import { actors, available } from '../src/core/world.ts'
import { characterIds } from '../src/core/roster.ts'
import { ContentController } from '../src/core/content-controller.ts'

describe('durable tea simulation', () => {
  it('all 42 ordered pairs reach both seats without collision or teleporting, including resume', () => {
    for (const first of characterIds) for (const second of characterIds) if (first !== second) {
      let world = inviteTea(emptyContent(previewWorld()), candidateScene, [first, second], 'tea', crypto.randomUUID())
      for (let tick = 0; tick < 1231 && world.activeEvent; tick++) {
        const before = actors(world).map(a => ({ id: a.id, ...a.position }))
        stepTea(world, candidateScene)
        expect(actors(world).every(a => available(world, a.position, a.id))).toBe(true)
        for (const actor of actors(world)) {
          const last = before.find(a => a.id === actor.id)!
          expect(Math.hypot(actor.position.x - last.x, actor.position.y - last.y)).toBeLessThanOrEqual(17 / 30 + 1e-7)
        }
        if (tick === 179) world = validateContentWorld(JSON.parse(JSON.stringify(world)), candidateScene)
        world = settleTea(world, candidateScene) ?? world
      }
      expect(world.activeEvent, first + '/' + second).toBeNull()
      expect(world.journal, first + '/' + second).toHaveLength(1)
      expect(world.progress.unlocked).toEqual(['wind-chime'])
    }
  })
  it('resumes deterministically; completion deduplicates and decor is a separate draft', () => {
    let world = inviteTea(emptyContent(previewWorld()), candidateScene, ['bluewhale', 'claude'], 'rice', crypto.randomUUID())
    for (let i = 0; i < 20; i++) stepTea(world, candidateScene)
    const resumed = validateContentWorld(JSON.parse(JSON.stringify(world)), candidateScene)
    for (let i = 0; i < 300; i++) { stepTea(world, candidateScene); stepTea(resumed, candidateScene) }
    expect(resumed).toEqual(world)
    world = settleTea(world, candidateScene)!
    expect(settleTea(world, candidateScene)).toBeNull()
    const decorated = placeBell(world, candidateScene, 'window')
    expect(world.decorations.windChime?.slot).toBeNull()
    expect(decorated.decorations.windChime?.slot).toBe('window')
    const firstMemory = structuredClone(world.journal[0]!)
    world = inviteTea(world, candidateScene, ['bluewhale', 'claude'], 'tea', crypto.randomUUID())
    for (let i = 0; i < 155; i++) stepTea(world, candidateScene)
    world = settleTea(world, candidateScene)!
    expect(world.journal).toHaveLength(1); expect(world.journal[0]!.count).toBe(2)
    expect(world.journal[0]).toEqual({ ...firstMemory, count: 2 })
    expect(world.progress.unlocked).toEqual(['wind-chime'])
  })
  it('drag drafts freeze gathering, cancel resumes, leaving removes the event', () => {
    const world = inviteTea(emptyContent(previewWorld()), candidateScene, ['bluewhale', 'claude'], 'tea', crypto.randomUUID())
    const c = new ContentController(world, candidateScene, () => {})
    c.pointer({ type: 'down', id: 1, point: { x: 175, y: 340 }, css: { x: 0, y: 0 } })
    c.advance(.1); expect(world.ticks).toBe(0)
    c.cancelDrag(); c.advance(.1); expect(world.ticks).toBeGreaterThan(0)
    c.setCharacterPresent('claude', false)
    expect(c.snapshot().activeEvent).toBeNull(); expect(world.journal).toHaveLength(0)
  })
  it('dropping back on the reserved seat preserves tea; an actual departure cancels both reservations', () => {
    const world = inviteTea(emptyContent(previewWorld()), candidateScene, ['bluewhale', 'claude'], 'tea', crypto.randomUUID())
    for (let i = 0; i < 120; i++) stepTea(world, candidateScene)
    expect(world.activeEvent?.phase).toBe('talking')
    const c = new ContentController(world, candidateScene, () => {})
    const foot = { ...world.actor.position }
    c.pointer({ type: 'down', id: 1, point: foot, css: { x: 0, y: 0 } })
    c.pointer({ type: 'up', id: 1, point: foot, css: { x: 20, y: 0 } })
    expect(c.snapshot().activeEvent?.phase).toBe('talking')
    c.pointer({ type: 'down', id: 2, point: foot, css: { x: 0, y: 0 } })
    c.pointer({ type: 'up', id: 2, point: { x: 180, y: 425 }, css: { x: 20, y: 0 } })
    expect(c.snapshot().activeEvent).toBeNull()
    expect(actors(world).filter(a => ['bluewhale', 'claude'].includes(a.id)).every(a => !a.intent)).toBe(true)
    expect(world.journal).toHaveLength(0)
  })
})

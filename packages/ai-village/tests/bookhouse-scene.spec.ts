import { describe, expect, it } from 'vitest'
import { bookhouseEntries, bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { available, createWorld, placement, reachable, routeTo, seatAvailable, walkable } from '../src/core/world.ts'
import { furnitureDepth, seatProps } from '../src/frame/furniture.ts'

describe('independent bookhouse development geometry', () => {
  it('connects every entry, spawn and activity place with obstacle-safe routes', () => {
    const places = [bookhouseScene.spawn, ...bookhouseEntries, ...bookhouseScene.hotspots.map(h => h.anchor)]
    for (const from of places) {
      expect(walkable(bookhouseScene, from)).toBe(true)
      for (const to of places) {
        const route = routeTo(bookhouseScene, from, to)
        expect(route).not.toBeNull()
        let previous = from
        for (const next of route!) { expect(reachable(bookhouseScene, previous, next)).toBe(true); previous = next }
        expect(previous).toEqual(to)
      }
    }
  })

  it('admits seven distinct footprints without placing residents inside furniture', () => {
    expect(bookhouseEntries).toHaveLength(7)
    const world = createWorld(bookhouseScene)
    for (const [index, point] of bookhouseEntries.entries()) {
      expect(walkable(bookhouseScene, point)).toBe(true)
      for (const other of bookhouseEntries.slice(index + 1)) expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(24)
    }
    world.actor.position = { ...bookhouseEntries[0]! }
    expect(available(world, bookhouseEntries[1]!)).toBe(true)
    expect(available(world, bookhouseEntries[0]!)).toBe(false)
  })

  it('maps hits to exact legal activities, retains exclusive seats, and rejects blocked drops', () => {
    const world = createWorld(bookhouseScene)
    for (const hotspot of bookhouseScene.hotspots) {
      const target = placement(bookhouseScene, hotspot.anchor, world.actor.safe)
      expect(target.accepted).toBe(true); expect(target.activity).toBe(hotspot.activity)
      expect(target.position).toEqual(hotspot.anchor)
      world.actor.position = { ...hotspot.anchor }
      world.actor.behavior = hotspot.activity!
      world.actor.intent = { furnitureId: hotspot.id, seat: 'main', activity: hotspot.activity!, stage: 'use', route: [], expires: 200 }
      expect(seatAvailable(world, hotspot, 'claude')).toBe(false)
      expect(seatAvailable(world, hotspot, world.actor.id)).toBe(true)
    }
    for (const obstacle of bookhouseScene.obstacles) {
      const point = { x: obstacle.x + obstacle.width / 2, y: obstacle.y + obstacle.height / 2 }
      expect(placement(bookhouseScene, point, bookhouseScene.spawn)).toMatchObject({ accepted: false, position: bookhouseScene.spawn })
    }
  })

  it('has no dining fallback props or courtyard cushion and supplies contact depth for every seat', () => {
    expect(bookhouseScene.id).toBe('bookhouse'); expect(bookhouseScene.version).toBe(1)
    expect(bookhouseScene.cushion).toBeUndefined(); expect(seatProps(bookhouseScene)).toEqual([])
    for (const hotspot of bookhouseScene.hotspots) expect(furnitureDepth(bookhouseScene, hotspot.id)).toBeGreaterThan(0)
    expect(bookhouseScene.furniture.every(f => f.asset.startsWith('code/bookhouse/'))).toBe(true)
  })
})

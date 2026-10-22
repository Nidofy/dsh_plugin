import { expect, it } from 'vitest'
import { sceneViewport } from '../src/frame/viewport.ts'

it.each([[340, 1100], [340, 600], [360, 480], [900, 300]])('fits the entire world and real backdrop with one projection at %s by %s', (width, height) => {
  const { world, background } = sceneViewport(width, height)
  expect(background.x).toBe(world.x)
  expect(background.y).toBe(world.y)
  expect(background.width).toBe(360 * world.scale)
  expect(background.height).toBe(480 * world.scale)
  expect(background.width / background.height).toBeCloseTo(3 / 4)
  expect(world.x).toBeGreaterThanOrEqual(0)
  expect(world.y).toBeGreaterThanOrEqual(0)
  expect(world.x + 360 * world.scale).toBeLessThanOrEqual(width)
  expect(world.y + 480 * world.scale).toBeLessThanOrEqual(height)
  const point = { x: 280, y: 410 }
  expect(((world.x + point.x * world.scale) - world.x) / world.scale).toBeCloseTo(point.x)
  expect(((world.y + point.y * world.scale) - world.y) / world.scale).toBeCloseTo(point.y)
})

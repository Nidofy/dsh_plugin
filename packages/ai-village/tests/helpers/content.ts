import { emptyContent, type ContentWorld } from '../../src/core/content-state.ts'
import { previewWorld } from '../../experiments/content-ui/scene.ts'
export const eventId = '10000000-0000-0000-0000-000000000001'
export function completedContent(): ContentWorld {
  const world = emptyContent(previewWorld())
  world.ticks = 900
  world.progress = { completedWishes: ['first-tea'], discovered: ['first-table'], unlocked: ['wind-chime'], lastCompletedEventId: eventId }
  world.journal = [{ id: '20000000-0000-0000-0000-000000000001', templateId: 'first-table', eventId, participants: ['bluewhale', 'claude'], food: 'tea', completedTick: 900, count: 1 }]
  world.decorations.windChime = { id: 'first-wind-chime', slot: null }
  return world
}

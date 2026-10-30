import type { LivingWorld } from './living-state.ts'
import { afternoonStories } from './afternoon-catalog.ts'

/** Fixed scene anchors for confirmed keepsakes, shared with photos and hit testing. */
export function storyKeepsakes(w: LivingWorld) {
  const spots: Record<string, { x: number; y: number }> = {
    'tea-bookmark': { x: 268, y: 142 }, 'reflection-shapes': { x: 292, y: 146 },
    'rice-and-tea': { x: 266, y: 180 }, 'broken-rhythm': { x: 304, y: 180 },
    'odd-answers': { x: 262, y: 180 }, 'reading-corner': { x: 302, y: 180 },
    'wind-scroll': { x: 80, y: 220 }, 'tomorrow-plan': { x: 180, y: 220 }, 'lost-diary-home': { x: 270, y: 220 },
  }
  return afternoonStories.filter(s => s.region === w.region.active && w.afternoon.keepsakes[s.id] && w.afternoon.memories.some(m => m.storyId === s.id)).map(story => ({ story, point: spots[story.id]! }))
}

import type { LivingWorld } from './living-state.ts'
import { actors, type Point } from './world.ts'
import { afternoonStories, afternoonOperations, type AfternoonAction, type AfternoonStoryId } from './afternoon-catalog.ts'
import { residentStory, type StoryProp } from './resident-stories-catalog.ts'
import { afternoonToken } from './afternoon-state.ts'
import { storyKeepsakes } from './story-keepsakes.ts'

export interface SceneInteraction {
  id: string
  token: string
  region: LivingWorld['region']['active']
  point: Point
  radius: number
  priority: number
  label: { zh: string; en: string }
  prop: StoryProp
  selected?: boolean
  command: { kind: 'start'; story: AfternoonStoryId } | { kind: 'act'; action: AfternoonAction; choice?: string } | { kind: 'recall'; story: AfternoonStoryId }
}

/** Read-only projection. Geometry, painting and authority-side hit testing share this list.
 * No pointer gesture, draft selection, reward or second story state is persisted here. */
export function sceneInteractions(w: LivingWorld): SceneInteraction[] {
  const e = w.afternoon.active
  const make = (id: string, point: Point, label: SceneInteraction['label'], prop: SceneInteraction['prop'], command: SceneInteraction['command'], token: string, selected = false): SceneInteraction => ({ id, point, label, prop, command, token, selected, radius: 23, priority: 100, region: w.region.active })
  if (!e) {
    if (w.teaSquare.active || w.teaSquare.activity || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event) return []
    const points: Record<string, Point> = { 'tea-bookmark': { x: 282, y: 204 }, 'reflection-shapes': { x: 180, y: 274 }, 'rice-and-tea': { x: 64, y: 214 }, 'broken-rhythm': { x: 120, y: 274 }, 'lost-diary-tea': { x: 240, y: 274 }, 'odd-answers': { x: 126, y: 306 }, 'reading-corner': { x: 92, y: 218 }, 'lost-diary-page': { x: 186, y: 306 }, 'wind-scroll': { x: 80, y: 270 }, 'tomorrow-plan': { x: 180, y: 220 }, 'lost-diary-home': { x: 270, y: 270 } }
    return afternoonStories.filter(story => story.region === w.region.active).flatMap((story, i) => {
      const memory = w.afternoon.memories.find(m => m.storyId === story.id)
      if (memory && w.afternoon.keepsakes[story.id]) return [{ ...make(`recall:${story.id}`, storyKeepsakes(w).find(k => k.story.id === story.id)!.point, story.keepsakeTitle, story.id === 'reflection-shapes' ? 'mirror' : 'bookmark', { kind: 'recall', story: story.id }, `recall:${memory.eventId}`), radius: 16 }]
      if (story.prerequisite && !w.afternoon.memories.some(m => m.storyId === story.prerequisite)) return []
      if (!story.participants.every(id => actors(w).some(a => a.id === id))) return []
      return [make(`discover:${story.id}`, points[story.id]!, story.title, residentStory(story.id)?.steps[0]?.choices[0]?.prop ?? (i ? 'cup' : 'note'), { kind: 'start', story: story.id }, `discover:${story.id}:${w.afternoon.lastEventIds[story.id] ?? 'first'}`)]
    })
  }
  if (e.phase !== 'ready') return []
  const token = afternoonToken(e)
  // Paper is on the shared work surface between the two residents, above their feet.
  const midpoint = e.targets.reduce((p, q) => ({ x: p.x + q.x / 2, y: p.y + q.y / 2 }), { x: 0, y: 0 })
  const y = w.region.active === 'tea-square' ? 274 : w.region.active === 'bookhouse' ? 302 : Math.max(235, Math.min(320, midpoint.y - 48))
  const act = (id: string, x: number, zh: string, en: string, prop: SceneInteraction['prop'], action: AfternoonAction, choice?: string) => make(`afternoon:${id}`, { x, y }, { zh, en }, prop, { kind: 'act', action, ...(choice ? { choice } : {}) }, token, e.selection === choice)
  if (residentStory(e.storyId)) return afternoonOperations(e).map((op, i, operations) => {
    const x = e.stage === 2 ? Math.max(70, Math.min(290, midpoint.x)) : 180 + (i - (operations.length - 1) / 2) * 86
    const hit = act(`${op.action}:${op.choice ?? 'keep'}`, x, e.stage === 0 ? '查看线索' : op.label.zh, e.stage === 0 ? 'Inspect the clue' : op.label.en, op.prop, op.action, op.choice)
    if (e.stage === 2) hit.point.y = Math.max(220, Math.min(340, midpoint.y - 48))
    return hit
  })
  if (e.stage === 2) return [act('keep', 180, '挂起书签，留下回忆', 'Hang it up and remember', 'bookmark', 'remember')]
  if (e.storyId === 'tea-bookmark') {
    if (e.stage === 0) return [act('note', 180, '读一读纸签', 'Read the note', 'note', 'listen')]
    return [act('leaf', 94, '折叶子', 'Fold a leaf', 'leaf', 'fold', 'leaf'), act('wave', 180, '折波纹', 'Fold a wave', 'wave', 'fold', 'wave'), ...(e.selection ? [act('press', 266, '压平书签', 'Press the bookmark', 'press', 'press')] : [])]
  }
  if (e.stage === 0) return [act('left', 140, '看杯子左侧', 'Look from the left', 'cup', 'observe', 'left'), act('right', 220, '看杯子右侧', 'Look from the right', 'cup', 'observe', 'right')]
  return [act('same', 140, '试试原图', 'Try the original', 'note', 'match', 'same'), act('mirror', 220, '翻转图案', 'Turn the shape over', 'mirror', 'match', 'mirror')]
}

export function sceneInteractionAt(w: LivingWorld, point: Point): SceneInteraction | null {
  if (![point.x, point.y].every(Number.isFinite)) return null
  return sceneInteractions(w).filter(h => Math.hypot(point.x - h.point.x, point.y - h.point.y) <= h.radius).sort((a, b) => b.priority - a.priority || Math.hypot(point.x - a.point.x, point.y - a.point.y) - Math.hypot(point.x - b.point.x, point.y - b.point.y) || a.id.localeCompare(b.id))[0] ?? null
}

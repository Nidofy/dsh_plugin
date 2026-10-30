import type { CharacterId } from './roster.ts'
import type { Words } from './neighborhood-catalog.ts'
import { afternoonStories as originalStories } from './afternoon-catalog-v1.ts'
import { residentStories, residentStory, type ResidentStoryId, type StoryProp } from './resident-stories-catalog.ts'
export type AfternoonStoryId = 'tea-bookmark' | 'reflection-shapes' | ResidentStoryId
export type AfternoonSelection = string
export type AfternoonAction = 'listen' | 'fold' | 'press' | 'observe' | 'match' | 'remember' | 'interact'
export type AfternoonPlacement = 'message-tree' | 'bookcase' | 'courtyard-card'
export interface AfternoonStory {
  id: AfternoonStoryId; participants: readonly [CharacterId, CharacterId]; title: Words; keepsakeTitle: Words
  region: 'courtyard' | 'bookhouse' | 'tea-square'; placement: AfternoonPlacement | null
  stages: readonly Words[]; lines: readonly Words[]; revisit: Words; prerequisite?: ResidentStoryId
  arc?: 'lost-diary'; chapter?: 'page' | 'tea' | 'home'
}
export const afternoonStories: readonly AfternoonStory[] = [
  ...originalStories.map(story => ({ ...story, region: 'tea-square' as const, placement: 'message-tree' as const,
    revisit: story.id === 'tea-bookmark' ? { zh: 'Claude：那枚茶香书签还留着我们一起折好的停顿。', en: 'Claude: That tea-scented bookmark still holds the pause we folded together.' } : { zh: 'Gemini：倒影小卡提醒我，换个方向看，朋友的答案就近了一点。', en: 'Gemini: Our reflection card reminds me that a new angle brings a friend’s answer closer.' } })),
  ...residentStories.map(story => ({ ...story, stages: [story.discovery, story.motivation, { zh: '陪朋友走到收尾的位置，再把这次经历记下来。', en: 'Let your friends finish their walk, then save this shared memory.' }] })),
]
export const afternoonStoryIds: readonly AfternoonStoryId[] = afternoonStories.map(story => story.id)
export const isAfternoonStoryId = (v: unknown): v is AfternoonStoryId => typeof v === 'string' && afternoonStoryIds.includes(v as AfternoonStoryId)
export function afternoonStory(id: AfternoonStoryId): AfternoonStory { return afternoonStories.find(story => story.id === id)! }
export function afternoonSelectionValid(id: AfternoonStoryId, value: unknown): value is AfternoonSelection {
  if (typeof value !== 'string') return false
  const story = residentStory(id)
  return story ? story.steps[0]!.accept.includes(value) : (id === 'tea-bookmark' ? ['leaf', 'wave'] : ['left', 'right']).includes(value)
}
export interface AfternoonOperation { action: AfternoonAction; choice?: string; label: Words; prop: StoryProp }
/** Projection only. The authoritative engine rechecks the token, phase and choice. */
export function afternoonOperations(e: { storyId: AfternoonStoryId; stage: number; phase: string; selection: string | null; step?: number }): AfternoonOperation[] {
  if (e.phase !== 'ready') return []
  if (e.stage === 2) return [{ action: 'remember', label: { zh: '收好这次回忆', en: 'Keep this memory' }, prop: 'bookmark' }]
  const story = residentStory(e.storyId)
  if (story) return e.stage === 0 ? [{ action: 'interact', choice: 'inspect', label: story.discovery, prop: story.steps[0]!.choices[0]!.prop }]
    : (story.steps[e.step ?? 0]?.choices ?? []).map(choice => ({ action: 'interact', choice: choice.id, label: choice.label, prop: choice.prop }))
  if (e.storyId === 'tea-bookmark') return e.stage === 0 ? [{ action: 'listen', label: { zh: '打开纸签', en: 'Open the note' }, prop: 'note' }]
    : [{ action: 'fold', choice: 'leaf', label: { zh: '折一片叶子', en: 'Fold a leaf' }, prop: 'leaf' }, { action: 'fold', choice: 'wave', label: { zh: '折一道波纹', en: 'Fold a wave' }, prop: 'wave' }, ...(e.selection ? [{ action: 'press' as const, label: { zh: '压平纸签', en: 'Press the note' }, prop: 'press' as const }] : [])]
  return e.stage === 0 ? [{ action: 'observe', choice: 'left', label: { zh: '从左观察', en: 'Look from the left' }, prop: 'cup' }, { action: 'observe', choice: 'right', label: { zh: '从右观察', en: 'Look from the right' }, prop: 'cup' }]
    : [{ action: 'match', choice: 'same', label: { zh: '原样图形', en: 'Original shape' }, prop: 'page' }, { action: 'match', choice: 'mirror', label: { zh: '镜像图形', en: 'Mirrored shape' }, prop: 'mirror' }]
}

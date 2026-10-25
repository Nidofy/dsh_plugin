import type { LivingWorld } from './living-state.ts'
import type { HomeWorld } from './home-state.ts'
import { stories, type Locale } from './neighborhood-catalog.ts'
import { playDefinition } from './play-catalog.ts'
export interface Notice { id: string; story: string; eventId: string; tick: number; participants: string[]; count: number }
export function noticeTitle(story: string, locale: Locale): string {
  if (story === 'tea-square-three-cups') return locale === 'zh' ? '三杯不同的下午' : 'Three cups, one afternoon'
  if (story === 'bookhouse-light') return locale === 'zh' ? '夹在书里的微光' : 'A little light between the pages'
  if (story === 'bookhouse-puzzle') return locale === 'zh' ? '书架里的谜题' : 'A puzzle on the shelf'
  if (story === 'first-table') return locale === 'zh' ? '今天，我们坐到了一起' : 'Today, we shared a table'
  return stories.find(s => s.id === story)?.name[locale] ?? playDefinition(story)?.name[locale] ?? (locale === 'zh' ? '共同回忆' : 'Shared memory')
}
/** Input must be an acknowledged durable snapshot, never a live candidate. */
export function deriveNotices(world: HomeWorld | LivingWorld): Notice[] {
  const rows: Notice[] = [...world.journal.map(m => ({ id: `tea:${m.templateId}:${m.eventId}`, story: m.templateId, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count })),
    ...world.neighborhood.memories.map(m => ({ id: `memory:${m.id}:${m.eventId}`, story: m.id, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count }))]
  if('bookhouse' in world && world.bookhouse.memory){const m=world.bookhouse.memory;rows.push({id:`memory:bookhouse-light:${m.eventId}`,story:'bookhouse-light',eventId:m.eventId,tick:m.completedTick,participants:m.participants,count:m.count})}
  if('bookhouse' in world && world.bookhouse.puzzleMemory){const m=world.bookhouse.puzzleMemory;rows.push({id:`memory:bookhouse-puzzle:${m.eventId}`,story:'bookhouse-puzzle',eventId:m.eventId,tick:m.completedTick,participants:m.participants,count:m.count})}
  if('teaSquare' in world && world.teaSquare.memory){const m=world.teaSquare.memory;rows.push({id:`memory:tea-square-three-cups:${m.eventId}`,story:'tea-square-three-cups',eventId:m.eventId,tick:m.completedTick,participants:m.participants,count:m.count})}
  return rows.filter((m, i) => rows.findIndex(n => n.eventId === m.eventId) === i).sort((a, b) => b.tick - a.tick || a.id.localeCompare(b.id))
}

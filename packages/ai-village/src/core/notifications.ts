import type { LivingWorld } from './living-state.ts'
import type { HomeWorld } from './home-state.ts'
import { stories, type Locale } from './neighborhood-catalog.ts'
import { playDefinition } from './play-catalog.ts'
export interface Notice { id: string; story: string; eventId: string; tick: number; participants: string[]; count: number }
export function noticeTitle(story: string, locale: Locale): string {
  if (story === 'bookhouse-light') return locale === 'zh' ? '夹在书里的微光' : 'A little light between the pages'
  if (story === 'first-table') return locale === 'zh' ? '今天，我们坐到了一起' : 'Today, we shared a table'
  return stories.find(s => s.id === story)?.name[locale] ?? playDefinition(story)?.name[locale] ?? (locale === 'zh' ? '共同回忆' : 'Shared memory')
}
/** Input must be an acknowledged durable snapshot, never a live candidate. */
export function deriveNotices(world: HomeWorld | LivingWorld): Notice[] {
  const rows: Notice[] = [...world.journal.map(m => ({ id: `tea:${m.templateId}:${m.eventId}`, story: m.templateId, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count })),
    ...world.neighborhood.memories.map(m => ({ id: `memory:${m.id}:${m.eventId}`, story: m.id, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count }))]
  if('bookhouse' in world && world.bookhouse.memory){const m=world.bookhouse.memory;rows.push({id:`memory:bookhouse-light:${m.eventId}`,story:'bookhouse-light',eventId:m.eventId,tick:m.completedTick,participants:m.participants,count:m.count})}
  return rows.filter((m, i) => rows.findIndex(n => n.eventId === m.eventId) === i).sort((a, b) => b.tick - a.tick || a.id.localeCompare(b.id))
}

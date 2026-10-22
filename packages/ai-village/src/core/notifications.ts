import type { HomeWorld } from './home-state.ts'
export interface Notice { id: string; story: string; eventId: string; tick: number; participants: string[]; count: number }
/** Input must be an acknowledged durable snapshot, never a live candidate. */
export function deriveNotices(world: HomeWorld): Notice[] {
  const rows = [...world.journal.map(m => ({ id: `tea:${m.templateId}:${m.eventId}`, story: m.templateId, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count })),
    ...world.neighborhood.memories.map(m => ({ id: `memory:${m.id}:${m.eventId}`, story: m.id, eventId: m.eventId, tick: m.completedTick, participants: m.participants, count: m.count }))]
  return rows.filter((m, i) => rows.findIndex(n => n.eventId === m.eventId) === i).sort((a, b) => b.tick - a.tick || a.id.localeCompare(b.id))
}

import { createWorld, validateWorld, actors, available, type World, type Scene } from './world.ts'
import { isCharacterId, type CharacterId } from './roster.ts'

export type Food = 'rice' | 'tea'
export type BellSlot = 'window' | 'door' | 'wall'
export const contentLimits = { actors: 7, activeEvents: 1, journal: 32, discovered: 64, unlocked: 64,
  identifierBytes: 64, operationIdBytes: 36, routePoints: 9, worldBytes: 48 * 1024, envelopeBytes: 64 * 1024 } as const
export interface TeaEventV1 {
  id: string; definitionId: 'first-tea'; definitionVersion: 1
  participants: [CharacterId, CharacterId]; food: Food; seats: ['eat/left', 'eat/right']
  phase: 'approaching' | 'talking'; remainingTicks: number; approachRemainingTicks: number
  retryCount: number; branch: 'tea' | 'rice' | 'familiar'
}
export interface JournalEntryV1 {
  id: string; templateId: 'first-table'; eventId: string; participants: [CharacterId, CharacterId]
  food: Food; completedTick: number; count: number
}
export interface ContentWorld extends Omit<World, 'schemaVersion' | 'sceneVersion'> {
  schemaVersion: 4; sceneVersion: 2; simulationRulesVersion: 1; contentRevision: 1
  activeEvent: TeaEventV1 | null
  progress: { completedWishes: 'first-tea'[]; discovered: ('first-table' | 'wind-chime-placed')[]; unlocked: 'wind-chime'[]; lastCompletedEventId: string | null }
  journal: JournalEntryV1[]
  decorations: { layoutRevision: number; windChime: { id: 'first-wind-chime'; slot: BellSlot | null } | null }
}
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
const invalid = (): never => { throw Error('INVALID_CONTENT_WORLD') }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
const keys = (value: Record<string, unknown>, names: string[]) => {
  if (Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) invalid()
}
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const food = (value: unknown): value is Food => value === 'tea' || value === 'rice'
function pair(value: unknown): value is [CharacterId, CharacterId] {
  return Array.isArray(value) && value.length === 2 && value.every(isCharacterId) && value[0] !== value[1]
}
function list(value: unknown, allowed: string[], max: number): string[] {
  if (!Array.isArray(value) || value.length > max || new Set(value).size !== value.length || value.some(v => !allowed.includes(v))) return invalid()
  return [...value] as string[]
}
export function emptyContent(world: World): ContentWorld {
  if (world.sceneVersion !== 2) throw Error('UNSUPPORTED_SCENE_VERSION')
  return { ...world, schemaVersion: 4, sceneVersion: 2, simulationRulesVersion: 1, contentRevision: 1, activeEvent: null,
    progress: { completedWishes: [], discovered: [], unlocked: [], lastCompletedEventId: null }, journal: [], decorations: { layoutRevision: 0, windChime: null } }
}
export function createContentWorld(scene: Scene): ContentWorld { return validateContentWorld(emptyContent(createWorld(scene)), scene) }

/** External-input validator. Cross-field checks keep reward, journal and layout atomic. */
export function validateContentWorld(value: unknown, scene: Scene): ContentWorld {
  const w = object(value)
  let bytes: number
  try { bytes = new TextEncoder().encode(JSON.stringify(value)).length } catch { return invalid() }
  if (bytes > contentLimits.worldBytes) throw Error('SAVE_TOO_LARGE')
  keys(w, ['schemaVersion', 'worldId', 'sceneVersion', 'avatarDefinitionVersion', 'ticks', 'rng', 'userPaused', 'actor', 'companions',
    'simulationRulesVersion', 'contentRevision', 'activeEvent', 'progress', 'journal', 'decorations'])
  if (w.schemaVersion !== 4 || w.sceneVersion !== 2 || scene.version !== 2) throw Error('UNSUPPORTED_WORLD_VERSION')
  if (w.simulationRulesVersion !== 1 || w.contentRevision !== 1) throw Error('UNSUPPORTED_CONTENT_VERSION')
  const base = validateWorld({ ...w, schemaVersion: 3 }, scene)
  if (!actors(base).every(a => available(base, a.position, a.id))) return invalid()
  const p = object(w.progress); keys(p, ['completedWishes', 'discovered', 'unlocked', 'lastCompletedEventId'])
  const completedWishes = list(p.completedWishes, ['first-tea'], 1) as 'first-tea'[]
  const discovered = list(p.discovered, ['first-table', 'wind-chime-placed'], contentLimits.discovered) as ContentWorld['progress']['discovered']
  const unlocked = list(p.unlocked, ['wind-chime'], 1) as 'wind-chime'[]
  if (p.lastCompletedEventId !== null && !uuid(p.lastCompletedEventId)) return invalid()
  // The current catalog has one first-memory template. Capacity 32 is reserved for future catalogs.
  if (!Array.isArray(w.journal) || w.journal.length > 1) return invalid()
  const ids = new Set<string>(), events = new Set<string>(); let previousTick = 0
  const journal = w.journal.map(value => {
    const row = object(value); keys(row, ['id', 'templateId', 'eventId', 'participants', 'food', 'completedTick', 'count'])
    if (!uuid(row.id) || !uuid(row.eventId) || ids.has(row.id) || events.has(row.eventId) || row.templateId !== 'first-table'
      || !pair(row.participants) || !food(row.food) || !integer(row.completedTick, previousTick, base.ticks) || !integer(row.count, 1)) return invalid()
    ids.add(row.id); events.add(row.eventId); previousTick = row.completedTick
    return { id: row.id, templateId: 'first-table' as const, eventId: row.eventId, participants: [...row.participants] as [CharacterId, CharacterId],
      food: row.food, completedTick: row.completedTick, count: row.count }
  })
  const completed = journal.length > 0
  if (completed !== !!completedWishes.length || completed !== !!unlocked.length || completed !== discovered.includes('first-table')
    || completed !== (p.lastCompletedEventId !== null)
    || (journal[0]?.count === 1 && p.lastCompletedEventId !== journal[0].eventId)) return invalid()
  const d = object(w.decorations); keys(d, ['layoutRevision', 'windChime'])
  if (!integer(d.layoutRevision, 0)) return invalid()
  let windChime: ContentWorld['decorations']['windChime'] = null
  if (d.windChime !== null) {
    const bell = object(d.windChime); keys(bell, ['id', 'slot'])
    if (!completed || bell.id !== 'first-wind-chime' || (bell.slot !== null && !['window', 'door', 'wall'].includes(bell.slot as string))) return invalid()
    windChime = { id: 'first-wind-chime', slot: bell.slot as BellSlot | null }
  }
  if (completed !== !!windChime || (!!windChime?.slot && !d.layoutRevision)
    || (d.layoutRevision > 0) !== discovered.includes('wind-chime-placed') || (!completed && d.layoutRevision !== 0)) return invalid()
  let activeEvent: TeaEventV1 | null = null
  if (w.activeEvent !== null) {
    const e = object(w.activeEvent)
    keys(e, ['id', 'definitionId', 'definitionVersion', 'participants', 'food', 'seats', 'phase', 'remainingTicks', 'approachRemainingTicks', 'retryCount', 'branch'])
    if (!uuid(e.id) || events.has(e.id) || e.id === p.lastCompletedEventId || e.definitionId !== 'first-tea' || e.definitionVersion !== 1 || !pair(e.participants) || !food(e.food)
      || JSON.stringify(e.seats) !== '["eat/left","eat/right"]' || !['approaching', 'talking'].includes(e.phase as string)
      || !integer(e.remainingTicks, 0, 150) || !integer(e.approachRemainingTicks, 0, 1080) || !integer(e.retryCount, 0, 2)
      || !(e.branch === e.food || (e.branch === 'familiar' && completed))) return invalid()
    const members = e.participants.map(id => actors(base).find(a => a.id === id))
    if (members.some((a, i) => !a || a.intent?.furnitureId !== 'eat' || a.intent.seat !== (i ? 'right' : 'left') || a.intent.activity !== 'eat'
      || (e.phase === 'talking' && a.intent.stage !== 'use'))) return invalid()
    activeEvent = { id: e.id, definitionId: 'first-tea', definitionVersion: 1, participants: [...e.participants], food: e.food,
      seats: ['eat/left', 'eat/right'], phase: e.phase as TeaEventV1['phase'], remainingTicks: e.remainingTicks,
      approachRemainingTicks: e.approachRemainingTicks, retryCount: e.retryCount, branch: e.branch as TeaEventV1['branch'] }
  }
  return { ...base, schemaVersion: 4, sceneVersion: 2, simulationRulesVersion: 1, contentRevision: 1, activeEvent,
    progress: { completedWishes, discovered, unlocked, lastCompletedEventId: p.lastCompletedEventId as string | null }, journal,
    decorations: { layoutRevision: d.layoutRevision, windChime } }
}

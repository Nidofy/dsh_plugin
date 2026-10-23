import { checkRosterScope, legacyCharacterIds, type RosterScope } from './roster-policy.ts'
import { actors, activityOf, type Scene } from './world.ts'
import { createContentWorld, validateContentWorld, uuid, contentLimits, type ContentWorld, type BellSlot } from './content-state.ts'
import { migrateContentWorld, type WorldCodec } from './migrations.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { layouts, neighborhoodEvents, stories, type LayoutId, type StoryId, type ExtraDecoration } from './neighborhood-catalog.ts'

export interface NeighborhoodEvent {
  id: string; definitionId: string; participants: CharacterId[]; seats: (string | null)[]
  phase: 'approaching' | 'acting'; remainingTicks: number; approachRemainingTicks: number
}
export interface Memory { id: StoryId; eventId: string; participants: CharacterId[]; completedTick: number; count: number }
export interface Neighborhood {
  layout: LayoutId; layoutRevision: number; event: NeighborhoodEvent | null; memories: Memory[]
  bonds: { pair: [CharacterId, CharacterId]; count: number; lastTick: number }[]
  decorations: Record<ExtraDecoration, BellSlot | null>; nextInteractionTick: number; lastEventId: string | null
}
export interface NeighborhoodWorld extends Omit<ContentWorld, 'schemaVersion' | 'simulationRulesVersion' | 'contentRevision'> { schemaVersion: 5; simulationRulesVersion: 2; contentRevision: 2; neighborhood: Neighborhood }
export const blankNeighborhood = (): Neighborhood => ({ layout: 'courtyard', layoutRevision: 0, event: null, memories: [], bonds: [], decorations: { lantern: null, planter: null }, nextInteractionTick: 0, lastEventId: null })
export function legacyContent(world: NeighborhoodWorld): ContentWorld {
  const { neighborhood: _neighborhood, ...base } = world
  return { ...base, schemaVersion: 4, simulationRulesVersion: 1, contentRevision: 1 }
}
const sceneCache = new WeakMap<Scene, Map<LayoutId, Scene>>()
/** Layouts share fixed walls/table/desk. One corner swaps cushion/bookcase/plant. */
export function neighborhoodScene(base: Scene, layout: LayoutId): Scene {
  if (base.hotspots.some(h => h.id === 'bench')) return base // Validated schema 6 geometry adapter.
  const cache = sceneCache.get(base) ?? new Map<LayoutId, Scene>(); sceneCache.set(base, cache)
  if (cache.has(layout)) return cache.get(layout)!
  const scene = structuredClone(base)
  scene.hotspots = scene.hotspots.filter(h => h.id !== 'rest')
  const corner = layout === 'reading' ? 'books' : layout === 'garden' ? 'plant' : 'rest'
  scene.hotspots.push({ id: corner, seat: 'main', activity: corner === 'books' ? 'read' : corner === 'plant' ? 'tend' : 'rest',
    hit: { x: 233, y: 211, width: 90, height: 44 }, anchor: { x: 274, y: 245 } })
  const work = scene.hotspots.find(h => h.id === 'work')!
  work.hit = { ...work.hit, y: 255, height: 34 }
  for (const [seat, x] of [['left', 70], ['right', 170]] as const) scene.hotspots.push({ id: 'bench', seat, activity: 'sit',
    hit: { x: x - 35, y: 211, width: 70, height: 40 }, anchor: { x, y: 239 } })
  cache.set(layout, scene); return scene
}
function fail(): never { throw Error('INVALID_NEIGHBORHOOD') }
function obj(v: unknown, names: string[]): Record<string, any> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== names.length || names.some(k => !Object.hasOwn(v, k))) return fail()
  return v as Record<string, any>
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
const ids = (v: unknown, length?: number): v is CharacterId[] => Array.isArray(v) && (length ? v.length === length : v.length >= 1 && v.length <= 2) && v.every(isCharacterId) && new Set(v).size === v.length
export function createNeighborhoodWorld(scene: Scene): NeighborhoodWorld { return { ...createContentWorld(scene), schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: blankNeighborhood() } }
export function validateNeighborhoodWorld(value: unknown, baseScene: Scene, scope: RosterScope = 'legacy'): NeighborhoodWorld {
  checkRosterScope(value, scope)
  if (!value || typeof value !== 'object' || (value as NeighborhoodWorld).schemaVersion !== 5) throw Error('UNSUPPORTED_WORLD_VERSION')
  const w = value as NeighborhoodWorld
  if (w.simulationRulesVersion !== 2 || w.contentRevision !== 2) throw Error('UNSUPPORTED_CONTENT_VERSION')
  if (new TextEncoder().encode(JSON.stringify(w)).length > contentLimits.worldBytes) throw Error('SAVE_TOO_LARGE')
  const n = obj(w.neighborhood, ['layout', 'layoutRevision', 'event', 'memories', 'bonds', 'decorations', 'nextInteractionTick', 'lastEventId'])
  if (!layouts.includes(n.layout) || !integer(n.layoutRevision) || !integer(n.nextInteractionTick, 0, w.ticks + 90) || (n.lastEventId !== null && !uuid(n.lastEventId))) fail()
  const scene = neighborhoodScene(baseScene, n.layout), base = validateContentWorld(legacyContent(w), scene, scope)
  if (!Array.isArray(n.memories) || n.memories.length > stories.length || new Set(n.memories.map((m: Memory) => m.id)).size !== n.memories.length) fail()
  const eventIds=new Set(base.journal.map(m=>m.eventId))
  let previousTick = 0
  for (const memory of n.memories) {
    const m = obj(memory, ['id', 'eventId', 'participants', 'completedTick', 'count'])
    if (!stories.some(s => s.id === m.id) || !uuid(m.eventId) || eventIds.has(m.eventId) || !ids(m.participants) || !neighborhoodEvents.some(d=>d.story===m.id&&d.count===m.participants.length) || !integer(m.completedTick, previousTick, w.ticks) || !integer(m.count, 1, 1000000)) fail()
    previousTick = m.completedTick;eventIds.add(m.eventId)
  }
  if ((n.memories.length>0)!==(n.lastEventId!==null)) fail()
  if (!Array.isArray(n.bonds) || n.bonds.length > (scope === 'current' ? 66 : 21)) fail()
  const pairs = new Set<string>()
  for (const bond of n.bonds) {
    const b = obj(bond, ['pair', 'count', 'lastTick'])
    if (!ids(b.pair, 2) || b.pair[0]! >= b.pair[1]! || pairs.has(b.pair.join('/')) || !integer(b.count, 1, 1000000) || !integer(b.lastTick, 0, w.ticks)) fail()
    pairs.add(b.pair.join('/'))
  }
  const decorations = obj(n.decorations, ['lantern', 'planter'])
  for (const id of ['lantern', 'planter'] as const) {
    if (decorations[id] !== null && (!['window', 'door', 'wall'].includes(decorations[id]) || !extraUnlocked(n as Neighborhood, id))) fail()
  }
  if (n.event !== null) {
    const e = obj(n.event, ['id', 'definitionId', 'participants', 'seats', 'phase', 'remainingTicks', 'approachRemainingTicks'])
    const definition = neighborhoodEvents.find(d => d.id === e.definitionId)
    if (base.activeEvent || !definition || !uuid(e.id) || e.id === n.lastEventId || eventIds.has(e.id) || e.id === base.progress.lastCompletedEventId
      || !ids(e.participants, definition.count) || !Array.isArray(e.seats) || e.seats.length !== definition.count || !['approaching', 'acting'].includes(e.phase)
      || !integer(e.remainingTicks, 0, definition.ticks) || !integer(e.approachRemainingTicks, 0, 1080)) fail()
    e.participants.forEach((id: CharacterId, i: number) => {
      const a = actors(base).find(a => a.id === id), seat = e.seats[i]
      if (!a) fail()
      if (definition.furniture === 'here') { if (seat !== null || a!.intent || a!.behavior !== 'idle') fail() }
      else {
        const expected = definition.furniture + '/' + (definition.count === 2 ? (i ? 'right' : 'left') : 'main')
        const h = scene.hotspots.find(h => h.id + '/' + h.seat === expected)
        if (seat !== expected || !h || a!.intent?.furnitureId !== h.id || a!.intent.seat !== h.seat || a!.intent.activity !== activityOf(h) || (e.phase === 'acting' && a!.intent.stage !== 'use')) fail()
      }
    })
  }
  return { ...base, schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: structuredClone(n) as Neighborhood }
}
export function extraUnlocked(n: { memories: readonly { id: string }[] }, id: ExtraDecoration): boolean { return n.memories.some(m => m.id === (id === 'lantern' ? 'shared-book' : 'water')) }
export function migrateNeighborhoodWorld(value: unknown, scene: Scene): NeighborhoodWorld {
  if ((value as { schemaVersion?: number })?.schemaVersion === 5) return validateNeighborhoodWorld(value, scene)
  const old = migrateContentWorld(value, scene)
  return validateNeighborhoodWorld({ ...old, schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: blankNeighborhood() }, scene)
}
export function neighborhoodWorldCodec(scene: Scene): WorldCodec<NeighborhoodWorld> {
  return { decode: value => migrateNeighborhoodWorld(value, scene), validate: value => validateNeighborhoodWorld(value, scene), needsUpgrade: value => (value as NeighborhoodWorld)?.schemaVersion !== 5 }
}

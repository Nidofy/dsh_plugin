import { neighborhoodScene, validateNeighborhoodWorld, migrateNeighborhoodWorld, createNeighborhoodWorld, type NeighborhoodWorld } from './neighborhood-state.ts'
import { actors, walkable, routeTo, abandon, type Scene, type Point } from './world.ts'
import { characterIds, type CharacterId } from './roster.ts'
import { layouts, type LayoutId } from './neighborhood-catalog.ts'
import type { WorldCodec } from './migrations.ts'
import type { SceneArt } from '../frame/furniture.ts'

export const furnitureIds = ['work', 'eat', 'bench', 'corner'] as const
export type FurnitureId = typeof furnitureIds[number]
export type Accessory = 'none' | 'ribbon' | 'leaf'
export interface Home {
  revision: number
  positions: Record<FurnitureId, 0 | 1>
  environment: 'afternoon' | 'twilight'
  accessories: Record<CharacterId, Accessory>
}
export interface HomeWorld extends Omit<NeighborhoodWorld, 'schemaVersion' | 'sceneVersion' | 'simulationRulesVersion' | 'contentRevision'> {
  schemaVersion: 6; sceneVersion: 3; simulationRulesVersion: 3; contentRevision: 3; home: Home
}
export const offsets: Record<FurnitureId, readonly Point[]> = {
  work: [{ x: 0, y: 0 }, { x: 24, y: -18 }], eat: [{ x: 0, y: 0 }, { x: -54, y: 0 }],
  bench: [{ x: 0, y: 0 }, { x: 24, y: 0 }], corner: [{ x: 0, y: 0 }, { x: 0, y: 62 }],
}
export const homeTemplates = {
  courtyard: { work: 0, eat: 0, bench: 0, corner: 0 },
  reading: { work: 1, eat: 1, bench: 1, corner: 0 },
  garden: { work: 0, eat: 0, bench: 1, corner: 1 },
} as const
export const blankHome = (): Home => ({ revision: 0, positions: { ...homeTemplates.courtyard }, environment: 'afternoon', accessories: Object.fromEntries(characterIds.map(id => [id, 'none'])) as Home['accessories'] })
function exact(value: unknown, keys: readonly string[]): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
export function validateHome(value: unknown): Home {
  if (!exact(value, ['revision', 'positions', 'environment', 'accessories']) || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !exact(value.positions, furnitureIds) || !furnitureIds.every(id => value.positions[id] === 0 || value.positions[id] === 1)
    || !['afternoon', 'twilight'].includes(value.environment) || !exact(value.accessories, characterIds)
    || !characterIds.every(id => ['none', 'ribbon', 'leaf'].includes(value.accessories[id]))) throw Error('INVALID_HOME')
  return structuredClone(value) as Home
}
const sceneCache = new WeakMap<Scene, Map<string, SceneArt>>()
/** The simulation adapter retains internal scene 2 coordinates; the persisted geometry contract is scene 3. */
export function homeScene(base: Scene, layout: LayoutId, value: Home): SceneArt {
  if (!layouts.includes(layout)) throw Error('INVALID_LAYOUT')
  const home = validateHome(value), key = layout + furnitureIds.map(id => home.positions[id]).join('')
  const cache = sceneCache.get(base) ?? new Map<string, SceneArt>(); sceneCache.set(base, cache)
  if (cache.has(key)) return cache.get(key)!
  const result = structuredClone(neighborhoodScene(base, layout)) as SceneArt
  const move = <T extends Point>(p: T, id: FurnitureId): T => ({ ...p, x: p.x + offsets[id][home.positions[id]]!.x, y: p.y + offsets[id][home.positions[id]]!.y })
  for (const h of result.hotspots) {
    const id = (['work', 'eat', 'bench'].includes(h.id) ? h.id : 'corner') as FurnitureId
    h.anchor = move(h.anchor, id); h.hit = move(h.hit, id)
    // The inward desk sits behind the bench. Its foot target must not capture bench drops.
    if (h.id === 'work') h.hit = { ...h.hit, y: h.anchor.y - 10, height: 16 }
  }
  result.obstacles = result.obstacles.map((r, i) => move(r, i === 0 ? 'work' : 'eat'))
  if (result.furniture) result.furniture = result.furniture.map(f => ({ ...f, rect: move(f.rect, f.id as FurnitureId) }))
  if (result.cushion) result.cushion = move(result.cushion, 'corner')
  if (result.seatProps) result.seatProps = result.seatProps.map(p => ({ ...p, rect: move(p.rect, p.furnitureId as FurnitureId) }))
  // Every seat must remain walkable, distinct, and reachable from the courtyard entrance.
  if (result.hotspots.some((h, i) => !walkable(result, h.anchor) || !routeTo(result, result.spawn, h.anchor)
    || result.hotspots.slice(i + 1).some(other => Math.hypot(h.anchor.x - other.anchor.x, h.anchor.y - other.anchor.y) < 24))) throw Error('INVALID_LAYOUT')
  cache.set(key, result); return result
}
export function neighborhoodProjection(world: HomeWorld): NeighborhoodWorld {
  const { home: _home, ...rest } = world
  return { ...rest, schemaVersion: 5, sceneVersion: 2, simulationRulesVersion: 2, contentRevision: 2 }
}
export function withHome(world: NeighborhoodWorld, home: Home): HomeWorld {
  return { ...world, schemaVersion: 6, sceneVersion: 3, simulationRulesVersion: 3, contentRevision: 3, home: structuredClone(home) }
}
export function validateHomeWorld(value: unknown, base: Scene): HomeWorld {
  const w = value as HomeWorld
  if (!w || w.schemaVersion !== 6 || w.sceneVersion !== 3 || w.simulationRulesVersion !== 3 || w.contentRevision !== 3) throw Error('UNSUPPORTED_WORLD_VERSION')
  if (new TextEncoder().encode(JSON.stringify(w)).length > 48 * 1024) throw Error('SAVE_TOO_LARGE')
  const home = validateHome(w.home)
  return withHome(validateNeighborhoodWorld(neighborhoodProjection(w), homeScene(base, w.neighborhood?.layout, home)), home)
}
export function createHomeWorld(base: Scene): HomeWorld { return withHome(createNeighborhoodWorld(base), blankHome()) }
export function migrateHomeWorld(value: unknown, base: Scene): HomeWorld {
  return (value as HomeWorld)?.schemaVersion === 6 ? validateHomeWorld(value, base) : withHome(migrateNeighborhoodWorld(value, base), blankHome())
}
export function homeWorldCodec(base: Scene): WorldCodec<HomeWorld> {
  return { decode: value => migrateHomeWorld(value, base), validate: value => validateHomeWorld(value, base), needsUpgrade: value => (value as HomeWorld)?.schemaVersion !== 6 }
}
/** Furniture edits never teleport residents or discard an active story. */
export function arrangeHome(source: HomeWorld, base: Scene, home: Home, layout: LayoutId, expectedRevision: number): HomeWorld {
  const world = validateHomeWorld(source, base)
  if (expectedRevision !== world.home.revision || home.revision !== expectedRevision) throw Error('LAYOUT_CONFLICT')
  if (world.activeEvent || world.neighborhood.event) throw Error('EVENT_ACTIVE')
  if (!layouts.includes(layout)) throw Error('INVALID_LAYOUT')
  const next = validateHome(home), scene = homeScene(base, layout, next)
  if (actors(world).some(a => !walkable(scene, a.position) || !walkable(scene, a.safe))) throw Error('FURNITURE_OCCUPIED')
  const geometryChanged = layout !== world.neighborhood.layout || JSON.stringify(next.positions) !== JSON.stringify(world.home.positions)
  if (geometryChanged) {
    for (const a of actors(world)) abandon(a)
    world.neighborhood.layout = layout; world.neighborhood.layoutRevision++
  }
  next.revision++; world.home = next
  return validateHomeWorld(world, base)
}

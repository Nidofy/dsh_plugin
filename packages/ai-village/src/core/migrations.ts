import { abandon, actors, available, reachable, routeTo, validateWorld, walkable, type Point, type Scene } from './world.ts'
import { emptyContent, validateContentWorld, type ContentWorld } from './content-state.ts'

/** Frozen geometry for versions 1/2/3. Never derive historical validation from new assets. */
export const legacySceneV1: Scene = { schemaVersion: 1, id: 'courtyard', version: 1, size: [360, 480],
  walkable: { x: 45, y: 211, width: 248, height: 222 },
  obstacles: [{ x: 38, y: 290, width: 124, height: 27 }, { x: 204, y: 290, width: 124, height: 27 }], spawn: { x: 173, y: 365 },
  hotspots: [
    { id: 'work', hit: { x: 46, y: 225, width: 112, height: 64 }, anchor: { x: 102, y: 283 } },
    { id: 'eat', hit: { x: 212, y: 225, width: 112, height: 64 }, anchor: { x: 268, y: 283 } },
    { id: 'rest', hit: { x: 233, y: 370, width: 90, height: 55 }, anchor: { x: 274, y: 411 } },
  ] }
export interface WorldCodec<W> {
  /** Read historical versions without changing their on-disk bytes. */
  decode(value: unknown): W
  /** Validate current-version writes; do not silently drop future or legacy content. */
  validate(value: unknown): W
  needsUpgrade(value: unknown): boolean
}
export function contentWorldCodec(target: Scene): WorldCodec<ContentWorld> {
  if (target.version !== 2 || target.id !== 'courtyard') throw Error('UNSUPPORTED_SCENE_VERSION')
  return { decode: value => migrateContentWorld(value, target), validate: value => validateContentWorld(value, target),
    needsUpgrade: value => (value as { schemaVersion?: number } | null)?.schemaVersion !== 4 }
}
/** Pure migration: keep valid positions and unchanged activities; relocate only conflicts. */
export function migrateContentWorld(value: unknown, target: Scene): ContentWorld {
  if (target.version !== 2) throw Error('UNSUPPORTED_SCENE_VERSION')
  const version = value as { schemaVersion?: number; sceneVersion?: number } | null
  if (version?.schemaVersion === 4) return validateContentWorld(value, target)
  if (![1, 2, 3].includes(version?.schemaVersion ?? 0) || version?.sceneVersion !== 1) throw Error('UNSUPPORTED_WORLD_VERSION')
  const world = validateWorld(value, legacySceneV1), residents = actors(world).sort((a, b) => a.id.localeCompare(b.id))
  const occupied: Point[] = [], displaced = new Set<string>()
  // Reserve unaffected positions first, so relocation cannot evict an otherwise valid resident.
  for (const a of residents) {
    if (walkable(target, a.position) && occupied.every(p => Math.hypot(p.x - a.position.x, p.y - a.position.y) >= 24)) occupied.push(a.position)
    else displaced.add(a.id)
  }
  for (const a of residents) if (displaced.has(a.id)) {
    let chosen: Point | undefined
    for (let y = 220; y <= 430 && !chosen; y += 30) for (let x = 50; x <= 290; x += 30) {
      const p = { x, y }
      if (walkable(target, p) && routeTo(target, target.spawn, p) && occupied.every(q => Math.hypot(q.x - x, q.y - y) >= 24)
        && target.hotspots.every(h => Math.hypot(h.anchor.x - x, h.anchor.y - y) >= 24)) { chosen = p; break }
    }
    if (!chosen) throw Error('NO_SAFE_MIGRATION_POSITION')
    a.position = chosen; a.safe = { ...chosen }; occupied.push(chosen)
  }
  const seats = new Set<string>()
  for (const a of residents) {
    if (!walkable(target, a.safe)) a.safe = { ...a.position }
    const intent = a.intent
    if (intent) {
      const seat = intent.furnitureId === 'eat' && intent.seat === 'main' ? 'left' : intent.seat
      const h = target.hotspots.find(h => h.id === intent.furnitureId && (h.seat ?? 'main') === seat)
      const key = JSON.stringify([intent.furnitureId, seat])
      const path = h && routeTo(target, a.position, h.anchor)
      if (!h || !path?.length || seats.has(key) || !available(world, h.anchor, a.id)) { abandon(a); continue }
      seats.add(key)
      if (intent.stage === 'use' && Math.hypot(a.position.x - h.anchor.x, a.position.y - h.anchor.y) <= .01) {
        intent.seat = seat // Preserve phase, remaining time and expiry for an unchanged activity.
      } else {
        a.intent = { ...intent, seat, stage: 'approach', route: path.slice(1) }
        a.destination = path[0]!; a.behavior = 'walk'; a.phase = 0
      }
    } else if (a.behavior === 'walk' && (!a.destination || !reachable(target, a.position, a.destination))) abandon(a)
  }
  world.sceneVersion = 2
  return validateContentWorld(emptyContent(world), target)
}

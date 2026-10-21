import { isCharacterId, type CharacterId } from './roster.ts'
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export type Activity = 'work' | 'eat' | 'rest'
export type Behavior = 'idle' | 'walk' | 'put_down' | Activity
export interface Hotspot { id: Activity; hit: Rect; anchor: Point }
export interface Scene {
  schemaVersion: 1
  id: string
  version: number
  size: [number, number]
  walkable: Rect
  obstacles: Rect[]
  spawn: Point
  hotspots: Hotspot[]
}
export interface Actor {
  id: CharacterId
  facing: 'left' | 'right'
  position: Point
  safe: Point
  behavior: Behavior
  phase: number
  remaining: number
  destination: Point | null
}
export interface World {
  schemaVersion: 2
  worldId: 'bluewhale-courtyard'
  sceneVersion: number
  avatarDefinitionVersion: 1
  ticks: number
  rng: number
  userPaused: boolean
  actor: Actor
  companions: Actor[]
}
export const behaviors: Behavior[] = ['idle', 'walk', 'put_down', 'work', 'eat', 'rest']
export function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}
export function walkable(scene: Scene, point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && contains(scene.walkable, point)
    && !scene.obstacles.some(rect => contains(rect, point))
}
/** Exact segment/rectangle clipping, including corners; obstacles include a body-clearance margin. */
export function reachable(scene: Scene, from: Point, to: Point): boolean {
  if (!walkable(scene, from) || !walkable(scene, to)) return false
  return !scene.obstacles.some(rect => {
    let enter = 0, leave = 1
    for (const [start, delta, min, max] of [
      [from.x, to.x - from.x, rect.x, rect.x + rect.width],
      [from.y, to.y - from.y, rect.y, rect.y + rect.height],
    ] as [number, number, number, number][]) {
      if (Math.abs(delta) < 1e-12) { if (start < min || start > max) return false }
      else {
        const a = (min - start) / delta, b = (max - start) / delta
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b))
        if (enter > leave) return false
      }
    }
    return true
  })
}
export function placement(scene: Scene, point: Point, safe: Point): { position: Point; activity: Activity | null; accepted: boolean } {
  const hotspot = scene.hotspots.find(h => contains(h.hit, point))
  if (hotspot) return { position: { ...hotspot.anchor }, activity: hotspot.id, accepted: true }
  if (walkable(scene, point)) return { position: { ...point }, activity: null, accepted: true }
  return { position: { ...safe }, activity: null, accepted: false }
}
export function createWorld(scene: Scene, seed = 0x8e51ab49): World {
  return { schemaVersion: 2, worldId: 'bluewhale-courtyard', sceneVersion: scene.version, avatarDefinitionVersion: 1,
    ticks: 0, rng: seed >>> 0, userPaused: false, companions: [],
    actor: { id: 'bluewhale', facing: 'right', position: { ...scene.spawn }, safe: { ...scene.spawn }, behavior: 'idle', phase: 0, remaining: 4, destination: null } }
}
function random(world: World): number {
  world.rng = (Math.imul(world.rng, 1664525) + 1013904223) >>> 0
  return world.rng / 0x100000000
}
/** Fixed-step, seeded simulation. No renderer, wall clock, DSH or storage imports. */
export function actors(world: World): Actor[] { return [world.actor, ...world.companions] }
export function available(world: World, point: Point, except?: string): boolean {
  return actors(world).every(a => a.id === except || Math.hypot(a.position.x - point.x, a.position.y - point.y) >= 24)
}
/** Same depth order for pointer picking and drawing. */
export function orderedActors(world: World): Actor[] {
  return actors(world).sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id))
}
export function hitActor(world: World, point: Point): Actor | undefined {
  return orderedActors(world).reverse().find(a => Math.abs(point.x - a.position.x) <= 54 && point.y >= a.position.y - 115 && point.y <= a.position.y + 4)
}
export function step(world: World, scene: Scene, held?: string): void {
  world.ticks++
  for (const actor of actors(world).sort((a, b) => a.id.localeCompare(b.id))) {
    if (actor.id !== held) stepActor(world, scene, actor)
  }
}
function stepActor(world: World, scene: Scene, actor: Actor): void {
  const dt = 1 / 30
  actor.phase += dt
  if (actor.behavior === 'work' || actor.behavior === 'eat' || actor.behavior === 'rest') return
  actor.remaining = Math.max(0, actor.remaining - dt)
  if (actor.behavior === 'put_down' && actor.remaining === 0) {
    actor.behavior = 'idle'; actor.phase = 0; actor.remaining = 3 + random(world) * 4
  } else if (actor.behavior === 'idle' && actor.remaining === 0) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const target = { x: scene.walkable.x + random(world) * scene.walkable.width, y: scene.walkable.y + random(world) * scene.walkable.height }
      if (Math.hypot(target.x - actor.position.x, target.y - actor.position.y) > 20 && reachable(scene, actor.position, target) && available(world, target, actor.id)) {
        actor.behavior = 'walk'; actor.phase = 0; actor.destination = target; return
      }
    }
    actor.remaining = 3
  } else if (actor.behavior === 'walk' && actor.destination) {
    const dx = actor.destination.x - actor.position.x, dy = actor.destination.y - actor.position.y, distance = Math.hypot(dx, dy)
    if (Math.abs(dx) > .01) actor.facing = dx < 0 ? 'left' : 'right'
    const stride = 17 * dt
    if (distance <= stride && available(world, actor.destination, actor.id)) {
      actor.position = { ...actor.destination }; actor.safe = { ...actor.position }
      actor.destination = null; actor.behavior = 'idle'; actor.phase = 0; actor.remaining = 3 + random(world) * 5
    } else {
      const next = { x: actor.position.x + dx / distance * stride, y: actor.position.y + dy / distance * stride }
      if (!reachable(scene, actor.position, next) || !available(world, next, actor.id)) { actor.destination = null; actor.behavior = 'idle'; actor.remaining = 3; actor.phase = 0; return }
      actor.position = next; actor.safe = { ...next }
    }
  }
}
export function validateWorld(value: unknown, scene: Scene): World {
  const invalid = (): never => { throw Error('INVALID_WORLD') }
  if (!value || typeof value !== 'object') return invalid()
  const w = value as Omit<World, 'schemaVersion'> & { schemaVersion: number }
  if (![1, 2].includes(w.schemaVersion) || w.worldId !== 'bluewhale-courtyard' || w.sceneVersion !== scene.version || w.avatarDefinitionVersion !== 1
    || !Number.isSafeInteger(w.ticks) || w.ticks < 0 || !Number.isInteger(w.rng) || w.rng < 0 || w.rng > 0xffffffff
    || typeof w.userPaused !== 'boolean') return invalid()
  // Schema 1 is read without changing its original snapshot. New saves explicitly use schema 2.
  const extra = w.schemaVersion === 1 ? [] : w.companions
  if (!Array.isArray(extra) || extra.length > 6) return invalid()
  const ids = new Set<string>(), occupied = new Set<string>()
  const canonical = (a: Actor): Actor => {
    if (!a || !isCharacterId(a.id) || ids.has(a.id) || !['left', 'right'].includes(a.facing) || !behaviors.includes(a.behavior)
      || !Number.isFinite(a.phase) || a.phase < 0 || !Number.isFinite(a.remaining) || a.remaining < 0 || a.remaining > 60
      || !a.position || !a.safe || !walkable(scene, a.position) || !walkable(scene, a.safe)) return invalid()
    ids.add(a.id)
    if (['work', 'eat', 'rest'].includes(a.behavior)) {
      const anchor = scene.hotspots.find(h => h.id === a.behavior)?.anchor
      if (!anchor || occupied.has(a.behavior) || Math.hypot(anchor.x - a.position.x, anchor.y - a.position.y) > .01) return invalid()
      occupied.add(a.behavior)
    }
    if (a.behavior === 'walk') {
      if (!a.destination || !reachable(scene, a.position, a.destination)) return invalid()
    } else if (a.destination !== null) return invalid()
    return { id: a.id, facing: a.facing, position: { x: a.position.x, y: a.position.y }, safe: { x: a.safe.x, y: a.safe.y },
      behavior: a.behavior, phase: a.phase, remaining: a.remaining,
      destination: a.destination ? { x: a.destination.x, y: a.destination.y } : null }
  }
  return { schemaVersion: 2, worldId: w.worldId, sceneVersion: w.sceneVersion, avatarDefinitionVersion: 1,
    ticks: w.ticks, rng: w.rng, userPaused: w.userPaused, actor: canonical(w.actor), companions: extra.map(canonical) }
}

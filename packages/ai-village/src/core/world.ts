import { isCharacterId, type CharacterId } from './roster.ts'
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export type Activity = 'work' | 'eat' | 'rest'
export type Behavior = 'idle' | 'walk' | 'put_down' | Activity
export interface Hotspot { id: string; activity?: Activity; seat?: string; hit: Rect; anchor: Point }
export interface ActivityIntent { furnitureId: string; seat: string; activity: Activity; stage: 'approach' | 'use'; route: Point[]; expires: number }
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
  intent?: ActivityIntent | null
}
export interface World {
  schemaVersion: 3
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
export function activityOf(hotspot: Hotspot): Activity {
  const activity = hotspot.activity ?? hotspot.id
  if (activity !== 'work' && activity !== 'eat' && activity !== 'rest') throw Error('INVALID_FURNITURE_ACTIVITY')
  return activity
}
export function seatKey(hotspot: Hotspot): string { return JSON.stringify([hotspot.id, hotspot.seat ?? 'main']) }
export function seatAvailable(world: World, hotspot: Hotspot, except: string): boolean {
  return actors(world).every(a => a.id === except || (a.intent
    ? JSON.stringify([a.intent.furnitureId, a.intent.seat]) !== seatKey(hotspot)
    : !(a.behavior === activityOf(hotspot) && Math.hypot(a.position.x - hotspot.anchor.x, a.position.y - hotspot.anchor.y) < 1)))
}
/** Small visibility graph around the fixed scene obstacles; no external navigation engine. */
export function routeTo(scene: Scene, from: Point, to: Point): Point[] | null {
  if (!walkable(scene, from) || !walkable(scene, to)) return null
  if (reachable(scene, from, to)) return [{ ...to }]
  const nodes = [from, to, ...scene.obstacles.flatMap(r => [
    { x: r.x - 2, y: r.y - 2 }, { x: r.x + r.width + 2, y: r.y - 2 },
    { x: r.x - 2, y: r.y + r.height + 2 }, { x: r.x + r.width + 2, y: r.y + r.height + 2 },
  ]).filter(p => walkable(scene, p))]
  const distance = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>()
  distance[0] = 0
  for (let count = 0; count < nodes.length; count++) {
    let at = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (at < 0 || distance[i]! < distance[at]!)) at = i
    if (at < 0 || !Number.isFinite(distance[at])) break
    if (at === 1) {
      const route: Point[] = []
      for (let i = 1; i !== 0; i = previous[i]!) route.unshift({ ...nodes[i]! })
      return route
    }
    visited.add(at)
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && reachable(scene, nodes[at]!, nodes[i]!)) {
      const cost = distance[at]! + Math.hypot(nodes[i]!.x - nodes[at]!.x, nodes[i]!.y - nodes[at]!.y)
      if (cost < distance[i]!) { distance[i] = cost; previous[i] = at }
    }
  }
  return null
}
export function placement(scene: Scene, point: Point, safe: Point): { position: Point; activity: Activity | null; accepted: boolean; hotspot?: Hotspot } {
  const hotspot = scene.hotspots.find(h => contains(h.hit, point))
  if (hotspot) return { position: { ...hotspot.anchor }, activity: activityOf(hotspot), accepted: true, hotspot }
  if (walkable(scene, point)) return { position: { ...point }, activity: null, accepted: true }
  return { position: { ...safe }, activity: null, accepted: false }
}
export function createWorld(scene: Scene, seed = 0x8e51ab49): World {
  return { schemaVersion: 3, worldId: 'bluewhale-courtyard', sceneVersion: scene.version, avatarDefinitionVersion: 1,
    ticks: 0, rng: seed >>> 0, userPaused: false, companions: [],
    actor: { id: 'bluewhale', facing: 'right', position: { ...scene.spawn }, safe: { ...scene.spawn }, behavior: 'idle', phase: 0, remaining: 4, destination: null, intent: null } }
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
    else if (actor.intent) actor.intent.expires++ // Drag freezes this resident's simulation time.
  }
}
function stepActor(world: World, scene: Scene, actor: Actor): void {
  const dt = 1 / 30
  actor.phase += dt
  if (actor.intent && actor.intent.expires <= world.ticks) abandon(actor)
  actor.remaining = Math.max(0, actor.remaining - dt)
  if (actor.behavior === 'work' || actor.behavior === 'eat' || actor.behavior === 'rest') {
    if (actor.remaining === 0) { abandon(actor); wander(world, scene, actor) }
    return
  }
  if (actor.behavior === 'put_down' && actor.remaining === 0) {
    actor.behavior = 'idle'; actor.phase = 0; actor.remaining = 3 + random(world) * 4
  } else if (actor.behavior === 'idle' && actor.remaining === 0) {
    const preferred: Record<CharacterId, Activity> = { bluewhale: 'eat', claude: 'work', gemini: 'rest', gpt: 'work', grok: 'eat', kimi: 'rest', qwen: 'work' }
    const candidates = scene.hotspots.filter(h => seatAvailable(world, h, actor.id) && available(world, h.anchor, actor.id))
    const weighted = candidates.flatMap(h => activityOf(h) === preferred[actor.id] ? [h, h] : [h])
    const choice = random(world)
    const hotspot = weighted[Math.floor(choice * (weighted.length + 2))]
    const route = hotspot && routeTo(scene, actor.position, hotspot.anchor)
    if (hotspot && route?.length) {
      actor.intent = { furnitureId: hotspot.id, seat: hotspot.seat ?? 'main', activity: activityOf(hotspot),
        stage: 'approach', route: route.slice(1), expires: world.ticks + 1800 }
      actor.destination = route[0]!; actor.behavior = 'walk'; actor.phase = 0; return
    }
    wander(world, scene, actor)
  } else if (actor.behavior === 'walk' && actor.destination) {
    const dx = actor.destination.x - actor.position.x, dy = actor.destination.y - actor.position.y, distance = Math.hypot(dx, dy)
    if (Math.abs(dx) > .01) actor.facing = dx < 0 ? 'left' : 'right'
    const stride = 17 * dt
    if (distance <= stride && available(world, actor.destination, actor.id)) {
      actor.position = { ...actor.destination }; actor.safe = { ...actor.position }
      if (actor.intent?.stage === 'approach') {
        const next = actor.intent.route.shift()
        if (next) actor.destination = next
        else { actor.destination = null; actor.intent.stage = 'use'; actor.behavior = actor.intent.activity
          actor.phase = 0; actor.remaining = 12 + random(world) * 12; actor.intent.expires = world.ticks + 900 }
      } else { actor.destination = null; actor.behavior = 'idle'; actor.phase = 0; actor.remaining = 3 + random(world) * 5 }
    } else {
      if (distance < 1e-8) { abandon(actor); return }
      const next = { x: actor.position.x + dx / distance * Math.min(stride, distance), y: actor.position.y + dy / distance * Math.min(stride, distance) }
      if (!reachable(scene, actor.position, next) || !available(world, next, actor.id)) { abandon(actor); return }
      actor.position = next; actor.safe = { ...next }
    }
  }
}
export function abandon(actor: Actor): void {
  actor.intent = null; actor.destination = null; actor.behavior = 'idle'; actor.remaining = 3; actor.phase = 0
}
function wander(world: World, scene: Scene, actor: Actor): void {
  for (let attempt = 0; attempt < 16; attempt++) {
    const target = { x: scene.walkable.x + random(world) * scene.walkable.width, y: scene.walkable.y + random(world) * scene.walkable.height }
    if (Math.hypot(target.x - actor.position.x, target.y - actor.position.y) > 24 && reachable(scene, actor.position, target) && available(world, target, actor.id)) {
      actor.behavior = 'walk'; actor.phase = 0; actor.destination = target; actor.intent = null; return
    }
  }
  actor.remaining = 3
}
export function validateWorld(value: unknown, scene: Scene): World {
  const invalid = (): never => { throw Error('INVALID_WORLD') }
  if (!value || typeof value !== 'object') return invalid()
  const w = value as Omit<World, 'schemaVersion'> & { schemaVersion: number }
  if (![1, 2, 3].includes(w.schemaVersion) || w.worldId !== 'bluewhale-courtyard' || w.sceneVersion !== scene.version || w.avatarDefinitionVersion !== 1
    || !Number.isSafeInteger(w.ticks) || w.ticks < 0 || !Number.isInteger(w.rng) || w.rng < 0 || w.rng > 0xffffffff
    || typeof w.userPaused !== 'boolean') return invalid()
  // Older snapshots are read without rewriting their bytes. New saves explicitly use schema 3.
  const extra = w.schemaVersion === 1 ? [] : w.companions
  if (!Array.isArray(extra) || extra.length > 6) return invalid()
  const ids = new Set<string>(), occupied = new Set<string>()
  const canonical = (a: Actor): Actor => {
    if (!a || !isCharacterId(a.id) || ids.has(a.id) || !['left', 'right'].includes(a.facing) || !behaviors.includes(a.behavior)
      || !Number.isFinite(a.phase) || a.phase < 0 || !Number.isFinite(a.remaining) || a.remaining < 0 || a.remaining > 60
      || !a.position || !a.safe || !walkable(scene, a.position) || !walkable(scene, a.safe)) return invalid()
    ids.add(a.id)
    let intent = w.schemaVersion === 3 ? a.intent ?? null : null
    const using = ['work', 'eat', 'rest'].includes(a.behavior)
    if (using && !intent) {
      const h = scene.hotspots.find(h => activityOf(h) === a.behavior && Math.hypot(h.anchor.x - a.position.x, h.anchor.y - a.position.y) <= .01)
      if (!h) return invalid()
      intent = { furnitureId: h.id, seat: h.seat ?? 'main', activity: activityOf(h), stage: 'use', route: [], expires: w.ticks + 1800 }
    }
    if (intent) {
      const captured = intent
      const h = scene.hotspots.find(h => h.id === captured.furnitureId && (h.seat ?? 'main') === captured.seat)
      if (!h || activityOf(h) !== intent.activity || !['approach', 'use'].includes(intent.stage)
        || !Number.isSafeInteger(intent.expires) || intent.expires <= w.ticks || intent.expires > w.ticks + 1800
        || !Array.isArray(intent.route) || intent.route.length > scene.obstacles.length * 4 + 1
        || occupied.has(seatKey(h))) return invalid()
      occupied.add(seatKey(h))
      if (intent.stage === 'use') {
        if (a.behavior !== intent.activity || intent.route.length || Math.hypot(a.position.x - h.anchor.x, a.position.y - h.anchor.y) > .01) return invalid()
      } else {
        if (a.behavior !== 'walk' || !a.destination) return invalid()
        let last = a.destination
        for (const p of intent.route) { if (!p || !reachable(scene, last, p)) return invalid(); last = p }
        if (Math.hypot(last.x - h.anchor.x, last.y - h.anchor.y) > .01) return invalid()
      }
      intent = { furnitureId: h.id, seat: h.seat ?? 'main', activity: intent.activity, stage: intent.stage,
        expires: intent.expires, route: intent.route.map(p => ({ x: p.x, y: p.y })) }
    }
    if (a.behavior === 'walk') {
      if (!a.destination || !reachable(scene, a.position, a.destination)) return invalid()
    } else if (a.destination !== null) return invalid()
    return { id: a.id, facing: a.facing, position: { x: a.position.x, y: a.position.y }, safe: { x: a.safe.x, y: a.safe.y },
      behavior: a.behavior, phase: a.phase, remaining: using && !a.intent ? 30 : a.remaining, intent,
      destination: a.destination ? { x: a.destination.x, y: a.destination.y } : null }
  }
  return { schemaVersion: 3, worldId: w.worldId, sceneVersion: w.sceneVersion, avatarDefinitionVersion: 1,
    ticks: w.ticks, rng: w.rng, userPaused: w.userPaused, actor: canonical(w.actor), companions: extra.map(canonical) }
}

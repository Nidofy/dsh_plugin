import { legacyCharacterIds } from './roster-policy.ts'
import { abandon, reachable, type Actor, type Point, type Scene } from './world.ts'
import { clearSegment, residentRoute } from './navigation.ts'
import { characterIds, isCharacterId, type CharacterId } from './roster.ts'
import { lifeClock, residentLife, type LifeMotion } from './life-catalog.ts'

export const lifeSocialKinds = ['greet', 'chat', 'watch', 'tea', 'chime', 'garden'] as const
export type LifeSocialKind = typeof lifeSocialKinds[number]
export interface LifeSocial { pair: [CharacterId, CharacterId]; kind: LifeSocialKind; startTick: number; endTick: number }
export interface LifeState { social: LifeSocial | null }
export interface LifeWorld { actor: Actor; companions: Actor[]; ticks: number; userPaused: boolean; life: LifeState; decorations?: { windChime: { slot: string | null } | null } }
const members = (world: Pick<LifeWorld, 'actor' | 'companions'>) => [world.actor, ...world.companions]
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const free = (a: Actor) => a.behavior === 'idle' && !a.intent && !a.destination
const watched = (a: Actor) => ['read', 'work', 'tend'].includes(a.behavior) && a.intent?.stage === 'use'
const ownKeys = (value: object, keys: string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))
export const lifeSocialInterval = 900
export const lifeSocialDuration = 300

/** Only current interaction is saved. Its timing derives exclusively from simulation ticks. */
export function validateLifeState(value: unknown, world: Pick<LifeWorld, 'actor' | 'companions' | 'ticks'>, scene: Scene): LifeState {
  const invalid = (): never => { throw Error('INVALID_LIFE_STATE') }
  if (!value || typeof value !== 'object' || !ownKeys(value, ['social'])) return invalid()
  const social = (value as LifeState).social
  if (social === null) return { social: null }
  if (!social || typeof social !== 'object' || !ownKeys(social, ['pair', 'kind', 'startTick', 'endTick'])
    || !Array.isArray(social.pair) || social.pair.length !== 2 || !isCharacterId(social.pair[0]) || !isCharacterId(social.pair[1]) || social.pair[0] === social.pair[1]
    || !lifeSocialKinds.includes(social.kind) || !Number.isSafeInteger(social.startTick) || !Number.isSafeInteger(social.endTick)
    || social.startTick < 0 || social.startTick > world.ticks || social.endTick < world.ticks || social.endTick - social.startTick !== lifeSocialDuration) return invalid()
  const pair = social.pair.map(id => members(world).find(a => a.id === id))
  if (pair.some(a => !a)) return invalid()
  const [a, b] = pair as [Actor, Actor]
  if (a.intent || !['idle', 'walk'].includes(a.behavior) || (social.kind === 'watch' ? !watched(b) : !free(b))
    || distance(a.position, b.position) > 110 || !reachable(scene, a.position, b.position)) return invalid()
  return { social: { pair: [...social.pair], kind: social.kind, startTick: social.startTick, endTick: social.endTick } }
}

/** Stable ID order and rotating tick windows distribute opportunities without consuming RNG. */
export function chooseLifeSocial(world: Pick<LifeWorld, 'actor' | 'companions' | 'ticks' | 'decorations'>, scene: Scene, blockedIds: readonly CharacterId[] = []): LifeSocial | null {
  const all = members(world), window = Math.floor(world.ticks / lifeSocialInterval), period = lifeClock(world.ticks).period
  const catalog: readonly CharacterId[] = all.every(a => (legacyCharacterIds as readonly string[]).includes(a.id)) ? legacyCharacterIds : characterIds
  const order = [...catalog.slice(window % catalog.length), ...catalog.slice(0, window % catalog.length)]
  for (const id of order) {
    const actor = all.find(a => a.id === id), profile = residentLife[id]
    if (!actor || !free(actor) || blockedIds.includes(id) || (window % 5 >= profile.sociability && period !== profile.activePeriod)) continue
    const neighbors = all.filter(a => a.id !== id && !blockedIds.includes(a.id) && (free(a) || watched(a))
      && distance(a.position, actor.position) <= 100 && distance(a.position, actor.position) >= 24 && reachable(scene, actor.position, a.position))
      .sort((a, b) => distance(a.position, actor.position) - distance(b.position, actor.position) || a.id.localeCompare(b.id))
    for (const other of neighbors) {
      const approach = approachPoint(actor, other)
      if (!residentRoute(scene, actor.position, approach, all.filter(a => a.id !== id).map(a => a.position))) continue
      const nearbyGarden = scene.hotspots.some(h => h.activity === 'tend' && distance(h.anchor, other.position) <= 85)
      const kind: LifeSocialKind = watched(other) ? 'watch' : nearbyGarden && window % 2 === 0 ? 'garden'
        : window % 5 === 0 ? 'tea' : window % 5 === 1 ? 'greet' : window % 5 === 2 ? 'chat' : window % 5 === 3 && world.decorations?.windChime?.slot ? 'chime' : 'chat'
      return { pair: [id, other.id], kind, startTick: world.ticks, endTick: world.ticks + lifeSocialDuration }
    }
  }
  return null
}
function approachPoint(actor: Actor, other: Actor): Point {
  const d = distance(actor.position, other.position)
  if (d <= 52) return { ...actor.position }
  return { x: other.position.x + (actor.position.x - other.position.x) / d * 52, y: other.position.y + (actor.position.y - other.position.y) / d * 52 }
}
/** Never abandons a newer user-owned activity or a dragged participant. */
export function cancelLifeSocial(world: LifeWorld, protectedIds: readonly CharacterId[] = []): void {
  const social = world.life.social
  world.life.social = null
  if (!social) return
  for (const id of social.kind === 'watch' ? [social.pair[0]] : social.pair) {
    const actor = members(world).find(a => a.id === id)
    if (actor && !protectedIds.includes(id) && !actor.intent && ['idle', 'walk'].includes(actor.behavior)) abandon(actor)
  }
}

/** Run after ordinary scheduling as well: a watched resident may finish during that step. */
export function settleLifeSocial(world: LifeWorld, scene: Scene, protectedIds: readonly CharacterId[] = []): void {
  const social = world.life.social
  if (!social) return
  const a = members(world).find(a => a.id === social.pair[0]), b = members(world).find(a => a.id === social.pair[1])
  if (world.ticks >= social.endTick || social.pair.some(id => protectedIds.includes(id)) || !a || !b
    || a.intent || !['idle', 'walk'].includes(a.behavior) || (social.kind === 'watch' ? !watched(b) : !free(b))
    || distance(a.position, b.position) > 110 || !reachable(scene, a.position, b.position)) cancelLifeSocial(world, protectedIds)
}

/**
 * Run once BEFORE the normal world step. Returns residents owned by this short social
 * interaction, to exclude from ordinary scheduling for this tick. Does not advance ticks,
 * RNG, quests, rewards or relationship facts. Higher-priority activity cancels via blockedIds.
 */
export function stepLifeSocial(world: LifeWorld, scene: Scene, blockedIds: readonly CharacterId[] = []): CharacterId[] {
  if (world.userPaused) return []
  if (world.life.social && world.life.social.pair.some(id => blockedIds.includes(id))) { cancelLifeSocial(world, blockedIds); return [] }
  if (world.life.social && world.ticks >= world.life.social.endTick) { cancelLifeSocial(world); return [] }
  if (!world.life.social && world.ticks > 0 && world.ticks % lifeSocialInterval === 0) {
    world.life.social = chooseLifeSocial(world, scene, blockedIds)
    const social = world.life.social
    if (social) for (const actor of members(world)) if (social.pair.includes(actor.id) && (social.kind !== 'watch' || social.pair[0] === actor.id)) actor.phase = 0
  }
  const social = world.life.social
  if (!social) return []
  const all = members(world), a = all.find(a => a.id === social.pair[0]), b = all.find(a => a.id === social.pair[1])
  if (!a || !b || a.intent || !['idle', 'walk'].includes(a.behavior) || (social.kind === 'watch' ? !watched(b) : !free(b))
    || distance(a.position, b.position) > 110 || !reachable(scene, a.position, b.position)) { cancelLifeSocial(world); return [] }
  const held = social.kind === 'watch' ? [a.id] : [a.id, b.id]
  for (const actor of all.filter(a => held.includes(a.id))) { actor.phase += 1 / 30; actor.remaining = 3 }
  a.facing = b.position.x < a.position.x ? 'left' : 'right'
  if (social.kind !== 'watch') b.facing = a.position.x < b.position.x ? 'left' : 'right'
  if (distance(a.position, b.position) > 53) {
    // Bounded direct approach; no teleport and no extra reservation outside existing actor fields.
    const goal = approachPoint(a, b), occupied = all.filter(other => other.id !== a.id).map(a => a.position)
    const next = a.destination && distance(a.position, a.destination) > .01 && clearSegment(scene, a.position, a.destination, occupied)
      ? a.destination : residentRoute(scene, a.position, goal, occupied)?.[0]
    if (!next) { cancelLifeSocial(world); return [] }
    const d = distance(a.position, next), amount = Math.min(17 / 30, d)
    const position = d ? { x: a.position.x + (next.x - a.position.x) / d * amount, y: a.position.y + (next.y - a.position.y) / d * amount } : { ...next }
    if (!clearSegment(scene, a.position, position, occupied)) { cancelLifeSocial(world); return [] }
    if (a.behavior !== 'walk') a.phase = 0
    a.behavior = 'walk'; a.position = position; a.safe = { ...position }; a.destination = { ...next }
  } else {
    if (a.behavior !== 'idle') { a.phase = 0; if (social.kind !== 'watch') b.phase = 0 }
    a.behavior = 'idle'; a.destination = null
  }
  return held
}

export function lifePresentation(world: Pick<LifeWorld, 'actor' | 'companions' | 'ticks' | 'life'>, id: CharacterId): { motion: LifeMotion; elapsed: number; bubble: string | null } | null {
  const actor = members(world).find(a => a.id === id)
  if (!actor || actor.behavior !== 'idle') return null
  const social = world.life.social
  if (!social?.pair.includes(id)) return { motion: residentLife[id].signature, elapsed: actor.phase, bubble: null }
  if (world.ticks >= social.endTick - 45) return { motion: 'farewell', elapsed: (world.ticks - social.endTick + 45) / 30, bubble: 'farewell' }
  if (members(world).find(a => a.id === social.pair[0])?.behavior === 'walk') return { motion: 'waiting', elapsed: actor.phase, bubble: null }
  const elapsed = actor.phase, initiator = social.pair[0] === id
  const motion = !initiator ? 'listen' : social.kind === 'greet' ? 'wave' : social.kind === 'tea' ? 'offer'
    : social.kind === 'chime' || social.kind === 'garden' ? 'point' : 'listen'
  return { motion, elapsed, bubble: elapsed >= .6 && elapsed <= 3.2 && initiator ? social.kind : null }
}

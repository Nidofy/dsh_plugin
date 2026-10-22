import { actors, abandon, activityOf, step, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { inviteTea as teaInvite, settleTea as teaSettle, stepTea, cancelTea as teaCancel, placeBell as bellPlace } from './content-engine.ts'
import { uuid, type Food, type BellSlot } from './content-state.ts'
import { validateNeighborhoodWorld as validate, legacyContent, neighborhoodScene, extraUnlocked, type NeighborhoodWorld } from './neighborhood-state.ts'
import { neighborhoodEvents, type LayoutId, type ExtraDecoration } from './neighborhood-catalog.ts'
import type { CharacterId } from './roster.ts'

export function inviteTea(source: NeighborhoodWorld, base: Scene, pair: [CharacterId, CharacterId], food: Food, id: string): NeighborhoodWorld {
  if (source.neighborhood.event) throw Error('EVENT_ACTIVE')
  if (source.neighborhood.lastEventId===id || source.neighborhood.memories.some(m=>m.eventId===id)) throw Error('INVALID_INVITATION')
  return validate({ ...teaInvite(legacyContent(source), neighborhoodScene(base, source.neighborhood.layout), pair, food, id), schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: source.neighborhood }, base)
}
export function cancelTea(world: NeighborhoodWorld): void {
  const copy = legacyContent(world); teaCancel(copy); world.activeEvent = copy.activeEvent
  for (const actor of actors(world)) if (world.neighborhood.event?.participants.includes(actor.id)) abandon(actor)
  world.neighborhood.event = null
}
export function placeBell(world: NeighborhoodWorld, base: Scene, slot: BellSlot | null): NeighborhoodWorld {
  return validate({ ...bellPlace(legacyContent(world), neighborhoodScene(base, world.neighborhood.layout), slot), schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: world.neighborhood }, base)
}
export function startNeighborhoodEvent(source: NeighborhoodWorld, base: Scene, definitionId: string, participants: CharacterId[], id: string): NeighborhoodWorld {
  const world = validate(source, base), n = world.neighborhood, scene = neighborhoodScene(base, n.layout)
  const definition = neighborhoodEvents.find(d => d.id === definitionId)
  if (world.activeEvent || n.event) throw Error('EVENT_ACTIVE')
  if (world.ticks < n.nextInteractionTick) throw Error('INTERACTION_COOLDOWN')
  if (!definition || !uuid(id) || n.lastEventId === id || n.memories.some(m => m.eventId === id) || world.progress.lastCompletedEventId === id || world.journal.some(m=>m.eventId===id) || participants.length !== definition.count || new Set(participants).size !== participants.length) throw Error('INVALID_INVITATION')
  if ((definitionId === 'shared-book' && n.layout !== 'reading') || (definitionId === 'plant-care' && n.layout !== 'garden')) throw Error('LAYOUT_REQUIRED')
  const members = participants.map(id => actors(world).find(a => a.id === id))
  if (members.some(a => !a)) throw Error('RESIDENT_MISSING')
  const projected = structuredClone(world), seats: (string | null)[] = []
  for (let i = 0; i < members.length; i++) {
    const a = members[i]!
    if (definition.furniture === 'here') { abandon(a); seats.push(null); continue }
    const seat = definition.count === 2 ? (i ? 'right' : 'left') : 'main'
    const h = scene.hotspots.find(h => h.id === definition.furniture && h.seat === seat)
    if (!h) throw Error('LAYOUT_REQUIRED')
    if (actors(world).some(other => !participants.includes(other.id) && other.intent?.furnitureId === h.id && other.intent.seat === seat)) throw Error('SEAT_OCCUPIED')
    const path = residentRoute(scene, a.position, h.anchor, actors(projected).filter(other => other.id !== a.id).map(a => a.position))
    if (!path) throw Error('PATH_BLOCKED')
    a.intent = { furnitureId: h.id, seat, activity: activityOf(h), stage: 'approach', route: path.slice(1), expires: world.ticks + 1800 }
    a.destination = path[0]!; a.behavior = 'walk'; a.phase = 0; a.remaining = 30
    actors(projected).find(other => other.id === a.id)!.position = { ...h.anchor }; seats.push(h.id + '/' + seat)
  }
  n.event = { id, definitionId, participants: [...participants], seats, phase: definition.furniture === 'here' ? 'acting' : 'approaching', remainingTicks: definition.ticks, approachRemainingTicks: 1080 }
  return validate(world, base)
}
export function stepNeighborhood(world: NeighborhoodWorld, base: Scene): void {
  const scene = neighborhoodScene(base, world.neighborhood.layout)
  if (world.activeEvent) { stepTea(legacyContent(world), scene); world.ticks++; return }
  const e = world.neighborhood.event
  if (!e) { step(world, scene); return }
  world.ticks++
  for (const a of actors(world)) { a.phase += 1 / 30; if (a.intent) a.intent.expires++ }
  if (e.phase === 'acting') { e.remainingTicks = Math.max(0, e.remainingTicks - 1); return }
  e.approachRemainingTicks = Math.max(0, e.approachRemainingTicks - 1)
  const members = e.participants.map(id => actors(world).find(a => a.id === id)!)
  const a = members.find(a => a.intent?.stage === 'approach')
  if (a?.destination) {
    const occupied = actors(world).filter(other => other.id !== a.id).map(a => a.position), intent = a.intent!
    if (!clearSegment(scene, a.position, a.destination, occupied)) {
      const h = scene.hotspots.find(h => h.id === intent.furnitureId && h.seat === intent.seat)!
      const path = residentRoute(scene, a.position, h.anchor, occupied)
      if (path) { a.destination = path[0]!; intent.route = path.slice(1) }
    } else {
      const dx = a.destination.x - a.position.x, dy = a.destination.y - a.position.y, distance = Math.hypot(dx, dy)
      if (Math.abs(dx) > .01) a.facing = dx < 0 ? 'left' : 'right'
      if (distance <= 17 / 30) {
        a.position = { ...a.destination }; a.destination = intent.route.shift() ?? null
        if (!a.destination) { intent.stage = 'use'; a.behavior = intent.activity; a.phase = 0 }
      } else { a.position = { x: a.position.x + dx / distance * 17 / 30, y: a.position.y + dy / distance * 17 / 30 } }
      a.safe = { ...a.position }
    }
  }
  if (members.every(a => a.intent?.stage === 'use')) e.phase = 'acting'
}
function rememberPair(world: NeighborhoodWorld, participants: CharacterId[]) {
  if (participants.length !== 2) return
  const pair = [...participants].sort() as [CharacterId, CharacterId], bonds = world.neighborhood.bonds
  const bond = bonds.find(b => b.pair.join('/') === pair.join('/'))
  if (bond) { bond.count = Math.min(1000000, bond.count + 1); bond.lastTick = world.ticks }
  else bonds.push({ pair, count: 1, lastTick: world.ticks })
}
export function settleTea(source: NeighborhoodWorld, base: Scene): NeighborhoodWorld | null {
  const tea = teaSettle(legacyContent(source), neighborhoodScene(base, source.neighborhood.layout))
  if (tea) {
    const next: NeighborhoodWorld = { ...tea, schemaVersion: 5, simulationRulesVersion: 2, contentRevision: 2, neighborhood: structuredClone(source.neighborhood) }
    if (source.activeEvent?.phase === 'talking') rememberPair(next, source.activeEvent.participants)
    return validate(next, base)
  }
  const e = source.neighborhood.event
  if (!e || (e.phase === 'acting' ? e.remainingTicks > 0 : e.approachRemainingTicks > 0)) return null
  const world = validate(source, base), n = world.neighborhood
  if (e.phase === 'acting') {
    const definition = neighborhoodEvents.find(d => d.id === e.definitionId)!, previous = n.memories.find(m => m.id === definition.story)
    if (previous) previous.count = Math.min(1000000, previous.count + 1)
    else n.memories.push({ id: definition.story, eventId: e.id, participants: [...e.participants], completedTick: world.ticks, count: 1 })
    rememberPair(world, e.participants); n.lastEventId = e.id; n.nextInteractionTick = world.ticks + 90
  }
  cancelTea(world)
  return validate(world, base)
}
export function changeLayout(source: NeighborhoodWorld, base: Scene, layout: LayoutId): NeighborhoodWorld {
  const world = validate(source, base)
  if (world.activeEvent || world.neighborhood.event) throw Error('EVENT_ACTIVE')
  if (world.neighborhood.layout === layout) return world
  const scene = neighborhoodScene(base, layout)
  for (const a of actors(world)) if (a.intent && !scene.hotspots.some(h => h.id === a.intent!.furnitureId && h.seat === a.intent!.seat)) abandon(a)
  world.neighborhood.layout = layout; world.neighborhood.layoutRevision++
  return validate(world, base)
}
export function decorateExtra(source: NeighborhoodWorld, base: Scene, id: ExtraDecoration, slot: BellSlot | null): NeighborhoodWorld {
  const world = validate(source, base)
  if (!extraUnlocked(world.neighborhood, id)) throw Error('DECORATION_LOCKED')
  world.neighborhood.decorations[id] = slot
  return validate(world, base)
}

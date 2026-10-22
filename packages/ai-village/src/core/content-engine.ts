import { abandon, actors, type Actor, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { validateContentWorld, uuid, type ContentWorld, type Food, type BellSlot } from './content-state.ts'
import type { CharacterId } from './roster.ts'

/** Commands return validated candidates. Only the runtime's confirmed transaction adopts them. */
export function inviteTea(source: ContentWorld, scene: Scene, pair: [CharacterId, CharacterId], food: Food, id: string): ContentWorld {
  const world = validateContentWorld(source, scene)
  if (world.activeEvent) throw Error('EVENT_ACTIVE')
  if (!uuid(id) || pair[0] === pair[1] || world.progress.lastCompletedEventId === id || world.journal.some(row => row.eventId === id)) throw Error('INVALID_INVITATION')
  const members = pair.map(id => actors(world).find(a => a.id === id))
  if (members.some(a => !a)) throw Error('RESIDENT_MISSING')
  // Plan both legs against the state each resident will actually encounter.
  const projected = structuredClone(world)
  for (let i = 0; i < 2; i++) {
    const actor = members[i]!, projectedActor = actors(projected).find(a => a.id === actor.id)!
    const seat = i ? 'right' : 'left', h = scene.hotspots.find(h => h.id === 'eat' && h.seat === seat)
    if (!h) throw Error('SEAT_UNAVAILABLE')
    if (actors(world).some(a => !pair.includes(a.id) && a.intent?.furnitureId === 'eat' && a.intent.seat === seat)) throw Error('SEAT_OCCUPIED')
    const route = residentRoute(scene, projectedActor.position, h.anchor, actors(projected).filter(a => a.id !== actor.id).map(a => a.position))
    if (!route) throw Error('PATH_BLOCKED')
    actor.intent = { furnitureId: 'eat', seat, activity: 'eat', stage: 'approach', route: route.slice(1), expires: world.ticks + 1800 }
    actor.destination = route[0]!; actor.behavior = 'walk'; actor.phase = 0; actor.remaining = 30
    projectedActor.position = { ...h.anchor }
  }
  world.activeEvent = { id, definitionId: 'first-tea', definitionVersion: 1, participants: [...pair], food,
    seats: ['eat/left', 'eat/right'], phase: 'approaching', remainingTicks: 150, approachRemainingTicks: 1080, retryCount: 0,
    branch: world.journal.length ? 'familiar' : food }
  return validateContentWorld(world, scene)
}
export function cancelTea(world: ContentWorld): void {
  const event = world.activeEvent
  if (!event) return
  for (const actor of actors(world)) if (event.participants.includes(actor.id)) abandon(actor)
  world.activeEvent = null
}
/** During gathering residents wait; one guest walks at a time, with full collision clearance. */
export function stepTea(world: ContentWorld, scene: Scene): void {
  const event = world.activeEvent
  if (!event) return
  world.ticks++
  for (const actor of actors(world)) { actor.phase += 1 / 30; if (actor.intent) actor.intent.expires++ }
  if (event.phase === 'talking') { event.remainingTicks = Math.max(0, event.remainingTicks - 1); return }
  event.approachRemainingTicks = Math.max(0, event.approachRemainingTicks - 1)
  const members = event.participants.map(id => actors(world).find(a => a.id === id)!)
  const moving = members.find(a => a.intent?.stage === 'approach')
  if (moving) moveGuest(world, scene, moving)
  if (members.every(a => a.intent?.stage === 'use')) event.phase = 'talking'
}
function moveGuest(world: ContentWorld, scene: Scene, actor: Actor): void {
  const destination = actor.destination, intent = actor.intent!
  if (!destination) return
  const occupied = actors(world).filter(a => a.id !== actor.id).map(a => a.position)
  if (!clearSegment(scene, actor.position, destination, occupied)) {
    const h = scene.hotspots.find(h => h.id === 'eat' && h.seat === intent.seat)!
    const route = residentRoute(scene, actor.position, h.anchor, occupied)
    if (!route) return // A bounded deadline cancels without a reward.
    actor.destination = route[0]!; intent.route = route.slice(1); return
  }
  const dx = destination.x - actor.position.x, dy = destination.y - actor.position.y, distance = Math.hypot(dx, dy)
  if (Math.abs(dx) > .01) actor.facing = dx < 0 ? 'left' : 'right'
  if (distance <= 17 / 30) {
    actor.position = { ...destination }; actor.safe = { ...destination }
    actor.destination = intent.route.shift() ?? null
    if (!actor.destination) { intent.stage = 'use'; actor.behavior = 'eat'; actor.phase = 0; actor.remaining = 30 }
  } else {
    actor.position = { x: actor.position.x + dx / distance * 17 / 30, y: actor.position.y + dy / distance * 17 / 30 }
    actor.safe = { ...actor.position }
  }
}
export function settleTea(source: ContentWorld, scene: Scene): ContentWorld | null {
  const event = source.activeEvent
  if (!event || (event.phase === 'approaching' ? event.approachRemainingTicks > 0 : event.remainingTicks > 0)) return null
  const world = validateContentWorld(source, scene)
  if (event.phase === 'talking') {
    const first = world.journal[0]
    if (first) first.count++ // Keep the first gathering's actual participants, food and date.
    else world.journal.push({ id: event.id, templateId: 'first-table', eventId: event.id, participants: [...event.participants],
      food: event.food, completedTick: world.ticks, count: 1 })
    world.progress.completedWishes = ['first-tea']; world.progress.unlocked = ['wind-chime']; world.progress.lastCompletedEventId = event.id
    if (!world.progress.discovered.includes('first-table')) world.progress.discovered.push('first-table')
    world.decorations.windChime ??= { id: 'first-wind-chime', slot: null }
  }
  cancelTea(world)
  return validateContentWorld(world, scene)
}
export function placeBell(source: ContentWorld, scene: Scene, slot: BellSlot | null): ContentWorld {
  const world = validateContentWorld(source, scene)
  if (!world.decorations.windChime) throw Error('DECORATION_LOCKED')
  if (world.decorations.windChime.slot !== slot) {
    world.decorations.windChime.slot = slot; world.decorations.layoutRevision++
    if (!world.progress.discovered.includes('wind-chime-placed')) world.progress.discovered.push('wind-chime-placed')
  }
  return validateContentWorld(world, scene)
}

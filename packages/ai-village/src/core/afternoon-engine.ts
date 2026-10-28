import { actors, abandon, type Point, type Scene } from './world.ts'
import { residentRoute, clearSegment } from './navigation.ts'
import { validateLivingWorld, type LivingWorld } from './living-state.ts'
import { teaSquareScene, teaSquareClosing } from './tea-square-scene.ts'
import { cancelCommunitySocial } from './community-life.ts'
import { cancelManualMove } from './manual-move.ts'
import { cancelTeaSquareActivity } from './tea-square-engine.ts'
import { afternoonStory, isAfternoonStoryId, type AfternoonStoryId, type AfternoonAction } from './afternoon-catalog.ts'
import { afternoonToken, afternoonUsedIds, type AfternoonEvent } from './afternoon-state.ts'
import type { CharacterId } from './roster.ts'
import { uuid } from './content-state.ts'
import { villageTime } from './dialogue.ts'
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
function assign(w: LivingWorld, id: CharacterId, route: Point[]) {
  const a = actors(w).find(a => a.id === id)!; abandon(a); a.destination = route[0] ?? null; a.behavior = a.destination ? 'walk' : 'idle'
}
function prepare(w: LivingWorld) {
  const e = w.afternoon.active!, targets: Point[] = [], routes: Point[][] = []
  const outsiders = actors(w).filter(a => !e.participants.includes(a.id)).map(a => a.position)
  const left = e.storyId === 'tea-bookmark' ? e.stage === 0 : e.stage === 2
  const preferred = left ? { x: 98, y: 380 } : { x: 262, y: 380 }
  let totalDistance = 0
  for (let i = 0; i < 2; i++) {
    const a = actors(w).find(a => a.id === e.participants[i])!
    const occupied = [...outsiders, ...targets, ...e.participants.slice(i + 1).map(id => actors(w).find(a => a.id === id)!.position)]
    const candidates = [...teaSquareClosing].sort((a, b) => distance(a, preferred) - distance(b, preferred))
    let found = false
    for (const target of candidates) {
      if (occupied.some(p => distance(p, target) < 24) || e.stage === 2 && distance(a.position, target) < 32) continue
      const route = residentRoute(teaSquareScene, a.position, target, occupied)?.filter((p, j) => j !== 0 || distance(p, a.position) > .001)
      if (!route || route.length > 9) continue
      let last = a.position, length = 0
      for (const p of route) { length += distance(last, p); last = p }
      // Sequential movement has one shared deadline. Refuse impossible invitations up front.
      if (totalDistance + length > 660) continue
      totalDistance += length; targets.push({ ...target }); routes.push(route); found = true; break
    }
    if (!found) throw Error('PATH_BLOCKED')
  }
  e.targets = targets; e.routes = routes; e.phase = 'approaching'; e.remainingTicks = 60; e.approachRemainingTicks = 1200
  e.participants.forEach((id, i) => assign(w, id, routes[i]!))
}
export function startAfternoon(source: LivingWorld, base: Scene, storyId: AfternoonStoryId, participants: CharacterId[], eventId: string) {
  const w = validateLivingWorld(source, base)
  if (w.region.active !== 'tea-square') throw Error('TEA_SQUARE_REQUIRED')
  if (w.afternoon.active || w.teaSquare.active || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event) throw Error('EVENT_ACTIVE')
  if (!isAfternoonStoryId(storyId) || participants.length !== 2 || new Set(participants).size !== 2 || !afternoonStory(storyId).participants.every(id => participants.includes(id)) || participants.some(id => !actors(w).some(a => a.id === id)) || !uuid(eventId) || afternoonUsedIds(w).has(eventId) || w.afternoon.memories.some(m => m.eventId === eventId) || Object.values(w.afternoon.lastEventIds).includes(eventId)) throw Error('INVALID_INVITATION')
  cancelTeaSquareActivity(w); cancelManualMove(w); cancelCommunitySocial(w); for (const a of actors(w)) abandon(a)
  w.afternoon.active = { version: 1, id: eventId, storyId, participants: [...afternoonStory(storyId).participants], stage: 0, phase: 'approaching', remainingTicks: 60, approachRemainingTicks: 1200, targets: [], routes: [], serial: 0, selection: null, attempts: 0 }
  prepare(w); return validateLivingWorld(w, base)
}
export function cancelAfternoon(w: LivingWorld) {
  for (const id of w.afternoon.active?.participants ?? []) { const a = actors(w).find(a => a.id === id); if (a) abandon(a) }
  w.afternoon.active = null
}
export function stepAfternoon(w: LivingWorld) {
  const e = w.afternoon.active
  if (!e || w.userPaused) return
  w.ticks++; for (const a of actors(w)) a.phase += 1 / 30
  if (e.phase === 'ready') return
  if (e.phase === 'observing') { if (--e.remainingTicks === 0) e.phase = 'ready'; return }
  if (--e.approachRemainingTicks <= 0) { cancelAfternoon(w); return 'blocked' as const }
  const i = e.routes.findIndex(r => r.length)
  if (i < 0) { e.phase = 'observing'; return }
  const route = e.routes[i]!, a = actors(w).find(a => a.id === e.participants[i])!, target = route[0]!
  const occupied = actors(w).filter(b => b.id !== a.id).map(b => b.position)
  if (!clearSegment(teaSquareScene, a.position, target, occupied)) return
  const dx = target.x - a.position.x, dy = target.y - a.position.y, d = Math.hypot(dx, dy)
  if (Math.abs(dx) > .01) a.facing = dx < 0 ? 'left' : 'right'
  if (d <= 17 / 30) { a.position = { ...target }; route.shift(); a.destination = route[0] ?? null; if (!a.destination) { a.behavior = 'idle'; a.phase = 0 } }
  else a.position = { x: a.position.x + dx / d * 17 / 30, y: a.position.y + dy / d * 17 / 30 }
  a.safe = { ...a.position }
}
function closeStage(w: LivingWorld, e: AfternoonEvent) { e.stage = 2; prepare(w) }
export function actAfternoon(source: LivingWorld, base: Scene, token: string, action: AfternoonAction, choice?: string) {
  const w = validateLivingWorld(source, base), e = w.afternoon.active
  if (!e || token !== afternoonToken(e) || e.serial >= 1000000) throw Error('STALE_PLAY_ACTION')
  if (e.phase !== 'ready') throw Error('PLAY_NOT_READY')
  if (e.stage === 2) {
    if (action !== 'remember' || choice !== undefined) throw Error('INVALID_PLAY_ACTION')
    const first = w.afternoon.memories.find(m => m.storyId === e.storyId)
    if (first) first.count = Math.min(1000000, first.count + 1)
    else { w.afternoon.memories.push({ storyId: e.storyId, eventId: e.id, participants: [...e.participants], completedTick: w.ticks, day: villageTime(w.ticks).day, count: 1, selection: e.selection! }); w.afternoon.keepsakes[e.storyId] = 'message-tree' }
    w.afternoon.lastEventIds[e.storyId] = e.id; cancelAfternoon(w)
  } else if (e.storyId === 'tea-bookmark') {
    if (e.stage === 0 && action === 'listen' && choice === undefined) { e.stage = 1; e.serial++ }
    else if (e.stage === 1 && action === 'fold' && (choice === 'leaf' || choice === 'wave')) { e.selection = choice; e.serial++ }
    else if (e.stage === 1 && action === 'press' && choice === undefined && e.selection !== null) { e.serial++; closeStage(w, e) }
    else throw Error('INVALID_PLAY_ACTION')
  } else {
    if (e.stage === 0 && action === 'observe' && (choice === 'left' || choice === 'right')) { e.selection = choice; e.stage = 1; e.serial++ }
    else if (e.stage === 1 && action === 'match' && (choice === 'same' || choice === 'mirror')) {
      e.serial++; if (choice === 'mirror') closeStage(w, e); else e.attempts = Math.min(1000000, e.attempts + 1)
    } else throw Error('INVALID_PLAY_ACTION')
  }
  return validateLivingWorld(w, base)
}
export function placeAfternoonKeepsake(source: LivingWorld, base: Scene, storyId: AfternoonStoryId, place: 'message-tree' | null) {
  const w = validateLivingWorld(source, base)
  if (!isAfternoonStoryId(storyId) || place !== null && place !== 'message-tree') throw Error('INVALID_SLOT')
  if (!w.afternoon.memories.some(m => m.storyId === storyId)) throw Error('DECORATION_LOCKED')
  if (w.afternoon.active || w.teaSquare.active || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event) throw Error('EVENT_ACTIVE')
  cancelCommunitySocial(w); w.afternoon.keepsakes[storyId] = place; return validateLivingWorld(w, base)
}

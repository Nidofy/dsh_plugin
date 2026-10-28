import { actors, walkable, reachable, type Point } from './world.ts'
import { uuid } from './content-state.ts'
import type { CharacterId } from './roster.ts'
import type { LivingWorld } from './living-state.ts'
import { teaSquareScene, teaSquareClosing } from './tea-square-scene.ts'
import { villageTime } from './dialogue.ts'
import { afternoonStory, afternoonStoryIds, isAfternoonStoryId, afternoonSelectionValid, type AfternoonStoryId, type AfternoonSelection } from './afternoon-catalog.ts'
export type { AfternoonStoryId, AfternoonSelection, AfternoonAction } from './afternoon-catalog.ts'
export interface AfternoonEvent {
  version: 1; id: string; storyId: AfternoonStoryId; participants: [CharacterId, CharacterId]
  stage: 0 | 1 | 2; phase: 'approaching' | 'observing' | 'ready'; remainingTicks: number; approachRemainingTicks: number
  targets: Point[]; routes: Point[][]; serial: number; selection: AfternoonSelection | null; attempts: number
}
export interface AfternoonMemory { storyId: AfternoonStoryId; eventId: string; participants: [CharacterId, CharacterId]; completedTick: number; day: number; count: number; selection: AfternoonSelection }
export interface AfternoonState { version: 1; active: AfternoonEvent | null; memories: AfternoonMemory[]; lastEventIds: Record<AfternoonStoryId, string | null>; keepsakes: Record<AfternoonStoryId, 'message-tree' | null> }
export const blankAfternoon = (): AfternoonState => ({ version: 1, active: null, memories: [], lastEventIds: { 'tea-bookmark': null, 'reflection-shapes': null }, keepsakes: { 'tea-bookmark': null, 'reflection-shapes': null } })
export const afternoonToken = (e: AfternoonEvent) => `${e.id}:${e.stage}:${e.serial}`
export function afternoonUsedIds(w: LivingWorld) { return new Set([...w.journal.map(m => m.eventId), ...w.neighborhood.memories.map(m => m.eventId), w.play.lastEventId, w.neighborhood.lastEventId, w.progress.lastCompletedEventId, w.play.active?.id, w.neighborhood.event?.id, w.activeEvent?.id, w.bookhouse.active?.id, w.bookhouse.memory?.eventId, w.bookhouse.lastEventId, w.bookhouse.puzzleMemory?.eventId, w.bookhouse.puzzleLastEventId, w.teaSquare.active?.id, w.teaSquare.memory?.eventId, w.teaSquare.lastEventId]) }
const fail = (): never => { throw Error('INVALID_AFTERNOON') }
function exact(v: unknown, keys: string[]): asserts v is Record<string, any> { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail() }
const integer = (n: unknown, min: number, max: number): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
function cast(id: AfternoonStoryId, p: unknown) { return Array.isArray(p) && p.length === 2 && p.every((v, i) => v === afternoonStory(id).participants[i]) }
export function validateAfternoon(value: unknown, w: LivingWorld): AfternoonState {
  exact(value, ['version', 'active', 'memories', 'lastEventIds', 'keepsakes'])
  exact(value.lastEventIds, [...afternoonStoryIds]); exact(value.keepsakes, [...afternoonStoryIds])
  if (value.version !== 1 || !Array.isArray(value.memories) || value.memories.length > 2) fail()
  const used = afternoonUsedIds(w), seen = new Set<AfternoonStoryId>(), ownIds = new Set<string>()
  for (const m of value.memories) {
    exact(m, ['storyId', 'eventId', 'participants', 'completedTick', 'day', 'count', 'selection'])
    if (!isAfternoonStoryId(m.storyId) || seen.has(m.storyId) || !uuid(m.eventId) || used.has(m.eventId) || ownIds.has(m.eventId) || !cast(m.storyId, m.participants) || !integer(m.completedTick, 0, w.ticks) || m.day !== villageTime(m.completedTick).day || !integer(m.count, 1, 1000000) || !afternoonSelectionValid(m.storyId, m.selection)) fail()
    const last = value.lastEventIds[m.storyId]
    if (!uuid(last) || used.has(last) || ownIds.has(last) || m.count === 1 && last !== m.eventId || m.count > 1 && last === m.eventId) fail()
    seen.add(m.storyId); ownIds.add(m.eventId); ownIds.add(last)
  }
  for (const id of afternoonStoryIds) {
    if (![null, 'message-tree'].includes(value.keepsakes[id]) || !seen.has(id) && (value.keepsakes[id] !== null || value.lastEventIds[id] !== null)) fail()
  }
  if (value.active !== null) {
    const e = value.active
    exact(e, ['version', 'id', 'storyId', 'participants', 'stage', 'phase', 'remainingTicks', 'approachRemainingTicks', 'targets', 'routes', 'serial', 'selection', 'attempts'])
    if (w.region.active !== 'tea-square' || w.teaSquare.active || w.teaSquare.activity || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event || w.life.social || w.manualMove) fail()
    if (e.version !== 1 || !uuid(e.id) || used.has(e.id) || ownIds.has(e.id) || !isAfternoonStoryId(e.storyId) || !cast(e.storyId, e.participants) || !integer(e.stage, 0, 2) || !['approaching', 'observing', 'ready'].includes(e.phase) || !integer(e.remainingTicks, 0, 60) || !integer(e.approachRemainingTicks, 0, 1200) || !integer(e.serial, 0, 1000000) || !integer(e.attempts, 0, 1000000) || !Array.isArray(e.targets) || e.targets.length !== 2 || !Array.isArray(e.routes) || e.routes.length !== 2) fail()
    if (e.stage === 0 && (e.selection !== null || e.serial !== 0 || e.attempts !== 0) || e.selection !== null && !afternoonSelectionValid(e.storyId, e.selection) || e.stage === 2 && e.selection === null || e.storyId === 'reflection-shapes' && e.stage > 0 && e.selection === null || e.storyId === 'tea-bookmark' && e.attempts !== 0) fail()
    if (e.stage > 0 && e.serial < 1 || e.stage === 2 && e.serial < (e.storyId === 'tea-bookmark' ? 3 : 2) || e.stage === 1 && e.phase !== 'ready' || e.phase === 'approaching' && (e.remainingTicks !== 60 || e.approachRemainingTicks === 0) || e.phase === 'observing' && e.remainingTicks === 0 || e.phase === 'ready' && e.remainingTicks !== 0) fail()
    e.targets.forEach((p: unknown, i: number) => {
      exact(p, ['x', 'y']); const target = p as Point, a = actors(w).find(a => a.id === e.participants[i]), route = e.routes[i]
      if (!a || !teaSquareClosing.some(q => same(q, target)) || e.targets.some((q: Point, j: number) => j !== i && Math.hypot(q.x - target.x, q.y - target.y) < 24) || !Array.isArray(route) || route.length > 9 || a.intent) fail()
      let last = a!.position
      for (const p of route) { exact(p, ['x', 'y']); if (!walkable(teaSquareScene, p as Point) || !reachable(teaSquareScene, last, p as Point)) fail(); last = p as Point }
      if (route.length) { if (e.phase !== 'approaching' || !same(last, target) || a!.behavior !== 'walk' || !a!.destination || !same(a!.destination!, route[0])) fail() }
      else if (!same(a!.position, target) || a!.behavior !== 'idle' || a!.destination !== null) fail()
    })
  }
  return structuredClone(value) as AfternoonState
}

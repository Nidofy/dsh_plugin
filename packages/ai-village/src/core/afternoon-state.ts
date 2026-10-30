import { actors, walkable, reachable, type Point } from './world.ts'
import { uuid } from './content-state.ts'
import type { CharacterId } from './roster.ts'
import type { LivingWorld } from './living-state.ts'
import { regionScene } from './living-state.ts'
import { afternoonTargets } from './afternoon-geometry.ts'
import { residentStory } from './resident-stories-catalog.ts'
import { villageTime } from './dialogue.ts'
import { afternoonStory, afternoonStoryIds, isAfternoonStoryId, afternoonSelectionValid, type AfternoonStoryId, type AfternoonSelection, type AfternoonPlacement } from './afternoon-catalog.ts'
export type { AfternoonStoryId, AfternoonSelection, AfternoonAction } from './afternoon-catalog.ts'
export interface AfternoonEvent {
  version: 2; step: number; id: string; storyId: AfternoonStoryId; participants: [CharacterId, CharacterId]
  stage: 0 | 1 | 2; phase: 'approaching' | 'observing' | 'ready'; remainingTicks: number; approachRemainingTicks: number
  targets: Point[]; routes: Point[][]; serial: number; selection: AfternoonSelection | null; attempts: number
}
export interface AfternoonMemory { storyId: AfternoonStoryId; eventId: string; participants: [CharacterId, CharacterId]; completedTick: number; day: number; count: number; selection: AfternoonSelection }
export interface AfternoonState { version: 2; active: AfternoonEvent | null; memories: AfternoonMemory[]; lastEventIds: Record<AfternoonStoryId, string | null>; keepsakes: Record<AfternoonStoryId, AfternoonPlacement | null> }
export const blankAfternoon = (): AfternoonState => ({ version: 2, active: null, memories: [], lastEventIds: Object.fromEntries(afternoonStoryIds.map(id => [id, null])) as AfternoonState['lastEventIds'], keepsakes: Object.fromEntries(afternoonStoryIds.map(id => [id, null])) as AfternoonState['keepsakes'] })
export const afternoonToken = (e: AfternoonEvent) => `${e.id}:${e.stage}:${e.serial}`
export function afternoonUsedIds(w: LivingWorld) { return new Set([...w.journal.map(m => m.eventId), ...w.neighborhood.memories.map(m => m.eventId), w.play.lastEventId, w.neighborhood.lastEventId, w.progress.lastCompletedEventId, w.play.active?.id, w.neighborhood.event?.id, w.activeEvent?.id, w.bookhouse.active?.id, w.bookhouse.memory?.eventId, w.bookhouse.lastEventId, w.bookhouse.puzzleMemory?.eventId, w.bookhouse.puzzleLastEventId, w.teaSquare.active?.id, w.teaSquare.memory?.eventId, w.teaSquare.lastEventId]) }
const fail = (): never => { throw Error('INVALID_AFTERNOON') }
function exact(v: unknown, keys: string[]): asserts v is Record<string, any> { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail() }
const integer = (n: unknown, min: number, max: number): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
function cast(id: AfternoonStoryId, p: unknown) { return Array.isArray(p) && p.length === 2 && p.every((v, i) => v === afternoonStory(id).participants[i]) }
export function validateAfternoon(value: unknown, w: LivingWorld, base: import('./world.ts').Scene): AfternoonState {
  exact(value, ['version', 'active', 'memories', 'lastEventIds', 'keepsakes'])
  exact(value.lastEventIds, [...afternoonStoryIds]); exact(value.keepsakes, [...afternoonStoryIds])
  if (value.version !== 2 || !Array.isArray(value.memories) || value.memories.length > afternoonStoryIds.length) fail()
  const used = afternoonUsedIds(w), seen = new Set<AfternoonStoryId>(), ownIds = new Set<string>()
  for (const m of value.memories) {
    exact(m, ['storyId', 'eventId', 'participants', 'completedTick', 'day', 'count', 'selection'])
    if (!isAfternoonStoryId(m.storyId) || seen.has(m.storyId) || !uuid(m.eventId) || used.has(m.eventId) || ownIds.has(m.eventId) || !cast(m.storyId, m.participants) || !integer(m.completedTick, 0, w.ticks) || m.day !== villageTime(m.completedTick).day || !integer(m.count, 1, 1000000) || !afternoonSelectionValid(m.storyId, m.selection)) fail()
    const last = value.lastEventIds[m.storyId]
    if (!uuid(last) || used.has(last) || ownIds.has(last) || m.count === 1 && last !== m.eventId || m.count > 1 && last === m.eventId) fail()
    const prerequisite = afternoonStory(m.storyId).prerequisite
    if (prerequisite && !value.memories.some((p: AfternoonMemory) => p.storyId === prerequisite && p.completedTick <= m.completedTick)) fail()
    seen.add(m.storyId); ownIds.add(m.eventId); ownIds.add(last)
  }
  for (const id of afternoonStoryIds) {
    if (![null, afternoonStory(id).placement].includes(value.keepsakes[id]) || !seen.has(id) && (value.keepsakes[id] !== null || value.lastEventIds[id] !== null)) fail()
  }
  if (value.active !== null) {
    const e = value.active
    exact(e, ['version', 'step', 'id', 'storyId', 'participants', 'stage', 'phase', 'remainingTicks', 'approachRemainingTicks', 'targets', 'routes', 'serial', 'selection', 'attempts'])
    if (!isAfternoonStoryId(e.storyId) || w.region.active !== afternoonStory(e.storyId).region || w.teaSquare.active || w.teaSquare.activity || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event || w.life.social || w.manualMove) fail()
    if (e.version !== 2 || !uuid(e.id) || used.has(e.id) || ownIds.has(e.id) || !isAfternoonStoryId(e.storyId) || !cast(e.storyId, e.participants) || !integer(e.stage, 0, 2) || !['approaching', 'observing', 'ready'].includes(e.phase) || !integer(e.remainingTicks, 0, 60) || !integer(e.approachRemainingTicks, 0, 1200) || !integer(e.serial, 0, 1000000) || !integer(e.attempts, 0, 1000000) || !Array.isArray(e.targets) || e.targets.length !== 2 || !Array.isArray(e.routes) || e.routes.length !== 2) fail()
    const authored = residentStory(e.storyId)
    if (!integer(e.step, 0, authored?.steps.length ?? 0)) fail()
    if (authored) {
      if (authored.prerequisite && !seen.has(authored.prerequisite)) fail()
      if (e.stage === 0 && e.step !== 0 || e.stage === 1 && e.step >= authored.steps.length || e.stage === 2 && e.step !== authored.steps.length) fail()
      if (e.stage > 0 && e.serial < 1 + e.step + e.attempts) fail()
      if (e.step === 0 ? e.selection !== null : !authored.steps[0]!.accept.includes(e.selection)) fail()
    }
    if (e.stage === 0 && (e.selection !== null || e.serial !== 0 || e.attempts !== 0) || e.selection !== null && !afternoonSelectionValid(e.storyId, e.selection) || e.stage === 2 && e.selection === null || e.storyId === 'reflection-shapes' && e.stage > 0 && e.selection === null || e.storyId === 'tea-bookmark' && e.attempts !== 0) fail()
    if (e.stage > 0 && e.serial < 1 || e.stage === 2 && e.serial < (authored ? authored.steps.length + 1 : e.storyId === 'tea-bookmark' ? 3 : 2) || e.stage === 1 && e.phase !== 'ready' || e.phase === 'approaching' && (e.remainingTicks !== 60 || e.approachRemainingTicks === 0) || e.phase === 'observing' && e.remainingTicks === 0 || e.phase === 'ready' && e.remainingTicks !== 0) fail()
    const currentScene = regionScene(w, base), candidates = afternoonTargets(w.region.active, currentScene, !!authored)
    e.targets.forEach((p: unknown, i: number) => {
      exact(p, ['x', 'y']); const target = p as Point, a = actors(w).find(a => a.id === e.participants[i]), route = e.routes[i]
      if (!a || !candidates.some(q => same(q, target)) || e.targets.some((q: Point, j: number) => j !== i && Math.hypot(q.x - target.x, q.y - target.y) < 24) || !Array.isArray(route) || route.length > 9 || a.intent) fail()
      let last = a!.position
      for (const p of route) { exact(p, ['x', 'y']); if (!walkable(currentScene, p as Point) || !reachable(currentScene, last, p as Point)) fail(); last = p as Point }
      if (route.length) { if (e.phase !== 'approaching' || !same(last, target) || a!.behavior !== 'walk' || !a!.destination || !same(a!.destination!, route[0])) fail() }
      else if (!same(a!.position, target) || a!.behavior !== 'idle' || a!.destination !== null) fail()
    })
  }
  return structuredClone(value) as AfternoonState
}

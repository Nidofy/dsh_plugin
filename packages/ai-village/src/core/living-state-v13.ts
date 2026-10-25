import * as v12 from './living-state-v12.ts'
import type { HomeWorld } from './home-state.ts'
import { actors, abandon, reachable, walkable, type Point, type Scene } from './world.ts'
import type { CharacterId } from './roster.ts'
import type { WorldCodec } from './migrations.ts'
export { blankPlay, isPlayId, isRegionId, idlePose } from './living-state-v12.ts'
export type { RegionId, RegionState, ParkedPose, PlayEvent, PlayMemory, PlayState } from './living-state-v12.ts'

/** One explicit player order; distance is logical scene units, time is simulation ticks. */
export interface ManualMoveIntent { actorId: CharacterId; target: Point; route: Point[]; waitTicks: number; replans: number; expires: number }
export interface LivingWorld extends Omit<v12.LivingWorld, 'schemaVersion'> { schemaVersion: 13; manualMove: ManualMoveIntent | null }
function previous(w: LivingWorld): v12.LivingWorld { const { manualMove: _manual, ...rest } = w; return { ...rest, schemaVersion: 12 } }
export function requireCourtyard(w: LivingWorld) { v12.requireCourtyard(previous(w)) }
export function regionScene(w: LivingWorld, base: Scene) { return v12.regionScene(previous(w), base) }
export function homeProjection(w: LivingWorld): HomeWorld { return v12.homeProjection(previous(w)) }
export function withLiving(base: HomeWorld, source?: LivingWorld): LivingWorld {
  const old = v12.withLiving(base, source ? previous(source) : undefined)
  const actor=source?.manualMove&&actors(old).find(a=>a.id===source.manualMove!.actorId)
  if(actor&&actor.behavior==='walk'&&!actor.intent)abandon(actor)
  return { ...old, schemaVersion: 13, manualMove: null }
}
export function validateLivingWorld(value: unknown, base: Scene): LivingWorld {
  const w = value as LivingWorld
  if (!w || w.schemaVersion !== 13) throw Error('UNSUPPORTED_WORLD_VERSION')
  if (new TextEncoder().encode(JSON.stringify(w)).length > 48 * 1024) throw Error('SAVE_TOO_LARGE')
  const old = v12.validateLivingWorld(previous(w), base)
  const fail = (): never => { throw Error('INVALID_MANUAL_MOVE') }
  const m = w.manualMove
  if (m !== null) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || Object.keys(m).length !== 6 || !['actorId','target','route','waitTicks','replans','expires'].every(k => Object.hasOwn(m,k))) fail()
    const a = actors(old).find(a => a.id === m.actorId), scene = v12.regionScene(old,base)
    if (!a || a.intent || a.behavior !== 'walk' || !a.destination || old.life.social || old.activeEvent || old.neighborhood.event || old.play.active || old.bookhouse.active) fail()
    if (!Number.isSafeInteger(m.waitTicks) || m.waitTicks < 0 || m.waitTicks >= 30 || !Number.isSafeInteger(m.replans) || m.replans < 0 || m.replans > 3 || !Number.isSafeInteger(m.expires) || m.expires <= old.ticks || m.expires > old.ticks + 1800) fail()
    if (!Array.isArray(m.route) || !m.route.length || m.route.length > 9) fail()
    const point = (p: Point) => p && Object.keys(p).length === 2 && Object.hasOwn(p,'x') && Object.hasOwn(p,'y') && walkable(scene,p)
    if (!point(m.target)) fail()
    let last = a!.position
    for (const p of m.route) { if (!point(p) || !reachable(scene,last,p)) fail(); last = p }
    const first=m.route[0]!,destination=a!.destination!
    if (last.x!==m.target.x||last.y!==m.target.y||destination.x!==first.x||destination.y!==first.y) fail()
  }
  return { ...old, schemaVersion: 13, manualMove: structuredClone(m) }
}
export function createLivingWorld(base: Scene): LivingWorld { return { ...v12.createLivingWorld(base), schemaVersion: 13, manualMove: null } }
export function migrateLivingWorld(value: unknown, base: Scene): LivingWorld {
  if ((value as LivingWorld)?.schemaVersion === 13) return validateLivingWorld(value,base)
  return validateLivingWorld({ ...v12.migrateLivingWorld(value,base), schemaVersion: 13, manualMove: null },base)
}
export function livingWorldCodec(base: Scene): WorldCodec<LivingWorld> {
  return { decode:v=>migrateLivingWorld(v,base), validate:v=>validateLivingWorld(v,base), needsUpgrade:v=>(v as LivingWorld)?.schemaVersion!==13 }
}

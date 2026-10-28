// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { migrateLivingWorld, validateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { validateLivingWorld as validate14 } from '../src/core/living-state-v14.ts'
import { decodeFrameWorld } from '../src/core/frame-world.ts'
import { actors, hitActor } from '../src/core/world.ts'
import { teaSquareFixture } from './tea-square.fixture.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { startBookhouseStory } from '../src/core/bookhouse-engine.ts'
import { startTeaSquareStory } from '../src/core/tea-square-engine.ts'
import { startPlay, stepLiving, inviteTea, startNeighborhoodEvent } from '../src/core/living-engine.ts'
import { startAfternoon, actAfternoon } from '../src/core/afternoon-engine.ts'
import { afternoonToken, blankAfternoon } from '../src/core/afternoon-state.ts'
import { VillageRuntime } from '../src/client/runtime.ts'
import type { Saved } from '../src/host/save-store.ts'
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
function start(w = teaSquareFixture(true)) { return startAfternoon(w, scene, 'tea-bookmark', ['bluewhale', 'claude'], crypto.randomUUID()) }
function ready(w: LivingWorld) { for (let i = 0; i < 1265 && w.afternoon.active?.phase !== 'ready'; i++) stepLiving(w, scene); expect(w.afternoon.active?.phase).toBe('ready'); return w }
function finalReady() {
  let w = ready(start()); w = actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'listen')
  w = actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'fold', 'wave')
  return ready(actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'press'))
}

it.each(['tea-square', 'bookhouse', 'play'] as const)('migrates a frozen world14 active %s without changing old paths, actors or memory bytes', kind => {
  let current = teaSquareFixture()
  if (kind === 'tea-square') current = startTeaSquareStory(current, scene, ['bluewhale', 'claude', 'gemini'], crypto.randomUUID())
  else if (kind === 'bookhouse') current = startBookhouseStory(switchRegion(switchRegion(current, scene, 'courtyard'), scene, 'bookhouse'), scene, 'claude', crypto.randomUUID())
  else current = startPlay(switchRegion(current, scene, 'courtyard'), scene, 'find-whale', ['bluewhale'], crypto.randomUUID())
  for (let i = 0; i < 60; i++) stepLiving(current, scene)
  const { afternoon: _a, community: _c, ...rest } = current
  const old = validate14({ ...rest, schemaVersion: 14, contentRevision: 10 }, scene), bytes = JSON.stringify(old)
  const upgraded = migrateLivingWorld(JSON.parse(bytes), scene), { afternoon, community, ...retained } = upgraded
  expect(JSON.stringify(old)).toBe(bytes); expect({ ...retained, schemaVersion: 14, contentRevision: 10 }).toEqual(old)
  expect(afternoon).toEqual(blankAfternoon()); expect(community.active).toBeNull()
  expect(upgraded.worldId).toBe(old.worldId); expect(upgraded.ticks).toBe(old.ticks); expect(upgraded.rng).toBe(old.rng)
  expect(decodeFrameWorld(old, scene)).toEqual(upgraded)
})

it('decodes current world15 with active and completed stories and refuses future16 or forged content', () => {
  const active = finalReady(), complete = actAfternoon(active, scene, afternoonToken(active.afternoon.active!), 'remember')
  for (const w of [active, complete]) expect(decodeFrameWorld(JSON.parse(JSON.stringify(w)), scene)).toEqual(w)
  expect(() => decodeFrameWorld({ ...active, schemaVersion: 16 }, scene)).toThrow()
  expect(() => decodeFrameWorld({ ...active, contentRevision: 12 }, scene)).toThrow()
  const bad = structuredClone(active); bad.afternoon.active!.selection = 'right'; expect(() => decodeFrameWorld(bad, scene)).toThrow()
})

it('blocks a real participant pointer drag without displacement or cancellation and still permits selection', () => {
  const c = new LivingController(start(), scene, () => {}), before = c.snapshot()
  const point = [0, -50, 50].map(dx => ({ x: before.actor.position.x + dx, y: before.actor.position.y })).find(p => hitActor(before, p)?.id === before.actor.id)!
  c.pointer({ type: 'down', id: 70, point, css: { x: 100, y: 100 } }); c.pointer({ type: 'move', id: 70, point: { x: 180, y: 430 }, css: { x: 130, y: 130 } }); c.pointer({ type: 'up', id: 70, point: { x: 180, y: 430 }, css: { x: 130, y: 130 } })
  expect(c.lastPlacement).toBe('story-blocked'); expect(c.drag).toBeNull(); expect(c.snapshot()).toEqual(before)
  c.pointer({ type: 'down', id: 71, point, css: { x: 100, y: 100 } }); c.pointer({ type: 'up', id: 71, point, css: { x: 100, y: 100 } })
  expect(c.lastPlacement).toBe('selected'); expect(c.snapshot()).toEqual(before)
})

it('rejects reuse of a confirmed afternoon UUID by every old story entry and preserves the source', () => {
  const pre = finalReady(), done = actAfternoon(pre, scene, afternoonToken(pre.afternoon.active!), 'remember'), id = done.afternoon.memories[0]!.eventId, bytes = JSON.stringify(done)
  expect(() => startTeaSquareStory(done, scene, ['bluewhale', 'claude', 'gemini'], id)).toThrow()
  const courtyard = switchRegion(done, scene, 'courtyard')
  expect(() => startPlay(courtyard, scene, 'find-whale', ['bluewhale'], id)).toThrow()
  expect(() => inviteTea(courtyard, scene, ['bluewhale', 'claude'], 'tea', id)).toThrow()
  expect(() => startNeighborhoodEvent(courtyard, scene, 'bench-chat', ['bluewhale', 'claude'], id)).toThrow()
  expect(() => startBookhouseStory(switchRegion(courtyard, scene, 'bookhouse'), scene, 'claude', id)).toThrow()
  expect(JSON.stringify(done)).toBe(bytes)
})

function runtimeFixture(initial: LivingWorld) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  const profileId = crypto.randomUUID(), epoch = crypto.randomUUID()
  let saved: Saved<LivingWorld> = { revision: 1, operationId: crypto.randomUUID(), world: structuredClone(initial) }, preferences: any = null
  let gate: Promise<void> | null = null, offline = false, lose = false, mutations = 0, reads = 0
  const operations: string[] = []
  const runtime = new VillageRuntime(async (path, init) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null; let result: unknown = { ok: true }
    if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
    else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: preferences }
    else if (path.endsWith('/preferences-save')) { preferences = { revision: (preferences?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }; result = { ...preferences, profileId, epoch } }
    else if (path.endsWith('/state')) { reads++; if (offline) throw Error('STATE_OFFLINE'); result = { profileId, epoch, saved } }
    else if (path.endsWith('/save')) {
      expect(data.expectedRevision).toBe(saved.revision); expect(operations).not.toContain(data.operationId)
      mutations++; operations.push(data.operationId); if (gate) await gate
      saved = { revision: saved.revision + 1, operationId: data.operationId, world: validateLivingWorld(data.world, scene) }
      if (lose) { lose = false; throw Error('ACK_LOST') }
      result = { ...saved, profileId, epoch }
    }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  })
  vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue(); runtime.images = {}
  return { runtime, stats: () => ({ mutations, reads }), saved: () => structuredClone(saved), loseAck: () => { lose = true }, stateOffline: (v: boolean) => { offline = v }, hold: () => { let finish!: () => void; gate = new Promise<void>(r => { finish = r }); return () => { gate = null; finish() } } }
}
async function open(r: VillageRuntime) {
  r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true))
  r.entrance.verified = 1; r.beginEntranceFrame('afternoon-test-frame'); r.expectEntranceFrame('afternoon-test-frame', r.assetRevision, 1)
  r.setFrameReady(true); r.entranceFrame('afternoon-test-frame', r.entrance.attemptId, r.assetRevision, 1); r.finishEntrance(); await r.flush()
}

it('publishes start only after one CAS; concurrent starts and participant drag cannot replace it; paused cancellation clears the active state', async () => {
  const f = runtimeFixture(teaSquareFixture(true)), r = f.runtime
  try {
    await open(r); const old = r.controller!.snapshot(), writes = f.stats().mutations, release = f.hold()
    const starting = r.startAfternoon('tea-bookmark', ['bluewhale', 'claude']); await vi.waitFor(() => expect(f.stats().mutations).toBe(writes + 1))
    expect(r.controller!.snapshot()).toEqual(old); await r.startAfternoon('reflection-shapes', ['gemini', 'grok']); expect(f.stats().mutations).toBe(writes + 1)
    release(); await starting; expect(r.controller!.world.afternoon.active?.storyId).toBe('tea-bookmark')
    const before = r.controller!.snapshot(), point = before.actor.position
    r.pointer({ type: 'down', id: 5, point, css: { x: 20, y: 20 } }); r.pointer({ type: 'up', id: 5, point: { x: 180, y: 430 }, css: { x: 40, y: 40 } })
    expect(r.actionError).toBe('EVENT_ACTIVE'); expect(r.controller!.snapshot()).toEqual(before); expect(f.stats().mutations).toBe(writes + 1)
    r.pause('user', true); await r.flush(); const pausedWrites = f.stats().mutations
    await r.cancelAfternoon(); expect(f.stats().mutations).toBe(pausedWrites + 1); expect(r.controller!.world.afternoon).toEqual(blankAfternoon()); expect(r.controller!.world.community.active).toBeNull()
    expect(actors(r.controller!.world).every(a => !a.destination && !a.intent)).toBe(true)
  } finally { await r.dispose() }
})

it('withholds an unconfirmed first reward, reconciles the same commit by reads and never replays remember', async () => {
  vi.useFakeTimers(); const f = runtimeFixture(finalReady()), r = f.runtime
  try {
    await open(r); const before = r.controller!.snapshot(), token = afternoonToken(before.afternoon.active!), writes = f.stats().mutations
    f.loseAck(); f.stateOffline(true); await r.actAfternoon(token, 'remember')
    expect(r.saveReceipt.status).toBe('unknown'); expect(r.controller!.snapshot()).toEqual(before); expect(r.controller!.world.afternoon.memories).toHaveLength(0)
    const committed = f.saved().world.afternoon; expect(committed.memories).toHaveLength(1); expect(committed.memories[0]!.selection).toBe('wave')
    await r.actAfternoon(token, 'remember'); await r.cancelAfternoon(); expect(f.stats().mutations).toBe(writes + 1)
    const reads = f.stats().reads; f.stateOffline(false); await r.checkRecovery()
    expect(r.saveReceipt.status).toBe('committed'); expect(r.controller!.world.afternoon).toEqual(committed); expect(f.stats().mutations).toBe(writes + 1); expect(f.stats().reads).toBeGreaterThan(reads)
    expect(r.controller!.world.afternoon.memories[0]!.count).toBe(1)
  } finally { await r.dispose() }
})

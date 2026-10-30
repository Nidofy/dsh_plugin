// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, validateLivingWorld, migrateLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { startAfternoon, actAfternoon, stepAfternoon } from '../src/core/afternoon-engine.ts'
import { afternoonToken } from '../src/core/afternoon-state.ts'
import { residentStory } from '../src/core/resident-stories-catalog.ts'
import { VillageRuntime } from '../src/client/runtime.ts'
import type { Saved } from '../src/host/save-store.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
function ready(w: LivingWorld) {
  for (let i = 0; i < 1265 && w.afternoon.active?.phase !== 'ready'; i++) stepAfternoon(w, scene)
  expect(w.afternoon.active?.phase).toBe('ready'); return w
}
function finalReady() {
  const c = new LivingController(createLivingWorld(scene), scene, () => {})
  for (const id of ['claude', 'kimi', 'qwen', 'gpt', 'minimax']) c.setCharacterPresent(id, true)
  let w = ready(startAfternoon(switchRegion(c.snapshot(), scene, 'bookhouse'), scene, 'lost-diary-page', ['claude', 'kimi'], crypto.randomUUID()))
  w = actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'interact', 'inspect')
  for (const step of residentStory('lost-diary-page')!.steps) w = actAfternoon(w, scene, afternoonToken(w.afternoon.active!), 'interact', step.accept[0])
  return ready(w)
}
function fixture(initial: LivingWorld) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  const profileId = crypto.randomUUID(), epoch = crypto.randomUUID()
  let saved: Saved<LivingWorld> = { revision: 1, operationId: crypto.randomUUID(), world: structuredClone(initial) }, preferences: any = null
  let offline = false, mode: 'normal' | 'lost' | 'conflict' = 'normal', writes = 0, reads = 0
  let gate: Promise<void> | null = null
  const operations = new Set<string>()
  const runtime = new VillageRuntime(async (path, init) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null; let result: unknown = { ok: true }
    if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
    else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: preferences }
    else if (path.endsWith('/preferences-save')) { preferences = { revision: (preferences?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }; result = { ...preferences, profileId, epoch } }
    else if (path.endsWith('/state')) { reads++; if (offline) throw Error('STATE_OFFLINE'); result = { profileId, epoch, saved } }
    else if (path.endsWith('/save')) {
      expect(data.expectedRevision).toBe(saved.revision); expect(operations.has(data.operationId)).toBe(false)
      writes++; operations.add(data.operationId)
      if (gate) await gate
      if (mode === 'conflict') return new Response(JSON.stringify({ error: 'REVISION_CONFLICT' }), { status: 409, headers: { 'content-type': 'application/json' } })
      saved = { revision: saved.revision + 1, operationId: data.operationId, world: validateLivingWorld(data.world, scene) }
      if (mode === 'lost') { mode = 'normal'; throw Error('ACK_LOST') }
      result = { ...saved, profileId, epoch }
    }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  })
  vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue(); runtime.images = {}
  return { runtime, saved: () => structuredClone(saved), stats: () => ({ writes, reads }), setMode: (value: typeof mode) => { mode = value }, offline: (value: boolean) => { offline = value }, hold: () => { let finish!: () => void; gate = new Promise<void>(r => { finish = r }); return () => { gate = null; finish() } } }
}
async function open(r: VillageRuntime) {
  r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true))
  r.entrance.verified = 1; r.beginEntranceFrame('diary-test-frame'); r.expectEntranceFrame('diary-test-frame', r.assetRevision, 1)
  r.setFrameReady(true); r.entranceFrame('diary-test-frame', r.entrance.attemptId, r.assetRevision, 1); r.finishEntrance(); await r.flush()
}

it('unknown chapter completion cannot unlock travel or publish a clue; read-only reconciliation never replays its write', async () => {
  vi.useFakeTimers(); const f = fixture(finalReady()), r = f.runtime
  try {
    await open(r)
    const before = r.controller!.snapshot(), token = afternoonToken(before.afternoon.active!), writes = f.stats().writes
    f.setMode('lost'); f.offline(true); await r.actAfternoon(token, 'remember')
    expect(r.saveReceipt.status).toBe('unknown')
    expect(r.controller!.snapshot()).toEqual(before)
    expect(r.controller!.world.afternoon.memories).toHaveLength(0)
    expect(f.saved().world.afternoon.memories.map(m => m.storyId)).toEqual(['lost-diary-page'])
    expect(f.saved().world.afternoon.keepsakes['lost-diary-page']).toBeNull()
    await r.switchRegion('courtyard'); await r.actAfternoon(token, 'remember'); await r.cancelAfternoon()
    expect(f.stats().writes).toBe(writes + 1)
    expect(r.controller!.world.region.active).toBe('bookhouse')
    const reads = f.stats().reads; f.offline(false); await r.checkRecovery()
    expect(r.saveReceipt.status).toBe('committed')
    expect(r.controller!.world.afternoon.memories[0]).toMatchObject({ storyId: 'lost-diary-page', count: 1 })
    expect(r.controller!.world.afternoon.active).toBeNull()
    expect(f.stats().writes).toBe(writes + 1); expect(f.stats().reads).toBeGreaterThan(reads)
    const cold = migrateLivingWorld(JSON.parse(JSON.stringify(f.saved().world)), scene)
    const next = switchRegion(switchRegion(cold, scene, 'courtyard'), scene, 'tea-square')
    expect(startAfternoon(next, scene, 'lost-diary-tea', ['qwen', 'bluewhale'], crypto.randomUUID()).afternoon.active?.storyId).toBe('lost-diary-tea')
  } finally { await r.dispose() }
})

it('CAS rejection retains the unfinished chapter and cannot manufacture a next-chapter fact', async () => {
  const f = fixture(finalReady()), r = f.runtime
  try {
    await open(r); const before = r.controller!.snapshot(), token = afternoonToken(before.afternoon.active!), writes = f.stats().writes
    f.setMode('conflict'); await r.actAfternoon(token, 'remember')
    expect(r.saveReceipt).toMatchObject({ status: 'rejected', reason: 'REVISION_CONFLICT' })
    expect(r.controller!.snapshot()).toEqual(before)
    expect(f.saved().world.afternoon.memories).toHaveLength(0)
    expect(f.stats().writes).toBe(writes + 1)
    expect(r.controller!.world.afternoon.active?.storyId).toBe('lost-diary-page')
  } finally { await r.dispose() }
})

it('duplicate completion and travel during pending chapter CAS cannot replace its one candidate', async () => {
  const f = fixture(finalReady()), r = f.runtime
  try {
    await open(r); const before = r.controller!.snapshot(), token = afternoonToken(before.afternoon.active!), writes = f.stats().writes, release = f.hold()
    const completing = r.actAfternoon(token, 'remember')
    await vi.waitFor(() => expect(f.stats().writes).toBe(writes + 1))
    await r.actAfternoon(token, 'remember'); await r.switchRegion('courtyard')
    expect(r.controller!.snapshot()).toEqual(before); expect(f.stats().writes).toBe(writes + 1)
    release(); await completing
    expect(r.controller!.world.afternoon.memories[0]).toMatchObject({ storyId: 'lost-diary-page', count: 1 })
    expect(r.controller!.world.region.active).toBe('bookhouse')
    expect(f.stats().writes).toBe(writes + 1)
  } finally { await r.dispose() }
})

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { currentEncounter, encounterWindow, encounterPeriod } from '../src/core/encounter.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'

afterEach(() => vi.unstubAllGlobals())
function offeredWorld() {
  const c = new LivingController(createLivingWorld(scene), scene, () => {})
  c.setCharacterPresent('claude', true); c.world.ticks = encounterWindow(0).startsTick
  expect(currentEncounter(c.world)).not.toBeNull()
  return c.snapshot()
}
function authority(initial: LivingWorld) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  const profileId = crypto.randomUUID(), epoch = crypto.randomUUID()
  let saved: Saved<LivingWorld> = { revision: 1, operationId: crypto.randomUUID(), world: structuredClone(initial) }
  let preferences: unknown = null, writes = 0, reads = 0, offline = false, mode: 'accept' | 'lose-ack' | 'reject' = 'accept'
  let gate: Promise<void> | null = null
  const makeRuntime = () => {
    const runtime = new VillageRuntime(async (path, init) => {
      const data = init?.body ? JSON.parse(String(init.body)) : null
      let result: unknown
      if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
      else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: preferences }
      else if (path.endsWith('/preferences-save')) { preferences = { revision: 1, operationId: data.operationId, world: data.world }; result = { ...preferences as object, profileId, epoch } }
      else if (path.endsWith('/state')) { reads++; if (offline) throw new TypeError('Failed to fetch'); result = { profileId, epoch, saved: structuredClone(saved) } }
      else if (path.endsWith('/save')) {
        writes++; if (gate) await gate
        if (mode === 'reject') return new Response(JSON.stringify({ error: 'REVISION_CONFLICT' }), { status: 409, headers: { 'content-type': 'application/json' } })
        expect(data.expectedRevision).toBe(saved.revision)
        saved = { revision: saved.revision + 1, operationId: data.operationId, world: structuredClone(data.world) }
        if (mode === 'lose-ack') throw Error('ACK_LOST')
        result = { ...saved, profileId, epoch }
      } else result = { ok: true }
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
    })
    vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue()
    runtime.images = {}; return runtime
  }
  return { makeRuntime, stats: () => ({ writes, reads }), durable: () => structuredClone(saved), setMode: (next: typeof mode) => { mode = next }, stateOffline: (value: boolean) => { offline = value },
    holdSave: () => { let release!: () => void; gate = new Promise<void>(resolve => { release = resolve }); return () => { gate = null; release() } } }
}
async function boot(runtime: VillageRuntime, checkpoint = true) {
  runtime.setConnection(true); runtime.show(); await vi.waitFor(() => expect(runtime.ready).toBe(true)); if (checkpoint) await runtime.flush()
  runtime.entrance.verified = 1; runtime.beginEntranceFrame('encounter-test'); runtime.expectEntranceFrame('encounter-test', runtime.assetRevision, 1)
  runtime.setFrameReady(true); runtime.entranceFrame('encounter-test', runtime.entrance.attemptId, runtime.assetRevision, 1); runtime.finishEntrance()
  expect(runtime.controller!.pauseReasons.size).toBe(0)
}
function act(runtime: VillageRuntime, kind: 'start' | 'dismiss', offer: NonNullable<ReturnType<typeof currentEncounter>>) {
  return kind === 'start' ? runtime.startPlay(offer.definitionId, ['bluewhale', 'claude'], offer.token) : runtime.dismissEncounter(offer.token)
}
it.each(['start', 'dismiss'] as const)('reconciles a lost %s ACK with one write, no duplicate window and no reward', async kind => {
  const host = authority(offeredWorld()), runtime = host.makeRuntime(); let cold: VillageRuntime | undefined
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), offer = currentEncounter(before)!, baseline = host.stats(), release = host.holdSave()
    host.setMode('lose-ack'); host.stateOffline(true)
    const pending = act(runtime, kind, offer)
    await vi.waitFor(() => expect(runtime.saveReceipt.status).toBe('pending'))
    expect(runtime.controller!.snapshot()).toEqual(before)
    release(); await pending
    expect(runtime.saveReceipt.status).toBe('unknown'); expect(runtime.controller!.snapshot()).toEqual(before)
    for (let i = 0; i < 3; i++) { await runtime.checkRecovery(); await runtime.flush(); await act(runtime, kind, offer) }
    expect(host.stats()).toEqual({ writes: baseline.writes + 1, reads: baseline.reads + 4 })
    const durable = host.durable().world
    expect(durable.play.encounterWindow).toBe(offer.index); expect(currentEncounter(durable)).toBeNull()
    expect(durable.neighborhood.memories).toEqual([]); expect(durable.play.decorations).toEqual(before.play.decorations)
    expect(durable.play.active?.definitionId ?? null).toBe(kind === 'start' ? offer.definitionId : null)
    host.stateOffline(false); await runtime.checkRecovery()
    expect(runtime.saveReceipt.status).toBe('committed'); expect(runtime.controller!.snapshot()).toEqual(durable)
    await act(runtime, kind, offer); expect(host.stats().writes).toBe(baseline.writes + 1)
    await runtime.dispose(); host.setMode('accept'); cold = host.makeRuntime(); await boot(cold, false)
    expect(cold.controller!.snapshot()).toEqual(durable); expect(currentEncounter(cold.controller!.world)).toBeNull()
    expect(cold.notices).toEqual([]); expect(host.stats().writes).toBe(baseline.writes + 1)
  } finally { await runtime.dispose(); await cold?.dispose() }
})
it.each(['start', 'dismiss'] as const)('preserves the original world and available offer when authority rejects %s before publishing', async kind => {
  const host = authority(offeredWorld()), runtime = host.makeRuntime()
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), offer = currentEncounter(before)!, baseline = host.stats().writes
    host.setMode('reject'); await act(runtime, kind, offer)
    expect(runtime.saveReceipt).toMatchObject({ status: 'rejected', reason: 'REVISION_CONFLICT' })
    expect(runtime.controller!.snapshot()).toEqual(before); expect(host.durable().world).toEqual(before)
    expect(currentEncounter(runtime.controller!.world)?.token).toBe(offer.token)
    expect(runtime.controller!.world.play.encounterWindow).toBe(-1); expect(runtime.notices).toEqual([])
    expect(host.stats().writes).toBe(baseline + 1)
  } finally { await runtime.dispose() }
})
it('cancels an accepted encounter durably and cold-restores its consumed window without memories or rewards', async () => {
  const host = authority(offeredWorld()), runtime = host.makeRuntime(); let cold: VillageRuntime | undefined
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), offer = currentEncounter(before)!, baseline = host.stats().writes
    await act(runtime, 'start', offer); expect(runtime.controller!.world.play.active?.definitionId).toBe(offer.definitionId)
    await runtime.cancelPlay()
    const canceled = runtime.controller!.snapshot()
    expect(canceled.play.active).toBeNull(); expect(currentEncounter(canceled)).toBeNull()
    expect(canceled.play.encounterWindow).toBe(offer.index); expect(canceled.play.decorations).toEqual(before.play.decorations)
    expect(canceled.neighborhood.memories).toEqual([]); expect(canceled.neighborhood.bonds).toEqual(before.neighborhood.bonds)
    expect(host.stats().writes).toBe(baseline + 2)
    await runtime.dispose(); cold = host.makeRuntime(); await boot(cold, false)
    expect(cold.controller!.snapshot()).toEqual(canceled); expect(currentEncounter(cold.controller!.world)).toBeNull()
    await act(cold, 'start', offer); expect(cold.actionError).toBe('ENCOUNTER_EXPIRED'); expect(host.stats().writes).toBe(baseline + 2)
    cold.controller!.world.ticks = encounterWindow(encounterPeriod).startsTick
    expect(currentEncounter(cold.controller!.world)?.index).toBe(offer.index + 1)
    expect(cold.controller!.world.neighborhood.memories).toEqual([])
  } finally { await runtime.dispose(); await cold?.dispose() }
})

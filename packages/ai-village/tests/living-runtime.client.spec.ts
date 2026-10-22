// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { createLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { startPlay, playAction, stepLiving, placePlayDecoration, whalePlace } from '../src/core/living-engine.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'

afterEach(() => vi.unstubAllGlobals())
function ready(world: LivingWorld) {
  for (let i = 0; i < 1805 && world.play.active?.phase !== 'ready'; i++) stepLiving(world, scene)
  expect(world.play.active?.phase).toBe('ready')
  return world
}
const token = (world: LivingWorld) => `${world.play.active!.id}:${world.play.active!.stage}`
function finalStage(source = createLivingWorld(scene)) {
  const started = ready(startPlay(source, scene, 'find-whale', ['bluewhale'], crypto.randomUUID()))
  return ready(playAction(started, scene, 'find', whalePlace(started.play.active!), token(started)))
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
        writes++
        if (gate) await gate
        if (mode === 'reject') return new Response(JSON.stringify({ error: 'REVISION_CONFLICT' }), { status: 409, headers: { 'content-type': 'application/json' } })
        expect(data.expectedRevision).toBe(saved.revision)
        saved = { revision: saved.revision + 1, operationId: data.operationId, world: structuredClone(data.world) }
        if (mode === 'lose-ack') throw Error('ACK_LOST')
        result = { ...saved, profileId, epoch }
      } else result = { ok: true }
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
    })
    vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue()
    runtime.images = {}
    return runtime
  }
  return { makeRuntime, stats: () => ({ writes, reads }), durable: () => structuredClone(saved), setMode: (next: typeof mode) => { mode = next }, stateOffline: (value: boolean) => { offline = value },
    holdSave: () => { let release!: () => void; gate = new Promise<void>(resolve => { release = resolve }); return () => { gate = null; release() } } }
}
async function boot(runtime: VillageRuntime, checkpoint = true) {
  runtime.setConnection(true); runtime.show(); await vi.waitFor(() => expect(runtime.ready).toBe(true)); if (checkpoint) await runtime.flush()
  runtime.entrance.verified = 1; runtime.beginEntranceFrame('living-test'); runtime.expectEntranceFrame('living-test', runtime.assetRevision, 1)
  runtime.setFrameReady(true); runtime.entranceFrame('living-test', runtime.entrance.attemptId, runtime.assetRevision, 1); runtime.finishEntrance()
  expect(runtime.controller!.pauseReasons.size).toBe(0)
}
it('keeps a finishing candidate, memory, notification and reward invisible until the actual runtime commit is acknowledged', async () => {
  const initial = finalStage(), host = authority(initial), runtime = host.makeRuntime()
  try {
    await boot(runtime)
    const before = runtime.controller!.snapshot(), writes = host.stats().writes, release = host.holdSave()
    const pending = runtime.playAction('finish', undefined, token(before))
    await vi.waitFor(() => expect(runtime.saveReceipt.status).toBe('pending'))
    expect(runtime.controller!.snapshot()).toEqual(before)
    expect(runtime.notices.some(n => n.story === 'find-whale')).toBe(false)
    expect(() => placePlayDecoration(runtime.controller!.world, scene, 'whale-token', 'window')).toThrow('DECORATION_LOCKED')
    await runtime.playAction('finish', undefined, token(before))
    expect(host.stats().writes).toBe(writes + 1)
    release(); await pending
    expect(runtime.saveReceipt.status).toBe('committed')
    expect(runtime.controller!.world.neighborhood.memories).toHaveLength(1)
    expect(runtime.controller!.world.neighborhood.memories[0]!.count).toBe(1)
    expect(runtime.notices.filter(n => n.story === 'find-whale')).toHaveLength(1)
    expect(placePlayDecoration(runtime.controller!.world, scene, 'whale-token', 'window').play.decorations['whale-token']).toBe('window')
    await runtime.playAction('finish', undefined, token(before))
    expect(runtime.actionError).toBe('STALE_PLAY_ACTION'); expect(host.stats().writes).toBe(writes + 1)
    expect(initial.neighborhood.memories).toEqual([])
  } finally { await runtime.dispose() }
})
it('keeps one write through sustained unknown ACKs, performs only reads, then cold-loads the confirmed completion once', async () => {
  const initial = finalStage(), host = authority(initial), runtime = host.makeRuntime()
  let cold: VillageRuntime | undefined
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats()
    host.setMode('lose-ack'); host.stateOffline(true)
    await runtime.playAction('finish', undefined, token(before))
    expect(runtime.saveReceipt.status).toBe('unknown'); expect(runtime.actionError).toBe('SAVE_UNCONFIRMED')
    expect(runtime.controller!.snapshot()).toEqual(before)
    for (let i = 0; i < 3; i++) { await runtime.checkRecovery(); await runtime.flush(); await runtime.playAction('finish', undefined, token(before)) }
    expect(host.stats().writes).toBe(baseline.writes + 1)
    expect(host.stats().reads).toBe(baseline.reads + 4)
    expect(runtime.controller!.world.neighborhood.memories).toEqual([])
    expect(host.durable().world.neighborhood.memories[0]!.count).toBe(1)
    host.stateOffline(false); await runtime.checkRecovery()
    expect(runtime.saveReceipt.status).toBe('committed'); expect(runtime.controller!.world.play.active).toBeNull()
    expect(runtime.controller!.world.neighborhood.memories[0]!.count).toBe(1)
    await runtime.playAction('finish', undefined, token(before)); expect(host.stats().writes).toBe(baseline.writes + 1)
    await runtime.dispose(); host.setMode('accept'); cold = host.makeRuntime(); await boot(cold, false)
    expect(cold.controller!.world.neighborhood.memories).toEqual(host.durable().world.neighborhood.memories)
    expect(cold.controller!.world.play.lastEventId).toBe(before.play.active!.id)
    expect(cold.notices.filter(n => n.story === 'find-whale')).toHaveLength(1)
    expect(host.stats().writes).toBe(baseline.writes + 1)
  } finally { await runtime.dispose(); await cold?.dispose() }
})
it('rejects a replay finish without changing the first memory, its count, or an already placed reward', async () => {
  let earned = finalStage(); earned = playAction(earned, scene, 'finish', undefined, token(earned))
  earned = placePlayDecoration(earned, scene, 'whale-token', 'wall'); earned.ticks = earned.play.nextTick
  const initial = finalStage(earned), host = authority(initial), runtime = host.makeRuntime()
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats().writes
    host.setMode('reject'); await runtime.playAction('finish', undefined, token(before))
    expect(runtime.saveReceipt).toMatchObject({ status: 'rejected', reason: 'REVISION_CONFLICT' })
    expect(runtime.controller!.snapshot()).toEqual(before); expect(host.durable().world).toEqual(before)
    expect(runtime.controller!.world.neighborhood.memories[0]!.count).toBe(1)
    expect(runtime.controller!.world.play.decorations['whale-token']).toBe('wall')
    expect(runtime.reasons.has('commit-pending')).toBe(false); expect(host.stats().writes).toBe(baseline + 1)
  } finally { await runtime.dispose() }
})
it('increments a replay count only after ACK, retaining the first event and decoration placement', async () => {
  let earned = finalStage(); earned = playAction(earned, scene, 'finish', undefined, token(earned))
  earned = placePlayDecoration(earned, scene, 'whale-token', 'door'); earned.ticks = earned.play.nextTick
  const initial = finalStage(earned), firstMemory = structuredClone(initial.neighborhood.memories[0]!), host = authority(initial), runtime = host.makeRuntime()
  try {
    await boot(runtime); const oldToken = token(runtime.controller!.world), release = host.holdSave(), baseline = host.stats().writes
    const pending = runtime.playAction('finish', undefined, oldToken)
    await vi.waitFor(() => expect(runtime.saveReceipt.status).toBe('pending'))
    expect(runtime.controller!.world.neighborhood.memories[0]).toEqual(firstMemory)
    expect(initial.neighborhood.memories[0]).toEqual(firstMemory)
    expect(host.durable().world.neighborhood.memories[0]!.count).toBe(1)
    release(); await pending
    expect(runtime.controller!.world.neighborhood.memories).toEqual([{ ...firstMemory, count: 2 }])
    expect(runtime.controller!.world.play.decorations['whale-token']).toBe('door')
    await runtime.playAction('finish', undefined, oldToken)
    expect(host.stats().writes).toBe(baseline + 1)
    expect(runtime.controller!.world.neighborhood.memories[0]!.count).toBe(2)
  } finally { await runtime.dispose() }
})
it('rejects a delayed previous-stage token after a stage commit without another write', async () => {
  const initial = ready(startPlay(createLivingWorld(scene), scene, 'find-whale', ['bluewhale'], crypto.randomUUID())), host = authority(initial), runtime = host.makeRuntime()
  try {
    await boot(runtime); const oldToken = token(runtime.controller!.world), baseline = host.stats().writes
    await runtime.playAction('find', whalePlace(runtime.controller!.world.play.active!), oldToken)
    expect(runtime.controller!.world.play.active!.stage).toBe(1)
    ready(runtime.controller!.world)
    await runtime.playAction('finish', undefined, oldToken)
    expect(runtime.actionError).toBe('STALE_PLAY_ACTION')
    expect(host.stats().writes).toBe(baseline + 1); expect(runtime.controller!.world.neighborhood.memories).toEqual([])
  } finally { await runtime.dispose() }
})

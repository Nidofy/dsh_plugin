// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld, type LivingWorld } from '../src/core/living-state.ts'
import { setTableMode, startPlay, stepLiving } from '../src/core/living-engine.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'

afterEach(() => vi.unstubAllGlobals())
function readyGame() {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  controller.setCharacterPresent('claude', true)
  const world = startPlay(setTableMode(controller.world, scene, 'game'), scene, 'table-game', ['bluewhale', 'claude'], crypto.randomUUID())
  for (let i = 0; i < 1805 && world.play.active?.phase !== 'ready'; i++) stepLiving(world, scene)
  expect(world.play.active?.phase).toBe('ready')
  return world
}
const token = (world: LivingWorld) => `${world.play.active!.id}:${world.play.active!.stage}:${world.play.active!.choices.length}`
function authority(initial: LivingWorld) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  const profileId = crypto.randomUUID(), epoch = crypto.randomUUID()
  let saved: Saved<LivingWorld> = { revision: 1, operationId: crypto.randomUUID(), world: structuredClone(initial) }
  let preferences: unknown = null, writes = 0, reads = 0, offline = false, mode: 'accept' | 'lose-ack' | 'reject' = 'accept'
  let gate: Promise<void> | null = null
  const candidates: LivingWorld[] = []
  const makeRuntime = () => {
    const runtime = new VillageRuntime(async (path, init) => {
      const data = init?.body ? JSON.parse(String(init.body)) : null
      let result: unknown
      if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
      else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: preferences }
      else if (path.endsWith('/preferences-save')) { preferences = { revision: 1, operationId: data.operationId, world: data.world }; result = { ...preferences as object, profileId, epoch } }
      else if (path.endsWith('/state')) { reads++; if (offline) throw new TypeError('Failed to fetch'); result = { profileId, epoch, saved: structuredClone(saved) } }
      else if (path.endsWith('/save')) {
        writes++; candidates.push(structuredClone(data.world))
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
    runtime.images = {}; return runtime
  }
  return { makeRuntime, stats: () => ({ writes, reads }), durable: () => structuredClone(saved), candidates,
    setMode: (next: typeof mode) => { mode = next }, stateOffline: (value: boolean) => { offline = value },
    holdSave: () => { let release!: () => void; gate = new Promise<void>(resolve => { release = resolve }); return () => { gate = null; release() } } }
}
async function boot(runtime: VillageRuntime, checkpoint = true) {
  runtime.setConnection(true); runtime.show(); await vi.waitFor(() => expect(runtime.ready).toBe(true)); if (checkpoint) await runtime.flush()
  runtime.entrance.verified = 1; runtime.beginEntranceFrame('table-test'); runtime.expectEntranceFrame('table-test', runtime.assetRevision, 1)
  runtime.setFrameReady(true); runtime.entranceFrame('table-test', runtime.entrance.attemptId, runtime.assetRevision, 1); runtime.finishEntrance()
  expect(runtime.controller!.pauseReasons.size).toBe(0)
}
it('commits player and resident marks in one CAS while retaining the old board until ACK', async () => {
  const initial = readyGame(), host = authority(initial), runtime = host.makeRuntime()
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats().writes, release = host.holdSave()
    const pending = runtime.playAction('move', '0', token(before))
    await vi.waitFor(() => expect(runtime.saveReceipt.status).toBe('pending'))
    expect(runtime.controller!.snapshot()).toEqual(before)
    const candidate = host.candidates.at(-1)!.play.active!
    expect(candidate.choices).toEqual(['0', '4']); expect(candidate.board).toEqual([0, -1, -1, -1, 1, -1, -1, -1, -1])
    await runtime.playAction('move', '1', token(before)); expect(host.stats().writes).toBe(baseline + 1)
    release(); await pending
    expect(runtime.controller!.world.play.active!.board).toEqual(candidate.board)
    expect(runtime.controller!.world.play.active!.choices).toEqual(candidate.choices)
    expect(runtime.controller!.world.play.active!.stage).toBe(0)
    await runtime.playAction('move', '1', token(before))
    expect(runtime.actionError).toBe('STALE_PLAY_ACTION'); expect(host.stats().writes).toBe(baseline + 1)
    expect(runtime.controller!.world.play.active!.choices).toEqual(['0', '4'])
    expect(initial.play.active!.choices).toEqual([])
  } finally { await runtime.dispose() }
})
it('reconciles unknown moves with reads only and cold-loads both marks and their complete history', async () => {
  const host = authority(readyGame()), runtime = host.makeRuntime(); let cold: VillageRuntime | undefined
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats()
    host.setMode('lose-ack'); host.stateOffline(true); await runtime.playAction('move', '0', token(before))
    expect(runtime.saveReceipt.status).toBe('unknown'); expect(runtime.controller!.snapshot()).toEqual(before)
    for (let i = 0; i < 3; i++) { await runtime.checkRecovery(); await runtime.flush(); await runtime.playAction('move', '1', token(before)) }
    expect(host.stats()).toEqual({ writes: baseline.writes + 1, reads: baseline.reads + 4 })
    expect(runtime.controller!.world.play.active!.board).toEqual(Array(9).fill(-1)); expect(runtime.controller!.world.play.active!.choices).toEqual([])
    expect(host.durable().world.play.active!.choices).toEqual(['0', '4'])
    host.stateOffline(false); await runtime.checkRecovery()
    expect(runtime.saveReceipt.status).toBe('committed')
    const confirmed = runtime.controller!.snapshot(); expect(confirmed.play.active!.choices).toEqual(['0', '4'])
    await runtime.dispose(); host.setMode('accept'); cold = host.makeRuntime(); await boot(cold, false)
    expect(cold.controller!.world.play).toEqual(confirmed.play)
    expect(host.stats().writes).toBe(baseline.writes + 1)
    expect(cold.controller!.world.neighborhood.memories).toEqual([])
  } finally { await runtime.dispose(); await cold?.dispose() }
})
it('keeps both marks and move history unchanged when authority rejects the candidate', async () => {
  const host = authority(readyGame()), runtime = host.makeRuntime()
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats().writes
    host.setMode('reject'); await runtime.playAction('move', '0', token(before))
    expect(runtime.saveReceipt).toMatchObject({ status: 'rejected', reason: 'REVISION_CONFLICT' })
    expect(runtime.controller!.snapshot()).toEqual(before); expect(host.durable().world).toEqual(before)
    expect(host.candidates.at(-1)!.play.active!.choices).toHaveLength(2)
    expect(runtime.reasons.has('commit-pending')).toBe(false); expect(host.stats().writes).toBe(baseline + 1)
  } finally { await runtime.dispose() }
})
it('does not write table mode changes while arranging or in photo mode', async () => {
  const host = authority(createLivingWorld(scene)), runtime = host.makeRuntime()
  try {
    await boot(runtime); const before = runtime.controller!.snapshot(), baseline = host.stats().writes
    runtime.beginHome(); expect(runtime.arranging).toBe(true)
    await runtime.setTableMode('game'); expect(host.stats().writes).toBe(baseline)
    expect(runtime.controller!.snapshot()).toEqual(before)
    runtime.cancelHome(); await runtime.enterPhoto(); expect(runtime.photoMode).toBe(true)
    // Entering photo mode checkpoints the current world; the mode request itself must not write.
    const photoWrites = host.stats().writes
    await runtime.setTableMode('game'); expect(host.stats().writes).toBe(photoWrites)
    expect(runtime.controller!.snapshot()).toEqual(before)
    runtime.exitPhoto()
    await runtime.setTableMode('game'); expect(host.stats().writes).toBe(photoWrites + 1)
    expect(runtime.controller!.world.play.tableMode).toBe('game')
  } finally { await runtime.dispose() }
})

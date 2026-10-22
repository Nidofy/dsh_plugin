// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { createNeighborhoodWorld as createWorld, type NeighborhoodWorld as ContentWorld } from '../src/core/neighborhood-state.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'
import { stepNeighborhood as stepTea, settleTea } from '../src/core/neighborhood-engine.ts'
afterEach(() => vi.unstubAllGlobals())
function fixture() {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  let profileId = crypto.randomUUID(), epoch = crypto.randomUUID(), saved: Saved<ContentWorld> | null = null, uncertain = false
  let release = 0, mutations = 0
  let stateUnavailable = false, gate: Promise<void> | null = null
  const runtime = new VillageRuntime(async (path, init) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null
    let result: unknown
    if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
    else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: null }
    else if (path.endsWith('/state')) { if (stateUnavailable) throw Error('STATE_OFFLINE'); result = { profileId, epoch, saved } }
    else if (path.endsWith('/save')) {
      mutations++; if (gate) await gate
      saved = { revision: (saved?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }
      if (uncertain) { uncertain = false; throw Error('ACK_LOST') }
      result = { ...saved, profileId, epoch }
    } else if (path.endsWith('/release')) { release++; result = { ok: true } }
    else result = { ok: true }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  })
  vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue()
  runtime.images = {} // Resource integrity is exercised by browser/Host tests.
  return { runtime, loseAck: () => { uncertain = true }, foreignProfile: () => { profileId = crypto.randomUUID(); epoch = crypto.randomUUID(); saved = null },
    stateOffline: (value: boolean) => { stateUnavailable = value }, restart: () => { epoch = crypto.randomUUID() },
    holdSave: () => { let done!: () => void; gate = new Promise<void>(resolve => { done = resolve }); return () => { gate = null; done() } },
    changeRevision: () => { saved = { revision: (saved?.revision ?? 0) + 1, operationId: crypto.randomUUID(), world: createWorld(scene) } },
    stats: () => ({ release, mutations }) }
}
it('reads uncertain acknowledgements without replay and refuses another profile while retaining memory', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    const before = f.stats().mutations
    f.loseAck(); r.pause('user', true); await r.flush()
    expect(r.error).toBe(''); expect(f.stats().mutations).toBeGreaterThan(before)
    const memory = r.controller!.snapshot()
    r.setConnection(false); f.foreignProfile(); r.setConnection(true)
    await vi.waitFor(() => expect(r.error).toContain('PROFILE_CHANGED'))
    expect(r.controller!.snapshot()).toEqual(memory)
    expect(r.ready).toBe(false); expect(r.reasons.has('disconnected')).toBe(true)
    expect(f.stats().release).toBe(1)
  } finally { await r.dispose() }
})
it('critical candidates stay invisible until confirmed and block conflicting UI mutations', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    const original = r.controller!.snapshot(), candidate = structuredClone(original); candidate.userPaused = true
    const release = f.holdSave(), pending = r.commitWorld(candidate)
    let flushed = false
    const flush = r.flush().then(value => { flushed = true; return value })
    await vi.waitFor(() => expect(r.saveReceipt.status).toBe('pending'))
    expect(flushed).toBe(false)
    expect(r.reasons.has('commit-pending')).toBe(true); expect(r.controller!.snapshot()).toEqual(original)
    r.setCharacterPresent('claude', true); r.selectCharacter('gpt'); r.pause('user', true)
    expect(r.controller!.snapshot()).toEqual(original)
    release(); expect((await pending).status).toBe('committed')
    expect((await flush).status).toBe('committed')
    expect(r.controller!.snapshot()).toEqual(candidate); expect(r.reasons.has('commit-pending')).toBe(false)
    expect(r.reasons.has('user')).toBe(true)
  } finally { await r.dispose() }
})
it('unknown critical save never replays and reconciles after a freshly acquired Host epoch', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    const original = r.controller!.snapshot(), candidate = structuredClone(original); candidate.userPaused = true
    const count = f.stats().mutations
    f.loseAck(); f.stateOffline(true)
    expect((await r.commitWorld(candidate)).status).toBe('unknown')
    expect(r.controller!.snapshot()).toEqual(original)
    await r.flush(); await r.flush(); r.save()
    expect(f.stats().mutations).toBe(count + 1)
    expect(r.reasons.has('commit-pending')).toBe(true)
    f.stateOffline(false); f.restart(); r.retry()
    await vi.waitFor(() => expect(r.ready && !r.error && r.saveReceipt.status === 'committed').toBe(true))
    expect(r.controller!.snapshot()).toEqual(candidate); expect(r.reasons.has('commit-pending')).toBe(false)
    expect(f.stats().mutations).toBe(count + 1)
  } finally { await r.dispose() }
})
it('unload waits for an in-flight critical save and does not start another write', async () => {
  const f = fixture(), r = f.runtime
  r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
  const candidate = r.controller!.snapshot(); candidate.userPaused = true
  const release = f.holdSave(), pending = r.commitWorld(candidate)
  await vi.waitFor(() => expect(r.saveReceipt.status).toBe('pending'))
  let disposed = false
  const closing = r.dispose().then(() => { disposed = true })
  await Promise.resolve(); expect(disposed).toBe(false)
  const writes = f.stats().mutations
  r.save(); release(); await pending; await closing
  r.save(); await r.dispose()
  expect(f.stats().mutations).toBe(writes); expect(f.stats().release).toBe(1)
})
it('external revision conflict pauses instead of replacing memory or automatically saving', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    const before = f.stats().mutations, memory = r.controller!.snapshot()
    r.setConnection(false); f.changeRevision(); r.setConnection(true)
    await vi.waitFor(() => expect(r.error).toContain('REVISION_CONFLICT'))
    expect(r.controller!.snapshot()).toEqual(memory); expect(f.stats().mutations).toBe(before)
  } finally { await r.dispose() }
})
it('publishes tea reward, journal and unlock together only after a lost ACK is reconciled', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.setCharacterPresent('claude', true); await r.flush()
    await r.invite(['bluewhale', 'claude'], 'tea')
    const world = r.controller!.world
    for (let i = 0; i < 1230; i++) stepTea(world, scene)
    const reward = settleTea(world, scene)!
    expect(reward.journal).toHaveLength(1)
    const release = f.holdSave(); f.loseAck()
    const pending = r.commitWorld(reward)
    await vi.waitFor(() => expect(r.saveReceipt.status).toBe('pending'))
    expect(r.controller!.world.journal).toHaveLength(0)
    expect(r.controller!.world.decorations.windChime).toBeNull()
    release(); expect((await pending).status).toBe('committed')
    expect(r.controller!.world.journal).toHaveLength(1)
    expect(r.controller!.world.progress.unlocked).toEqual(['wind-chime'])
    expect(settleTea(r.controller!.world, scene)).toBeNull()
  } finally { await r.dispose() }
})

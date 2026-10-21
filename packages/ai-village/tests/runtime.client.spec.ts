// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { createWorld } from '../src/core/world.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'
afterEach(() => vi.unstubAllGlobals())
function fixture() {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  let profileId = crypto.randomUUID(), epoch = crypto.randomUUID(), saved: Saved | null = null, uncertain = false
  let release = 0, mutations = 0
  const runtime = new VillageRuntime(async (path, init) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null
    let result: unknown
    if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
    else if (path.endsWith('/state')) result = { profileId, epoch, saved }
    else if (path.endsWith('/save')) {
      mutations++; saved = { revision: (saved?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }
      if (uncertain) { uncertain = false; throw Error('ACK_LOST') }
      result = saved
    } else if (path.endsWith('/release')) { release++; result = { ok: true } }
    else result = { ok: true }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  })
  runtime.images = {} // Resource integrity is exercised by browser/Host tests.
  return { runtime, loseAck: () => { uncertain = true }, foreignProfile: () => { profileId = crypto.randomUUID(); epoch = crypto.randomUUID(); saved = null },
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

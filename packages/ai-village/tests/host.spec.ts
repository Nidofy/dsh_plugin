import { it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { request } from 'node:http'
import { harness } from '../experiments/phase4-host.ts'
import { createNeighborhoodWorld as createWorld, type NeighborhoodWorld as ContentWorld } from '../src/core/neighborhood-state.ts'
import { scene } from '../src/definitions.ts'
const out = resolve('.build/ai-village-phase4')
it('official authenticated Connection routes, profile lease, CAS, recovery, unload and cold reenable', async () => {
  const profile = await mkdtemp(join(out, 'host-test-'))
  const plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
  const h = await harness({ profile, plugin })
  try {
    const auth = await fetch(h.entry, { redirect: 'manual' }), cookie = auth.headers.get('set-cookie')!.split(';')[0]!
    const call = async (path: string, data?: object) => {
      const r = await fetch(h.url + '/api/nidofy-ai-village/' + path, { method: data ? 'POST' : 'GET',
        headers: { cookie, 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) })
      return { status: r.status, value: await r.json().catch(() => null) }
    }
    expect((await fetch(h.url + '/api/nidofy-ai-village/state')).status).toBe(401)
    expect((await fetch(h.url + '/api/nidofy-ai-village/state', { headers: { cookie, origin: 'https://untrusted.invalid' } })).status).toBe(403)
    const state = (await call('state')).value; expect(state.saved).toBeNull()
    const owner = (await call('acquire', { clientId: randomUUID() })).value
    expect((await call('acquire', { clientId: randomUUID() })).value.error).toBe('WORLD_IN_USE')
    const world = createWorld(scene), operationId = randomUUID()
    const ack = (await call('save', { ...owner, expectedRevision: 0, operationId, world })).value
    expect(ack.revision).toBe(1); expect(ack.profileId).toBe(owner.profileId); expect(ack.epoch).toBe(owner.epoch)
    const preferences = { schemaVersion: 1, theme: 'dark', language: 'en', reducedMotion: true, bubbles: false }
    expect((await call('preferences-state')).value.saved).toBeNull()
    const preferenceAck = (await call('preferences-save', { ...owner, expectedRevision: 0, operationId: randomUUID(), world: preferences })).value
    expect(preferenceAck.revision).toBe(1)
    expect((await call('preferences-state')).value.saved.world).toEqual(preferences)
    expect((await call('state')).value.saved.world).toEqual(world)
    expect((await call('preferences-save', { ...owner, expectedRevision: 1, operationId: randomUUID(), world: { ...preferences, reward: true } })).value.error).toBe('INVALID_PREFERENCES')
    expect((await call('save', { ...owner, expectedRevision: 0, operationId, world })).value.revision).toBe(1)
    expect((await call('save', { ...owner, expectedRevision: 0, operationId: randomUUID(), world })).value.error).toBe('REVISION_CONFLICT')
    world.userPaused = true
    expect((await call('save', { ...owner, expectedRevision: 1, operationId: randomUUID(), world })).value.revision).toBe(2)
    const path = join(profile, 'nidofy-ai-village/current.json'), damaged = '{"schemaVersion":999}'
    await writeFile(path, damaged)
    expect((await call('state')).status).toBe(409)
    expect(await readFile(path, 'utf8')).toBe(damaged)
    expect((await call('recover', owner)).value.world.userPaused).toBe(false)
    for (let i = 0; i < 3; i++) {
      await h.disable(); expect((await call('state')).status).toBe(404)
      await h.enable()
      const next = (await call('state')).value
      expect(next.profileId).toBe(state.profileId); expect(next.epoch).not.toBe(owner.epoch)
      expect(next.saved.revision).toBe(3)
      expect((await call('preferences-state')).value.saved.world).toEqual(preferences)
      expect((await call('heartbeat', owner)).value.error).toBe('OWNER_LOST')
    }
    for (const path of ['assets/../../package.json', 'assets/%2e%2e/package.json', 'assets/toString', 'frame/extra'])
      expect((await call(path)).status).toBe(404)
    expect((await fetch(h.url + '/api/nidofy-ai-village/frame', { headers: { cookie } })).headers.get('content-security-policy')).toContain("connect-src 'none'")
    const pending = request(h.url + '/api/nidofy-ai-village/save', { method: 'POST', headers: { cookie, 'content-type': 'application/json' } })
    const cancelled = new Promise<void>(resolve => { pending.on('error', () => resolve()); pending.on('close', () => resolve()) })
    pending.write('{"unfinished":')
    await new Promise(resolve => setTimeout(resolve, 40))
    await h.disable(); await cancelled
    await h.enable(); expect((await call('state')).value.saved.revision).toBe(3)
  } finally { await h.close() }
})

import { stories, neighborhoodEvents } from '../src/core/neighborhood-catalog.ts'
// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { VillageRuntime } from '../src/client/runtime.ts'
import { createLivingWorld as createWorld, type LivingWorld as ContentWorld } from '../src/core/living-state.ts'
import { scene } from '../src/definitions.ts'
import type { Saved } from '../src/host/save-store.ts'
import { stepLiving as stepTea, settleTea } from '../src/core/living-engine.ts'
import { switchRegion } from '../src/core/region-engine.ts'
afterEach(() => vi.unstubAllGlobals())
it('uses the neutral gate for cold bookhouse and same-region hide/restore until a fresh frame, with idempotent subscriber reveal', async () => {
  const world=switchRegion(createWorld(scene),scene,'bookhouse');world.userPaused=true;const f=fixture(world),r=f.runtime
  let unsubscribe=()=>{}
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush()
    expect(r.frameKey).toBe('bookhouse');expect(r.regionTransition).toBe(true);expect(r.canRevealEntrance).toBe(false)
    let calls=0
    unsubscribe=r.subscribe(()=>{calls++;if(r.canRevealEntrance)r.finishEntrance()})
    reveal(r);expect(r.entrance.blocking).toBe(false);expect(r.regionTransition).toBe(false);expect(calls).toBeLessThan(10)
    const saved=r.controller!.snapshot(),writes=f.stats().mutations
    r.pause('hidden',true);r.setFrameReady(false);r.pause('hidden',false)
    expect(r.regionTransition).toBe(true);expect(r.canRevealEntrance).toBe(false)
    r.setFrameReady(true);r.finishEntrance();expect(r.regionTransition).toBe(true)
    reveal(r);expect(r.regionTransition).toBe(false);expect(r.controller!.snapshot()).toEqual(saved)
    expect(r.reasons.has('user')).toBe(true);expect(f.stats().mutations).toBe(writes)
  } finally {unsubscribe();await r.dispose()}
})
it('publishes region travel only after CAS, resets transient view and waits for a new first frame while preserving user pause', async () => {
  const world=createWorld(scene);world.userPaused=true;const f=fixture(world),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));reveal(r)
    const before=r.controller!.snapshot(),writes=f.stats().mutations
    r.setCamera({zoom:1.4,panX:.1,panY:.1});r.present({type:'tab',tab:'journal'})
    const release=f.holdSave(),travel=r.switchRegion('bookhouse');await vi.waitFor(()=>expect(f.stats().mutations).toBe(writes+1))
    expect(r.controller!.snapshot()).toEqual(before);expect(r.frameKey).toBe('courtyard');release();await travel
    expect(r.frameKey).toBe('bookhouse');expect(r.regionTransition).toBe(true);expect(r.frameReady).toBe(false)
    expect(r.presentation.drawer).toBe('closed');expect(r.presentation.camera).toEqual({zoom:1,panX:0,panY:0})
    expect(r.controller!.world.rng).toBe(before.rng);expect(r.controller!.world.ticks).toBe(before.ticks);expect(r.reasons.has('user')).toBe(true)
    await r.switchRegion('courtyard');expect(f.stats().mutations).toBe(writes+1)
    r.setFrameReady(true);r.finishEntrance();expect(r.entrance.blocking).toBe(true)
    reveal(r);expect(r.regionTransition).toBe(false);await r.switchRegion('courtyard')
    expect(r.controller!.world.actor).toMatchObject({id:before.actor.id,position:before.actor.position,safe:before.actor.safe,facing:before.actor.facing,behavior:'idle',intent:null,destination:null})
    expect(r.controller!.world.userPaused).toBe(true);expect(f.stats().mutations).toBe(writes+2)
  } finally {await r.dispose()}
})
it('region resource failure before submit releases critical candidate and retains the old world and resources', async () => {
  const world=createWorld(scene);world.userPaused=true;const f=fixture(world),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));reveal(r)
    const before=r.controller!.snapshot(),writes=f.stats().mutations
    vi.mocked((r as unknown as {ensureAssets:()=>Promise<void>}).ensureAssets).mockRejectedValueOnce(Error('ASSET_UNAVAILABLE'))
    await r.switchRegion('bookhouse');expect(r.controller!.snapshot()).toEqual(before);expect(f.stats().mutations).toBe(writes)
    expect(r.reasons.has('commit-pending')).toBe(false);expect((r as unknown as {criticalCandidate:unknown}).criticalCandidate).toBeNull()
    expect(r.images).toEqual({});expect(r.actionError).toBe('ASSET_UNAVAILABLE');expect(r.frameKey).toBe('courtyard')
    r.retry();await vi.waitFor(()=>expect(r.ready).toBe(true));reveal(r);await r.switchRegion('bookhouse');expect(r.frameKey).toBe('bookhouse')
  } finally {await r.dispose()}
})
it('lost region ACK remains in the prior region until read-only reconciliation then fences the frame without another write', async () => {
  vi.useFakeTimers();const world=createWorld(scene);world.userPaused=true;const f=fixture(world),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));reveal(r)
    const before=r.controller!.snapshot(),writes=f.stats().mutations;f.loseAck();f.stateOffline(true)
    await r.switchRegion('bookhouse');expect(r.saveReceipt.status).toBe('unknown');expect(r.controller!.snapshot()).toEqual(before)
    await r.switchRegion('bookhouse');expect(f.stats().mutations).toBe(writes+1)
    f.stateOffline(false);await r.checkRecovery();expect(r.saveReceipt.status).toBe('committed');expect(r.frameKey).toBe('bookhouse')
    expect(r.frameReady).toBe(false);expect(r.entrance.blocking).toBe(true);expect(r.regionTransition).toBe(true);expect(f.stats().mutations).toBe(writes+1)
    reveal(r);expect(r.controller!.world.userPaused).toBe(true);expect(r.regionTransition).toBe(false)
  } finally {await r.dispose();vi.useRealTimers()}
})
it('refuses travel while hidden or arranging and prevents residency changes inside the bookhouse', async () => {
  const world=createWorld(scene);world.userPaused=true;const f=fixture(world),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));reveal(r);const writes=f.stats().mutations
    r.pause('sidebar',true);await r.switchRegion('bookhouse');expect(f.stats().mutations).toBe(writes)
    r.pause('sidebar',false);reveal(r);r.beginHome();await r.switchRegion('bookhouse');expect(f.stats().mutations).toBe(writes)
    r.cancelArrangements();await r.switchRegion('bookhouse');reveal(r)
    const before=r.controller!.snapshot();r.setAllCharacters(true);r.setCharacterPresent('claude',true);r.selectCharacter('claude');r.beginHome()
    expect(r.controller!.snapshot()).toEqual(before);expect(r.homeDraft).toBeNull()
    await r.bookhouseActivity('bookcase');expect(r.controller!.world.actor.intent).toBeNull()
    r.pause('user',false);await r.flush();await r.bookhouseActivity('bookcase');expect(r.controller!.world.actor.intent?.furnitureId).toBe('bookcase')
    await r.cancelBookhouseActivity();expect(r.controller!.world.actor.intent).toBeNull()
  } finally {await r.dispose()}
})
function reveal(r: VillageRuntime) {
  // This fixture stubs resource IO; emulate the validated resource and renderer boundaries explicitly.
  r.entrance.verified = 1; r.beginEntranceFrame('test-frame'); r.expectEntranceFrame('test-frame',r.assetRevision,1)
  r.setFrameReady(true); r.entranceFrame('test-frame',r.entrance.attemptId,r.assetRevision,1); r.finishEntrance()
}
it('blocks ticks and input until current first paint plus boot writes settle, and preserves saved user pause', async () => {
  const world=createWorld(scene);world.userPaused=true;const f=fixture(world),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush()
    r.entrance.verified=1;r.setFrameReady(true);r.skipEntrance()
    const before=r.controller!.snapshot();r.input({kind:'camera',camera:{zoom:1.5,panX:0,panY:0}})
    expect(r.presentation.camera.zoom).toBe(1);expect(r.canRevealEntrance).toBe(false)
    r.finishEntrance();expect(r.entrance.blocking).toBe(true);expect(r.controller!.snapshot()).toEqual(before)
    reveal(r);expect(r.entrance.blocking).toBe(false);expect(r.reasons.has('user')).toBe(true);expect(r.controller!.world.userPaused).toBe(true)
    r.pause('sidebar',true);r.setFrameReady(false);r.pause('sidebar',false)
    expect(r.canRevealEntrance).toBe(false);expect(r.entrance.full).toBe(false);reveal(r)
    expect(r.controller!.snapshot()).toEqual(before)
  } finally {await r.dispose()}
})
function fixture(initialWorld?: ContentWorld, initialPrefs?: unknown) {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  let profileId = crypto.randomUUID(), epoch = crypto.randomUUID(), saved: Saved<ContentWorld> | null = initialWorld ? {revision:1,operationId:crypto.randomUUID(),world:initialWorld} : null, uncertain = false
  let release = 0, mutations = 0, preferences: any = initialPrefs ? {revision:1,operationId:crypto.randomUUID(),world:initialPrefs} : null
  let stateGate: Promise<void> | null = null
  let stateUnavailable = false, heartbeatFailure = false, heartbeats = 0, gate: Promise<void> | null = null
  const runtime = new VillageRuntime(async (path, init) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null
    let result: unknown
    if (path.endsWith('/heartbeat')) { heartbeats++; if (heartbeatFailure) throw new TypeError('Failed to fetch'); result = { ok: true } }
    else if (path.endsWith('/acquire')) result = { profileId, epoch, lease: crypto.randomUUID() }
    else if (path.endsWith('/preferences-state')) result = { profileId, epoch, saved: preferences }
    else if (path.endsWith('/preferences-save')) { preferences = { revision: (preferences?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }; result = { ...preferences, profileId, epoch } }
    else if (path.endsWith('/state')) { if (stateUnavailable) throw Error('STATE_OFFLINE'); result = { profileId, epoch, saved }; const pending = stateGate; stateGate = null; if(pending) await pending }
    else if (path.endsWith('/save')) {
      mutations++; if (gate) await gate
      saved = { revision: (saved?.revision ?? 0) + 1, operationId: data.operationId, world: data.world }
      if (uncertain) { uncertain = false; throw Error('ACK_LOST') }
      result = { ...saved, profileId, epoch }
    } else if (path.endsWith('/recover')) { saved = { revision: (saved?.revision ?? 0) + 1, operationId: crypto.randomUUID(), world: createWorld(scene) }; result = saved }
    else if (path.endsWith('/release')) { release++; result = { ok: true } }
    else result = { ok: true }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  })
  vi.spyOn(runtime as unknown as { ensureAssets(): Promise<void> }, 'ensureAssets').mockResolvedValue()
  runtime.images = {} // Resource integrity is exercised by browser/Host tests.
  return { runtime, loseAck: () => { uncertain = true }, foreignProfile: () => { profileId = crypto.randomUUID(); epoch = crypto.randomUUID(); saved = null },
    stateOffline: (value: boolean) => { stateUnavailable = value }, restart: () => { epoch = crypto.randomUUID() },
    holdState: () => { let done!: () => void; stateGate = new Promise<void>(resolve => { done = resolve }); return () => done() },
    holdSave: () => { let done!: () => void; gate = new Promise<void>(resolve => { done = resolve }); return () => { gate = null; done() } },
    changeRevision: () => { saved = { revision: (saved?.revision ?? 0) + 1, operationId: crypto.randomUUID(), world: createWorld(scene) } },
    heartbeatOffline: (value: boolean) => { heartbeatFailure = value },
    stats: () => ({ release, mutations, heartbeats }) }
}

it('recovers same-transport heartbeat failure after authority checks, preserving user pause, draft, undo and frame gate', async () => {
  vi.useFakeTimers();const f=fixture(), r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));r.pause('user',true);await r.flush()
    r.beginHome();r.homeTemplate('reading');const draft=structuredClone(r.homeDraft), world=r.controller!.world,writes=f.stats().mutations
    f.heartbeatOffline(true);await vi.advanceTimersByTimeAsync(4000)
    expect(r.errorCode).toBe('CONNECTION_TEMPORARY');expect(r.connected).toBe(true);expect(r.reasons.has('disconnected')).toBe(true)
    f.heartbeatOffline(false);await vi.advanceTimersByTimeAsync(1000)
    expect(r.error).toBe('');expect(r.reasons.has('disconnected')).toBe(false);expect(r.reasons.has('user')).toBe(true);expect(r.reasons.has('arrange')).toBe(true)
    expect(r.homeDraft).toEqual(draft);expect(r.canUndoHome).toBe(true);expect(r.controller!.world).toBe(world);expect(r.frameReady).toBe(false);expect(f.stats().mutations).toBe(writes)
  } finally {await r.dispose();vi.useRealTimers()}
})
it('bounds recovery to 1/2/4 seconds and cancels hidden attempts without losing drafts',async()=>{
 vi.useFakeTimers();const f=fixture(),r=f.runtime
 try{r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush();r.beginHome();const draft=structuredClone(r.homeDraft)
 f.heartbeatOffline(true);await vi.advanceTimersByTimeAsync(4000);await vi.advanceTimersByTimeAsync(7000)
 expect(r.recoveryState).toBe('blocked');const count=f.stats().heartbeats;await vi.advanceTimersByTimeAsync(2000);expect(f.stats().heartbeats-count).toBeLessThanOrEqual(1)
 expect(r.errorCode).toBe('CONNECTION_TEMPORARY');expect(r.homeDraft).toEqual(draft)
 }finally{await r.dispose();vi.useRealTimers()}
})
it('read-only recovery confirms a lost ACK once and refuses foreign revision without taking over',async()=>{
 vi.useFakeTimers();const f=fixture(),r=f.runtime
 try{r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await r.flush();r.beginHome();r.homeTemplate('reading')
 const count=f.stats().mutations;f.loseAck();f.stateOffline(true);await r.confirmHome();expect(r.saveReceipt.status).toBe('unknown');const draft=structuredClone(r.homeDraft)
 f.stateOffline(false);await r.checkRecovery();expect(r.saveReceipt.status).toBe('committed');expect(f.stats().mutations).toBe(count+1);expect(r.homeDraft).toEqual(draft)
 f.heartbeatOffline(true);await vi.advanceTimersByTimeAsync(4000);f.heartbeatOffline(false);f.changeRevision();await vi.advanceTimersByTimeAsync(1000)
 expect(r.errorCode).toBe('REVISION_CONFLICT');expect(r.reasons.has('disconnected')).toBe(true);expect(f.stats().mutations).toBe(count+1)
 }finally{await r.dispose();vi.useRealTimers()}
})
it('arrangement previews never mutate the world; undo, cancellation and reconnect discard only the draft', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.pause('user', true); await r.flush(); const before = r.controller!.snapshot(), count = f.stats().mutations
    r.beginHome(); r.homeTemplate('reading')
    expect(r.controller!.snapshot()).toEqual(before); expect(r.view()!.world.home.positions.work).toBe(1)
    r.undoHome(); expect(r.homeDraft!.home).toEqual(before.home)
    r.homeTemplate('garden'); r.cancelHome()
    expect(r.controller!.snapshot()).toEqual(before); expect(r.view()!.world).toEqual(before)
    expect(f.stats().mutations).toBe(count); expect(r.reasons.has('user')).toBe(true); expect(r.reasons.has('arrange')).toBe(false)
    r.beginHome(); r.homeTemplate('reading'); r.setConnection(false)
    expect(r.homeDraft).toBeNull(); expect(r.controller!.snapshot()).toEqual(before)
  } finally { await r.dispose() }
})
it('retains drafts across sidebar and panel hiding, revalidates on return and clears them on explicit close or recovery', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.pause('user', true); await r.flush(); const before = r.controller!.snapshot(), writes = f.stats().mutations
    r.beginHome(); r.homeTemplate('reading'); const draft = structuredClone(r.homeDraft)
    for (let i = 0; i < 50; i++) {
      r.pause('sidebar', true); r.setFrameReady(false); r.pause('sidebar', false)
      expect(r.homeDraft).toEqual(draft); expect(r.reasons.has('arrange')).toBe(true)
      expect(r.controller!.snapshot()).toEqual(before)
    }
    r.hide(true); r.show(); expect(r.homeDraft).toEqual(draft)
    expect(f.stats().mutations).toBe(writes)
    r.controller!.world.home.revision++
    r.pause('sidebar', true); r.pause('sidebar', false)
    expect(r.homeDraftError).toBe('LAYOUT_CONFLICT'); expect(r.view()!.world).toEqual(r.controller!.world)
    await r.confirmHome(); expect(f.stats().mutations).toBe(writes); expect(r.homeDraft).toEqual(draft)
    r.undoHome(); expect(r.homeDraftError).toBe('LAYOUT_CONFLICT')
    r.hide(); expect(r.presentation.confirmClose).toBe(true); expect(r.homeDraft).not.toBeNull(); r.cancelArrangements(); r.hide(); expect(r.homeDraft).toBeNull(); expect(r.reasons.has('arrange')).toBe(false)
    r.show(); r.beginHome(); r.homeTemplate('garden'); await r.recover()
    expect(r.homeDraft).toBeNull(); expect(r.reasons.has('arrange')).toBe(false); expect(r.error).toBe('')
  } finally { await r.dispose() }
})
it('keeps all decoration previews in one paused runtime draft across hiding, blocks photos and clears on recovery', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.setCharacterPresent('claude', true); await r.flush(); await r.invite(['bluewhale', 'claude'], 'tea')
    for (let i = 0; i < 1230; i++) stepTea(r.controller!.world, scene)
    await r.commitWorld(settleTea(r.controller!.world, scene)!)
    const earned = r.controller!.snapshot()
    earned.neighborhood.memories.push({ id: 'water', eventId: crypto.randomUUID(), participants: ['bluewhale'], completedTick: earned.ticks, count: 1 })
    earned.neighborhood.lastEventId = earned.neighborhood.memories[0]!.eventId
    expect((await r.commitWorld(earned)).status).toBe('committed'); r.pause('user', true); await r.flush()
    const saved = r.controller!.snapshot(), count = f.stats().mutations
    r.previewDecoration('wall'); expect(r.reasons.has('arrange')).toBe(true)
    r.pause('sidebar', true); r.pause('sidebar', false); r.hide(true); r.show()
    expect(r.decorationDraft).toBe('wall'); expect(r.controller!.snapshot()).toEqual(saved)
    r.setFrameReady(true); await r.enterPhoto(); expect(r.photoMode).toBe(false)
    r.previewExtraDecoration({ id: 'planter', slot: 'door' })
    expect(r.decorationDraft).toBe('wall'); expect(r.extraDecorationDraft).toBeNull()
    r.cancelArrangements(); r.previewExtraDecoration({ id: 'planter', slot: 'door' })
    expect(r.decorationDraft).toBeUndefined(); expect(r.extraDecorationDraft).toEqual({ id: 'planter', slot: 'door' })
    r.pause('sidebar', true); r.pause('sidebar', false)
    expect(r.extraDecorationDraft?.slot).toBe('door'); r.setCharacterPresent('gpt', true)
    expect(r.controller!.snapshot()).toEqual(saved); expect(f.stats().mutations).toBe(count)
    r.cancelArrangements(); expect(r.arranging).toBe(false); expect(r.reasons.has('arrange')).toBe(false); expect(r.reasons.has('user')).toBe(true)
    r.previewExtraDecoration({ id: 'planter', slot: 'wall' }); f.loseAck(); f.stateOffline(true)
    await r.decorateExtra('planter', 'wall')
    expect(r.actionError).toBe('SAVE_UNCONFIRMED'); expect(r.extraDecorationDraft?.slot).toBe('wall')
    const writes = f.stats().mutations; await r.flush(); expect(f.stats().mutations).toBe(writes)
    f.stateOffline(false); r.retry(); await vi.waitFor(() => expect(r.ready && !r.error).toBe(true))
    expect(r.arranging).toBe(false); expect(r.controller!.world.neighborhood.decorations.planter).toBe('wall')
    r.previewDecoration('door'); await r.recover(); expect(r.arranging).toBe(false); expect(r.decorationDraft).toBeUndefined()
  } finally { await r.dispose() }
})
it('confirms an edited arrangement once after lost ACK and preserves geometry, appearance and user pause', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.pause('user', true); await r.flush(); r.beginHome(); r.homeTemplate('reading')
    r.updateHome({ ...r.homeDraft!.home, environment: 'twilight', accessories: { ...r.homeDraft!.home.accessories, bluewhale: 'ribbon' } })
    const count = f.stats().mutations, before = r.controller!.snapshot(), release = f.holdSave(); f.loseAck()
    const pending = r.confirmHome(); await vi.waitFor(() => expect(r.saveReceipt.status).toBe('pending'))
    expect(r.controller!.snapshot()).toEqual(before); release(); await pending
    expect(r.homeDraft).toBeNull(); expect(r.controller!.world.home.revision).toBe(1)
    expect(r.controller!.world.home.environment).toBe('twilight'); expect(r.controller!.world.home.accessories.bluewhale).toBe('ribbon')
    expect(f.stats().mutations).toBe(count + 1); expect(r.reasons.has('user')).toBe(true)
  } finally { await r.dispose() }
})
it('reconciles an unknown arrangement and immediately adopts geometry even while paused', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.pause('user', true); await r.flush(); r.beginHome(); r.homeTemplate('reading')
    const count = f.stats().mutations; f.loseAck(); f.stateOffline(true); await r.confirmHome()
    expect(r.saveReceipt.status).toBe('unknown'); expect(r.controller!.world.home.positions.eat).toBe(0)
    f.stateOffline(false); f.restart(); r.retry()
    await vi.waitFor(() => expect(r.ready && !r.error && r.saveReceipt.status === 'committed').toBe(true))
    expect(r.controller!.world.home.positions.eat).toBe(1)
    expect(r.controller!.scene.hotspots.find(h => h.id === 'eat')!.anchor.x).toBe(121)
    expect(f.stats().mutations).toBe(count + 1); expect(r.homeDraft).toBeNull(); expect(r.reasons.has('user')).toBe(true)
  } finally { await r.dispose() }
})
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
it('commits pointer-up selection through the same acknowledged world transaction', async () => {
  const f = fixture(), r = f.runtime
  try {
    r.setConnection(true); r.show(); await vi.waitFor(() => expect(r.ready).toBe(true)); await r.flush()
    r.setCharacterPresent('claude', true); await r.flush(); reveal(r)
    const point = r.controller!.world.companions[0]!.position, count = f.stats().mutations
    r.pointer({ type: 'down', id: 1, point, css: { x: 0, y: 0 } }); expect(r.controller!.world.actor.id).toBe('bluewhale')
    r.pointer({ type: 'up', id: 1, point, css: { x: 0, y: 0 } }); await r.flush()
    expect(r.controller!.world.actor.id).toBe('claude'); expect(f.stats().mutations).toBe(count + 1)
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

it('publishes notices only after durable confirmation, keeps repeat IDs stable, and serializes read/theme intentions', async () => {
  const f=fixture(),r=f.runtime
  try {
    r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));r.pause('user',true);await r.flush()
    await vi.waitFor(()=>expect(r.preferences.noticesInitialized).toBe(true))
    const candidate=r.controller!.snapshot(),id=crypto.randomUUID()
    candidate.neighborhood.memories.push({id:'hello',eventId:id,participants:['bluewhale'],completedTick:candidate.ticks,count:1});candidate.neighborhood.lastEventId=id
    const release=f.holdSave(),pending=r.commitWorld(candidate)
    await vi.waitFor(()=>expect(r.reasons.has('commit-pending')).toBe(true));expect(r.notices).toEqual([]);expect(r.presentation.toastIds).toEqual([])
    release();await pending;expect(r.notices).toHaveLength(1);expect(r.presentation.toastIds).toHaveLength(1)
    const notice=r.notices[0]!.id,writes=f.stats().mutations,world=r.controller!.snapshot()
    await Promise.all([r.setPreferences({theme:'dark'}),r.markNoticesRead([notice]),r.setPreferences({language:'en'})])
    expect(r.preferences.theme).toBe('dark');expect(r.preferences.language).toBe('en');expect(r.preferences.noticeReadIds).toContain(notice);expect(f.stats().mutations).toBe(writes);expect(r.controller!.snapshot()).toEqual(world)
    r.present({type:'patch',patch:{toastIds:[]}});world.neighborhood.memories[0]!.count++
    f.loseAck();await r.commitWorld(world);expect(r.notices[0]!.id).toBe(notice);expect(r.notices[0]!.count).toBe(2);expect(r.presentation.toastIds).toEqual([])
  } finally {await r.dispose()}
})

it('caps Home undo at twenty valid edits and cancel leaves the durable world untouched', async()=>{
 const f=fixture(),r=f.runtime
 try {r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));r.pause('user',true);await r.flush();const before=r.controller!.snapshot(),writes=f.stats().mutations;r.beginHome()
 for(let i=0;i<25;i++)r.updateHome({...r.homeDraft!.home,environment:i%2?'afternoon':'twilight'})
 for(let i=0;i<20;i++){expect(r.canUndoHome).toBe(true);r.undoHome()}
 expect(r.canUndoHome).toBe(false);expect(r.homeDraft!.home.environment).toBe('twilight');r.cancelArrangements();expect(r.controller!.snapshot()).toEqual(before);expect(f.stats().mutations).toBe(writes)
 }finally{await r.dispose()}
})

it('initializes twelve existing facts as read when legacy preferences migrate, without replaying history toasts',async()=>{
 const world=createWorld(scene)
 world.journal.push({id:crypto.randomUUID(),eventId:crypto.randomUUID(),templateId:'first-table',participants:['bluewhale','claude'],food:'tea',completedTick:0,count:1})
 world.progress={completedWishes:['first-tea'],discovered:['first-table'],unlocked:['wind-chime'],lastCompletedEventId:world.journal[0]!.eventId};world.decorations.windChime={id:'first-wind-chime',slot:null}
 world.neighborhood.memories=stories.map(s=>({id:s.id,eventId:crypto.randomUUID(),participants:neighborhoodEvents.find(d=>d.story===s.id)!.count===2?['bluewhale','claude']:['bluewhale'],completedTick:0,count:1}));world.neighborhood.lastEventId=world.neighborhood.memories.at(-1)!.eventId
 const f=fixture(world,{schemaVersion:1,theme:'dark',language:'en',reducedMotion:true,bubbles:false}),r=f.runtime
 try{r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));await vi.waitFor(()=>expect(r.preferences.noticesInitialized).toBe(true));expect(r.notices).toHaveLength(12);expect(r.preferences.noticeReadIds).toHaveLength(12);expect(r.presentation.toastIds).toEqual([]);expect(r.preferences.theme).toBe('dark');expect(r.preferences.language).toBe('en');expect(r.controller!.world.schemaVersion).toBe(10)}finally{await r.dispose()}
})


it('late automatic recovery reads cannot publish into a new connection generation',async()=>{
 vi.useFakeTimers();const f=fixture(),r=f.runtime
 try{r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));r.pause('user',true);await r.flush();f.heartbeatOffline(true);await vi.advanceTimersByTimeAsync(4000);f.heartbeatOffline(false)
 const release=f.holdState();await vi.advanceTimersByTimeAsync(1000);expect(r.recoveryState).toBe('checking')
 r.setConnection(false);r.setConnection(true);await vi.waitFor(()=>expect(r.ready).toBe(true));const controller=r.controller,world=r.controller!.snapshot(),writes=f.stats().mutations;r.setFrameReady(false);release();await vi.advanceTimersByTimeAsync(20)
 expect(r.controller).toBe(controller);expect(r.controller!.snapshot()).toEqual(world);expect(r.frameReady).toBe(false);expect(f.stats().mutations).toBe(writes);expect(r.error).toBe('');expect(r.reasons.has('user')).toBe(true)
 }finally{await r.dispose();vi.useRealTimers()}
})

it('parent navigation consumes stale iframe resident and actor intents before render delivery',async()=>{const f=fixture(),r=f.runtime;try{r.setConnection(true);r.show();await vi.waitFor(()=>expect(r.ready).toBe(true));r.setCharacterPresent('claude',true);await r.flush();reveal(r);const world=r.controller!.snapshot(),writes=f.stats().mutations;r.present({type:'tab',tab:'residents'});r.input({kind:'resident',id:'claude'});expect(r.presentation.drawer).toBe('closed');expect(r.presentation.overlay).toBeNull();expect(r.controller!.snapshot()).toEqual(world);r.present({type:'tab',tab:'residents'});r.input({kind:'camera',camera:{zoom:1.5,panX:0,panY:0}});expect(r.presentation.camera.zoom).toBe(1);for(const type of ['down','move','up']as const)r.pointer({type,id:7,point:world.actor.position,css:{x:100,y:100}});expect(r.controller!.drag).toBeNull();expect(r.presentation.overlay).toBeNull();expect(r.controller!.snapshot()).toEqual(world);expect(f.stats().mutations).toBe(writes)}finally{await r.dispose()}})

import { WorldController } from '../core/controller.ts'
import { createWorld, validateWorld } from '../core/world.ts'
import { characterIds } from '../core/roster.ts'
import { scene, resources, character, animations, roster } from '../definitions.ts'
import type { PauseReason, PointerIntent } from '../core/controller.ts'
import type { Saved } from '../host/save-store.ts'
const prefix = '/api/nidofy-ai-village/'
interface State { profileId: string; epoch: string; saved: Saved | null }
export type Request = (path: string, init?: RequestInit) => Promise<Response>
/** One instance per plugin lifetime, deliberately independent of session selection and React mounts. */
export class VillageRuntime {
  controller: WorldController | undefined
  readonly clientId = crypto.randomUUID()
  readonly reasons = new Set<PauseReason>(['closed', 'disconnected'])
  open = false; connected = false; ready = false; frameReady = false; error = ''; revision = 0; dragTime = 0
  profileId = ''; epoch = ''; lease = ''; generation = 0
  images: Record<string, ArrayBuffer> | undefined
  private version = 0
  private listeners = new Set<() => void>()
  private lifetime = new AbortController()
  private attempt = new AbortController()
  private loading: Promise<void> | null = null
  private saving: Promise<void> | null = null
  private pendingOperation: string | null = null
  private dirty = false; private raf = 0; private last = 0; private checkpoint = 0
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private recovering = false
  constructor(private readonly request: Request = (path, init) => fetch(path, init)) {}
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  snapshot = () => this.version
  private emit() { this.version++; for (const fn of this.listeners) fn() }
  private async api<T>(path: string, data?: object, signal = this.attempt.signal): Promise<T> {
    const response = await this.request(prefix + path, { method: data ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error',
      headers: { 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) })
    const bytes = await response.text()
    if (bytes.length > 65536) throw Error('RESPONSE_TOO_LARGE')
    const value = JSON.parse(bytes)
    if (!response.ok) throw Error(value.error ?? 'REQUEST_FAILED')
    return value as T
  }
  private credentials() { return { lease: this.lease, epoch: this.epoch } }
  private fail(error: unknown) { this.error = String(error); this.pause('disconnected', true); this.emit() }
  pause(reason: PauseReason, active: boolean) {
    if (active) this.reasons.add(reason); else this.reasons.delete(reason)
    if (this.controller?.pauseReasons.has(reason) !== active) this.controller?.pause(reason, active)
    this.schedule(); this.emit()
  }
  show() {
    this.open = true; this.pause('closed', false); this.pause('other-panel', false)
    if (this.connected && !this.ready) void this.connect()
  }
  hide(other = false) {
    this.open = false; this.pause(other ? 'other-panel' : 'closed', true)
    this.setFrameReady(false)
  }
  setConnection(connected: boolean, reset = false) {
    if (!reset && connected === this.connected) return
    this.connected = connected; this.generation++; this.attempt.abort(); this.attempt = new AbortController()
    clearInterval(this.heartbeat); this.heartbeat = undefined
    this.ready = false; this.frameReady = false; this.pause('disconnected', true)
    const previous = this.loading
    this.loading = null
    if (connected && (this.open || this.controller)) void (async () => { await previous; if (this.connected && !this.ready) await this.connect() })()
  }
  private async connect(): Promise<void> {
    if (this.loading || this.lifetime.signal.aborted || !this.connected) return this.loading ?? undefined
    const generation = this.generation, signal = this.attempt.signal
    const current = () => generation === this.generation && !signal.aborted && !this.lifetime.signal.aborted
    const work = (async () => {
      try {
        await this.saving
        if (!current()) return
        const owner = await this.api<{ lease: string; epoch: string; profileId: string }>('acquire', { clientId: this.clientId }, signal)
        if (!current()) return
        if (this.profileId && this.profileId !== owner.profileId) {
          await this.api('release', { lease: owner.lease, epoch: owner.epoch }, signal)
          throw Error('PROFILE_CHANGED')
        }
        this.profileId = owner.profileId; this.epoch = owner.epoch; this.lease = owner.lease
        clearInterval(this.heartbeat)
        this.heartbeat = setInterval(() => {
          void this.api('heartbeat', this.credentials()).catch(e => { if (current()) this.fail(e) })
        }, 4000)
        const state = await this.api<State>('state', undefined, signal)
        if (!current()) return
        if (owner.profileId !== state.profileId || owner.epoch !== state.epoch) throw Error('HOST_CHANGED')
        if (this.controller && (state.saved?.revision ?? 0) !== this.revision) {
          if (this.pendingOperation && state.saved?.operationId === this.pendingOperation) this.revision = state.saved.revision
          else throw Error('REVISION_CONFLICT')
        }
        if (!this.images) {
          const images = await Promise.all(resources.map(async entry => {
            const response = await this.request(prefix + 'assets/' + entry.key, { credentials: 'same-origin', redirect: 'error', signal })
            if (!response.ok || !response.body) throw Error('ASSET_UNAVAILABLE')
            const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
            try {
              for (;;) { const row = await reader.read(); if (row.done) break; size += row.value.length
                if (size > entry.bytes) throw Error('ASSET_LIMIT'); chunks.push(row.value) }
            } finally { await reader.cancel(); reader.releaseLock() }
            const bytes = new Uint8Array(size); let offset = 0
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('')
            if (size !== entry.bytes || hash !== entry.sha256) throw Error('ASSET_HASH_MISMATCH')
            return [entry.key, bytes.buffer] as const
          }))
          if (!current()) return
          this.images = Object.fromEntries(images)
        }
        if (!this.controller) {
          this.controller = new WorldController(state.saved ? validateWorld(state.saved.world, scene) : createWorld(scene), scene, () => this.save())
          if (this.controller.world.userPaused) this.reasons.add('user'); else this.reasons.delete('user')
          for (const reason of this.reasons) this.controller.pause(reason, true)
          this.revision = state.saved?.revision ?? 0
        }
        this.pendingOperation = null; this.error = ''; this.ready = true
        this.pause('disconnected', false); this.pause('ownership', false)
        if (!state.saved) this.save()
      } catch (e) { if (current()) this.fail(e) }
    })()
    this.loading = work
    await work
    if (this.loading === work) this.loading = null
  }
  setFrameReady(value: boolean) { this.frameReady = value; if (!value) this.controller?.cancelDrag(); this.schedule(); this.emit() }
  pointer(intent: PointerIntent) {
    if (!this.frameReady || !this.ready) return
    const active = this.controller?.drag?.active
    this.controller?.pointer(intent)
    if (!active && this.controller?.drag?.active) this.dragTime = 0
    this.emit()
  }
  cancelDrag() { this.controller?.cancelDrag(); this.emit() }
  selectCharacter(id: unknown) {
    if (!this.ready || this.error || this.recovering) return
    this.controller?.selectCharacter(id)
    this.emit()
  }
  setCharacterPresent(id: unknown, present: boolean) {
    if (!this.ready || this.error || this.recovering) return
    this.controller?.setCharacterPresent(id, present); this.emit()
  }
  setAllCharacters(present: boolean) {
    if (!this.ready || this.error || this.recovering) return
    for (const id of characterIds) if (present || id !== this.controller?.world.actor.id) this.controller?.setCharacterPresent(id, present)
    this.emit()
  }
  view() {
    const c = this.controller
    return c ? { world: c.world, position: c.drag?.active ? c.drag.position : c.world.actor.position,
      dragging: c.drag?.active ?? false, dragTime: this.dragTime, paused: !!c.pauseReasons.size, debug: false } : null
  }
  bundle() { return { character, animations, roster, scene, images: Object.fromEntries(Object.entries(this.images ?? {}).map(([k, v]) => [k, v.slice(0)])) } }
  private schedule() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0
    if (this.ready && this.frameReady && this.controller && !this.controller.pauseReasons.size) this.raf = requestAnimationFrame(this.tick)
  }
  private tick = (now: number) => {
    this.raf = 0
    if (!this.ready || !this.frameReady || !this.controller || this.controller.pauseReasons.size) return
    const dt = this.last ? Math.min((now - this.last) / 1000, .1) : 0
    if (!this.last || dt >= 1 / 30) {
      this.controller.advance(dt); if (this.controller.drag?.active) this.dragTime += dt
      this.last = now; this.emit()
      if (this.controller.world.ticks - this.checkpoint >= 300) { this.checkpoint = this.controller.world.ticks; this.save() }
    }
    this.raf = requestAnimationFrame(this.tick)
  }
  save(): void {
    if (!this.controller || !this.ready || this.error || this.recovering || this.lifetime.signal.aborted) return
    this.dirty = true
    if (this.saving) return
    const generation = this.generation
    this.saving = (async () => {
      while (this.dirty && this.controller && generation === this.generation) {
        this.dirty = false
        const operationId = crypto.randomUUID(), world = this.controller.snapshot()
        this.pendingOperation = operationId
        let saved: Saved
        try { saved = await this.api<Saved>('save', { ...this.credentials(), expectedRevision: this.revision, operationId, world }) }
        catch (e) {
          if (generation !== this.generation) return
          const observed = await this.api<State>('state').catch(() => null)
          if (observed?.profileId !== this.profileId || observed.saved?.operationId !== operationId) throw e
          saved = observed.saved
        }
        if (generation !== this.generation) return
        this.revision = saved.revision; this.pendingOperation = null; this.emit()
      }
    })().catch(e => { if (generation === this.generation) this.fail(e) }).finally(() => { this.saving = null })
  }
  async flush() { this.save(); await this.saving }
  leavePage() {
    this.pause('closed', true)
    if (this.lease) void this.request(prefix + 'release', { method: 'POST', credentials: 'same-origin', redirect: 'error', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.credentials()) }).catch(() => {})
  }
  retry() { this.setConnection(this.connected, true) }
  async recover() {
    if (!this.lease || !this.connected || this.recovering) return
    this.recovering = true
    const generation = this.generation
    this.pause('ownership', true)
    try {
      await this.saving; this.dirty = false
      const saved = await this.api<Saved>('recover', this.credentials())
      if (generation !== this.generation) return
      this.controller = new WorldController(validateWorld(saved.world, scene), scene, () => this.save())
      if (saved.world.userPaused) this.reasons.add('user'); else this.reasons.delete('user')
      this.revision = saved.revision; this.pendingOperation = null; this.error = ''
      for (const reason of this.reasons) this.controller.pause(reason, true)
      if (!this.images) { this.retry(); return }
      this.pause('ownership', false); this.pause('disconnected', false); this.ready = true; this.emit()
    } catch (e) { if (generation === this.generation) this.fail(e) }
    finally { this.recovering = false }
  }
  async dispose() {
    if (this.lifetime.signal.aborted) return
    this.pause('closed', true); this.frameReady = false
    clearInterval(this.heartbeat)
    await this.saving
    this.lifetime.abort(); this.attempt.abort(); await this.loading
    if (this.lease) await this.api('release', this.credentials(), AbortSignal.timeout(2000)).catch(() => {})
    this.ready = false; this.images = undefined; this.listeners.clear()
  }
}

import { tableCellAt } from '../core/table-geometry.ts'
import { arrangementObjects } from '../core/arrangement.ts'
import { EntranceCoordinator } from './entrance-state.ts'
import { canRecover, recoveryCode, recoveryDelays } from './recovery-policy.ts'
import { DiagnosticTrace } from './diagnostic-trace.ts'
import type { UIInput } from '../core/frame-protocol.ts'
import { initialPresentation, presentationReducer, type UIAction } from './ui-state.ts'
import { defaultCamera, validCamera, type Camera } from '../core/camera.ts'
import { deriveNotices, type Notice } from '../core/notifications.ts'
import { AlbumClient } from './album-client.ts'
import { residentAssets } from './asset-selection.ts'
import { actors } from '../core/world.ts'
import { LivingController as ContentController } from '../core/living-controller.ts'
import { inviteTea, cancelTea, settleTea, placeBell, startNeighborhoodEvent, changeLayout, decorateExtra } from '../core/living-engine.ts'
import type { CharacterId } from '../core/roster.ts'
import { createLivingWorld as createContentWorld, validateLivingWorld as validateContentWorld, migrateLivingWorld, homeProjection, type LivingWorld as ContentWorld } from '../core/living-state.ts'
import { homeTemplates, type Home } from '../core/home-state.ts'
import { arrangeHome, setTableMode as chooseTableMode, startPlay as beginPlay, playAction as actPlay, cancelPlay as stopPlay, placePlayDecoration as putPlayDecoration, whalePlace, whalePoint } from '../core/living-engine.ts'
import type { LayoutId, ExtraDecoration } from '../core/neighborhood-catalog.ts'
import type { Food, BellSlot } from '../core/content-state.ts'
import { characterIds } from '../core/roster.ts'
import { scene, resources, character, animations, roster } from '../definitions.ts'
import type { PauseReason, PointerIntent } from '../core/controller.ts'
import type { Saved } from '../host/save-store.ts'
import { readJsonResponse } from './json-response.ts'
import { SaveTransaction, type SaveReceipt } from './save-transaction.ts'
import { defaultPreferences, decodePreferences, validatePreferences, type Preferences } from '../core/preferences.ts'
const prefix = '/api/nidofy-ai-village/'
interface State { profileId: string; epoch: string; saved: Saved<ContentWorld> | null; retention?: { diagnostic?: string } }
export type Request = (path: string, init?: RequestInit) => Promise<Response>
/** One instance per plugin lifetime, deliberately independent of session selection and React mounts. */
export class VillageRuntime {
  readonly entrance = new EntranceCoordinator()
  private bootSettled = false
  get canRevealEntrance() {
    return this.foreground() && this.ready && this.frameReady && this.entrance.metadata && this.entrance.verified === 1 && this.entrance.decoded === 1 && this.entrance.firstFrame && this.bootSettled && !!this.lease && !this.error && !this.recovering && !this.criticalCandidate && !this.transaction.pending && !this.preferenceTransaction.pending
  }
  beginEntranceFrame(token: string) { this.entrance.bindFrame(token); this.schedule() }
  expectEntranceFrame(token: string, assets: number, view: number) { this.entrance.expectFrame(token, assets, view) }
  entranceFrame(token: string, attempt: string, assets: number, view: number) {
    if (this.entrance.acknowledge(token, attempt, assets, view)) this.emit()
  }
  entranceDecode(token: string, attempt: string, assets: number, progress: number) {
    if (this.entrance.decode(token, attempt, assets, progress)) this.emit()
  }
  skipEntrance() { this.entrance.skip(); this.emit() }
  finishEntrance() { if (this.entrance.finish(this.canRevealEntrance)) { this.schedule(); this.emit() } }
  private dismissedPointer: number | null = null
  softwareRendering = false
  readonly diagnostics = new DiagnosticTrace()
  recoveryState: 'idle' | 'waiting' | 'checking' | 'blocked' = 'idle'
  errorCode = ''
  private recoveryCount = 0
  private recoveryTimer: ReturnType<typeof setTimeout> | undefined
  private recoveryAttempt: AbortController | null = null
  private trace() { this.diagnostics.record({ reasons: [...this.reasons], code: this.errorCode, connected: this.connected, frameReady: this.frameReady, receipt: this.saveReceipt.status, ticks: this.controller?.world.ticks ?? 0 }) }
  private foreground() { return this.open && this.connected && !this.disposing && !this.recovering && !['closed','hidden','sidebar','other-panel','insufficient-space'].some(reason => this.reasons.has(reason as PauseReason)) }
  private cancelRecovery() { clearTimeout(this.recoveryTimer); this.recoveryTimer = undefined; this.recoveryAttempt?.abort(); this.recoveryAttempt = null }
  private queueRecovery() {
    if (!this.foreground() || !canRecover(this.errorCode) || this.recoveryTimer || this.recoveryAttempt || this.recoveryCount >= recoveryDelays.length) return
    this.recoveryState = 'waiting'
    this.recoveryTimer = setTimeout(() => { this.recoveryTimer = undefined; void this.checkRecovery() }, recoveryDelays[this.recoveryCount])
  }
  /** Same-authority read-only reconciliation. Never reacquire, replay writes or reset drafts. */
  async checkRecovery() {
    if (!this.foreground() || !canRecover(this.errorCode) || this.recoveryAttempt) return
    clearTimeout(this.recoveryTimer); this.recoveryTimer = undefined
    const attempt = new AbortController(), generation = this.generation, code = this.errorCode
    this.recoveryAttempt = attempt; this.recoveryCount++; this.recoveryState = 'checking'; this.emit()
    const current = () => !attempt.signal.aborted && generation === this.generation && this.errorCode === code && this.foreground()
    const signal = AbortSignal.any([attempt.signal, this.attempt.signal])
    try {
      await this.saving; await this.preferenceSaving
      if (!current()) return
      await this.api('heartbeat', this.credentials(), signal)
      const state = await this.api<State>('state', undefined, signal)
      const prefs = await this.api<{ profileId: string; epoch: string; saved: Saved<Preferences> | null }>('preferences-state', undefined, signal)
      if (!current()) return
      if (state.profileId !== this.profileId || prefs.profileId !== this.profileId) throw Error('PROFILE_CHANGED')
      if (state.epoch !== this.epoch || prefs.epoch !== this.epoch) throw Error('HOST_CHANGED')
      // Validate all observations before publishing any reconciliation.
      if (state.saved) migrateLivingWorld(state.saved.world, scene)
      if (prefs.saved) decodePreferences(prefs.saved.world)
      if (!this.transaction.pending && (state.saved?.revision ?? 0) !== this.revision) throw Error('REVISION_CONFLICT')
      if (!this.preferenceTransaction.pending && (prefs.saved?.revision ?? 0) !== this.preferenceRevision) throw Error('PREFERENCES_CONFLICT')
      if (this.transaction.pending) {
        const receipt = this.transaction.reconcile(state)
        if (receipt.status !== 'committed') throw Error('SAVE_UNCONFIRMED')
        this.revision = receipt.revision
        if (this.criticalCandidate && this.controller && state.saved) {
          this.controller.world = migrateLivingWorld(state.saved.world, scene); this.controller.syncScene()
          if (this.controller.world.userPaused) { this.reasons.add('user'); this.controller.pauseReasons.add('user') }
          else { this.reasons.delete('user'); this.controller.pauseReasons.delete('user') }
          this.criticalCandidate = null; this.pause('commit-pending', false)
        }
        if (state.saved) this.confirmed(state.saved.world)
      }
      if (this.preferenceTransaction.pending) {
        if (this.preferenceTransaction.reconcile(prefs).status !== 'committed') throw Error('PREFERENCES_UNCONFIRMED')
        this.preferences = decodePreferences(prefs.saved!.world); this.preferenceRevision = prefs.saved!.revision
      }
      this.revalidateHome()
      this.error = ''; this.errorCode = ''; this.recoveryState = 'idle'; this.recoveryCount = 0
      this.bootSettled = this.ready && !this.transaction.pending && !this.preferenceTransaction.pending
      this.pause('disconnected', false) // schedule still requires frameReady and every other reason cleared
    } catch (error) {
      if (current()) { const next = recoveryCode(error, 'heartbeat'); if (!canRecover(next)) { this.errorCode = next; this.error = String(error) }; this.recoveryState = 'blocked'; this.trace() }
    } finally {
      if (this.recoveryAttempt === attempt) { this.recoveryAttempt = null; this.queueRecovery(); this.emit() }
    }
  }
  setSoftwareRendering(value: boolean) { this.softwareRendering = value; this.emit() }
  presentation = initialPresentation()
  notices: Notice[] = []
  present(action: UIAction) { this.presentation = presentationReducer(this.presentation, action); this.emit() }
  input(input: UIInput) {
    if (this.entrance.blocking) return
    if (!this.ready || !this.frameReady || this.error || this.criticalCandidate || this.transaction.pending || this.photoMode) return
    if (input.kind === 'table-move') { const w=this.controller?.world; if(w && tableCellAt(w.home,input.point)===input.cell) void this.playAction('move',String(input.cell),input.token); return }
    if (input.kind === 'play-find') { const w=this.controller?.world, target=w&&whalePoint(w,scene); if(w?.play.active && target && Math.hypot(input.point.x-target.x,input.point.y-target.y)<=18) void this.playAction('find',whalePlace(w.play.active),input.token); return }
    if (input.kind === 'camera') { if(this.presentation.drawer==='closed'&&!this.presentation.overlay)this.setCamera(input.camera); return }
    if (input.kind === 'resident') { if(!this.arranging&&(this.presentation.drawer!=='closed'||this.presentation.overlay)){this.sceneClick();return}; if (!this.arranging && this.controller && actors(this.controller.world).some(a => a.id === input.id)) { this.selectCharacter(input.id); this.sceneClick(true) }; return }
    if (input.kind === 'scene') { if (!this.arranging) this.sceneClick(); return }
    if (!this.arranging) return
    if (this.homeDraft && ['work', 'eat', 'bench', 'corner'].includes(input.id)) {
      const id = input.id as typeof this.presentation.selectedFurniture
      if (input.phase === 'down') this.present({ type: 'patch', patch: { selectedFurniture: id } })
      if (input.phase === 'up' && (input.index === 0 || input.index === 1)) this.updateHome({ ...this.homeDraft.home, positions: { ...this.homeDraft.home.positions, [id]: input.index } })
    } else if (input.phase === 'up' && input.index !== undefined) {
      const slot = (['window', 'door', 'wall'] as const)[input.index]
      if (!slot) return
      if (input.id === 'windChime' && this.decorationDraft !== undefined) this.previewDecoration(slot)
      if (this.extraDecorationDraft?.id === input.id) this.previewExtraDecoration({ ...this.extraDecorationDraft, slot })
    }
  }
  setCamera(camera: Camera) { if (validCamera(camera) && !this.arranging && !this.photoMode && !this.controller?.drag && !this.error) this.present({ type: 'patch', patch: { camera, zoomHint: Date.now() } }) }
  resetCamera() { this.setCamera({ ...defaultCamera }) }
  sceneClick(resident = false) { this.present({ type: 'close' }); if (resident) this.present({ type: 'overlay', overlay: 'resident' }) }
  private confirmed(world: ContentWorld) {
    const previous = new Set(this.notices.map(n => n.id)), next = deriveNotices(world)
    if (this.preferences.noticesInitialized) this.presentation.toastIds = [...new Set([...this.presentation.toastIds, ...next.filter(n => !previous.has(n.id) && !this.preferences.noticeReadIds.includes(n.id)).map(n => n.id)])].slice(-16)
    this.notices = next
  }
  async markNoticesRead(ids: string[]) {
    await this.setPreferences({ noticeReadIds: [...new Set([...this.preferences.noticeReadIds, ...ids.filter(id => this.notices.some(n => n.id === id))])].slice(-64) })
  }
  get arrangementDirty() { const w = this.controller?.world; return !!w && (this.homeDraft ? JSON.stringify(this.homeDraft) !== JSON.stringify({ home: w.home, layout: w.neighborhood.layout }) : this.decorationDraft !== undefined ? this.decorationDraft !== (w.decorations.windChime?.slot ?? null) : this.extraDecorationDraft ? this.extraDecorationDraft.slot !== w.neighborhood.decorations[this.extraDecorationDraft.id] : false) }
  controller: ContentController | undefined
  readonly clientId = crypto.randomUUID()
  readonly reasons = new Set<PauseReason>(['closed', 'disconnected'])
  open = false; connected = false; ready = false; frameReady = false; error = ''; revision = 0; dragTime = 0
  profileId = ''; epoch = ''; lease = ''; generation = 0
  retentionWarning = false
  preferences: Preferences = { ...defaultPreferences }
  locale: 'zh' | 'en' = 'zh'
  decorationDraft: BellSlot | null | undefined
  extraDecorationDraft: { id: ExtraDecoration; slot: BellSlot | null } | null = null
  private preferenceRevision = 0
  private preferenceSaving: Promise<void> | null = null
  private readonly preferenceTransaction = new SaveTransaction(validatePreferences)
  images: Record<string, ArrayBuffer> | undefined
  private version = 0
  private uiVersion = 0
  private uiTick = 0
  private uiListeners = new Set<() => void>()
  private listeners = new Set<() => void>()
  private lifetime = new AbortController()
  private attempt = new AbortController()
  private loading: Promise<void> | null = null
  private saving: Promise<void> | null = null
  private readonly transaction = new SaveTransaction(value => validateContentWorld(value, scene))
  private criticalCandidate: ContentWorld | null = null
  private changingDraft = false
  actionError = ''
  private disposing = false
  private dirty = false; private raf = 0; private last = 0; private checkpoint = 0
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private recovering = false
  readonly album: AlbumClient
  photoMode = false
  homeDraft: { home: Home; layout: LayoutId } | null = null
  homeDraftError = ''
  homeSaving = false
  private homeHistory: { home: Home; layout: LayoutId }[] = []
  private homePreview: ContentWorld | null = null
  get arranging() { return !!this.homeDraft || this.decorationDraft !== undefined || !!this.extraDecorationDraft }
  private syncArrangementPause() { this.pause('arrange', this.arranging) }
  cancelArrangements() {
    if (this.homeSaving || this.criticalCandidate || this.transaction.pending) return
    this.decorationDraft = undefined; this.extraDecorationDraft = null; this.cancelHome()
  }
  get canUndoHome() { return this.homeHistory.length > 0 }
  beginHome() {
    const world = this.controller?.world
    if (!world || this.arranging || !this.ready || this.error || this.criticalCandidate || this.photoMode || world.activeEvent || world.neighborhood.event || world.play.active) return
    this.cancelArrangements()
    this.homeDraft = { home: structuredClone(world.home), layout: world.neighborhood.layout }
    this.homeHistory = []; this.homeDraftError = ''; this.homePreview = null; this.pause('arrange', true)
  }
  updateHome(home: Home, layout = this.homeDraft?.layout) {
    if (!this.homeDraft || !layout || !this.controller || this.homeSaving) return
    if (JSON.stringify(this.homeDraft) === JSON.stringify({ home, layout })) return
    try {
      const preview = arrangeHome(this.controller.world, scene, home, layout, this.homeDraft.home.revision)
      this.homeHistory.push(structuredClone(this.homeDraft)); if (this.homeHistory.length > 20) this.homeHistory.shift()
      this.homeDraft = { home: structuredClone(home), layout }; this.homePreview = preview; this.homeDraftError = ''
    } catch (e) { this.homeDraftError = e instanceof Error ? e.message : 'INVALID_LAYOUT' }
    this.emit()
  }
  homeTemplate(layout: LayoutId) { if (this.homeDraft) this.updateHome({ ...this.homeDraft.home, positions: { ...homeTemplates[layout] } }, layout) }
  private revalidateHome() {
    if (!this.homeDraft || !this.controller) return
    try {
      this.homePreview = arrangeHome(this.controller.world, scene, this.homeDraft.home, this.homeDraft.layout, this.homeDraft.home.revision)
      this.homeDraftError = ''
    } catch (e) {
      this.homePreview = null
      this.homeDraftError = e instanceof Error ? e.message : 'INVALID_LAYOUT'
    }
  }
  undoHome() {
    if (this.homeSaving || !this.controller) return
    const previous = this.homeHistory.pop(); if (!previous) return
    this.homeDraft = previous; this.revalidateHome(); this.emit()
  }
  cancelHome() { if (this.criticalCandidate || this.transaction.pending) return; this.homeDraft = null; this.homePreview = null; this.homeHistory = []; this.homeDraftError = ''; this.syncArrangementPause() }
  async confirmHome() {
    if (!this.homeDraft || !this.controller || this.homeSaving) return
    this.homeSaving = true; this.homeDraftError = ''; this.emit()
    try {
      const receipt = await this.commitWorld(arrangeHome(this.controller.world, scene, this.homeDraft.home, this.homeDraft.layout, this.homeDraft.home.revision))
      if (receipt.status === 'committed') this.cancelHome()
      else this.homeDraftError = receipt.status === 'rejected' ? receipt.reason : 'SAVE_UNCONFIRMED'
    } catch (e) { this.homeDraftError = e instanceof Error ? e.message : 'INVALID_LAYOUT' }
    finally { this.homeSaving = false; this.emit() }
  }
  photoOptions = { zoom: 1, x: 0, y: 0, date: true, border: true }
  private captureHandler: (()=>Promise<ArrayBuffer>) | null = null
  constructor(private readonly request: Request = (path, init) => fetch(path, init)) {
    this.album = new AlbumClient(request, () => ({ ...this.credentials(), profileId: this.profileId }), () => this.emit())
  }
  bindCapture(handler: (()=>Promise<ArrayBuffer>) | null) { this.captureHandler = handler }
  async enterPhoto() {
    if (!this.ready || !this.frameReady || this.error || this.criticalCandidate || this.arranging) return
    this.photoMode = true; this.pause('photo', true)
    const receipt = await this.flush()
    if (receipt.status !== 'committed') { this.exitPhoto(); return }
    await this.album.refresh().catch(()=>{this.album.error='PHOTO_UNAVAILABLE';this.emit()})
  }
  exitPhoto() { this.photoMode=false; this.photoOptions={zoom:1,x:0,y:0,date:true,border:true};this.pause('photo',false) }
  setPhotoOptions(patch: Partial<typeof this.photoOptions>) {
    const next={...this.photoOptions,...patch}
    if(!Number.isFinite(next.zoom)||next.zoom<1||next.zoom>1.5||![next.x,next.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=1))return
    this.photoOptions=next;this.emit()
  }
  async capturePhoto() { if(!this.photoMode||!this.captureHandler||!this.frameReady)throw Error('PHOTO_UNAVAILABLE');return this.captureHandler() }

  get saveReceipt(): SaveReceipt { return this.transaction.receipt }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  snapshot = () => this.version
  subscribeUI = (fn: () => void) => { this.uiListeners.add(fn); return () => { this.uiListeners.delete(fn) } }
  snapshotUI = () => this.uiVersion
  private emit(ui = true) {
    this.version++; for (const fn of this.listeners) fn()
    const tick = this.controller?.world.ticks ?? 0
    if (ui || tick - this.uiTick >= 15) { this.uiTick = tick; this.uiVersion++; for (const fn of this.uiListeners) fn() }
  }
  private async api<T>(path: string, data?: object, signal = this.attempt.signal): Promise<T> {
    const response = await this.request(prefix + path, { method: data ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error',
      headers: { 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) })
    return readJsonResponse<T>(response)
  }
  private credentials() { return { lease: this.lease, epoch: this.epoch } }
  private fail(error: unknown, source: 'heartbeat' | 'operation' = 'operation') {
    if (source === 'heartbeat' && this.error) return
    this.cancelRecovery(); this.errorCode = recoveryCode(error, source); this.recoveryCount = 0
    this.error = String(error); this.recoveryState = canRecover(this.errorCode) ? 'waiting' : 'blocked'
    this.pause('disconnected', true); this.trace(); this.queueRecovery(); this.emit()
  }
  pause(reason: PauseReason, active: boolean) {
    if (reason === 'user' && this.criticalCandidate) return
    if (!active && this.reasons.has(reason) && ['sidebar', 'hidden', 'other-panel'].includes(reason)) this.revalidateHome()
    if (active && !this.reasons.has(reason) && ['closed','hidden','sidebar','other-panel','insufficient-space'].includes(reason)) this.entrance.suspend()
    if (active) this.reasons.add(reason); else this.reasons.delete(reason)
    if (this.controller?.pauseReasons.has(reason) !== active) this.controller?.pause(reason, active)
    if (!this.foreground()) this.cancelRecovery(); else this.queueRecovery()
    this.trace(); this.schedule(); this.emit()
  }
  show() {
    if (!this.open) this.entrance.open()
    this.open = true; this.pause('closed', false); this.pause('other-panel', false)
    if (this.connected && !this.ready) void this.connect()
  }
  hide(other = false) {
    if (!other && (this.criticalCandidate || this.transaction.pending)) return
    if (this.arranging && !other && this.arrangementDirty) { this.present({ type: 'patch', patch: { confirmClose: true } }); return }
    if (this.arranging && !other) this.cancelArrangements()
    if (!other) this.present({ type: 'close' })
    if (this.photoMode) this.exitPhoto()
    this.open = false; this.pause(other ? 'other-panel' : 'closed', true)
    this.setFrameReady(false)
  }
  setConnection(connected: boolean, reset = false) {
    if (!reset && connected === this.connected) return
    this.cancelRecovery()
    this.entrance.beginBoot(); this.bootSettled = false
    if (this.arranging) this.cancelArrangements()
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
          void this.api<{ retention?: { diagnostic?: string } }>('heartbeat', this.credentials()).then(value => {
            if (current() && this.retentionWarning !== !!value.retention?.diagnostic) { this.retentionWarning = !!value.retention?.diagnostic; this.emit() }
          }).catch(e => { if (current()) this.fail(e, 'heartbeat') })
        }, 4000)
        const state = await this.api<State>('state', undefined, signal)
        if (!current()) return
        if (owner.profileId !== state.profileId || owner.epoch !== state.epoch) throw Error('HOST_CHANGED')
        this.retentionWarning = !!state.retention?.diagnostic
        await this.preferenceSaving
        const preferences = await this.api<{ profileId: string; epoch: string; saved: Saved<Preferences> | null }>('preferences-state', undefined, signal)
          .catch(() => { throw Error('PREFERENCES_UNAVAILABLE') })
        if (!current()) return
        if (preferences.profileId !== owner.profileId || preferences.epoch !== owner.epoch) throw Error('HOST_CHANGED')
        if (this.preferenceTransaction.pending) {
          const result = this.preferenceTransaction.reconcile(preferences, owner, true)
          if (result.status !== 'committed' && result.status !== 'rejected') throw Error('PREFERENCES_UNCONFIRMED')
        }
        this.preferences = preferences.saved ? decodePreferences(preferences.saved.world) : { ...defaultPreferences }
        this.preferenceRevision = preferences.saved?.revision ?? 0
        if (this.transaction.pending) {
          const result = this.transaction.reconcile(state, owner, true)
          if (result.status !== 'committed') {
            if (result.status === 'rejected') { this.criticalCandidate = null; this.pause('commit-pending', false) }
            throw Error(result.status === 'rejected' ? result.reason : 'SAVE_UNCONFIRMED')
          }
          this.revision = result.revision
        } else if (this.controller && (state.saved?.revision ?? 0) !== this.revision) {
          const receipt = this.saveReceipt
          if (receipt.status === 'committed' && this.transaction.confirms(state)) this.revision = receipt.revision
          else throw Error('REVISION_CONFLICT')
        }
        if (this.criticalCandidate && state.saved && this.saveReceipt.status === 'committed') {
          this.controller!.world = migrateLivingWorld(state.saved.world, scene)
          this.controller!.syncScene()
          if (this.controller!.world.userPaused) { this.reasons.add('user'); this.controller!.pauseReasons.add('user') }
          else { this.reasons.delete('user'); this.controller!.pauseReasons.delete('user') }
          this.criticalCandidate = null; this.pause('commit-pending', false); this.cancelArrangements(); this.confirmed(this.controller!.world)
        }
        const initialWorld = state.saved ? migrateLivingWorld(state.saved.world, scene) : createContentWorld(scene)
        this.entrance.metadata = true; this.emit()
        await this.ensureAssets(initialWorld, signal)
        if (!current()) return
        if (!this.controller) {
          this.controller = new ContentController(state.saved ? migrateLivingWorld(state.saved.world, scene) : createContentWorld(scene), scene, () => { if (!this.changingDraft) this.save() })
          if (this.controller.world.userPaused) this.reasons.add('user'); else this.reasons.delete('user')
          for (const reason of this.reasons) this.controller.pause(reason, true)
          this.revision = state.saved?.revision ?? 0
        }
        this.trimAssets()
        if (state.saved) { this.notices = deriveNotices(migrateLivingWorld(state.saved.world, scene)) }
        this.error = ''; this.errorCode = ''; this.recoveryState = 'idle'; this.ready = true
        this.pause('disconnected', false); this.pause('ownership', false)
        if (!this.preferences.noticesInitialized) await this.setPreferences({ noticeReadIds: this.notices.map(n => n.id), noticesInitialized: true })
        if (!state.saved) { this.save(); await this.saving }
        if (current()) { this.bootSettled = !this.error && !this.transaction.pending && !this.preferenceTransaction.pending; this.emit() }
      } catch (e) { if (current()) this.fail(e) }
    })()
    this.loading = work
    await work
    if (this.loading === work) this.loading = null
  }
  setFrameReady(value: boolean) { this.frameReady = value; if (!value) { this.entrance.firstFrame = false; this.entrance.blocking = true; this.dismissedPointer=null; this.controller?.cancelDrag() }; this.trace(); this.schedule(); this.emit() }
  pointer(intent: PointerIntent) {
    if (this.entrance.blocking) return
    if (!this.frameReady || !this.ready || this.criticalCandidate || this.error) return
    // Parent presentation is authoritative even before the iframe receives its next render.
    if(this.dismissedPointer===intent.id){if(intent.type==='up'||intent.type==='cancel')this.dismissedPointer=null;return}
    if(!this.arranging&&(this.presentation.drawer!=='closed'||this.presentation.overlay)){this.controller?.cancelDrag();if(intent.type==='down')this.dismissedPointer=intent.id;if(intent.type==='down'||intent.type==='up')this.sceneClick();return}
    const active = this.controller?.drag?.active
    const before = intent.type === 'up' ? this.controller?.snapshot() : undefined
    this.changingDraft = intent.type === 'up'
    try { this.controller?.pointer(intent) } finally { this.changingDraft = false }
    if (before && this.controller && ['accepted', 'selected'].includes(this.controller.lastPlacement ?? '') && JSON.stringify(before) !== JSON.stringify(this.controller.world)) {
      const candidate = this.controller.snapshot(); this.controller.world = before
      void this.commitWorld(candidate)
    }
    if (intent.type === 'up' && this.controller?.lastPlacement === 'selected') this.sceneClick(true)
    if (!active && this.controller?.drag?.active) this.dragTime = 0
    this.emit()
  }
  cancelDrag() { this.controller?.cancelDrag(); this.emit() }
  selectCharacter(id: unknown) {
    if (!this.ready || this.error || this.recovering || this.criticalCandidate || this.arranging) return
    if (this.controller && !actors(this.controller.world).some(a=>a.id===id)) this.changeMembers(c=>c.selectCharacter(id))
    else this.controller?.selectCharacter(id)
    this.emit()
  }
  setCharacterPresent(id: unknown, present: boolean) {
    if (!this.ready || this.error || this.recovering || this.criticalCandidate || this.arranging) return
    this.changeMembers(c => c.setCharacterPresent(id, present))
  }
  setAllCharacters(present: boolean) {
    if (!this.ready || this.error || this.recovering || this.criticalCandidate || this.arranging) return
    this.changeMembers(c => { for (const id of characterIds) if (present || id !== c.world.actor.id) c.setCharacterPresent(id, present) })
  }
  private changeMembers(change: (controller: ContentController) => void) {
    if (!this.controller) return
    const draft = new ContentController(this.controller.snapshot(), scene, () => {})
    change(draft)
    void this.commitWorld(draft.snapshot())
  }
  async invite(pair: [CharacterId, CharacterId], food: Food) {
    if (this.arranging) return
    this.actionError = ''
    try { if (this.controller) await this.commitWorld(inviteTea(this.controller.world, scene, pair, food, crypto.randomUUID())) }
    catch (error) { this.actionError = error instanceof Error ? error.message : 'INVITATION_FAILED' }
    this.emit()
  }
  async cancelEvent() {
    if (!this.controller) return
    const candidate = this.controller.snapshot(); cancelTea(candidate)
    await this.commitWorld(candidate)
  }
  async decorate(slot: BellSlot | null) {
    if (this.controller) return this.commitWorld(placeBell(this.controller.world, scene, slot))
  }
  async interact(definition: string, participants: CharacterId[]) {
    if (this.arranging) return
    await this.neighborhoodCommand(() => startNeighborhoodEvent(this.controller!.world, scene, definition, participants, crypto.randomUUID()))
  }
  async setTableMode(mode: 'dining' | 'game') {
    if (this.arranging || this.photoMode) return
    await this.neighborhoodCommand(() => chooseTableMode(this.controller!.world,scene,mode))
  }
  async startPlay(id: string, participants: CharacterId[]) {
    if (this.arranging || this.photoMode) return
    await this.neighborhoodCommand(() => beginPlay(this.controller!.world, scene, id, participants, crypto.randomUUID()))
  }
  async playAction(action: string, value?: string, token?: string) {
    if (this.arranging || this.photoMode || this.controller?.pauseReasons.size) return
    await this.neighborhoodCommand(() => actPlay(this.controller!.world, scene, action, value, token))
  }
  async cancelPlay() {
    await this.neighborhoodCommand(() => { const world=this.controller!.snapshot(); stopPlay(world); return world })
  }
  async placePlayDecoration(id: string, slot: BellSlot | null) {
    await this.neighborhoodCommand(() => putPlayDecoration(this.controller!.world, scene, id, slot))
  }
  async chooseLayout(layout: LayoutId) { if (!this.arranging) await this.neighborhoodCommand(() => changeLayout(this.controller!.world, scene, layout)) }
  async decorateExtra(id: ExtraDecoration, slot: BellSlot | null) { await this.neighborhoodCommand(() => decorateExtra(this.controller!.world, scene, id, slot)) }
  private async neighborhoodCommand(candidate: () => ContentWorld) {
    if (!this.controller) return
    this.actionError = ''
    try { const receipt = await this.commitWorld(candidate()); if (receipt.status === 'rejected') this.actionError = receipt.reason; else if (receipt.status === 'unknown') this.actionError = 'SAVE_UNCONFIRMED' }
    catch (e) { this.actionError = e instanceof Error ? e.message : 'INTERACTION_FAILED' }
    this.emit()
  }
  previewExtraDecoration(value: typeof this.extraDecorationDraft) {
    if (value) {
      if (!this.ready || !this.controller || this.error || this.criticalCandidate || this.photoMode) return
      try { decorateExtra(this.controller.world, scene, value.id, value.slot) } catch { return }
      if (this.homeDraft || this.decorationDraft !== undefined || (this.extraDecorationDraft && this.extraDecorationDraft.id !== value.id) || this.controller.world.activeEvent || this.controller.world.neighborhood.event || this.controller.world.play.active) return
    }
    this.extraDecorationDraft = value; this.syncArrangementPause()
  }
  previewDecoration(slot: BellSlot | null | undefined) {
    if (slot !== undefined) {
      if (!this.ready || !this.controller || this.error || this.criticalCandidate || this.photoMode) return
      try { placeBell(this.controller.world, scene, slot) } catch { return }
      if (this.homeDraft || this.extraDecorationDraft || this.controller.world.activeEvent || this.controller.world.neighborhood.event || this.controller.world.play.active) return
    }
    this.decorationDraft = slot; this.syncArrangementPause()
  }
  setLocale(locale: 'zh' | 'en') { if (this.locale !== locale) { this.locale = locale; this.emit(false) } }
  get preferencesSaving(): boolean { return !!this.preferenceSaving }
  async setPreferences(patch: Partial<Omit<Preferences, 'schemaVersion'>>): Promise<void> {
    while (this.preferenceSaving) await this.preferenceSaving
    if (!this.ready || this.error || this.preferenceTransaction.pending || this.disposing) return
    if (patch.noticeReadIds) patch = { ...patch, noticeReadIds: [...new Set([...this.preferences.noticeReadIds, ...patch.noticeReadIds])].slice(-64) }
    const candidate = validatePreferences({ ...this.preferences, ...patch }), generation = this.generation, signal = this.attempt.signal
    const work = (async () => {
      const result = await this.preferenceTransaction.submit({ ...this.credentials(), profileId: this.profileId,
        expectedRevision: this.preferenceRevision, operationId: crypto.randomUUID(), world: candidate }, {
        write: data => this.api('preferences-save', data, signal), read: () => this.api('preferences-state', undefined, signal),
      })
      if (generation !== this.generation) return
      if (result.status === 'committed') { this.preferences = candidate; this.preferenceRevision = result.revision }
      else this.fail(Error('PREFERENCES_UNCONFIRMED'))
    })().catch(e => { if (generation === this.generation) this.fail(e) }).finally(() => { this.preferenceSaving = null; this.emit() })
    this.preferenceSaving = work; this.emit(); await work
  }
  view() {
    const c = this.controller
    return c ? { arrangementObjects: this.homeDraft ? arrangementObjects(scene, homeProjection(c.world), this.homeDraft) : this.arranging ? [{ id: this.extraDecorationDraft?.id ?? 'windChime', rect: { x: 60, y: 90, width: 210, height: 65 }, anchors: (this.extraDecorationDraft ? [{x:166,y:101},{x:250,y:115},{x:76,y:104}] : [{x:185,y:105},{x:234,y:130},{x:96,y:117}]).map(a => ({ ...a, legal: true })) }] : [], camera: this.presentation.camera, overlayOpen: this.presentation.overlay !== null || this.presentation.confirmClose, dismissLayer: this.presentation.drawer !== 'closed' || this.presentation.overlay !== null, selectedFurniture: this.presentation.selectedFurniture, world: this.homePreview ?? c.world, arranging: !!this.homeDraft, position: c.drag?.active ? c.drag.position : c.world.actor.position,
      dragging: c.drag?.active ?? false, dragTime: this.dragTime, paused: this.entrance.blocking || !!c.pauseReasons.size, debug: false,
      locale: this.preferences.language === 'system' ? this.locale : this.preferences.language,
      photo: this.photoMode ? this.photoOptions : null, reducedMotion: this.preferences.reducedMotion, bubbles: this.preferences.bubbles, decorationDraft: this.decorationDraft, extraDecorationDraft: this.extraDecorationDraft } : null
  }
  assetRevision = 0
  private assetKeys = ''
  private async ensureAssets(world: ContentWorld, signal = this.attempt.signal) {
    const needed = residentAssets(actors(world).map(a=>a.id))
    const selected = resources.filter(entry => needed.has(entry.key)), total = selected.reduce((n, e) => n + e.bytes, 0)
    // Cached buffers entered this map only after the same length/hash verification.
    let verified = selected.reduce((n, e) => n + (this.images?.[e.key] ? e.bytes : 0), 0)
    const attempt = this.entrance.attemptId
    const progress = () => { if (!signal.aborted && attempt === this.entrance.attemptId) { this.entrance.verified = Math.max(this.entrance.verified, total ? verified / total : 1); this.emit() } }
    progress()
          const images = await Promise.all(resources.filter(entry => needed.has(entry.key) && !this.images?.[entry.key]).map(async entry => {
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
            verified += entry.bytes; progress()
            return [entry.key, bytes.buffer] as const
          }))
    signal.throwIfAborted()
    this.images = { ...this.images, ...Object.fromEntries(images) }
  }
  private trimAssets() {
    if (!this.controller || !this.images) return
    const needed = residentAssets(actors(this.controller.world).map(a=>a.id))
    this.images = Object.fromEntries(Object.entries(this.images).filter(([key])=>needed.has(key)))
    const keys = [...needed].sort().join('|')
    if (keys !== this.assetKeys) { this.assetKeys = keys; this.assetRevision++ }
  }
  bundle() { return { character, animations, roster, scene, images: Object.fromEntries(Object.entries(this.images ?? {}).map(([k, v]) => [k, v.slice(0)])) } }
  private schedule() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0
    if (!this.entrance.blocking && this.ready && this.frameReady && this.controller && !this.controller.pauseReasons.size) this.raf = requestAnimationFrame(this.tick)
  }
  private tick = (now: number) => {
    this.raf = 0
    if (this.entrance.blocking || !this.ready || !this.frameReady || !this.controller || this.controller.pauseReasons.size) return
    const dt = this.last ? Math.min((now - this.last) / 1000, .1) : 0
    if (!this.last || dt >= 1 / 30) {
      this.controller.advance(dt)
      const settlement = settleTea(this.controller.world, scene)
      if (settlement) void this.commitWorld(settlement)
      if (this.controller.drag?.active) this.dragTime += dt
      this.last = now; this.emit(false)
      if (this.controller.world.ticks - this.checkpoint >= 300) { this.checkpoint = this.controller.world.ticks; this.save() }
    }
    this.raf = requestAnimationFrame(this.tick)
  }
  save(): void {
    if (!this.controller || !this.ready || this.error || this.recovering || this.criticalCandidate || (this.transaction.pending && !this.saving) || this.disposing || this.lifetime.signal.aborted) return
    this.dirty = true
    if (this.saving) return
    const generation = this.generation
    const work = (async () => {
      while (this.dirty && this.controller && generation === this.generation) {
        this.dirty = false
        const receipt = await this.persist(this.controller.snapshot(), generation)
        if (receipt.status !== 'committed' || generation !== this.generation) { this.dirty = false; return }
      }
    })().catch(e => { if (generation === this.generation) this.fail(e) }).finally(() => { if (this.saving === work) this.saving = null })
    this.saving = work
  }
  private async persist(world: ContentWorld, generation: number): Promise<SaveReceipt> {
    const signal = this.attempt.signal
    const pending = this.transaction.submit({ ...this.credentials(), profileId: this.profileId, expectedRevision: this.revision, operationId: crypto.randomUUID(), world }, {
      write: data => this.api('save', data, signal), read: () => this.api<State>('state', undefined, signal),
    })
    this.emit()
    const receipt = await pending
    if (generation === this.generation) {
      if (receipt.status === 'committed') { this.revision = receipt.revision; this.confirmed(world) }
      else this.fail(Error(receipt.status === 'rejected' ? receipt.reason : 'SAVE_UNCONFIRMED'))
      this.emit()
    }
    return receipt
  }
  async flush(): Promise<SaveReceipt> {
    if (!this.saving) this.save()
    while (this.saving) await this.saving
    return this.saveReceipt
  }
  /** Atomic candidate publication for critical actions. The visible world changes only after confirmation. */
  async commitWorld(value: unknown): Promise<SaveReceipt> {
    if (!this.controller || !this.ready || this.error || this.recovering || this.criticalCandidate || (this.transaction.pending && !this.saving) || this.disposing)
      return { status: 'rejected', operationId: crypto.randomUUID(), reason: 'NOT_READY' }
    let candidate: ContentWorld
    try { candidate = validateContentWorld(value, scene) }
    catch { return { status: 'rejected', operationId: crypto.randomUUID(), reason: 'INVALID_WORLD' } }
    const previous = this.saving, generation = this.generation
    this.criticalCandidate = candidate; this.pause('commit-pending', true)
    const work = (async () => {
      await previous
      if (generation !== this.generation || this.error || this.disposing) {
        this.criticalCandidate = null; this.pause('commit-pending', false); return
      }
      await this.ensureAssets(candidate)
      if (generation !== this.generation) return
      const receipt = await this.persist(candidate, generation)
      if (generation !== this.generation) return
      if (receipt.status === 'committed') {
        this.controller!.world = candidate; this.controller!.syncScene(); this.trimAssets(); this.criticalCandidate = null
        if (candidate.userPaused) this.reasons.add('user'); else this.reasons.delete('user')
        // Synchronize pause state without creating a redundant checkpoint.
        if (candidate.userPaused) this.controller!.pauseReasons.add('user'); else this.controller!.pauseReasons.delete('user')
        this.pause('commit-pending', false)
      } else if (receipt.status === 'rejected') { this.criticalCandidate = null; this.pause('commit-pending', false) }
    })().catch(e => { if (generation === this.generation) this.fail(e) }).finally(() => { if (this.saving === work) this.saving = null })
    this.saving = work
    await work
    return this.saveReceipt
  }
  leavePage() {
    this.pause('closed', true)
    // Do not fence an in-flight publication. dispose waits; a terminated page's lease expires.
    if (this.lease && !this.saving && !this.preferenceSaving && !this.album.busy) void this.request(prefix + 'release', { method: 'POST', credentials: 'same-origin', redirect: 'error', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.credentials()) }).catch(() => {})
  }
  retry() { this.setConnection(this.connected, true) }
  async recoverPreferences() {
    if (!this.lease || !this.connected || this.recovering) return
    this.recovering = true; this.cancelRecovery()
    try {
      await this.preferenceSaving
      const saved = await this.api<Saved<Preferences>>('preferences-recover', this.credentials())
      this.preferences = validatePreferences(saved.world); this.preferenceRevision = saved.revision
      this.preferenceTransaction.reset(); this.retry()
    } catch { this.fail(Error('PREFERENCES_UNAVAILABLE')) }
    finally { this.recovering = false; this.emit() }
  }
  async recover() {
    if (!this.lease || !this.connected || this.recovering) return
    this.recovering = true; this.cancelRecovery()
    const generation = this.generation
    this.pause('ownership', true)
    this.cancelArrangements()
    try {
      await this.saving; this.dirty = false
      const saved = await this.api<Saved<ContentWorld>>('recover', this.credentials())
      if (generation !== this.generation) return
      this.controller = new ContentController(migrateLivingWorld(saved.world, scene), scene, () => { if (!this.changingDraft) this.save() })
      if (saved.world.userPaused) this.reasons.add('user'); else this.reasons.delete('user')
      this.revision = saved.revision; this.transaction.reset(); this.criticalCandidate = null; this.pause('commit-pending', false); this.error = ''; this.errorCode = ''; this.recoveryState = 'idle'; this.recoveryCount = 0
      for (const reason of this.reasons) this.controller.pause(reason, true)
      await this.ensureAssets(this.controller.world)
      if (generation !== this.generation) return
      this.trimAssets()
      this.entrance.metadata = true; this.bootSettled = true
      this.pause('ownership', false); this.pause('disconnected', false); this.ready = true; this.emit()
    } catch (e) { if (generation === this.generation) this.fail(e) }
    finally { this.recovering = false; this.emit() }
  }
  async dispose() {
    if (this.lifetime.signal.aborted) return
    this.disposing = true
    this.cancelRecovery()
    this.pause('closed', true); this.frameReady = false
    clearInterval(this.heartbeat)
    await this.saving
    await this.preferenceSaving
    await this.album.dispose()
    this.lifetime.abort(); this.attempt.abort(); await this.loading
    if (this.lease) await this.api('release', this.credentials(), AbortSignal.timeout(2000)).catch(() => {})
    this.ready = false; this.images = undefined; this.listeners.clear(); this.uiListeners.clear()
  }
}

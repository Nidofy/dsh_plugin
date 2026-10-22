/** Presentation only. Never persisted into the world or its pause reasons. */
export class EntranceCoordinator {
  attempted = false
  full = false
  skipped = false
  blocking = true
  attemptId = crypto.randomUUID()
  metadata = false
  verified = 0
  decoded = 0
  firstFrame = false
  openedAt = 0
  phase: 'bootstrap' | 'approach' | 'wait' | 'open' | 'cross' | 'reveal' | 'done' = 'bootstrap'
  private frame = ''
  private assets = -1
  private view = 0
  open(now = performance.now()) {
    this.full = !this.attempted; this.attempted = true; this.skipped = false
    this.blocking = true; this.openedAt = now; this.phase = 'bootstrap'
  }
  beginBoot() {
    this.attemptId = crypto.randomUUID(); this.metadata = false; this.verified = 0; this.decoded = 0
    this.firstFrame = false; this.blocking = true; this.phase = 'bootstrap'
    if (this.openedAt) this.full = false
  }
  bindFrame(token: string) {
    this.attemptId = crypto.randomUUID(); this.frame = token; this.assets = -1; this.view = 0
    this.firstFrame = false; this.decoded = 0; this.blocking = true
  }
  expectFrame(token: string, assets: number, view: number) {
    if (token !== this.frame) return
    if (assets !== this.assets) { this.decoded = 0; this.assets = assets }
    this.view = view; this.firstFrame = false
  }
  acknowledge(token: string, attempt: string, assets: number, view: number) {
    if (token !== this.frame || attempt !== this.attemptId || assets !== this.assets || view !== this.view || view < 1) return false
    this.firstFrame = true; this.decoded = 1; return true
  }
  decode(token: string, attempt: string, assets: number, progress: number) {
    if (token !== this.frame || attempt !== this.attemptId || assets !== this.assets || !Number.isFinite(progress) || progress < 0 || progress > 1) return false
    this.decoded = Math.max(this.decoded, progress); return true
  }
  suspend() { this.full = false; this.skipped = true; this.blocking = true; this.firstFrame = false; this.phase = 'wait' }
  skip() { this.skipped = true; this.full = false; this.phase = 'wait' }
  progress(canReveal: boolean) { return .15 * Number(this.metadata) + .6 * this.verified + .2 * this.decoded + .05 * Number(canReveal) }
  finish(canReveal: boolean) { if (!canReveal) return false; this.blocking = false; this.full = false; this.phase = 'done'; return true }
}
export const portraitFill = (progress: number, index: number) => Math.max(0, Math.min(1, 7 * progress - index))

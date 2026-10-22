/** Owns only entrance DOM animations; no world camera, frame scaling or extra render loop. */
export class EntranceMotion {
  private animations = new Set<Animation>()
  private cancelled = false
  async animate(node: Element | null, frames: Keyframe[], duration: number) {
    if (this.cancelled) return false
    if (!node || !node.animate) return true
    const animation = node.animate(frames, { duration, easing: 'ease-in-out', fill: 'forwards' })
    this.animations.add(animation)
    try { await animation.finished; return !this.cancelled }
    catch { return false }
    finally { this.animations.delete(animation); animation.cancel() }
  }
  cancel() { this.cancelled = true; for (const animation of this.animations) animation.cancel(); this.animations.clear() }
}

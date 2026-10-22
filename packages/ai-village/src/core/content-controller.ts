import { WorldController } from './controller.ts'
import { validateContentWorld, type ContentWorld } from './content-state.ts'
import { cancelTea, stepTea } from './content-engine.ts'

export class ContentController extends WorldController<ContentWorld> {
  override advance(seconds: number): void {
    if (!this.world.activeEvent) { super.advance(seconds); return }
    if (this.pauseReasons.size || this.drag || !Number.isFinite(seconds) || seconds < 0) return
    this.accumulator += Math.min(seconds, .1)
    while (this.accumulator >= 1 / 30) { stepTea(this.world, this.scene); this.accumulator -= 1 / 30 }
  }
  protected override placed(): void {
    const event = this.world.activeEvent
    const index = event?.participants.indexOf(this.world.actor.id) ?? -1, intent = this.world.actor.intent
    if (index >= 0 && !(intent?.furnitureId === 'eat' && intent.seat === (index ? 'right' : 'left'))) cancelTea(this.world)
  }
  override setCharacterPresent(id: unknown, present: boolean): void {
    if (!present && this.world.activeEvent?.participants.some(member => member === id)) cancelTea(this.world)
    super.setCharacterPresent(id, present)
  }
  override selectCharacter(id: unknown): void {
    // A selection cannot replace one participant's identity.
    if (this.world.activeEvent && ![this.world.actor, ...this.world.companions].some(a => a.id === id)) return
    super.selectCharacter(id)
  }
  override snapshot(): ContentWorld { return validateContentWorld(this.world, this.scene) }
}

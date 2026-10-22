import { WorldController } from './controller.ts'
import { validateNeighborhoodWorld, neighborhoodScene, type NeighborhoodWorld } from './neighborhood-state.ts'
import { cancelTea, stepNeighborhood } from './neighborhood-engine.ts'
import type { Scene } from './world.ts'
export class NeighborhoodController extends WorldController<NeighborhoodWorld> {
  constructor(world: NeighborhoodWorld, readonly baseScene: Scene, changed: () => void) { super(world, neighborhoodScene(baseScene, world.neighborhood.layout), changed) }
  syncScene() { this.scene = neighborhoodScene(this.baseScene, this.world.neighborhood.layout) }
  override advance(seconds: number): void {
    if (this.pauseReasons.size || this.drag || !Number.isFinite(seconds) || seconds < 0) return
    this.syncScene(); this.accumulator += Math.min(seconds, .1)
    while (this.accumulator >= 1 / 30) { stepNeighborhood(this.world, this.baseScene); this.accumulator -= 1 / 30 }
  }
  protected override placed(): void {
    const e = this.world.neighborhood.event, a = this.world.actor
    if (e?.participants.includes(a.id)) {
      const seat = e.seats[e.participants.indexOf(a.id)]
      if (!seat || a.intent?.furnitureId + '/' + a.intent?.seat !== seat) cancelTea(this.world)
    }
    const tea = this.world.activeEvent, i = tea?.participants.indexOf(a.id) ?? -1
    if (i >= 0 && !(a.intent?.furnitureId === 'eat' && a.intent.seat === (i ? 'right' : 'left'))) cancelTea(this.world)
  }
  override setCharacterPresent(id: unknown, present: boolean): void {
    this.syncScene()
    if (!present && [...this.world.activeEvent?.participants ?? [], ...this.world.neighborhood.event?.participants ?? []].some(a => a === id)) cancelTea(this.world)
    super.setCharacterPresent(id, present)
  }
  override selectCharacter(id: unknown): void {
    if ((this.world.activeEvent || this.world.neighborhood.event) && ![this.world.actor, ...this.world.companions].some(a => a.id === id)) return
    super.selectCharacter(id)
  }
  override snapshot(): NeighborhoodWorld { return validateNeighborhoodWorld(this.world, this.baseScene) }
}

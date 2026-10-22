import { WorldController } from './controller.ts'
import { homeScene, validateHomeWorld, type HomeWorld } from './home-state.ts'
import { cancelTea, stepHome } from './home-engine.ts'
import type { Scene } from './world.ts'
export class HomeController extends WorldController<HomeWorld> {
  constructor(world: HomeWorld, readonly baseScene: Scene, changed: () => void) { super(world, homeScene(baseScene, world.neighborhood.layout, world.home), changed) }
  syncScene() { this.scene = homeScene(this.baseScene, this.world.neighborhood.layout, this.world.home) }
  override advance(seconds: number) {
    if (this.pauseReasons.size || this.drag || !Number.isFinite(seconds) || seconds < 0) return
    this.syncScene(); this.accumulator += Math.min(seconds, .1)
    while (this.accumulator >= 1 / 30) { stepHome(this.world, this.baseScene); this.accumulator -= 1 / 30 }
  }
  protected override placed() {
    const e = this.world.neighborhood.event, a = this.world.actor
    if (e?.participants.includes(a.id)) { const seat = e.seats[e.participants.indexOf(a.id)]; if (!seat || a.intent?.furnitureId + '/' + a.intent?.seat !== seat) cancelTea(this.world) }
    const i = this.world.activeEvent?.participants.indexOf(a.id) ?? -1
    if (i >= 0 && !(a.intent?.furnitureId === 'eat' && a.intent.seat === (i ? 'right' : 'left'))) cancelTea(this.world)
  }
  override setCharacterPresent(id: unknown, present: boolean) {
    this.syncScene()
    if (!present && [...this.world.activeEvent?.participants ?? [], ...this.world.neighborhood.event?.participants ?? []].some(a => a === id)) cancelTea(this.world)
    super.setCharacterPresent(id, present)
  }
  override selectCharacter(id: unknown) {
    if ((this.world.activeEvent || this.world.neighborhood.event) && ![this.world.actor, ...this.world.companions].some(a => a.id === id)) return
    super.selectCharacter(id)
  }
  override snapshot() { return validateHomeWorld(this.world, this.baseScene) }
}

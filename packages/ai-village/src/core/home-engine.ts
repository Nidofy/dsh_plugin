import * as engine from './neighborhood-engine.ts'
import { homeScene, neighborhoodProjection, withHome, arrangeHome, type HomeWorld } from './home-state.ts'
import type { Scene } from './world.ts'
import type { CharacterId } from './roster.ts'
import type { BellSlot, Food } from './content-state.ts'
import type { LayoutId, ExtraDecoration } from './neighborhood-catalog.ts'
const projection = (world: HomeWorld, base: Scene) => [neighborhoodProjection(world), homeScene(base, world.neighborhood.layout, world.home)] as const
export function inviteTea(w: HomeWorld, base: Scene, pair: [CharacterId, CharacterId], food: Food, id: string) { return withHome(engine.inviteTea(...projection(w, base), pair, food, id), w.home) }
export function placeBell(w: HomeWorld, base: Scene, slot: BellSlot | null) { return withHome(engine.placeBell(...projection(w, base), slot), w.home) }
export function decorateExtra(w: HomeWorld, base: Scene, id: ExtraDecoration, slot: BellSlot | null) { return withHome(engine.decorateExtra(...projection(w, base), id, slot), w.home) }
export function startNeighborhoodEvent(w: HomeWorld, base: Scene, definition: string, participants: CharacterId[], id: string) { return withHome(engine.startNeighborhoodEvent(...projection(w, base), definition, participants, id), w.home) }
export function cancelTea(w: HomeWorld) { const projected = neighborhoodProjection(w); engine.cancelTea(projected); Object.assign(w, withHome(projected, w.home)) }
export function stepHome(w: HomeWorld, base: Scene) { const [projected, scene] = projection(w, base); engine.stepNeighborhood(projected, scene); Object.assign(w, withHome(projected, w.home)) }
export function settleTea(w: HomeWorld, base: Scene) { const result = engine.settleTea(...projection(w, base)); return result ? withHome(result, w.home) : null }
export function changeLayout(w: HomeWorld, base: Scene, layout: LayoutId) { return arrangeHome(w, base, w.home, layout, w.home.revision) }

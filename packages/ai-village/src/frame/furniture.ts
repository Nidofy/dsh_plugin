import type { Actor, Rect, Scene } from '../core/world.ts'

export interface FurnitureArt { id: string; asset: string; rect: Rect; split: number }
export interface SeatProp { furnitureId: string; seat: string; asset: string; rect: Rect }
export interface SceneArt extends Scene {
  furniture: FurnitureArt[]
  cushion?: Rect
  seatProps?: SeatProp[]
}

/** Foreground contact layers follow the furniture, including a moved or multi-seat table. */
export function furnitureDepth(scene: SceneArt, furnitureId: string): number | undefined {
  const furniture = scene.furniture.find(item => item.id === furnitureId)
  return furniture ? (furniture.rect.y + furniture.rect.height) * 10 + 10 : undefined
}

export function activityDepth(scene: SceneArt, actor: Actor, fallback: number): number {
  const id = actor.intent?.furnitureId ?? scene.hotspots.find(h =>
    (h.activity ?? h.id) === actor.behavior && Math.hypot(h.anchor.x - actor.position.x, h.anchor.y - actor.position.y) < .01)?.id
  return id ? furnitureDepth(scene, id) ?? fallback : fallback
}

export function seatProps(scene: SceneArt): SeatProp[] {
  // Legacy scene v1 has a single tabletop bowl. Its coordinates and appearance stay unchanged.
  return scene.seatProps ?? [{ furnitureId: 'eat', seat: 'main', asset: 'scene/bowl.png', rect: { x: 277, y: 241, width: 22, height: 17 } }]
}

export function propVisible(prop: SeatProp, residents: Actor[], held?: string): boolean {
  return !residents.some(actor => actor.id !== held && actor.behavior === 'eat'
    && actor.intent?.furnitureId === prop.furnitureId && actor.intent.seat === prop.seat)
}

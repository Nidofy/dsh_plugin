import { actors, available, hitActor, placement, step, validateWorld, walkable } from './world.ts'
import type { Point, Scene, World } from './world.ts'
import { isCharacterId } from './roster.ts'
export type PauseReason = 'user' | 'hidden' | 'closed' | 'disconnected' | 'ownership' | 'sidebar' | 'other-panel' | 'insufficient-space'
export interface PointerIntent { type: 'down' | 'move' | 'up' | 'cancel'; id: number; point: Point; css: Point }
interface Drag { id: number; origin: Point; offset: Point; position: Point; active: boolean }
/** State owner survives iframe disposal. Dragging is a draft, never a saved world state. */
export class WorldController {
  readonly pauseReasons = new Set<PauseReason>()
  drag: Drag | null = null
  accumulator = 0
  lastPlacement: 'accepted' | 'rejected' | 'cancelled' | null = null
  constructor(public world: World, readonly scene: Scene, readonly changed: () => void) {
    if (world.userPaused) this.pauseReasons.add('user')
  }
  pause(reason: PauseReason, active: boolean): void {
    if (active) { this.cancelDrag(); this.pauseReasons.add(reason); this.accumulator = 0 }
    else this.pauseReasons.delete(reason)
    if (reason === 'user') { this.world.userPaused = active; this.changed() }
  }
  advance(seconds: number): void {
    if (this.pauseReasons.size || !Number.isFinite(seconds) || seconds < 0) return
    this.accumulator += Math.min(seconds, .1)
    while (this.accumulator >= 1 / 30) { step(this.world, this.scene, this.drag ? this.world.actor.id : undefined); this.accumulator -= 1 / 30 }
  }
  cancelDrag(): void {
    if (this.drag) this.lastPlacement = 'cancelled'
    this.drag = null
  }
  selectCharacter(id: unknown): void {
    if (!isCharacterId(id) || id === this.world.actor.id) return
    this.cancelDrag()
    const index = this.world.companions.findIndex(a => a.id === id)
    if (index >= 0) {
      const selected = this.world.companions[index]!
      this.world.companions[index] = this.world.actor; this.world.actor = selected
    } else this.world.actor.id = id
    this.changed()
  }
  setCharacterPresent(id: unknown, present: boolean): void {
    if (!isCharacterId(id)) return
    const member = actors(this.world).find(a => a.id === id)
    if (present === !!member || (!present && !this.world.companions.length)) return
    this.cancelDrag()
    if (present) {
      let position: Point | undefined
      // Deterministic free foot positions; new members never claim occupied furniture.
      for (let y = 350; y <= 430 && !position; y += 64) for (let x = 60; x <= 285; x += 64) {
        const p = { x, y }
        if (walkable(this.scene, p) && available(this.world, p) && this.scene.hotspots.every(h => Math.hypot(h.anchor.x - x, h.anchor.y - y) >= 24)) { position = p; break }
      }
      if (!position) return
      this.world.companions.push({ id, facing: 'right', position, safe: { ...position }, behavior: 'idle', phase: 0,
        remaining: 2 + this.world.companions.length, destination: null })
    } else if (this.world.actor.id === id) this.world.actor = this.world.companions.shift()!
    else this.world.companions = this.world.companions.filter(a => a.id !== id)
    this.changed()
  }
  pointer(input: PointerIntent): void {
    if (input.type === 'cancel') { if (this.drag?.id === input.id) this.cancelDrag(); return }
    if (this.pauseReasons.size) return
    if (input.type === 'down') {
      if (this.drag) return
      const picked = hitActor(this.world, input.point)
      if (!picked) return
      this.selectCharacter(picked.id)
      const p = this.world.actor.position
      this.drag = { id: input.id, origin: { ...input.css },
        offset: { x: input.point.x - p.x, y: input.point.y - p.y }, position: { ...p }, active: false }
      return
    }
    const drag = this.drag
    if (!drag || drag.id !== input.id) return
    if (input.type === 'move' || input.type === 'up') {
      if (!drag.active && Math.hypot(input.css.x - drag.origin.x, input.css.y - drag.origin.y) >= 5) drag.active = true
      if (drag.active) drag.position = { x: input.point.x - drag.offset.x, y: input.point.y - drag.offset.y }
    }
    if (input.type !== 'up') return
    this.drag = null
    if (!drag.active) return
    const result = placement(this.scene, drag.position, this.world.actor.safe)
    const accepted = result.accepted && available(this.world, result.position, this.world.actor.id)
      && (!result.activity || !this.world.companions.some(a => a.behavior === result.activity))
    this.lastPlacement = accepted ? 'accepted' : 'rejected'
    if (!accepted) return
    Object.assign(this.world.actor, { position: result.position, safe: { ...result.position },
      facing: result.activity ? 'right' : this.world.actor.facing,
      behavior: result.activity ?? 'put_down', phase: 0, remaining: result.activity ? 0 : .55, destination: null })
    this.changed()
  }
  snapshot(): World { return validateWorld(this.world, this.scene) }
}

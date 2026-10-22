import { WorldController } from '../../src/core/controller.ts'
import { abandon, actors, available, routeTo, seatAvailable } from '../../src/core/world.ts'
import type { CharacterId } from '../../src/core/roster.ts'
import { candidateScene, previewWorld, type BellSlot } from './scene.ts'

export type TeaStage = 'idle' | 'approaching' | 'talking' | 'completed' | 'cancelled'
export type Food = 'rice' | 'tea'
/** Deliberately memory-only: exercise real movement, not the future storage protocol. */
export class ContentPreview {
  readonly controller = new WorldController(previewWorld(), candidateScene, () => {})
  stage: TeaStage = 'idle'
  food: Food = 'tea'
  participants: CharacterId[] = []
  deadline = 0
  conversationAt = 0
  reason = ''
  journal: { participants: CharacterId[]; food: Food; tick: number }[] = []
  unlocked = false
  draft: BellSlot | null = null
  placed: BellSlot | null = null
  get active() { return this.stage === 'approaching' || this.stage === 'talking' }
  invite(pair: CharacterId[], food: Food): boolean {
    if (this.active || this.stage === 'completed' || pair.length !== 2 || pair[0] === pair[1]) return false
    const world = this.controller.world
    const seats = candidateScene.hotspots.filter(h => h.id === 'eat')
    const members = pair.map(id => actors(world).find(a => a.id === id))
    const routes = members.map((a, i) => a && routeTo(candidateScene, a.position, seats[i]!.anchor))
    if (members.some((a, i) => !a || !routes[i]?.length || !seatAvailable(world, seats[i]!, a.id) || !available(world, seats[i]!.anchor, a.id))) {
      this.reason = 'seat'; return false
    }
    this.controller.cancelDrag()
    members.forEach((a, i) => {
      const actor = a!, route = routes[i]!, seat = seats[i]!
      abandon(actor)
      actor.intent = { furnitureId: 'eat', seat: seat.seat!, activity: 'eat', stage: 'approach', route: route.slice(1), expires: world.ticks + 1800 }
      actor.destination = route[0]!; actor.behavior = 'walk'
    })
    this.food = food; this.participants = [...pair]; this.stage = 'approaching'
    this.deadline = world.ticks + 1080; this.reason = ''; return true
  }
  advance(seconds: number): void {
    const world = this.controller.world
    // The first arrival waits at its reserved seat for the second participant.
    if (this.active) for (const actor of actors(world)) if (this.participants.includes(actor.id) && actor.intent?.stage === 'use') actor.remaining = 30
    this.controller.advance(seconds)
    if (!this.active) return
    const members = actors(world).filter(a => this.participants.includes(a.id))
    if (members.some(a => a.intent?.furnitureId !== 'eat')) { this.cancel('blocked'); return }
    if (world.ticks >= this.deadline) { this.cancel('timeout'); return }
    if (this.stage === 'approaching' && members.every(a => a.intent?.stage === 'use')) {
      this.stage = 'talking'; this.conversationAt = world.ticks
    }
    if (this.stage === 'talking' && world.ticks - this.conversationAt >= 150) {
      this.stage = 'completed'; this.unlocked = true
      this.journal.push({ participants: [...this.participants], food: this.food, tick: world.ticks })
      for (const actor of members) { abandon(actor); actor.remaining = 60 }
    }
  }
  cancel(reason = 'user'): void {
    if (!this.active) return
    for (const actor of actors(this.controller.world)) if (this.participants.includes(actor.id)) abandon(actor)
    this.stage = 'cancelled'; this.reason = reason
  }
  preview(slot: BellSlot): void { if (this.unlocked) this.draft = slot }
  confirm(): void { if (this.unlocked && this.draft) { this.placed = this.draft; this.draft = null } }
  discard(): void { this.draft = null }
}

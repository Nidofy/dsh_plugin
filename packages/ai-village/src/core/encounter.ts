import { validateLivingWorld, type LivingWorld } from './living-state.ts'
import type { Scene } from './world.ts'

export const encounterIds = ['paper-rescue', 'leaves-gather'] as const
export const encounterPeriod = 2700
/** A separate stateless PRNG: inspecting an offer never consumes the residents' RNG. */
function mix(n: number) {
  n = Math.imul(n ^ 0x68bc21eb, 0x45d9f3b)
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b)
  return (n ^ n >>> 16) >>> 0
}
export function encounterWindow(ticks: number) {
  const index = Math.floor(ticks / encounterPeriod)
  const startsTick = index * encounterPeriod + 300 + mix(index) % 300
  // Each pair has both kinds, in independently chosen order. No missed-day penalties.
  const definitionId = encounterIds[(index % 2 + mix(Math.floor(index / 2)) % 2) % 2]!
  return { index, definitionId, startsTick, expiresTick: startsTick + 1800, token: `${index}:${definitionId}` }
}
export function currentEncounter(world: LivingWorld) {
  const window = encounterWindow(world.ticks)
  if (world.region.active !== 'courtyard' || world.play.active || world.activeEvent || world.neighborhood.event || world.ticks < world.play.nextTick
    || world.play.encounterWindow >= window.index || world.ticks < window.startsTick || world.ticks >= window.expiresTick) return null
  return window
}
export function dismissEncounter(source: LivingWorld, base: Scene, token: string): LivingWorld {
  const world = validateLivingWorld(source, base), offer = currentEncounter(world)
  if (!offer || offer.token !== token) throw Error('ENCOUNTER_EXPIRED')
  world.play.encounterWindow = offer.index
  return validateLivingWorld(world, base)
}

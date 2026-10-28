import type { LivingWorld } from '../src/core/living-state.ts'
import { validateLivingWorld, type LivingWorld as FrozenWorld14 } from '../src/core/living-state-v14.ts'
import type { Scene } from '../src/core/world.ts'

/** Historical fixtures must pass the frozen codec, without world15-only fields. */
export function frozenV14(current: LivingWorld, scene: Scene): FrozenWorld14 {
  const { afternoon: _afternoon, community: _community, ...old } = structuredClone(current)
  return validateLivingWorld({ ...old, schemaVersion: 14, contentRevision: 10 }, scene)
}

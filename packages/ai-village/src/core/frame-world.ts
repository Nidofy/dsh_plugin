import { migrateLivingWorld } from './living-state.ts'
import { validateHomeWorld } from './home-state.ts'
import { validateNeighborhoodWorld } from './neighborhood-state.ts'
import { validateContentWorld } from './content-state.ts'
import { validateWorld, type Scene } from './world.ts'

/** Render messages use the same current codec as the owner; never guess a future schema. */
export function decodeFrameWorld(value: unknown, scene: Scene) {
  const version = (value as { schemaVersion?: number } | null)?.schemaVersion
  if (version === 7 || version === 8 || version === 9 || version === 10) return migrateLivingWorld(value, scene)
  if (version === 6) return validateHomeWorld(value, scene)
  if (version === 5) return validateNeighborhoodWorld(value, scene)
  if (version === 4) return validateContentWorld(value, scene)
  return validateWorld(value, scene)
}

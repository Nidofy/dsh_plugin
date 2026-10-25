import type { Point } from './world.ts'
import type { SceneArt } from '../frame/furniture.ts'

/** Frozen bookhouse interaction geometry. Approved atlas layers bind separately in the frame; asset labels remain stable geometry identities. */
export const bookhouseScene: SceneArt = {
  schemaVersion: 1,
  id: 'bookhouse',
  version: 1,
  size: [360, 480],
  walkable: { x: 36, y: 220, width: 288, height: 220 },
  obstacles: [
    { x: 234, y: 220, width: 86, height: 20 },
    { x: 72, y: 337, width: 140, height: 22 },
    { x: 44, y: 220, width: 116, height: 20 },
  ],
  spawn: { x: 180, y: 420 },
  hotspots: [
    { id: 'bookcase', activity: 'read', seat: 'main', anchor: { x: 276, y: 268 }, hit: { x: 254, y: 250, width: 44, height: 36 } },
    { id: 'reading-desk', activity: 'work', seat: 'main', anchor: { x: 142, y: 328 }, hit: { x: 116, y: 308, width: 52, height: 28 } },
    { id: 'window-seat', activity: 'sit', seat: 'main', anchor: { x: 92, y: 270 }, hit: { x: 62, y: 250, width: 60, height: 40 } },
  ],
  furniture: [
    { id: 'bookcase', asset: 'code/bookhouse/bookcase', rect: { x: 234, y: 126, width: 86, height: 114 }, split: .82 },
    { id: 'reading-desk', asset: 'code/bookhouse/reading-desk', rect: { x: 72, y: 292, width: 140, height: 67 }, split: .5 },
    { id: 'window-seat', asset: 'code/bookhouse/window-seat', rect: { x: 44, y: 198, width: 116, height: 42 }, split: .6 },
  ],
  seatProps: [],
}

/** Stable-ID order is supplied by the region owner; no RNG or actor state is stored here. */
export const bookhouseEntries: readonly Point[] = Array.from({ length: 7 }, (_, index) => ({ x: 48 + 44 * index, y: 402 }))

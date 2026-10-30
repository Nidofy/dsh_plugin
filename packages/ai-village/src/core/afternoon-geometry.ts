import { walkable, type Point, type Scene } from './world.ts'
import { teaSquareClosing } from './tea-square-scene.ts'

/** Finite feet candidates, derived from the same geometry that renders the current home. */
export function afternoonTargets(region: 'courtyard' | 'bookhouse' | 'tea-square', scene: Scene, authored = false): readonly Point[] {
  if (region === 'tea-square' && !authored) return teaSquareClosing
  const points: Point[] = scene.hotspots.map(h => ({ ...h.anchor }))
  for (let y = 252; y <= 420; y += 28) for (let x = 54; x <= 306; x += 28) {
    const p = { x, y }
    if (walkable(scene, p)) points.push(p)
  }
  return points
}

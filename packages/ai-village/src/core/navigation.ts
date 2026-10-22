import { reachable, walkable, type Point, type Scene } from './world.ts'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
/** Foot collision is a 24-unit circle, including along the entire segment. */
export function clearSegment(scene: Scene, from: Point, to: Point, occupied: readonly Point[]): boolean {
  if (!reachable(scene, from, to)) return false
  const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy
  return occupied.every(p => {
    const t = length ? Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.y - from.y) * dy) / length)) : 0
    return Math.hypot(p.x - from.x - t * dx, p.y - from.y - t * dy) >= 24 - 1e-7
  })
}

/** Bounded visibility graph. All ties follow node order; no wall clock or random search. */
export function residentRoute(scene: Scene, from: Point, to: Point, occupied: readonly Point[]): Point[] | null {
  if (!clearSegment(scene, from, from, occupied) || !clearSegment(scene, to, to, occupied)) return null
  if (clearSegment(scene, from, to, occupied)) return [{ ...to }]
  const corners = scene.obstacles.flatMap(r => [
    { x: r.x - 2, y: r.y - 2 }, { x: r.x + r.width + 2, y: r.y - 2 },
    { x: r.x - 2, y: r.y + r.height + 2 }, { x: r.x + r.width + 2, y: r.y + r.height + 2 },
  ])
  const rings = occupied.flatMap(p => Array.from({ length: 16 }, (_, i) => ({
    x: p.x + 25 * Math.cos(i * Math.PI / 8), y: p.y + 25 * Math.sin(i * Math.PI / 8),
  })))
  const nodes = [from, to, ...corners, ...rings].filter((p, i) => i < 2 || (walkable(scene, p) && occupied.every(q => distance(p, q) >= 24)))
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>()
  costs[0] = 0
  for (let count = 0; count < nodes.length; count++) {
    let at = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (at < 0 || costs[i]! < costs[at]!)) at = i
    if (at < 0 || !Number.isFinite(costs[at])) return null
    if (at === 1) {
      const route: Point[] = []
      for (let i = 1; i !== 0; i = previous[i]!) route.unshift({ ...nodes[i]! })
      return route.length <= 9 ? route : null
    }
    visited.add(at)
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i)) {
      const cost = costs[at]! + distance(nodes[at]!, nodes[i]!)
      if (cost < costs[i]! && clearSegment(scene, nodes[at]!, nodes[i]!, occupied)) { costs[i] = cost; previous[i] = at }
    }
  }
  return null
}

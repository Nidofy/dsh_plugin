import { offsets, type Home } from './home-state.ts'
import type { Point, Rect } from './world.ts'

export type TableHome = Pick<Home, 'positions'>
interface TableResident { behavior: string; intent?: { furnitureId: string } | null }
export interface TableDisplayWorld {
  actor: TableResident
  companions: readonly TableResident[]
  activeEvent: unknown | null
  play: { tableMode: 'dining' | 'game'; active: { definitionId: string; target: string | null } | null }
}
/** A game-enabled table still serves meals. This read-only view never changes activity choices or RNG. */
export function displayGameBoard(world: TableDisplayWorld | null | undefined): boolean {
  if (!world || world.play.tableMode !== 'game' || world.activeEvent) return false
  if ([world.actor, ...world.companions].some(actor => actor.intent?.furnitureId === 'eat' || actor.behavior === 'eat')) return false
  const activity = world.play.active
  return !activity || activity.definitionId === 'table-game' || activity.target !== 'eat'
}
export interface TableCellGeometry { index: number; center: Point; hit: Rect }
export interface TableBoardGeometry {
  id: 'game-table'
  /** The approved dining-table body, obstacle and two existing reservation keys remain shared. */
  furnitureId: 'eat'
  rect: Rect
  cells: TableCellGeometry[]
}

/**
 * Development preview tabletop overlay. This is NOT a new obstacle, furniture footprint,
 * seat or approved raster asset. Drawing and input use the same nine row-major cells.
 * The base rectangle lies on the approved table top at (123,330,204,68), clear of its legs.
 */
export function tableBoardGeometry(home: TableHome): TableBoardGeometry {
  const position = home.positions.eat
  if (position !== 0 && position !== 1) throw Error('INVALID_TABLE_POSITION')
  const offset = offsets.eat[position]!
  const rect = { x: 189 + offset.x, y: 332 + offset.y, width: 72, height: 24 }
  const width = rect.width / 3, height = rect.height / 3
  return { id: 'game-table', furnitureId: 'eat', rect, cells: Array.from({ length: 9 }, (_, index) => {
    const x = rect.x + index % 3 * width, y = rect.y + Math.floor(index / 3) * height
    return { index, center: { x: x + width / 2, y: y + height / 2 }, hit: { x, y, width, height } }
  }) }
}

/** Half-open cells give shared grid edges one unambiguous owner, including the outer border. */
export function tableCellAt(home: TableHome, point: Point): number | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  const { rect } = tableBoardGeometry(home)
  if (point.x < rect.x || point.x > rect.x + rect.width || point.y < rect.y || point.y > rect.y + rect.height) return null
  const column = Math.min(2, Math.floor((point.x - rect.x) / (rect.width / 3)))
  const row = Math.min(2, Math.floor((point.y - rect.y) / (rect.height / 3)))
  return row * 3 + column
}

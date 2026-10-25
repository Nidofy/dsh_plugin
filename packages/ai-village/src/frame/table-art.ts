import { Container, Graphics } from 'pixi.js'
import { displayGameBoard, tableBoardGeometry, type TableHome, type TableDisplayWorld } from '../core/table-geometry.ts'
import { furnitureDepth, type SceneArt } from './furniture.ts'

/** Structural input avoids coupling the renderer to the current persisted-world codec. */
export interface TableArtWorld extends TableDisplayWorld {
  schemaVersion: 9 | 10 | 11 | 12
  home: TableHome
  play: {
    tableMode: 'dining' | 'game'
    active: { definitionId: string; target: string | null; board: readonly number[] } | null
  }
}

/**
 * Original code-vector DEVELOPMENT PREVIEW on the approved dining-table body.
 * Add root to the existing sortable worldContent, call paint from its existing frame loop,
 * and hide dining bowl props while game mode is displayed. No new PNG or independent ticker.
 */
export class TableArt {
  readonly root = new Container()
  private readonly drawing = new Graphics()
  private appearance = ''

  constructor() {
    this.root.label = 'game-table-development-preview'
    this.root.eventMode = 'none'
    this.root.visible = false
    this.root.addChild(this.drawing)
  }

  paint(world: TableArtWorld | null, scene: SceneArt): void {
    const depth = furnitureDepth(scene, 'eat')
    this.root.visible = displayGameBoard(world) && depth !== undefined
    if (!this.root.visible || !world || depth === undefined) return
    // Dining table front = depth - 10; activity hands / tabletop props = depth.
    // Stay above the existing table pixels and below hand contact layers.
    this.root.zIndex = depth - 5
    const geometry = tableBoardGeometry(world.home), r = geometry.rect
    const event = world.play.active
    const board = event?.definitionId === 'table-game' && event.board.length === 9 ? event.board : null
    const appearance = `${r.x},${r.y}:${board?.join(',') ?? 'empty'}`
    if (this.appearance === appearance) return
    this.appearance = appearance

    const g = this.drawing
    g.clear()
    // A shallow three-row board follows the existing tabletop's perspective.
    g.roundRect(r.x - 2, r.y - 1, r.width + 4, r.height + 2, 2.5)
      .fill(0xf1dfb4).stroke({ color: 0x8b704b, width: .9 })
    for (const index of [1, 2]) {
      const x = r.x + r.width * index / 3, y = r.y + r.height * index / 3
      g.moveTo(x, r.y).lineTo(x, r.y + r.height).stroke({ color: 0xb09469, width: .65 })
      g.moveTo(r.x, y).lineTo(r.x + r.width, y).stroke({ color: 0xb09469, width: .65 })
    }
    for (const cell of geometry.cells) {
      const value = board?.[cell.index]
      if (value !== 0 && value !== 1) continue
      const { x, y } = cell.center
      // Circle versus cross remains distinguishable without relying on color.
      if (value === 0) {
        g.ellipse(x, y, 5.4, 2.5).fill(0xeaf4eb).stroke({ color: 0x487967, width: 1.2 })
        g.ellipse(x, y, 2.5, .9).fill(0xf1dfb4)
      } else {
        g.moveTo(x - 4.6, y - 2.1).lineTo(x + 4.6, y + 2.1)
          .moveTo(x + 4.6, y - 2.1).lineTo(x - 4.6, y + 2.1)
          .stroke({ color: 0x916658, width: 1.5, cap: 'round' })
      }
    }
  }

  destroy(): void { this.root.destroy({ children: true }) }
}

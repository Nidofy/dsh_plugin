import { Container, Graphics, Text } from 'pixi.js'
import type { SceneInteraction } from '../core/scene-interactions.ts'

/** Scene-space paper props. They use the existing vector art vocabulary, not new approved bitmap art. */
export class StoryObjects {
  readonly root = new Container()
  private graphics = new Graphics()
  private labels: Text[] = []
  constructor() { this.root.zIndex = 6000; this.root.addChild(this.graphics) }
  paint(hits: SceneInteraction[], locale: 'zh' | 'en', hidden: boolean, selectedId?: string) {
    this.root.visible = !hidden
    const g = this.graphics; g.clear()
    while (this.labels.length < hits.length) {
      const label = new Text({ text: '', style: { fontFamily: 'system-ui', fontSize: 13, fill: 0x394d43, align: 'center', wordWrap: true, breakWords: true, wordWrapWidth: 76 } })
      label.anchor.set(.5, 0); this.labels.push(label); this.root.addChild(label)
    }
    this.labels.forEach(label => { label.visible = false })
    hits.forEach((h, i) => {
      const { x, y } = h.point, active = h.selected || selectedId === h.id
      const recall = h.command.kind === 'recall'
      if (recall) { g.circle(x, y, h.radius).stroke({ color: 0xf3d9a0, width: 1, alpha: .65 }); return }
      g.ellipse(x, y + 14, 19, 4).fill({ color: 0x604a32, alpha: .16 })
      g.circle(x, y, h.radius).stroke({ color: active ? 0x678f7f : 0xf3d9a0, width: active ? 2.5 : 1.5, alpha: recall ? .55 : .9 })
      g.roundRect(x - 13, y - 16, 26, 32, 3).fill(active ? 0xdce9ce : 0xfff0d1).stroke({ color: 0x98774e, width: 1 })
      if (h.prop === 'leaf') g.ellipse(x, y - 2, 5, 9).fill(0x7e9975)
      else if (h.prop === 'wave') for (let k = 0; k < 2; k++) g.moveTo(x - 8, y - 4 + k * 7).quadraticCurveTo(x - 1, y - 11 + k * 7, x + 7, y - 3 + k * 7).stroke({ color: 0x729ba5, width: 2 })
      else if (h.prop === 'cup') { g.roundRect(x - 8, y - 5, 15, 14, 4).fill(0xe7cfaa).stroke({ color: 0x98774e, width: 1 }); g.ellipse(x, y - 5, 8, 3).fill(0x967b56); g.circle(x + 10, y + 1, 3).stroke({ color: 0x98774e, width: 1 }) }
      else if (h.prop === 'mirror') { g.moveTo(x - 8, y + 7).lineTo(x - 3, y - 6).lineTo(x - 1, y + 7).stroke({ color: 0x709ba1, width: 2 }); g.moveTo(x + 8, y + 7).lineTo(x + 3, y - 6).lineTo(x + 1, y + 7).stroke({ color: 0x709ba1, width: 2 }) }
      else if (h.prop === 'press') { g.moveTo(x - 8, y + 8).lineTo(x + 8, y + 8).stroke({ color: 0x98774e, width: 2 }); g.moveTo(x, y - 9).lineTo(x, y + 3).lineTo(x - 4, y - 1).moveTo(x, y + 3).lineTo(x + 4, y - 1).stroke({ color: 0x739680, width: 2 }) }
      else if (h.prop === 'bookmark') { g.poly([x - 5, y - 11, x + 5, y - 11, x + 5, y + 10, x, y + 6, x - 5, y + 10]).fill(0x83a279) }
      else if (h.prop === 'scroll') { g.roundRect(x - 10, y - 13, 4, 26, 2).fill(0xc9ad7a); g.roundRect(x + 6, y - 13, 4, 26, 2).fill(0xc9ad7a); g.moveTo(x - 4, y - 5).lineTo(x + 4, y - 5).moveTo(x - 4, y + 2).lineTo(x + 4, y + 2).stroke({ color: 0x98774e, width: 1 }) }
      else if (h.prop === 'book') { g.poly([x - 10, y - 10, x, y - 7, x + 10, y - 10, x + 10, y + 9, x, y + 12, x - 10, y + 9]).fill(0x90aaa2); g.moveTo(x, y - 7).lineTo(x, y + 12).stroke({ color: 0xfff0d1, width: 2 }) }
      else if (h.prop === 'rhythm') for (let k = 0; k < 3; k++) g.circle(x - 7 + k * 7, y + (k === 1 ? -5 : 4), 3).fill([0x839e82, 0xbba06e, 0x779ca8][k]!)
      else if (h.prop === 'plan') { g.roundRect(x - 9, y - 10, 18, 20, 1).stroke({ color: 0x98774e, width: 1 }); g.moveTo(x - 6, y).lineTo(x - 2, y + 4).lineTo(x + 6, y - 5).stroke({ color: 0x739680, width: 2 }) }
      else for (let k = 0; k < 3; k++) g.moveTo(x - 7, y - 6 + k * 6).lineTo(x + 7 - k * 2, y - 6 + k * 6).stroke({ color: 0xaa8b61, width: 1 })
      const label = this.labels[i]!; label.text = h.label[locale]; label.position.set(x, y + 26); label.visible = !recall
      if (!recall) { const height = Math.min(50, label.height + 5); g.roundRect(x - 40, y + 24, 80, height, 5).fill({ color: 0xfff9e9, alpha: .94 }) }
    })
  }
  destroy() { this.root.destroy({ children: true }) }
}

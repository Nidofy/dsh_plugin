import { describe, expect, it } from 'vitest'
import { Container } from 'pixi.js'
import { BookhouseArt } from '../src/frame/bookhouse-art.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { createWorld } from '../src/core/world.ts'
import { furnitureDepth } from '../src/frame/furniture.ts'

describe('bookhouse development art lifecycle and contact layers', () => {
  it('interleaves sibling layers and removes all owned nodes without touching the parent', () => {
    const parent = new Container(), unrelated = new Container()
    parent.addChild(unrelated)
    const art = new BookhouseArt(parent)
    expect(parent.children).toHaveLength(11)
    expect(art.background.parent).toBe(parent)
    for (const map of [art.backs, art.fronts, art.props]) for (const node of map.values()) expect(node.parent).toBe(parent)
    art.destroy()
    expect(parent.children).toEqual([unrelated]); expect(unrelated.destroyed).toBe(false)
    parent.destroy({ children: true })
  })

  it('shows props only at the corresponding occupied place and leaves drawing input untouched', () => {
    const parent = new Container(), art = new BookhouseArt(parent)
    for (const hotspot of bookhouseScene.hotspots) {
      const actor = createWorld(bookhouseScene).actor
      actor.position = { ...hotspot.anchor }; actor.behavior = hotspot.activity!
      actor.intent = { furnitureId: hotspot.id, seat: 'main', activity: hotspot.activity!, stage: 'use', route: [], expires: 200 }
      const before = structuredClone(actor), residents = [{ actor, point: { ...actor.position } }]
      art.paint(residents, 120, false)
      expect(actor).toEqual(before)
      for (const [id, node] of art.props) expect(node.visible).toBe(id === hotspot.id)
      const prop = art.props.get(hotspot.id)!
      if (hotspot.id === 'reading-desk') {
        expect(prop.zIndex).toBeGreaterThan(art.fronts.get(hotspot.id)!.zIndex)
        expect(prop.zIndex).toBeLessThan(furnitureDepth(bookhouseScene, hotspot.id)!)
      } else expect(prop.zIndex).toBeGreaterThan(actor.position.y * 10)
      art.paint([{ actor, point: { x: 200, y: 420 } }], 121, false)
      expect(prop.visible).toBe(false)
      art.paint(residents, 122, true)
      expect(prop.visible).toBe(true)
    }
    art.paint([], 123, true)
    expect([...art.props.values()].every(p => !p.visible)).toBe(true)
    art.destroy(); parent.destroy()
  })
})

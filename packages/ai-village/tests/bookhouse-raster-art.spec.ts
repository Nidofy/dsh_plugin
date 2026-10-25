import { describe, expect, it } from 'vitest'
import { Container, Rectangle, Texture, TextureSource } from 'pixi.js'
import { BookhouseArt, bookhouseRasterRoles, type BookhouseRasterLayer, type BookhouseRasterOptions } from '../src/frame/bookhouse-art.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { createWorld } from '../src/core/world.ts'

function fixture() {
  const source = new TextureSource({ width: 256, height: 256 })
  const texture = new Texture({ source, frame: new Rectangle(32, 48, 128, 128) })
  const layers: BookhouseRasterLayer[] = bookhouseRasterRoles.map(role => ({
    ...role, kind: role.kind as BookhouseRasterLayer['kind'], key: 'test-atlas', sourceRect: [8, 12, 24, 32], rect: [40, 80, 48, 64],
  }))
  const options: BookhouseRasterOptions = { textures: new Map([['test-atlas', texture]]), layers }
  return { source, texture, layers, options }
}

describe('optional bookhouse raster injection (not production registration)', () => {
  it('keeps the original ten development graphics and labels without options', () => {
    const parent = new Container(), art = new BookhouseArt(parent)
    expect(art.artwork).toBe('development-preview'); expect(art.sprites.size).toBe(0)
    expect(parent.children).toHaveLength(10)
    expect(art.background.visible).toBe(true); expect(art.background.label).toBe('bookhouse-development-preview-background')
    expect([...art.backs.values(), ...art.fronts.values()].every(node => node.visible)).toBe(true)
    art.destroy(); expect(parent.children).toHaveLength(0); parent.destroy()
  })

  it('creates frame-relative views sharing one source, preserves sibling depths, and releases only owned objects', () => {
    const { texture, source, options } = fixture(), parent = new Container(), unrelated = new Container()
    parent.addChild(unrelated)
    const geometry = JSON.stringify(bookhouseScene), art = new BookhouseArt(parent, options)
    expect(art.artwork).toBe('raster'); expect(art.sprites.size).toBe(10)
    expect(art.background.visible).toBe(false)
    expect([...art.backs.values(), ...art.fronts.values(), ...art.props.values()].every(node => !node.visible)).toBe(true)
    const sprites = [...art.sprites.values()], views = sprites.map(sprite => sprite.texture)
    for (const role of bookhouseRasterRoles) {
      const sprite = art.sprites.get(role.id)!
      expect(sprite.parent).toBe(parent); expect(sprite.zIndex).toBe(role.z)
      expect(sprite).toMatchObject({ x: 40, y: 80, width: 48, height: 64, eventMode: 'none' })
      expect(sprite.texture).not.toBe(texture); expect(sprite.texture.source).toBe(source)
      expect(sprite.texture.frame).toMatchObject({ x: 40, y: 60, width: 24, height: 32 })
      expect(sprite.visible).toBe(role.kind !== 'prop')
    }
    expect(new Set(views).size).toBe(10)
    expect(JSON.stringify(bookhouseScene)).toBe(geometry)
    art.destroy()
    expect(sprites.every(sprite => sprite.destroyed)).toBe(true); expect(views.every(view => view.destroyed)).toBe(true)
    expect(texture.destroyed).toBe(false); expect(source.destroyed).toBe(false)
    expect(parent.children).toEqual([unrelated]); expect(unrelated.destroyed).toBe(false)
    // A second scene can still use the loader-owned atlas after the first scene was torn down.
    const second = new BookhouseArt(parent, options); expect(second.artwork).toBe('raster'); second.destroy()
    texture.destroy(true); parent.destroy({ children: true })
  })

  it.each(bookhouseRasterRoles.map(role => role.id))('rejects an incomplete layer set missing %s without any raster fragments', missing => {
    const { options, texture, layers } = fixture(), parent = new Container()
    const art = new BookhouseArt(parent, { ...options, layers: layers.filter(layer => layer.id !== missing) })
    expect(art.artwork).toBe('development-preview'); expect(art.sprites.size).toBe(0)
    expect(parent.children).toHaveLength(10); expect(art.background.visible).toBe(true)
    expect(texture.destroyed).toBe(false)
    art.destroy(); texture.destroy(true); parent.destroy()
  })

  it.each(['missing-texture', 'duplicate', 'nan', 'rect-overflow', 'zero-size', 'negative-uv', 'frame-overflow', 'source-overflow', 'bad-depth', 'bad-hotspot', 'rotated', 'destroyed'])(
    'rejects %s before creating views or hiding preview layers', problem => {
      const { options, texture, source, layers } = fixture(), parent = new Container()
      if (problem === 'missing-texture') layers[9]!.key = 'absent'
      if (problem === 'duplicate') layers[9]!.id = layers[0]!.id
      if (problem === 'nan') layers[9]!.rect = [0, 0, NaN, 20]
      if (problem === 'rect-overflow') layers[9]!.rect = [1e308, 0, 1e308, 20]
      if (problem === 'zero-size') layers[9]!.sourceRect = [0, 0, 0, 20]
      if (problem === 'negative-uv') layers[9]!.sourceRect = [-1, 0, 20, 20]
      if (problem === 'frame-overflow') layers[9]!.sourceRect = [120, 0, 20, 20]
      if (problem === 'source-overflow') texture.frame.x = 200
      if (problem === 'bad-depth') layers[2]!.z += 1
      if (problem === 'bad-hotspot') layers[9]!.hotspot = 'unknown'
      if (problem === 'rotated') texture.rotate = 2
      if (problem === 'destroyed') texture.destroy(false)
      const art = new BookhouseArt(parent, options)
      expect(art.artwork).toBe('development-preview'); expect(art.sprites.size).toBe(0)
      expect(parent.children).toHaveLength(10); expect(art.background.visible).toBe(true)
      expect([...art.backs.values(), ...art.fronts.values()].every(node => node.visible)).toBe(true)
      art.destroy(); if (!texture.destroyed) texture.destroy(false); source.destroy(); parent.destroy()
    },
  )

  it('uses ordinary hotspot occupancy for raster props without changing actors or showing vector props', () => {
    const { options, texture, layers } = fixture(), parent = new Container()
    layers.push({ ...layers[3]!, id: 'second-bookcase-prop' })
    const art = new BookhouseArt(parent, options)
    expect(art.artwork).toBe('raster')
    for (const hotspot of bookhouseScene.hotspots) {
      const actor = createWorld(bookhouseScene).actor
      actor.position = { ...hotspot.anchor }; actor.behavior = hotspot.activity!
      actor.intent = { furnitureId: hotspot.id, seat: 'main', activity: hotspot.activity!, stage: 'use', route: [], expires: 200 }
      const before = JSON.stringify(actor)
      art.paint([{ actor, point: { ...actor.position } }], 120, false)
      for (const layer of layers.filter(layer => layer.kind === 'prop')) expect(art.sprites.get(layer.id)!.visible).toBe(layer.hotspot === hotspot.id)
      expect(JSON.stringify(actor)).toBe(before)
      expect([...art.props.values()].every(node => !node.visible)).toBe(true)
      art.paint([{ actor, point: { x: 200, y: 420 } }], 121, true)
      expect(layers.filter(layer => layer.kind === 'prop').every(layer => !art.sprites.get(layer.id)!.visible)).toBe(true)
      actor.intent.furnitureId = 'not-this-place'
      art.paint([{ actor, point: actor.position }], 122, true)
      expect(art.sprites.get(`${hotspot.id}-prop`)!.visible).toBe(false)
    }
    art.paint([], 123, false)
    expect(layers.filter(layer => layer.kind === 'prop').every(layer => !art.sprites.get(layer.id)!.visible)).toBe(true)
    art.destroy(); texture.destroy(true); parent.destroy()
  })
})

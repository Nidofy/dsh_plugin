import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { bookhouseScene } from '../core/bookhouse-scene.ts'
import type { Actor, Point } from '../core/world.ts'
import { furnitureDepth } from './furniture.ts'
import type { BookhousePose } from './bookhouse-contact.ts'

export interface BookhouseResident { actor: Actor; point: Point; presentation?: BookhousePose }

export interface BookhouseRasterLayer {
  id: string
  key: string
  /** Pixel coordinates relative to the borrowed texture's unrotated frame, not its source origin. */
  sourceRect: readonly [number, number, number, number]
  rect: readonly [number, number, number, number]
  z: number
  kind: 'background' | 'furniture' | 'prop'
  hotspot?: string
}
export interface BookhouseRasterOptions {
  textures: ReadonlyMap<string, Texture>
  layers: readonly BookhouseRasterLayer[]
  residentContacts?: boolean
}

/** Render roles, not file names: several roles may share one atlas source. */
export const bookhouseRasterRoles = [
  { id: 'background', kind: 'background', z: -100 },
  ...bookhouseScene.furniture.flatMap(furniture => [
    { id: `${furniture.id}-back`, kind: 'furniture', z: furniture.rect.y * 10 - 1 },
    { id: `${furniture.id}-front`, kind: 'furniture', z: furnitureDepth(bookhouseScene, furniture.id)! - 10 },
    { id: `${furniture.id}-prop`, kind: 'prop', hotspot: furniture.id,
      z: furniture.id === 'reading-desk' ? furnitureDepth(bookhouseScene, furniture.id)! - 2
        : bookhouseScene.hotspots.find(hotspot => hotspot.id === furniture.id)!.anchor.y * 10 + 3 },
  ]),
] as const

function validRaster(options: BookhouseRasterOptions): boolean {
  const layers = options.layers
  if (!Array.isArray(layers) || layers.length < bookhouseRasterRoles.length || layers.length > 32) return false
  const ids = new Set<string>()
  for (const layer of layers) {
    if (!layer || typeof layer.id !== 'string' || !layer.id || layer.id.length > 80 || ids.has(layer.id)
      || typeof layer.key !== 'string' || !layer.key || layer.key.length > 256 || !Number.isFinite(layer.z)
      || !['background', 'furniture', 'prop'].includes(layer.kind)) return false
    ids.add(layer.id)
    for (const rect of [layer.sourceRect, layer.rect]) {
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[2] <= 0 || rect[3] <= 0
        || !Number.isFinite(rect[0] + rect[2]) || !Number.isFinite(rect[1] + rect[3])) return false
    }
    if (layer.kind === 'prop' ? !bookhouseScene.hotspots.some(hotspot => hotspot.id === layer.hotspot) : layer.hotspot !== undefined) return false
    const texture = options.textures.get(layer.key)
    if (!(texture instanceof Texture) || texture.destroyed || texture.source.destroyed || texture.rotate !== 0) return false
    const [x, y, width, height] = layer.sourceRect, frame = texture.frame, source = texture.source
    if (x < 0 || y < 0 || x + width > frame.width || y + height > frame.height
      || ![frame.x, frame.y, frame.width, frame.height, source.width, source.height].every(Number.isFinite)
      || frame.x < 0 || frame.y < 0 || frame.x + frame.width > source.width || frame.y + frame.height > source.height) return false
  }
  return bookhouseRasterRoles.every(role => {
    const layer = layers.find(item => item.id === role.id)
    return layer?.kind === role.kind && layer.z === role.z
      && layer.hotspot === ('hotspot' in role ? role.hotspot : undefined)
  })
}

/** Defaults to the original DEVELOPMENT PREVIEW. Optional injection is not asset approval or registration. */
export class BookhouseArt {
  readonly background = new Graphics()
  readonly backs = new Map<string, Graphics>()
  readonly fronts = new Map<string, Graphics>()
  readonly props = new Map<string, Graphics>()
  readonly artwork: 'development-preview' | 'raster'
  readonly sprites = new Map<string, Sprite>()
  private readonly textureViews: Texture[] = []
  private readonly rasterProps = new Map<Sprite, string>()
  private readonly writerProps = new Map<string, Sprite>()
  private readonly residentContacts: boolean

  constructor(parent: Container, options?: BookhouseRasterOptions) {
    this.residentContacts = options?.residentContacts === true
    this.background.label = 'bookhouse-development-preview-background'
    this.background.eventMode = 'none'
    this.background.zIndex = -100
    parent.addChild(this.background)
    this.drawRoom()
    for (const furniture of bookhouseScene.furniture) {
      const back = new Graphics(), front = new Graphics(), prop = new Graphics()
      for (const [kind, node] of [['back', back], ['front', front], ['prop', prop]] as const) {
        node.label = `bookhouse-${furniture.id}-${kind}`
        node.eventMode = 'none'
        // Siblings, not a nested room root: residents must interleave with table front and hands.
        parent.addChild(node)
      }
      back.zIndex = furniture.rect.y * 10 - 1
      front.zIndex = furnitureDepth(bookhouseScene, furniture.id)! - 10
      prop.visible = false
      this.backs.set(furniture.id, back); this.fronts.set(furniture.id, front); this.props.set(furniture.id, prop)
      this.drawFurniture(furniture.id, back, front)
    }
    this.artwork = options && validRaster(options) && this.installRaster(parent, options) ? 'raster' : 'development-preview'
  }

  private installRaster(parent: Container, options: BookhouseRasterOptions): boolean {
    // Validate the entire set before allocating. Allocation failure also leaves the complete preview intact.
    try {
      for (const layer of options.layers) {
        const borrowed = options.textures.get(layer.key)!, [sx, sy, sw, sh] = layer.sourceRect
        const view = new Texture({ source: borrowed.source, frame: new Rectangle(borrowed.frame.x + sx, borrowed.frame.y + sy, sw, sh) })
        this.textureViews.push(view)
        const sprite = new Sprite(view), [x, y, width, height] = layer.rect
        this.sprites.set(layer.id, sprite)
        sprite.label = `bookhouse-raster-${layer.id}`; sprite.eventMode = 'none'
        sprite.position.set(x, y); sprite.width = width; sprite.height = height; sprite.zIndex = layer.z
        sprite.visible = layer.kind !== 'prop'
        if (layer.kind === 'prop') this.rasterProps.set(sprite, layer.hotspot!)
      }
    } catch {
      this.destroyRaster()
      return false
    }
    this.background.visible = false
    for (const collection of [this.backs, this.fronts, this.props]) for (const node of collection.values()) node.visible = false
    for (const sprite of this.sprites.values()) parent.addChild(sprite)
    return true
  }

  private destroyRaster(): void {
    for(const sprite of this.writerProps.values())sprite.destroy({texture:false,textureSource:false})
    this.writerProps.clear()
    for (const sprite of this.sprites.values()) sprite.destroy({ texture: false, textureSource: false })
    for (const view of this.textureViews) view.destroy(false)
    this.sprites.clear(); this.textureViews.length = 0; this.rasterProps.clear()
  }

  private drawRoom(): void {
    const g = this.background
    g.rect(0, 0, 360, 480).fill(0xf0e4c9)
    g.rect(0, 0, 360, 221).fill(0xe5d9bd)
    g.rect(16, 18, 328, 200).fill(0xf5ead2)
    g.rect(0, 214, 360, 9).fill(0xb69b77)
    g.rect(0, 223, 360, 257).fill(0xd7ba91)
    // Quiet perspective floorboards, fixed world coordinates shared by rendering and photos.
    for (const y of [252, 291, 336, 388, 448]) g.moveTo(0, y).lineTo(360, y).stroke({ color: 0xb79b75, width: .8, alpha: .55 })
    for (const x of [-120, -15, 90, 195, 300, 405, 510]) g.moveTo(180 + (x - 180) * .32, 223).lineTo(x, 480).stroke({ color: 0xb79b75, width: .8, alpha: .45 })
    g.roundRect(38, 57, 128, 144, 38).fill(0xb59a75)
    g.roundRect(45, 64, 114, 130, 33).fill(0xd7e6de)
    g.poly([46, 155, 83, 115, 112, 145, 157, 108, 157, 192, 46, 192]).fill(0xa5bc9f)
    g.poly([46, 176, 78, 151, 116, 167, 157, 143, 157, 193, 46, 193]).fill(0x89a58b)
    g.moveTo(102, 65).lineTo(102, 194).moveTo(45, 126).lineTo(159, 126).stroke({ color: 0xf0dfbd, width: 5 })
    g.roundRect(35, 191, 134, 9, 2).fill(0xc2a67f)
    // Ceiling beam and a simple lamp keep the room distinct from the courtyard artwork.
    g.rect(0, 25, 360, 12).fill(0xb39570)
    g.moveTo(202, 37).lineTo(202, 74).stroke({ color: 0x9b8261, width: 2 })
    g.poly([190, 74, 214, 74, 224, 91, 180, 91]).fill(0xd1a76f).stroke({ color: 0xa27b4f, width: 1 })
    g.ellipse(202, 92, 21, 4).fill(0xf7df9d)
    g.roundRect(222, 69, 108, 38, 4).fill(0xd5c29e).stroke({ color: 0xb29970, width: 1 })
    g.moveTo(239, 82).lineTo(265, 82).moveTo(239, 90).lineTo(308, 90).stroke({ color: 0xb5a17e, width: 2 })
    g.ellipse(180, 424, 95, 26).fill({ color: 0xeaddbf, alpha: .45 })
  }

  private drawFurniture(id: string, back: Graphics, front: Graphics): void {
    const r = bookhouseScene.furniture.find(item => item.id === id)!.rect
    if (id === 'bookcase') {
      back.roundRect(r.x, r.y, r.width, r.height, 3).fill(0xa1825c).stroke({ color: 0x806449, width: 1 })
      back.rect(r.x + 6, r.y + 7, r.width - 12, r.height - 15).fill(0x715b43)
      for (let row = 0; row < 3; row++) {
        const y = r.y + 12 + row * 30
        for (let i = 0; i < 9; i++) {
          const height = 17 + i % 3 * 3, x = r.x + 10 + i * 7
          back.roundRect(x, y + 25 - height, 5.5, height, 1).fill([0x8fa99b, 0xc9b181, 0xb58e7c, 0xa7a1b3][(i + row) % 4]!)
          back.moveTo(x + 1, y + 22).lineTo(x + 4.5, y + 22).stroke({ color: 0xe7d6b4, width: .6 })
        }
        back.rect(r.x + 5, y + 26, r.width - 10, 4).fill(0xc4a376)
      }
      front.rect(r.x, r.y + r.height - 8, r.width, 8).fill(0x96734f)
    } else if (id === 'reading-desk') {
      back.roundRect(r.x + 51, r.y - 7, 37, 41, 7).fill(0xb7a183).stroke({ color: 0x8d775e, width: 1 })
      back.roundRect(r.x + 54, r.y - 3, 31, 27, 5).fill(0xdac9a6)
      for (const x of [r.x + 9, r.x + r.width - 16]) front.roundRect(x, r.y + 26, 7, r.height - 26, 2).fill(0x96734f)
      front.poly([r.x + 6, r.y, r.x + r.width - 6, r.y, r.x + r.width, r.y + 34, r.x, r.y + 34]).fill(0xd2b58a).stroke({ color: 0x95734f, width: 1 })
      front.roundRect(r.x, r.y + 33, r.width, 9, 2).fill(0xb18c60)
      front.moveTo(r.x + 12, r.y + 21).lineTo(r.x + r.width - 13, r.y + 21).stroke({ color: 0xbc9b72, width: .6 })
      // A closed volume remains a static cue even when the reading place is empty.
      front.poly([r.x + 106, r.y + 5, r.x + 125, r.y + 6, r.x + 126, r.y + 21, r.x + 106, r.y + 20]).fill(0x829c8c).stroke({ color: 0x5f7c6d, width: .8 })
    } else {
      back.roundRect(r.x, r.y, r.width, 29, 5).fill(0xb79a73).stroke({ color: 0x967954, width: 1 })
      back.roundRect(r.x + 6, r.y + 3, r.width - 12, 22, 5).fill(0xb4c3ab)
      front.roundRect(r.x, r.y + 24, r.width, 10, 3).fill(0xc9ac7f)
      for (const x of [r.x + 8, r.x + r.width - 15]) front.rect(x, r.y + 34, 7, r.height - 34).fill(0x957650)
      front.moveTo(r.x + 13, r.y + 29).lineTo(r.x + r.width - 13, r.y + 29).stroke({ color: 0xe5d4aa, width: 1 })
    }
  }

  paint(residents: readonly BookhouseResident[], ticks: number, reducedMotion: boolean): void {
    if(this.artwork==='raster'&&this.residentContacts){
      // Books belong to each resident's hands. Every story writer gets a paper at their real desk position.
      for(const sprite of this.rasterProps.keys())sprite.visible=false
      const base=this.sprites.get('reading-desk-prop')!,active=new Set<string>()
      for(const {actor,point,presentation} of residents){
        if(presentation!=='writing')continue
        active.add(actor.id);let sprite=this.writerProps.get(actor.id)
        if(!sprite){sprite=new Sprite(base.texture);sprite.eventMode='none';sprite.label='bookhouse-writing-paper-'+actor.id;base.parent!.addChild(sprite);this.writerProps.set(actor.id,sprite)}
        sprite.position.set(base.x+point.x-142,base.y+point.y-328);sprite.width=base.width;sprite.height=base.height;sprite.zIndex=base.zIndex;sprite.visible=true
      }
      for(const[id,sprite]of this.writerProps)if(!active.has(id)){sprite.destroy({texture:false,textureSource:false});this.writerProps.delete(id)}
      return
    }
    for (const hotspot of bookhouseScene.hotspots) {
      const g = this.props.get(hotspot.id)!
      const resident = residents.find(({ actor, point }) => actor.behavior === hotspot.activity
        && Math.hypot(point.x - hotspot.anchor.x, point.y - hotspot.anchor.y) < 1
        && (!actor.intent || actor.intent.furnitureId === hotspot.id && actor.intent.seat === 'main'))
      if (this.artwork === 'raster') {
        // Ordinary hotspot props only. Story-specific poses/props need a separately approved integration.
        for (const [sprite, id] of this.rasterProps) if (id === hotspot.id) sprite.visible = !!resident
        continue
      }
      g.clear(); g.visible = !!resident
      if (!resident) continue
      const { point } = resident, wave = reducedMotion ? 0 : Math.sin(ticks / 16)
      g.zIndex = hotspot.id === 'reading-desk' ? furnitureDepth(bookhouseScene, hotspot.id)! - 2 : point.y * 10 + 3
      if (hotspot.id === 'bookcase') {
        const x = point.x, y = point.y - 34
        g.poly([x - 18, y - 4, x, y, x + 18, y - 4, x + 18, y + 12, x, y + 17, x - 18, y + 12]).fill(0xf5e8c7).stroke({ color: 0x9f8864, width: 1 })
        g.moveTo(x, y).lineTo(x, y + 17).stroke({ color: 0xbda681, width: .8 })
        g.moveTo(x + 4, y + 5).lineTo(x + 14, y + 3 + wave).stroke({ color: 0xc4b38d, width: .7 })
      } else if (hotspot.id === 'reading-desk') {
        const x = point.x, y = point.y - 28
        g.poly([x - 18, y - 2, x + 13, y - 2, x + 18, y + 20, x - 20, y + 20]).fill(0xf5ebd0).stroke({ color: 0xc1a77e, width: .7 })
        for (let i = 0; i < 3; i++) g.moveTo(x - 12, y + 4 + i * 4).lineTo(x + 9, y + 4 + i * 4).stroke({ color: 0xb8aa89, width: .7 })
        g.moveTo(x + 8 + wave, y + 11).lineTo(x + 16 + wave, y - 1).stroke({ color: 0x927358, width: 2 })
      } else {
        const x = point.x + 23, y = point.y - 25
        g.roundRect(x - 5, y - 9, 12, 17, 2).fill(0xa0b69b).stroke({ color: 0x71886c, width: .8 })
        g.rect(x - 2, y - 8, 7, 13).fill(0xe9dfc1)
        g.moveTo(x + 3, y - 8).lineTo(x + 3, y - 1 + wave).stroke({ color: 0xb88c77, width: 1.4 })
      }
    }
  }

  destroy(): void {
    this.destroyRaster()
    this.background.destroy()
    for (const collection of [this.backs, this.fronts, this.props]) {
      for (const node of collection.values()) node.destroy()
      collection.clear()
    }
  }
}

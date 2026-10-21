import { Container, Sprite, Texture } from 'pixi.js'
import type { Character, Expression, Pose } from './types.ts'

/** One container per functional part, with inherited pivots and explicit draw order. */
export class PaperDoll {
  readonly root = new Container()
  readonly nodes = new Map<string, Container>()
  private face: Sprite | undefined
  private expressions: Record<Expression, Texture> | undefined
  constructor(readonly character: Character, textures: Map<string, Texture>) {
    this.root.sortableChildren = true
    for (const part of character.parts) {
      const node = new Container()
      node.label = part.id
      node.sortableChildren = true
      node.zIndex = part.z
      this.nodes.set(part.id, node)
    }
    for (const part of character.parts) {
      const node = this.nodes.get(part.id)!
      const parent = part.parent ? this.nodes.get(part.parent)! : this.root
      parent.addChild(node)
      const file = part.file ?? part.expressions?.neutral
      if (file) {
        const texture = textures.get(file)
        if (!texture) throw Error('MISSING_TEXTURE:' + file)
        const sprite = new Sprite(texture)
        sprite.position.set(part.offset[0] - part.pivot[0], part.offset[1] - part.pivot[1])
        sprite.width = part.size[0]
        sprite.height = part.size[1]
        node.addChild(sprite)
        if (part.expressions) {
          this.face = sprite
          this.expressions = Object.fromEntries(Object.entries(part.expressions).map(([key, path]) => [key, textures.get(path)!])) as Record<Expression, Texture>
        }
      }
    }
  }
  apply(pose: Pose): void {
    for (const part of this.character.parts) {
      const node = this.nodes.get(part.id)!, transform = pose.transforms[part.id]!
      const parent = this.character.parts.find(p => p.id === part.parent)
      node.position.set(part.pivot[0] - (parent?.pivot[0] ?? 0) + transform.x, part.pivot[1] - (parent?.pivot[1] ?? 0) + transform.y)
      node.rotation = transform.rotation * Math.PI / 180
      node.scale.set(transform.scaleX, transform.scaleY)
    }
    if (this.face && this.expressions) this.face.texture = this.expressions[pose.expression]
  }
  destroy(): void { this.root.destroy({ children: true }) }
}

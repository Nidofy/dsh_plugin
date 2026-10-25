/** Deterministic QA only: production paper dolls and sampler, with a neutral desk occluder. */
import { Application, Container, Sprite, Texture, Graphics, Text } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { PaperDoll } from '../src/art/paper-doll.ts'
import { samplePose } from '../src/art/animation.ts'
import type { Character, AnimationSet } from '../src/art/types.ts'

interface Entry { id: string; character: Character; animations: AnimationSet; images: Record<string, string> }
type State = 'idle' | 'work' | 'eat' | 'rest'
declare global { interface Window {
  baselinePayload: Entry[]
  baselineReview: { ready: boolean; set: (state: State, size: number, background: string) => unknown }
} }
const app = new Application()
await app.init({ width: 960, height: 660, backgroundAlpha: 0, antialias: true, resolution: devicePixelRatio, autoStart: false, sharedTicker: false, preference: 'webgl' })
document.querySelector('#stage')!.append(app.canvas)
const rigs = [] as { entry: Entry; root: Container; doll: PaperDoll; arms: Map<string, Sprite>; rest: Sprite; table: Graphics; label: Text; guides: Graphics }[]
for (const [index, entry] of window.baselinePayload.entries()) {
  const textures = new Map<string, Texture>()
  for (const [file, data] of Object.entries(entry.images)) {
    const image = new Image(); image.src = data; await image.decode(); textures.set(file, Texture.from(image))
  }
  const root = new Container(), doll = new PaperDoll(entry.character, textures), table = new Graphics(), guides = new Graphics()
  root.position.set(index % 4 * 240 + 120, Math.floor(index / 4) * 220 + 180)
  app.stage.addChild(root); root.addChild(guides, doll.root, table)
  const rest = new Sprite(textures.get('activity/rest-pose.png')!); rest.anchor.set(.5, 1); root.addChild(rest)
  const arms = new Map<string, Sprite>()
  for (const name of ['work-left', 'work-right', 'eat-left', 'eat-right']) { const sprite = new Sprite(textures.get(`activity/${name}.png`)!); root.addChild(sprite); arms.set(name, sprite) }
  const label = new Text({ text: entry.id, style: { fontFamily: 'Arial, sans-serif', fontSize: 15, fill: 0x222222 } }); label.anchor.set(.5, 0); label.position.set(0, 12); root.addChild(label)
  rigs.push({ entry, root, doll, arms, rest, table, label, guides })
}
function set(state: State, size: number, background: string) {
  document.querySelector<HTMLElement>('#stage')!.style.background = background
  const dark = background === '#20232a', time = .4
  for (const { entry: { character, animations }, doll, rest, table, arms, label, guides } of rigs) {
    const busy = state === 'work' || state === 'eat', pose = samplePose(character, animations.actions.idle, time), scale = size / character.visibleHeight
    pose.expression = 'neutral'; doll.apply(pose)
    doll.root.scale.set(scale); doll.root.position.set(-character.feet[0] * scale, -character.feet[1] * scale); doll.root.visible = state !== 'rest'
    for (const id of ['arm-left', 'arm-right', 'leg-left', 'leg-right']) doll.nodes.get(id)!.visible = !busy
    rest.visible = state === 'rest'; rest.width = size * 96 / 108 * rest.texture.width / rest.texture.height; rest.height = size * 96 / 108 * (1 + .004 * Math.sin(time * 2))
    table.clear(); table.visible = busy
    if (busy) {
      const width = size * 1.06, top = -size * .29
      table.roundRect(-width / 2, top, width, size * .105, 4).fill(0xc2a27b).stroke({ color: 0x755c46, width: 1 })
      table.rect(-width * .43, top + size * .105, size * .055, size * .22).fill(0x876a4b)
      table.rect(width * .375, top + size * .105, size * .055, size * .22).fill(0x876a4b)
    }
    for (const [name, sprite] of arms) {
      sprite.visible = busy && name.startsWith(state + '-'); const left = name.endsWith('left')
      let x = left ? 325 : 535, y = state === 'eat' ? 495 : 560
      sprite.rotation = 0
      if (state === 'work' && left) { y += Math.sin(time * 7) * 6; sprite.rotation = Math.sin(time * 7) * .025 }
      if (state === 'eat' && !left) { y -= (1 + Math.sin(time * 3)) * 22; x -= (1 + Math.sin(time * 3)) * 10; sprite.rotation = -.05 }
      sprite.position.set((x - character.feet[0]) * scale, (y - character.feet[1]) * scale)
      sprite.width = (state === 'work' ? 175 : 220) * scale; sprite.height = (state === 'work' ? 200 : 185) * scale
    }
    label.style.fill = dark ? 0xf4eee4 : 0x292d31
    guides.clear().moveTo(-95, 0).lineTo(95, 0).moveTo(0, -5).lineTo(0, 5).stroke({ color: dark ? 0x9aa4ad : 0x606c76, width: 1, alpha: .6 })
  }
  app.render()
  return { state, size, background, time, expression: 'neutral', dpr: devicePixelRatio, tickerStarted: app.ticker.started, residents: rigs.map(({ entry, root, doll, rest }) => {
    const bounds = (state === 'rest' ? rest : doll.root).getBounds()
    return { id: entry.id, declaredFeet: entry.character.feet, visibleHeight: entry.character.visibleHeight, screenFeet: [root.x, root.y], bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
  }) }
}
window.baselineReview = { ready: true, set }
set('idle', 108, '#f7f0e5')

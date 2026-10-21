import { Application, Graphics, Texture } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { PaperDoll } from '../src/art/paper-doll.ts'
import { Animator } from '../src/art/animation.ts'
import type { Action, AnimationSet, Character, Expression } from '../src/art/types.ts'

const channel = 'nidofy-ai-village-phase2'
const actions: Action[] = ['idle', 'walk', 'pickup', 'dragging', 'put_down']
const expressions: Expression[] = ['neutral', 'happy', 'surprised', 'sleepy']
let token: string | undefined, started = false, disposed = false
let app: Application | undefined, doll: PaperDoll | undefined, animator: Animator | undefined
let running = false, parentHidden = false, frames = 0, elapsedFrames = 0, raf = 0, last = 0, accumulator = 0
let expression: Expression | undefined
let shadow: Graphics | undefined
let height = 320
const urls: string[] = []
const textures = new Map<string, Texture>()
const report = (type: string, extra: object = {}) => parent.postMessage({ channel, token, type, ...extra }, '*')
const isHidden = () => parentHidden || document.hidden
function draw() {
  if (!app || !doll || !animator || disposed) return
  const pose = animator.pose()
  if (expression) pose.expression = expression
  doll.apply(pose)
  app.render()
  frames++
}
function status() {
  if (!animator) return
  report('state', { action: animator.action, time: animator.elapsed, running, hidden: isHidden(), frames,
    expression: expression ?? animator.pose().expression, transforms: animator.pose().transforms,
    ended: animator.pose().ended, height, renderer: 'webgl' })
}
function tick(now: number) {
  raf = 0
  if (!running || isHidden() || disposed || !animator) return
  if (last) accumulator += Math.min((now - last) / 1000, .1)
  last = now
  if (accumulator >= 1 / 30) {
    animator.advance(accumulator)
    accumulator = 0
    draw()
    if (animator.pose().ended) { running = false; status(); return }
    if (++elapsedFrames % 10 === 0) status()
  }
  raf = requestAnimationFrame(tick)
}
function schedule() {
  cancelAnimationFrame(raf)
  raf = 0; last = 0; accumulator = 0
  if (running && !isHidden() && !disposed) raf = requestAnimationFrame(tick)
}
function scaleActor(value: number) {
  height = value
  if (!doll || !shadow) return
  const scale = height / doll.character.visibleHeight
  doll.root.scale.set(scale)
  doll.root.position.set(256 - doll.character.feet[0] * scale, 430 - doll.character.feet[1] * scale)
  shadow.clear().ellipse(256, 431, height * .23, height * .035).fill({ color: 0x34434d, alpha: .14 })
}
async function initialize(data: { character: Character; animations: AnimationSet; images: Record<string, ArrayBuffer> }) {
  for (const [file, bytes] of Object.entries(data.images)) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
    urls.push(url)
    const image = new Image()
    image.src = url
    await image.decode()
    if (disposed) return
    textures.set(file, Texture.from(image))
  }
  const instance = new Application()
  await instance.init({ width: 512, height: 512, resolution: Math.min(devicePixelRatio, 2),
    antialias: true, backgroundAlpha: 0, preference: 'webgl', autoStart: false, sharedTicker: false })
  if (disposed) { instance.destroy(true, { children: true }); return }
  app = instance
  document.body.append(app.canvas)
  shadow = new Graphics()
  doll = new PaperDoll(data.character, textures)
  animator = new Animator(data.character, data.animations)
  app.stage.addChild(shadow, doll.root)
  scaleActor(height)
  draw(); status(); report('rendered')
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== channel || disposed) return
  const message = event.data
  if (message.type === 'init' && !started) {
    if (typeof message.token !== 'string' || message.token.length !== 36 || !message.images
      || typeof message.images !== 'object' || Object.keys(message.images).length > 32
      || Object.values(message.images).some(bytes => !(bytes instanceof ArrayBuffer) || bytes.byteLength > 4 * 1024 * 1024)) return
    started = true; token = message.token
    // Definitions are build-validated fixtures, not a public asset import surface.
    void initialize(message).catch(error => report('failed', { error: String(error) }))
    return
  }
  if (message.token !== token || !animator || !app || !doll) return
  if (message.type === 'control') {
    if (actions.includes(message.action)) animator.change(message.action)
    if (typeof message.time === 'number' && Number.isFinite(message.time) && message.time >= 0 && message.time <= 120) animator.seek(message.time)
    if (message.expression === 'auto') expression = undefined
    else if (expressions.includes(message.expression)) expression = message.expression
    if ([96, 128, 320].includes(message.height)) scaleActor(message.height)
    if (typeof message.running === 'boolean') {
      running = message.running
      if (running && animator.pose().ended) animator.seek(0)
    }
    draw(); schedule(); status()
  } else if (message.type === 'visibility' && typeof message.hidden === 'boolean') {
    parentHidden = message.hidden
    schedule(); status()
  } else if (message.type === 'inspect') status()
})
document.addEventListener('visibilitychange', () => {
  schedule(); status()
})
window.addEventListener('pagehide', () => {
  disposed = true
  running = false
  cancelAnimationFrame(raf)
  doll?.destroy()
  app?.destroy(true, { children: true })
  for (const texture of textures.values()) texture.destroy(true)
  textures.clear()
  for (const url of urls) URL.revokeObjectURL(url)
})
report('ready')

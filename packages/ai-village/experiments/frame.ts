/** Phase 1: real offline Pixi renderer with two flat candidates, not game animation. */
import { Application, Sprite, Texture } from 'pixi.js'
// Pixi's official no-eval polyfills; keep CSP without unsafe-eval.
import 'pixi.js/unsafe-eval'

type Init = { channel: string; type: 'init'; token: string; character: ArrayBuffer; scene: ArrayBuffer }
const channel = 'nidofy-ai-village-phase1'
let token: string | undefined
let app: Application | undefined
const urls: string[] = []
let starting = false
const report = (type: string, extra: object = {}) => parent.postMessage({ channel, token, type, ...extra }, '*')
async function texture(bytes: ArrayBuffer): Promise<Texture> {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  urls.push(url)
  const image = new Image()
  image.src = url
  await image.decode()
  return Texture.from(image)
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== channel) return
  const message = event.data as Init
  if (message.type !== 'init' || starting || typeof message.token !== 'string' || message.token.length !== 36
    || !(message.character instanceof ArrayBuffer) || !(message.scene instanceof ArrayBuffer)
    || message.character.byteLength > 8 * 1024 * 1024 || message.scene.byteLength > 8 * 1024 * 1024) return
  starting = true
  token = message.token
  void (async () => {
    const [character, scene] = await Promise.all([texture(message.character), texture(message.scene)])
    app = new Application()
    await app.init({ width: 360, height: 480, resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true, antialias: true, preference: 'webgl', autoStart: false, sharedTicker: false })
    document.body.append(app.canvas)
    const backdrop = new Sprite(scene)
    backdrop.width = 360
    backdrop.height = 480
    const actor = new Sprite(character)
    actor.anchor.set(.5, 1)
    actor.height = 128
    actor.width = 128 * character.width / character.height
    actor.position.set(180, 380)
    app.stage.addChild(backdrop, actor)
    app.render()
    // Static art review needs one frame, not a permanent ticker.
    app.stop()
    report('rendered', { renderer: 'webgl', logicalSize: [360, 480], characterHeight: 128, tickerStarted: app.ticker.started })
  })().catch(error => report('failed', { error: String(error) }))
})
window.addEventListener('pagehide', () => {
  app?.destroy(true, { children: true, texture: true, textureSource: true })
  for (const url of urls) URL.revokeObjectURL(url)
})
report('ready')

/** Real component + offline WebGL browser acceptance in a local layout fixture; no user profile. */
import { build } from 'tsdown'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/live2d-preview')
await mkdir(out, { recursive: true })
await writeFile(join(out, 'preview.tsx'), `
import { createRoot } from 'react-dom/client'
import { Floating } from '../../packages/live2d/src/client/Floating.tsx'
const app = createRoot(document.getElementById('root'))
app.render(<Floating locale="zh" status="idle" onClose={() => app.unmount()} />)
`)
await build({ config: false, entry: { preview: join(out, 'preview.tsx') }, outDir: out, format: 'esm', platform: 'browser', target: 'es2022', clean: false, dts: false,
  deps: { alwaysBundle: [/./] }, define: { 'process.env.NODE_ENV': '"production"' } })
const code = await readFile(join(out, 'preview.js'), 'utf8')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Live2D 浮动面板验收</title>
<style>body{margin:0;background:#191919;color:#ddd;font:14px system-ui}#frame{position:relative;display:flex;height:100vh}nav{width:220px;padding:24px;box-sizing:border-box;background:#161616}main{flex:1;min-width:0}header{padding:24px}article{height:calc(100vh - 80px);box-sizing:border-box;padding:28px;display:flex;flex-direction:column}article p{max-width:600px;line-height:1.7;color:#aaa}textarea{margin-top:auto;border:1px solid #444;background:#242424;border-radius:16px;padding:20px;color:#aaa;resize:none}#overlay{position:absolute;inset:0;pointer-events:none}</style>
<div id="frame" data-rightbar-collapsed><nav>DSH<br><br>Live2D 浮动面板<br><small>验收夹具 · 示例会话</small></nav><main><header>当前会话</header><article data-conversation-content><h2>伙伴已就位</h2><p>角色使用与 Git 插件相同的右侧浮动卡片。外观调整直接作用于角色，关闭后恢复对话空间。</p><textarea aria-label="消息输入" placeholder="发送消息…"></textarea></article></main><div data-rightbar-col></div><div id="overlay" data-shell-overlay><div id="root"></div></div></div><script type="module">${code.replaceAll('</script', '<\\/script')}</script></html>`
await writeFile(join(out, 'index.html'), html)
const { handleRequest } = await import(pathToFileURL(join(root, 'packages/live2d/lib/index.js')).href)
const server = createServer((req, res) => {
  if (req.url.startsWith('/api/nidofy-live2d/')) { void handleRequest(req, res, new AbortController().signal); return }
  res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm')
const playwright = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.'))
if (!playwright) throw Error('Install Playwright in the development dependency provider')
const { chromium } = await import(pathToFileURL(join(pnpm, playwright, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
const browserDir = (await readdir(cache)).find(name => name.startsWith('chromium_headless_shell-'))
let executablePath
for (const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
  const file = join(cache, browserDir, candidate)
  if (await stat(file).catch(() => false)) { executablePath = file; break }
}
let browser
const errors = [], external = []
try {
  browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:') && !req.url().startsWith('blob:')) external.push(req.url()) })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.locator('[data-capability=animated]').waitFor({ timeout: 30000 })
  await page.screenshot({ path: join(out, 'floating.png') })
  assert.equal(await page.evaluate(() => typeof window.Live2DCubismCore), 'undefined')
  let frame = page.frames().find(frame => frame.url().includes('/api/nidofy-live2d/frame'))
  const isolated = await frame.evaluate(() => {
    let cookie = false, parentAccess = false
    try { void document.cookie } catch { cookie = true }
    try { void parent.document.body } catch { parentAccess = true }
    return { cookie, parentAccess, core: typeof window.Live2DCubismCore }
  })
  assert.deepEqual(isolated, { cookie: true, parentAccess: true, core: 'object' })
  await page.getByRole('button', { name: '外观', exact: true }).click()
  await page.getByRole('button', { name: '全身', exact: true }).click()
  assert.equal(page.frames().find(f => f.url().includes('/api/nidofy-live2d/frame')), frame)
  const settleDrawing = () => frame.evaluate(() => new Promise(resolve => {
    let remaining = 6
    const tick = () => { if (--remaining === 0) resolve(); else requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }))
  await settleDrawing()
  await page.screenshot({ path: join(out, 'full-body.png') })
  await page.getByRole('button', { name: '头像', exact: true }).click()
  await settleDrawing()
  await page.screenshot({ path: join(out, 'portrait.png') })
  // Context loss must stop drawing, destroy the iframe and retain a stable static failure.
  await frame.evaluate(() => document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await page.getByRole('button', { name: '重试动画' }).waitFor()
  assert.equal(await page.locator('iframe').count(), 0)
  await page.evaluate(() => document.getElementById('frame').removeAttribute('data-rightbar-collapsed'))
  await page.locator('.live2d-card').waitFor({ state: 'detached' })
  await page.evaluate(() => document.getElementById('frame').setAttribute('data-rightbar-collapsed', ''))
  await page.getByRole('button', { name: '重试动画' }).waitFor()
  assert.equal(await page.locator('iframe').count(), 0)
  await page.getByRole('button', { name: '重试动画' }).click()
  await page.locator('[data-capability=animated]').waitFor()
  await page.getByRole('checkbox', { name: '动画', exact: true }).uncheck()
  assert.equal(await page.locator('iframe').count(), 0)
  await page.getByRole('checkbox', { name: '动画', exact: true }).check()
  await page.locator('[data-capability=animated]').waitFor()
  await page.setViewportSize({ width: 800, height: 800 })
  await page.locator('.live2d-card').waitFor({ state: 'detached' })
  assert.equal(await page.locator('[data-nidofy-live2d-space]').count(), 0)
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.locator('[data-capability=animated]').waitFor()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('iframe').waitFor({ state: 'detached' })
  assert.equal(await page.locator('[data-nidofy-live2d-space]').count(), 0)
  assert.deepEqual(external, []); assert.deepEqual(errors, [])
  await writeFile(join(out, 'result.json'), JSON.stringify({ passed: true, checks: ['real WebGL render', 'opaque sandbox', 'no parent SDK', 'framing without reload', 'context-loss fallback', 'explicit retry', 'hidden teardown', 'animation toggle', 'narrow viewport', 'no external requests', 'no page errors'] }, null, 2))
  console.log('Chromium Live2D acceptance passed:', out)
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }

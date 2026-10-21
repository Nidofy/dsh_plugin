/** Short, repeatable measurements of the isolated official Desktop, not a universal benchmark. */
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cpus, totalmem } from 'node:os'
const root = resolve(import.meta.dirname, '..')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm')
const entry = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, entry, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18751')
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('dsh-app:'))
assert.ok(page)
const protocol = await browser.newBrowserCDPSession()
const system = await protocol.send('SystemInfo.getInfo')
const frame = await (await page.locator('.village-canvas iframe').elementHandle()).contentFrame()
assert.ok(frame)
const getMetrics = () => frame.evaluate(() => window.__sceneMetrics())
const renderer = await page.context().newCDPSession(page)
await renderer.send('Performance.enable')
const sample = async () => {
  const { processInfo } = await protocol.send('SystemInfo.getProcessInfo')
  const { metrics } = await renderer.send('Performance.getMetrics')
  return { at: Date.now(), processes: processInfo, heapBytes: metrics.find(m => m.name === 'JSHeapUsedSize')?.value }
}
const measure = async () => {
  const before = await sample()
  await page.waitForTimeout(15000)
  const after = await sample()
  const cpuSeconds = after.processes.reduce((n, p) => n + Math.max(0, p.cpuTime - (before.processes.find(b => b.id === p.id)?.cpuTime ?? p.cpuTime)), 0)
  const seconds = (after.at - before.at) / 1000
  return { seconds, totalDesktopCpuPercentOfOneCore: cpuSeconds / seconds * 100, parentRendererHeapBytes: after.heapBytes }
}
await page.getByRole('button', { name: 'Resume', exact: true }).click()
await page.waitForTimeout(1000)
const before = await getMetrics()
const visible = await measure()
const after = await getMetrics()
visible.fps = (after.frames - before.frames) / visible.seconds
visible.meanPaintMs = after.meanPaintMs
visible.maxPaintMs = after.maxPaintMs
visible.textures = after.textures
assert.ok(visible.fps > 20 && visible.fps <= 35, 'Unexpected visible frame rate')
await page.getByRole('button', { name: 'Pause', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Close courtyard', exact: true }).click()
await page.locator('.village-canvas iframe').waitFor({ state: 'detached' })
const hidden = await measure()
assert.equal(await page.locator('.village-canvas iframe').count(), 0)
assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 0)
await page.getByRole('button', { name: 'Open AI Village', exact: true }).click()
await page.locator('.village-canvas iframe').waitFor()
const result = { sampledAt: new Date().toISOString(), cpu: cpus()[0]?.model, logicalCores: cpus().length,
  ramGiB: totalmem() / 1024 ** 3, gpu: system.gpu.devices, visible, hidden,
  limitations: 'Two 15-second samples. CPU includes the entire isolated Desktop, parent heap excludes GPU/native textures. Paint time measures JS render submission, not GPU completion. No long soak or cross-device claim.' }
await writeFile(join(root, '.build/ai-village-v0.3-qa/desktop/performance.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
process.exit(0)

/** Read-only UI discovery / acceptance helper for the isolated official Desktop, CDP localhost only. */
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..')
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18751')
const qa = join(root, '.build/ai-village-v0.3-qa/desktop/discovery')
const artifacts = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'))
const tarball = id => join(root, 'dist', artifacts.find(p => p.name === `@nidofy/dsh-${id}`).file)
await mkdir(qa, { recursive: true })
if (process.argv[2] === 'install-suite') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  const dialogClose = page.getByRole('button', { name: 'Close', exact: true })
  if (await dialogClose.isVisible()) await dialogClose.click()
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  const installed = async id => {
    const profile = JSON.parse(await readFile(join(root, '.build/ai-village-phase5/home/profiles/desktop/package.json'), 'utf8'))
    return !!profile.dependencies?.[`@nidofy/dsh-${id}`]
  }
  for (const id of ['ai-village', 'source-control', 'live2d']) {
    const back = page.getByRole('button', { name: 'Back to plugins', exact: true })
    if (await back.count()) await back.click()
    const existing = page.getByRole('button', { name: `View @nidofy/dsh-${id}`, exact: true })
    if (await installed(id)) {
      await existing.waitFor()
      await existing.click()
      await page.getByRole('button', { name: `Uninstall @nidofy/dsh-${id}`, exact: true }).click()
      await page.getByRole('button', { name: 'Uninstall', exact: true }).click()
      for (let i = 0; i < 300 && await installed(id); i++) await page.waitForTimeout(100)
      if (await installed(id)) throw Error('Official uninstall did not complete: ' + id)
      await existing.waitFor({ state: 'detached' })
    }
    await page.getByRole('button', { name: 'Add plugin', exact: true }).click()
    await page.getByRole('textbox', { name: 'Package name or address' }).fill(tarball(id))
    await page.getByRole('button', { name: 'Install', exact: true }).click()
    await page.getByRole('button', { name: 'Enable now', exact: true }).waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Enable now', exact: true }).click()
    await page.waitForTimeout(750)
    console.log(`Official plugin manager installed and enabled ${id}`)
  }
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  console.log('Package replacement finished. Restart the isolated Desktop before acceptance to renew the official host module paths.')
}
if (process.argv[2] === 'click') {
  const label = process.argv[3]
  const allowed = ['Plugins', 'Back to plugins', 'View @nidofy/dsh-ai-village', 'Uninstall @nidofy/dsh-ai-village',
    'Uninstall', 'Cancel', 'Retry', 'Enable now', 'Open AI Village', 'Pause', 'Resume', 'Open Git / Hg tools',
    'Open Live2D companion', 'Close', 'Open right sidebar', 'Collapse right sidebar']
  if (!allowed.includes(label)) throw Error('Unknown acceptance action')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(1500)
}
if (process.argv[2] === 'plugins') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  if (!page) throw Error('Desktop workspace not found')
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await page.waitForTimeout(500)
}
if (process.argv[2] === 'add') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.getByRole('button', { name: 'Add plugin', exact: true }).click()
}
if (process.argv[2] === 'welcome') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('welcome.html'))
  await page.getByRole('button', { name: 'Add API Key', exact: true }).click()
}
if (process.argv[2] === 'skip') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('welcome.html'))
  await page.getByRole('button', { name: 'Set up later', exact: true }).click()
  await new Promise(resolve => setTimeout(resolve, 1000))
}
if (process.argv[2] === 'install') {
  const id = process.argv[3]
  if (!['ai-village', 'source-control', 'live2d'].includes(id)) throw Error('Unknown acceptance package')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.getByRole('textbox', { name: 'Package name or address' }).fill(tarball(id))
  await page.getByRole('button', { name: 'Install', exact: true }).click()
  await page.waitForTimeout(4000)
}
if (process.argv[2] === 'allow-koffi') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  const body = await page.locator('body').innerText()
  if (!body.includes('koffi@3.1.1') || !body.includes('Install scripts need permission')) throw Error('Unexpected install permission request')
  await page.getByRole('button', { name: 'Allow these scripts and retry', exact: true }).click()
  await page.waitForTimeout(4000)
}
if (process.argv[2] === 'enable') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.getByRole('button', { name: 'Enable now', exact: true }).click()
  await page.waitForTimeout(1500)
}
if (process.argv[2] === 'game') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'New session', exact: true }).first().click()
  await page.waitForTimeout(1000)
}
if (process.argv[2] === 'enable-village') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('dsh-app:'))
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  const toggle = page.getByLabel('Enable @nidofy/dsh-ai-village', { exact: true })
  if (await toggle.getAttribute('aria-checked') === 'false') await toggle.click()
  await page.waitForTimeout(2000)
}
if (process.argv[2] === 'view-village') {
  const page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('file:'))
  await page.getByRole('button', { name: 'View @nidofy/dsh-ai-village', exact: true }).click()
}
for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
  const url = new URL(page.url())
  console.log(JSON.stringify({ page: i, protocol: url.protocol, origin: url.origin, path: url.pathname, title: await page.title() }))
  console.log((await page.locator('body').innerText()).slice(0, 9000))
  console.log(await page.locator('input').evaluateAll(nodes => nodes.map(n => ({ type: n.type, placeholder: n.placeholder, aria: n.getAttribute('aria-label') }))))
  console.log(await page.locator('button[aria-label]').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))))
  console.log(await page.locator('[aria-label="Enable @nidofy/dsh-ai-village"]').evaluateAll(nodes => nodes.map(n => n.outerHTML)))
  console.log(await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus(),
    viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
    overlay: document.querySelectorAll('[data-nidofy-ai-village-overlay]').length,
    cards: document.querySelectorAll('.village-card').length,
    frames: document.querySelectorAll('.village-canvas iframe').length })))
  for (const frame of page.frames().filter(f => f.url().includes('/api/nidofy-ai-village/frame')))
    console.log(await frame.evaluate(() => window.__sceneMetrics?.()))
  await page.screenshot({ path: join(qa, `desktop-${i}.png`), timeout: 5000 }).catch(() => console.log('Window currently hidden; screenshot deferred'))
}
// Disconnect our automation process without closing the user's application.
process.exit(0)

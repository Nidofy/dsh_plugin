import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = resolve(import.meta.dirname, '..'), qa = join(root, '.build/ai-village-v0.6.1-qa/fresh-desktop')
await mkdir(qa, { recursive: true })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:18761'), page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('dsh-app:'))
assert.ok(page)
const click = name => page.getByRole('button', { name, exact: true }).click()
const state = () => page.evaluate(async () => (await (await fetch('/api/nidofy-ai-village/state')).json()).saved.world)
const errors = [], screenshots = []; page.on('pageerror', e => errors.push(e.message))
if (!await page.locator('.village-card').count()) await click('Open AI Village')
const editor = page.locator('[data-composer-input]'), draft = '真实桌面输入区验收 / unsent draft; 不发送'
await editor.fill(draft)
const attachment = 'ai-village-qa.txt'
await page.locator('input[type=file]').setInputFiles({ name: attachment, mimeType: 'text/plain', buffer: Buffer.from('Synthetic local attachment for AI Village coexistence QA. No model request.') })
await page.getByText(attachment, { exact: true }).waitFor()
await click('Expand courtyard'); await page.waitForTimeout(300)
const geometry = await page.evaluate(() => {
  const card = document.querySelector('.village-card').getBoundingClientRect(), composer = document.querySelector('[data-composer-card]').getBoundingClientRect()
  return { card: card.toJSON(), composer: composer.toJSON(), limited: document.querySelector('.village-error')?.textContent }
})
assert.ok(geometry.card.bottom <= geometry.composer.top || geometry.card.top >= geometry.composer.bottom)
assert.ok(geometry.card.left >= 280)
assert.equal(await editor.innerText(), draft)
assert.ok(await page.getByText(attachment, { exact: true }).count())
if (geometry.card.height < 360) { assert.match(geometry.limited, /Paused for limited space/); assert.equal(await page.locator('.village-canvas iframe').count(), 0) }
await click('Compact courtyard'); await page.locator('.village-canvas iframe').waitFor()
const before = await state()
await page.getByRole('tab', { name: 'Decor', exact: true }).click(); await click('Arrange my courtyard')
await page.getByLabel('Environment', { exact: true }).selectOption('twilight')
await click('Open right sidebar'); await page.locator('.village-card').waitFor({ state: 'detached' })
const closeName = await page.getByRole('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label') || n.textContent).find(s => /Close right sidebar|Collapse right sidebar/.test(s)))
assert.ok(closeName, 'A visible right-sidebar close control is required'); await click(closeName)
await page.getByRole('button', { name: 'Cancel my arrangement', exact: true }).waitFor()
assert.equal(await page.getByLabel('Environment', { exact: true }).inputValue(), 'twilight')
await page.getByRole('button', { name: 'Cancel my arrangement', exact: true }).press('Escape')
assert.deepEqual(await state(), before)
assert.equal(await page.getByRole('button', { name: 'Arrange my courtyard', exact: true }).evaluate(e => e === document.activeElement), true)
await editor.focus(); await editor.press('Escape'); assert.equal(await editor.innerText(), draft)
assert.ok(await page.getByText(attachment, { exact: true }).count())
const fileInputs = await page.locator('input[type=file]').evaluateAll(nodes => nodes.map(n => ({ accept: n.accept, multiple: n.multiple, label: n.getAttribute('aria-label') })))
const buttons = await page.getByRole('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label') || n.textContent).filter(s => /attach|upload|file|sidebar/i.test(s)))
assert.deepEqual(errors, [])
await writeFile(join(qa, 'ui-validation.json'), JSON.stringify({ passed: true, geometry, chatDraftPreserved: true, attachmentPreserved: true, sidebarDraftPreserved: true, localEscapeAndFocus: true, errors,
  fileInputs, buttons, screenshots, limitation: 'Real Desktop DOM and input controls; physical IME candidate window and approval shortcut not exercised.' }, null, 2))
console.log(JSON.stringify({ passed: true, geometry, fileInputs, buttons }))
process.exit(0)

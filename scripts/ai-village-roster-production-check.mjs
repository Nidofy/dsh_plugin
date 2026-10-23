/** Actual production UI/Host/iframe checks in an isolated profile. Build village first. */
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, cp, stat, mkdtemp } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runPreview } from './ai-village-phase4-browser.mjs'
import { villageUI } from './ai-village-ui-v1-navigation.mjs'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = await mkdtemp(join(root, '.build/roster-production-'))
const label = process.argv.find(value => value.startsWith('--label='))?.slice(8) ?? new Date().toISOString().replaceAll(/[:.]/g, '-')
assert.match(label, /^[a-zA-Z0-9][a-zA-Z0-9-]{0,80}$/)
const qa = join(pkg, 'art/QA/roster-production', label)
assert.equal(await stat(qa).then(() => true).catch(() => false), false, 'Keep earlier evidence: choose a new label')
await mkdir(qa, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
const sourceFiles = (await readdir(join(pkg, 'src'), { recursive: true })).filter(file => /\.tsx?$/.test(file)).sort()
const assetFiles = (await readdir(join(pkg, 'assets'), { recursive: true })).filter(file => /\.(png|json)$/.test(file)).sort()
const build = {
  head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), dirty: git('status', '--short'),
  version: JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8')).version,
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file.replaceAll('\\', '/'), hash(await readFile(join(pkg, 'src', file)))]))),
  assetHashes: Object.fromEntries(await Promise.all(assetFiles.map(async file => [file.replaceAll('\\', '/'), hash(await readFile(join(pkg, 'assets', file)))]))),
  scope: 'Local production lib and actual authenticated Host fixture; package identity requires separate final archive comparison',
}
await writeFile(join(qa, 'build.json'), JSON.stringify(build, null, 2) + '\n')
await cp(join(pkg, 'lib'), join(out, 'lib'), { recursive: true })
await cp(join(pkg, 'assets'), join(out, 'assets'), { recursive: true })
await runPreview({ root, pkg, out, buildOnly: true })
const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href)
const plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
const profile = join(out, 'profile'); await mkdir(profile)
const host = await harness({ profile, plugin, html: await readFile(join(out, 'index.html'), 'utf8') })
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), pw = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).filter(n => n.startsWith('chromium_headless_shell-')).sort().at(-1)
const executablePath = join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'); await stat(executablePath)
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
const errors = [], external = [], checks = [], captures = []
const bundles = Object.fromEntries(await Promise.all(['index.js', 'client.js', 'frame.js'].map(async file => [file, createHash('sha256').update(await readFile(join(out, 'lib', file))).digest('hex')])))
build.bundles = bundles
build.fixtureSha256 = hash(await readFile(join(out, 'fixture.js')))
await writeFile(join(qa, 'build.json'), JSON.stringify(build, null, 2) + '\n')
const names = { seedance: 'Seedance', glm: 'GLM', minimax: 'MiniMax', llama: 'Llama', mistral: 'Mistral' }
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
  await context.route('**/*', route => {
    if (route.request().url().startsWith(host.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
    external.push(new URL(route.request().url()).origin); return route.abort()
  })
  page = await context.newPage(); page.setDefaultTimeout(25000)
  page.on('pageerror', error => errors.push(error.message))
  const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
  const settled = () => page.waitForFunction(() => { const s = window.__villageHostFixture.inspect(); return s.ready && !s.error && !s.preferencesSaving && !s.reasons.includes('commit-pending') && s.saveReceipt.status !== 'pending' })
  const entered = () => page.waitForFunction(() => { const s = window.__villageHostFixture.inspect(); return s.frameReady && !s.entrance.blocking && !s.error })
  const direct = name => page.getByRole('button', { name, exact: true }).click()
  const metrics = async () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame')).evaluate(() => window.__sceneMetrics())
  const close = async () => { if (await page.getByRole('button', { name: '关闭面板', exact: true }).isVisible()) await direct('关闭面板') }
  const residents = async () => {
    if ((await inspect()).presentation.drawer === 'closed' || (await inspect()).presentation.tab !== 'residents') await page.getByRole('tab', { name: '居民', exact: true }).click()
    if ((await inspect()).presentation.page === 'admissions') await direct('返回')
    if (await page.getByRole('button', { name: '全部居民', exact: true }).isVisible()) await direct('全部居民')
  }
  const admissions = async () => { await residents(); await direct('安排入住') }
  const screenshot = async name => {
    await page.waitForTimeout(250)
    await page.screenshot({ path: join(qa, name + '.png') })
    const s = await inspect(); captures.push({ name, actor: s.world?.actor.id, residents: s.world && [s.world.actor, ...s.world.companions].map(a => a.id), region: s.world?.region.active, metrics: s.frameReady ? await metrics() : null })
  }
  await page.goto(host.entry)
  await direct('打开 AI 小院')
  await page.locator('.entrance-portraits').waitFor()
  assert.equal(await page.locator('.entrance-portrait').count(), 7)
  await entered(); await villageUI(page).click('暂停'); await settled()
  await villageUI(page).click('展开小院'); await entered()
  for (const [id, name] of Object.entries(names)) {
    await admissions()
    assert.equal(await page.locator('.village-admissions input[type=checkbox]').count(), 12)
    await page.getByLabel('入住 ' + name, { exact: true }).click(); await settled(); await entered()
    assert.ok((await inspect()).world.companions.some(a => a.id === id))
    await residents()
    await page.locator('.village-person').filter({ has: page.locator('strong', { hasText: name }) }).getByRole('button', { name: '看看', exact: true }).click()
    await settled(); await admissions(); await direct('仅留当前'); await settled(); await entered(); await close()
    const s = await inspect(); assert.equal(s.world.actor.id, id); assert.equal(s.world.companions.length, 0)
    assert.equal(s.resourceKeys.length, 23); assert.equal((await metrics()).textures, 23)
    assert.ok(s.resourceKeys.every(key => key.startsWith(id + '/') || key.startsWith('scene/')))
    await screenshot('solo-' + id)
    checks.push(id + ': admitted, selected, rendered alone with 23 textures and unrelated resident textures released')
    if (process.argv.includes('--activities')) for (const activity of ['work', 'eat', 'rest']) {
      await villageUI(page).click('继续'); await settled()
      const m = await metrics(), actor = (await inspect()).world.actor, seat = m.geometry.find(h => h.activity === activity)
      const box = await page.locator('.village-canvas iframe').boundingBox(), projection = m.viewport.world
      const screen = p => ({ x: box.x + projection.x + p.x * projection.scale, y: box.y + projection.y + (p.y - 40) * projection.scale })
      const from = screen(actor.position), to = screen(seat.anchor)
      await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up()
      await page.waitForFunction(activity => window.__villageHostFixture.inspect().world.actor.behavior === activity, activity)
      await villageUI(page).click('暂停'); await settled()
      assert.equal((await inspect()).world.actor.behavior, activity)
      await screenshot(id + '-' + activity)
      checks.push(id + ': actual drag and production furniture ' + activity)
    }
  }
  await admissions()
  for (const name of ['DeepSeek', 'Claude', 'Seedance', 'GLM', 'MiniMax', 'Llama']) {
    await page.getByLabel('入住 ' + name, { exact: true }).click(); await settled(); await entered()
  }
  assert.equal((await inspect()).world.companions.length, 6)
  assert.equal(await page.getByLabel('入住 Kimi', { exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel('入住 Mistral', { exact: true }).isDisabled(), false)
  await page.locator('.village-panel').evaluate(el => { el.scrollTop = 0 })
  await screenshot('twelve-resident-admissions-zh')
  await page.getByLabel('入住 Mistral', { exact: true }).scrollIntoViewIfNeeded(); await screenshot('new-resident-choices-zh')
  await page.evaluate(() => window.__villageHostFixture.reviewLanguage('en')); await settled()
  assert.equal(await page.getByLabel('Resident Kimi', { exact: true }).isDisabled(), true)
  await page.locator('.village-panel').evaluate(el => { el.scrollTop = 0 })
  await screenshot('twelve-resident-admissions-en')
  await page.getByLabel('Resident Mistral', { exact: true }).scrollIntoViewIfNeeded(); await screenshot('new-resident-choices-en')
  await page.evaluate(() => window.__villageHostFixture.reviewLanguage('zh')); await settled(); await close()
  assert.equal((await inspect()).resourceKeys.length, 128); assert.equal((await metrics()).textures, 128)
  await screenshot('mixed-seven-courtyard')
  checks.push('Twelve bilingual choices, seventh resident limit, five new + two original residents: 128 courtyard textures')
  await page.getByRole('tab', { name: '布置', exact: true }).click(); await direct('家具'); await direct('前往 AI 书屋'); await settled(); await entered(); await close()
  assert.equal((await inspect()).world.region.active, 'bookhouse'); assert.equal((await metrics()).textures, 121)
  await screenshot('mixed-seven-bookhouse')
  await page.evaluate(() => window.__villageHostFixture.flush()); await settled()
  const saved = (await inspect()).world
  await page.evaluate(() => window.__villageHostFixture.dispose()); await page.reload(); await direct('打开 AI 小院'); await entered()
  assert.deepEqual((await inspect()).world, saved); assert.equal((await metrics()).textures, 121)
  await screenshot('mixed-seven-cold-restore')
  checks.push('Mixed seven travel to bookhouse with 121 textures and preserve exact paused world on cold restore')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  await writeFile(join(qa, 'validation.json'), JSON.stringify({ checks, captures, errors, external, bundles, profileScope: 'Isolated .build profile; no Desktop install or user profile change' }, null, 2) + '\n')
  console.log(JSON.stringify({ checks, screenshots: captures.length, errors, external, evidence: qa }, null, 2))
} catch (error) {
  if (page) { await page.screenshot({ path: join(qa, 'failure.png') }).catch(() => {}); await writeFile(join(qa, 'failure.txt'), String(error)) }
  throw error
} finally {
  if (page) await page.evaluate(() => window.__villageHostFixture.dispose()).catch(() => {})
  await browser.close(); await host.close()
}

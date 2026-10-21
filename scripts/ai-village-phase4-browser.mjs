import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, writeFile, readdir, mkdir, mkdtemp, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
export async function runPreview({ root, pkg, out, serve }) {
  const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
  const dependency = createRequire(join(source, 'packages/client/connection/package.json'))
  const baseline = JSON.parse(await readFile(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
  const upstream = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
  const alias = Object.fromEntries(Object.entries(upstream).filter(([k]) => !k.includes('*') && k.startsWith('@deepseek-ai/dsh-')).map(([k, v]) => [k, resolve(baseline.source, v[0])]))
  alias.zod = dependency.resolve('zod')
  await build({ config: false, entry: { harness: join(pkg, 'experiments/phase4-host.ts') }, outDir: out, alias,
    format: 'esm', platform: 'node', target: 'es2024', clean: false, dts: false,
    deps: { alwaysBundle: [/^@deepseek-ai\/dsh-/, 'zod'], neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery'] } })
  const browserDependency = createRequire(join(root, '.build/live2d-official-deps/package.json'))
  await build({ config: false, entry: { fixture: join(pkg, 'experiments/phase4-client.tsx') }, outDir: out,
    alias: { 'use-sync-external-store/shim/with-selector': browserDependency.resolve('use-sync-external-store/shim/with-selector') },
    format: 'iife', platform: 'browser', target: 'es2022', clean: false, dts: false, deps: { alwaysBundle: [/./] },
    define: { 'process.env.NODE_ENV': '\"production\"' }, outputOptions: { entryFileNames: 'fixture.js' } })
  const code = await readFile(join(out, 'fixture.js'), 'utf8')
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>AI 小院 · DSH 接入验收</title><style>
  body{margin:0;background:#191d1a;color:#e5e9e3;font:14px system-ui}#frame{position:relative;display:flex;height:100vh}nav{width:200px;padding:24px;box-sizing:border-box;background:#151916}main{flex:1;min-width:0}header{padding:20px;display:flex;justify-content:space-between;align-items:center}article{height:calc(100vh - 100px);box-sizing:border-box;padding:24px;display:flex;flex-direction:column}article p{max-width:620px;line-height:1.8;color:#adb8aa}textarea{margin-top:auto;min-height:90px;box-sizing:border-box;border:1px solid #586051;border-radius:16px;background:#242a24;color:#ddd;padding:18px;resize:none}#overlay{position:absolute;inset:0;pointer-events:none}button{color:inherit;background:#293329;border:1px solid #50624a;border-radius:8px;padding:6px;margin:3px;cursor:pointer}nav small{display:block;margin-top:18px;line-height:1.7;color:#a0ae9b}
  </style><div id="frame" data-rightbar-collapsed><nav><strong>DSH · AI 小院</strong><small>阶段 4 接入验收夹具<br>真实插件组件、官方 Connection 鉴权、独立临时 profile</small><br><button id="session">切换示例会话</button><button id="sidebar">侧栏开合</button><button id="reconnect">模拟重连</button></nav><main><header>示例会话 <span id="launchers"></span></header><article data-conversation-content><h2>同一方小院，跟随窗口</h2><p>使用右上角 ⌂ 打开小院。切换会话保持进度；打开 Git 后小院下移，打开 Live2D 会关闭小院。侧栏展开、窗口隐藏和断连会暂停世界。</p><p>左侧控制项仅用于验收，不属于插件界面。实际 Desktop 安装将在阶段 5 验证。</p><textarea aria-label="消息输入" placeholder="可在这里检查草稿和输入焦点…"></textarea></article></main><div data-rightbar-col></div><div id="overlay" data-shell-overlay><div id="root"></div></div></div><script>${code.replaceAll('</script', '<\\/script')}</script></html>`
  await writeFile(join(out, 'index.html'), html)
  const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href)
  const plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
  const live = await import(pathToFileURL(join(root, 'packages/live2d/lib/index.js')).href)
  const profile = serve ? join(out, 'profile') : await mkdtemp(join(out, 'browser-profile-'))
  await mkdir(profile, { recursive: true })
  const h = await harness({ profile, plugin, html, ...(serve ? { port: 18749 } : {}), extra: async (req, res) => {
    if (req.url.startsWith('/api/nidofy-live2d/')) await live.handleRequest(req, res, new AbortController().signal)
    else res.writeHead(404).end()
  } })
  if (serve) { await writeFile(join(out, 'preview-entry.json'), JSON.stringify({ entry: h.entry })); console.log('Phase 4 authenticated preview ready at http://127.0.0.1:18749 (entry token kept in local preview-entry.json)'); return }
  const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
  const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
  let executablePath
  for (const c of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
    const p = join(cache, folder, c); if (await stat(p).catch(() => false)) { executablePath = p; break }
  }
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
  const qa = join(pkg, 'art/QA/phase4'); await mkdir(qa, { recursive: true })
  const errors = [], external = [], checks = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
    await context.route('**/*', route => {
      if (route.request().url().startsWith(h.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
      external.push(route.request().url()); return route.abort()
    })
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
    await page.goto(h.entry)
    const inspect = () => page.evaluate(() => window.__villageHostFixture.inspect())
    const ready = async () => {
      await page.waitForFunction(() => window.__villageHostFixture?.inspect().frameReady || window.__villageHostFixture?.inspect().error)
      assert.equal((await inspect()).error, '')
    }
    await page.getByRole('button', { name: '打开 AI 小院', exact: true }).click(); await ready()
    const currentFrame = () => page.frames().find(f => f.url().includes('/api/nidofy-ai-village/frame'))
    const drag = async (target, finish = true) => {
      const actor = (await inspect()).world.actor.position, box = await page.locator('.village-canvas iframe').boundingBox()
      const scale = Math.min(box.width / 360, box.height / 480), point = p => ({ x: box.x + (box.width - scale * 360) / 2 + p.x * scale, y: box.y + (box.height - scale * 480) / 2 + (p.y - 45) * scale })
      const start = point(actor), end = point(target)
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 })
      if (finish) await page.mouse.up(); await page.waitForTimeout(100)
    }
    const rosterQa = join(pkg, 'art/QA/roster')
    await mkdir(rosterQa, { recursive: true })
    const renderer = currentFrame()
    for (const id of ['claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen', 'bluewhale']) {
      await page.getByRole('combobox', { name: '选择角色' }).selectOption(id)
      assert.equal((await inspect()).world.actor.id, id)
      assert.equal(currentFrame(), renderer)
      for (const [activity, target] of [['work', { x: 102, y: 283 }], ['eat', { x: 268, y: 283 }], ['rest', { x: 274, y: 411 }]]) {
        await drag(target)
        assert.equal((await inspect()).world.actor.behavior, activity)
        await page.waitForTimeout(180)
        await page.locator('.village-canvas').screenshot({ path: join(rosterQa, `${id}-${activity}.png`) })
      }
      await drag({ x: 173, y: 365 })
      await page.waitForTimeout(700)
      await page.locator('.village-canvas').screenshot({ path: join(rosterQa, `${id}-idle.png`) })
      await page.evaluate(() => window.__villageHostFixture.flush())
    }
    assert.equal((await currentFrame().evaluate(() => window.__sceneMetrics())).textures, 130)
    checks.push('7 characters, 21 activity placements, live selector without renderer replacement; fixed texture count 130')
    await page.locator('textarea').fill('保留草稿：中文输入 pending approval')
    await drag({ x: 102, y: 283 }); assert.equal((await inspect()).world.actor.behavior, 'work')
    await page.getByRole('button', { name: '暂停', exact: true }).click(); await page.evaluate(() => window.__villageHostFixture.flush())
    const frozen = (await inspect()).world
    await page.screenshot({ path: join(qa, 'integrated-courtyard.png') })
    for (let i = 0; i < 50; i++) {
      await page.evaluate(() => window.__villageHostFixture.sidebar(true))
      await page.locator('.village-canvas iframe').waitFor({ state: 'detached' })
      assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 0)
      await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await ready()
      assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 1)
    }
    assert.deepEqual((await inspect()).world, frozen)
    checks.push('50 sidebar cycles: one reservation, one frame, paused world unchanged')
    for (let i = 0; i < 10; i++) await page.evaluate(() => window.__villageHostFixture.session())
    assert.deepEqual((await inspect()).world, frozen)
    const beforeFrame = currentFrame()
    await page.evaluate(() => window.__villageHostFixture.session())
    assert.equal(currentFrame(), beforeFrame)
    checks.push('session changes preserve world and renderer instance')
    await page.getByRole('button', { name: '打开 Git / Hg 工具', exact: true }).click()
    await page.locator('.vcs-floating').waitFor()
    await page.waitForFunction(() => {
      const git = document.querySelector('.vcs-floating')?.getBoundingClientRect(), game = document.querySelector('.village-card')?.getBoundingClientRect()
      return git && game && game.top >= git.bottom + 10
    })
    assert.equal(currentFrame(), beforeFrame)
    assert.equal(await page.locator('[data-nidofy-ai-village-space],[data-nidofy-vcs-space]').count(), 1)
    await page.screenshot({ path: join(qa, 'git-and-village.png') })
    await page.getByRole('button', { name: '打开 Live2D 伙伴', exact: true }).click()
    await page.locator('.live2d-card').waitFor()
    assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 0)
    await page.getByRole('button', { name: '打开 AI 小院', exact: true }).click(); await ready()
    assert.equal(await page.locator('.live2d-card,.vcs-floating').count(), 0)
    assert.deepEqual((await inspect()).world, frozen)
    checks.push('Git above village simultaneously, one width reservation and same iframe; Live2D excludes both')
    await page.evaluate(() => window.__villageHostFixture.connection(false))
    await page.locator('.village-canvas iframe').waitFor({ state: 'detached' })
    await h.disable(); await h.enable()
    await page.evaluate(() => { window.__villageHostFixture.connection(true); window.__villageHostFixture.reset() }); await ready()
    assert.deepEqual((await inspect()).world, frozen)
    checks.push('Host restart and connection generation reset reconcile profile, epoch and revision, preserving user pause')
    await page.setViewportSize({ width: 800, height: 960 })
    await page.locator('.village-card').waitFor({ state: 'detached' })
    await page.setViewportSize({ width: 1440, height: 960 }); await ready()
    await page.evaluate(() => window.__villageHostFixture.panel(true))
    await page.locator('.village-card').waitFor({ state: 'detached' })
    await page.evaluate(() => window.__villageHostFixture.panel(false)); await ready()
    assert.deepEqual((await inspect()).world, frozen)
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await drag({ x: 170, y: 350 }, false)
    await page.evaluate(() => window.__villageHostFixture.sidebar(true)); await page.mouse.up()
    assert.equal((await inspect()).drag, null)
    assert.deepEqual((await inspect()).world.actor.position, frozen.actor.position)
    await page.evaluate(() => window.__villageHostFixture.sidebar(false)); await ready()
    await page.locator('textarea').focus(); await page.keyboard.press('Escape')
    assert.equal(await page.locator('.village-card').count(), 1)
    assert.equal(await page.locator('textarea').inputValue(), '保留草稿：中文输入 pending approval')
    checks.push('narrow/main panel hiding, drag rollback, conversation focus and draft preserved')
    await page.getByRole('button', { name: '暂停', exact: true }).click(); await page.evaluate(() => window.__villageHostFixture.flush())
    const last = (await inspect()).world
    await page.reload()
    await page.getByRole('button', { name: '打开 AI 小院', exact: true }).click(); await ready()
    assert.deepEqual((await inspect()).world, last)
    const second = await context.newPage(); await second.goto(h.url)
    await second.getByRole('button', { name: '打开 AI 小院', exact: true }).click()
    await second.getByRole('alert').waitFor(); assert.match(await second.getByRole('alert').innerText(), /另一个窗口/)
    await second.close()
    checks.push('refresh restores last durable snapshot, second window cannot simulate')
    await page.locator('.village-members summary').click()
    await page.getByRole('button', { name: '全员入住', exact: true }).click()
    await page.locator('.village-members summary').click()
    await page.evaluate(() => window.__villageHostFixture.flush())
    const members = w => [w.actor, ...w.companions]
    assert.equal(members((await inspect()).world).length, 7)
    await currentFrame().waitForFunction(() => window.__sceneMetrics().actors === 7)
    const everyone = (await inspect()).world
    await page.getByRole('combobox', { name: '选择角色' }).selectOption('gpt')
    assert.deepEqual(members((await inspect()).world).sort((a,b) => a.id.localeCompare(b.id)), members(everyone).sort((a,b) => a.id.localeCompare(b.id)))
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await page.waitForTimeout(700)
    for (const actor of members((await inspect()).world)) assert.ok(actor.phase > members(everyone).find(a => a.id === actor.id).phase)
    for (const activity of ['work', 'eat', 'rest']) {
      const w = (await inspect()).world
      if (members(w).some(a => a.behavior === activity)) continue
      const front = members(w).filter(a => !['work','eat','rest'].includes(a.behavior)).sort((a,b) => b.position.y - a.position.y || b.id.localeCompare(a.id))[0]
      await page.getByRole('combobox', { name: '选择角色' }).selectOption(front.id)
      const target = h.scene?.hotspots?.find(h => h.id === activity)?.anchor ?? ({ work: {x:102,y:283}, eat:{x:268,y:283}, rest:{x:274,y:411} })[activity]
      await drag(target)
      assert.equal((await inspect()).world.actor.behavior, activity)
    }
    await page.getByRole('button', { name: '暂停', exact: true }).click()
    await page.evaluate(() => window.__villageHostFixture.flush())
    const multi = (await inspect()).world
    assert.equal(new Set(members(multi).filter(a => ['work','eat','rest'].includes(a.behavior)).map(a => a.behavior)).size, 3)
    await page.getByRole('button', { name: '打开 Git / Hg 工具', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.village-card').getBoundingClientRect().top > document.querySelector('.vcs-floating').getBoundingClientRect().bottom)
    await page.screenshot({ path: join(qa, 'seven-residents-stacked.png') })
    await page.getByRole('button', { name: '打开 Git / Hg 工具', exact: true }).click()
    await page.reload(); await page.getByRole('button', { name: '打开 AI 小院', exact: true }).click(); await ready()
    assert.deepEqual((await inspect()).world, multi)
    await currentFrame().waitForFunction(() => window.__sceneMetrics().actors === 7)
    await page.locator('.village-members summary').click()
    await page.getByRole('button', { name: '仅留当前', exact: true }).click()
    await currentFrame().waitForFunction(() => window.__sceneMetrics().actors === 1)
    assert.equal((await currentFrame().evaluate(() => window.__sceneMetrics())).textures, 130)
    checks.push('Seven residents independently simulate, focus preserves all actors, three concurrent activities persist across reload; removal releases rigs')
    await page.evaluate(() => window.__villageHostFixture.dispose())
    await page.locator('.village-card').waitFor({ state: 'detached' })
    assert.equal(await page.locator('[data-nidofy-ai-village-space]').count(), 0)
    assert.equal((await inspect()).ready, false)
    await context.close()
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    const result = { officialRevision: baseline.revision, checks, errors, external }
    await writeFile(join(qa, 'validation.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result, null, 2))
  } finally { await browser.close(); await h.close() }
}

import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, writeFile, readdir, mkdir, mkdtemp, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
export async function runPreview({ root, pkg, out, serve, buildOnly = false }) {
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
  </style><div id="frame" data-rightbar-collapsed><nav><strong>DSH · AI 小院</strong><small>阶段 4 接入验收夹具<br>真实插件组件、官方 Connection 鉴权、独立临时 profile</small><br><button id="session">切换示例会话</button><button id="sidebar">侧栏开合</button><button id="reconnect">模拟重连</button></nav><main><header>示例会话 <span data-conversation-header-corner style="display:flex;align-items:center;margin-left:auto"><button id="right-sidebar" aria-label="展开 sidebar">◫</button></span></header><article data-conversation-content><h2>同一方小院，跟随窗口</h2><p>使用右上角 ⌂ 打开小院。切换会话保持进度；打开 Git 后小院下移，打开 Live2D 会关闭小院。侧栏展开、窗口隐藏和断连会暂停世界。</p><p>左侧控制项仅用于验收，不属于插件界面。实际 Desktop 安装将在阶段 5 验证。</p><textarea aria-label="消息输入" placeholder="可在这里检查草稿和输入焦点…"></textarea></article></main><div data-rightbar-col></div><div id="overlay" data-shell-overlay><div id="root"></div></div></div><script>${code.replaceAll('</script', '<\\/script')}</script></html>`
  await writeFile(join(out, 'index.html'), html)
  if (buildOnly) return
  const { harness } = await import(pathToFileURL(join(out, 'harness.mjs')).href)
  const plugin = await import(pathToFileURL(join(out, 'lib/index.js')).href)
  const live = await import(pathToFileURL(join(root, 'packages/live2d/lib/index.js')).href)
  const profile = serve ? join(out, 'profile-v04') : await mkdtemp(join(out, 'browser-profile-'))
  await mkdir(profile, { recursive: true })
  const h = await harness({ profile, plugin, html, ...(serve ? { port: 18754 } : {}), extra: async (req, res) => {
    if (req.url.startsWith('/api/nidofy-live2d/')) await live.handleRequest(req, res, new AbortController().signal)
    else res.writeHead(404).end()
  } })
  if (serve) { await writeFile(join(out, 'preview-entry.json'), JSON.stringify({ entry: h.entry })); console.log('Phase 4 authenticated preview ready at http://127.0.0.1:18754 (entry token kept in local preview-entry.json)'); return }
  const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
  const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
  let executablePath
  for (const c of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
    const p = join(cache, folder, c); if (await stat(p).catch(() => false)) { executablePath = p; break }
  }
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
  const qa = join(root, '.build/ai-village-v0.5-qa/browser'); await mkdir(qa, { recursive: true })
  const errors = [], external = [], checks = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
    await context.route('**/*', route => {
      if (route.request().url().startsWith(h.url + '/') || route.request().url().startsWith('blob:')) return route.continue()
      external.push(route.request().url()); return route.abort()
    })
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
    await page.goto(h.entry)
    for (const width of [1440, 2560]) {
      await page.setViewportSize({width,height:960})
      // Replacing the header models the official blank/populated session remount.
      for (const blank of [true, false]) {
        await page.evaluate(blank => {
          const old=document.querySelector('[data-conversation-header-corner]'), next=old.cloneNode(false)
          next.innerHTML='<button id="right-sidebar" aria-label="展开 sidebar">◫</button>'
          old.replaceWith(next); document.querySelector('header').firstChild.textContent=blank?'':'示例会话 '
        },blank)
        await page.waitForFunction(()=>document.querySelectorAll('[data-conversation-header-corner] [data-nidofy-header-launcher]').length===3)
        const positions=await page.evaluate(()=>[...document.querySelector('[data-conversation-header-corner]').children].map(el=>({id:el.getAttribute('data-nidofy-header-launcher')??'sidebar',...el.getBoundingClientRect().toJSON()})))
        assert.deepEqual(positions.map(p=>p.id),['source-control','live2d','ai-village','sidebar'])
        assert.ok(positions[3].right > width - 40, 'Sidebar and launchers must remain at the right edge')
        for(let i=0;i<3;i++) {
          assert.ok(positions[i].right<=positions[i+1].left)
          assert.ok(Math.abs(positions[i].top+positions[i].height/2-positions[3].top-positions[3].height/2)<1)
        }
        assert.equal(await page.locator('[data-nidofy-header-launcher]').count(),3)
        await page.locator('header').screenshot({path:join(qa,`launchers-${width}-${blank?'blank':'session'}.png`)})
      }
    }
    checks.push('Blank/populated header remounts at 1440/2560: one Git/Live2D/Village group left of sidebar, aligned vertical centers and stable order')
    await page.setViewportSize({width:1440,height:960})
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
    const rosterQa = join(qa, 'roster')
    await mkdir(rosterQa, { recursive: true })
    const renderer = currentFrame()
    for (const id of ['claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen', 'bluewhale']) {
      await page.getByRole('combobox', { name: '选择角色' }).selectOption(id)
      await page.waitForFunction(id=>window.__villageHostFixture.inspect().world.actor.id===id,id);await ready()
      assert.equal((await inspect()).world.actor.id, id)
      assert.equal(currentFrame(), renderer)
      for (const [activity, target] of [['work', { x: 102, y: 283 }], ['eat', { x: 175, y: 374 }], ['rest', { x: 274, y: 245 }]]) {
        await drag(target)
        assert.equal((await inspect()).world.actor.behavior, activity)
        await page.waitForTimeout(180)
        await page.locator('.village-canvas').screenshot({ path: join(rosterQa, `${id}-${activity}.png`) })
      }
      await drag({ x: 180, y: 425 })
      await page.waitForTimeout(700)
      await page.locator('.village-canvas').screenshot({ path: join(rosterQa, `${id}-idle.png`) })
      await page.evaluate(() => window.__villageHostFixture.flush())
    }
    assert.ok((await currentFrame().evaluate(() => window.__sceneMetrics())).textures < 40)
    checks.push('7 characters, 21 activity placements, live selector without renderer replacement; on-demand single-resident texture count below 40')
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
    assert.equal(await page.locator('.vcs-floating').count(), 1)
    await page.waitForFunction(() => document.querySelector('.live2d-card').getBoundingClientRect().top >= document.querySelector('.vcs-floating').getBoundingClientRect().bottom + 10)
    await page.getByRole('button', { name: '打开 AI 小院', exact: true }).click(); await ready()
    assert.equal(await page.locator('.live2d-card').count(), 0)
    assert.equal(await page.locator('.vcs-floating').count(), 1)
    assert.deepEqual((await inspect()).world, frozen)
    checks.push('Git coexists above either companion; only Live2D and village exclude each other')
    await page.setViewportSize({width:2560,height:1440})
    await page.waitForTimeout(100)
    const highQuality = await currentFrame().evaluate(() => {const canvas=document.querySelector('canvas');return {width:canvas.width,css:canvas.getBoundingClientRect().width}})
    assert.ok(highQuality.width >= highQuality.css * 1.99)
    await page.screenshot({path:join(qa,'1440p-100-percent.png')})
    checks.push('2560x1440 at 100% uses a 2x canvas backing store')
    await page.getByRole('button', { name: '打开 Git / Hg 工具', exact: true }).click()
    const tallStyle = await page.addStyleTag({content:'.village-card{height:calc(100vh - 300px)!important}'})
    for (const height of [1440, 2160]) {
      await page.setViewportSize({width:2560,height})
      await page.waitForTimeout(150)
      const bounds = await currentFrame().evaluate(() => ({width:innerWidth,height:innerHeight,...window.__sceneMetrics().viewport}))
      assert.ok(bounds.height > 250, JSON.stringify(bounds))
      assert.ok(bounds.background.x <= 0 && bounds.background.y <= 0)
      assert.ok(bounds.background.x + bounds.background.width >= bounds.width - 1)
      assert.ok(bounds.background.y + bounds.background.height >= bounds.height - 1)
      assert.ok(Math.abs(bounds.background.width / bounds.background.height - .75) < .001)
      await page.locator('.village-canvas').screenshot({path:join(qa,`tall-courtyard-${height}.png`)})
    }
    checks.push('Tall 1440p/2160p courtyard: backdrop covers every edge without stretching; interactive world remains contained')
    await tallStyle.evaluate(node => node.remove())
    await page.getByRole('button', { name: '打开 Git / Hg 工具', exact: true }).click()
    await page.setViewportSize({width:1440,height:960})
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
      const target = h.scene?.hotspots?.find(h => h.id === activity)?.anchor ?? ({ work: {x:102,y:283}, eat:{x:175,y:374}, rest:{x:274,y:245} })[activity]
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
    assert.ok((await currentFrame().evaluate(() => window.__sceneMetrics())).textures < 40)
    checks.push('Seven residents independently simulate, focus preserves all actors, three concurrent activities persist across reload; removal releases rigs')
    await page.locator('.village-members summary').click()
    const { checkContentUI } = await import('./ai-village-v04-browser.mjs')
    await checkContentUI({ page, inspect, ready, currentFrame, drag, qa, checks })
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

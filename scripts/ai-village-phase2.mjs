import { build } from 'tsdown'
import ts from 'typescript'
import sharp from 'sharp'
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const assets = join(pkg, 'assets/characters/bluewhale'), out = join(root, '.build/ai-village-phase2')
const qa = join(pkg, 'art/QA/phase2')
await mkdir(out, { recursive: true }); await mkdir(qa, { recursive: true })
const mode = process.argv[2] ?? 'check'
assert.ok(['check', 'serve'].includes(mode))
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts"
const manifest = JSON.parse(await readFile(join(assets, 'manifest.json'), 'utf8'))
const character = JSON.parse(await readFile(join(assets, 'character.json'), 'utf8'))
const manifestFiles = new Set(manifest.parts.map(p => p.file))
const usedFiles = new Set(character.parts.flatMap(p => p.file ? [p.file] : Object.values(p.expressions ?? {})))
assert.deepEqual(usedFiles, manifestFiles)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
if (mode === 'check') {
  for (const part of manifest.parts) {
    assert.match(part.file, /^parts\/[a-z-]+\.png$/)
    const bytes = await readFile(join(assets, part.file))
    assert.equal(hash(bytes), part.sha256)
    const metadata = await sharp(bytes).metadata()
    assert.deepEqual([metadata.width, metadata.height], part.nativeSize)
    assert.ok(metadata.hasAlpha)
  }
  const sources = ['src/art/types.ts', 'src/art/animation.ts', 'src/art/paper-doll.ts', 'experiments/phase2-frame.ts', 'experiments/phase2-check.ts'].map(f => join(pkg, f))
  const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler',
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: true,
    noEmit: true, allowImportingTsExtensions: true, types: ['node'] }, root)
  const program = ts.createProgram(sources, options.options)
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
  for (const file of sources) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
  if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
  await build({ config: false, entry: { frame: join(pkg, 'experiments/phase2-frame.ts') }, outDir: out,
    format: 'iife', platform: 'browser', target: 'es2022', dts: false, clean: false, minify: true,
    deps: { alwaysBundle: [/./] }, outputOptions: { entryFileNames: 'frame.js' } })
  const frame = await readFile(join(out, 'frame.js'), 'utf8')
  await writeFile(join(out, 'frame.html'), `<!doctype html><html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:512px;height:512px}</style><script>${frame.replaceAll('</script', '<\\/script')}</script></html>`)
  await copyFile(join(pkg, 'experiments/phase2-preview.html'), join(out, 'index.html'))
  await build({ config: false, entry: { check: join(pkg, 'experiments/phase2-check.ts') }, outDir: out,
    format: 'esm', platform: 'node', target: 'es2024', dts: false, clean: false })
  const logic = spawnSync(process.execPath, [join(out, 'check.mjs'), assets], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000 })
  if (logic.status !== 0) throw Error(logic.stderr || logic.stdout)
  await writeFile(join(out, 'logic-result.json'), logic.stdout)
}
const partsHtml = `<!doctype html><html><meta charset="utf-8"><title>纸娃娃部件 / Paper-doll parts</title><style>body{margin:24px;background:#f4f1e9;color:#263e43;font:15px "Segoe UI",sans-serif}main{display:grid;grid-template-columns:repeat(5,200px);gap:12px}figure{margin:0;padding:12px;background:#81858a;border-radius:10px;color:white;text-align:center}img{width:176px;height:180px;object-fit:contain}figcaption{margin-top:8px}</style><h1>20 张独立部件 / 20 components</h1><p>灰底用于检查真实透明；动画预览使用下列 PNG 与登记锚点。</p><main>${manifest.parts.map(p => `<figure><img src="/asset/${p.file.split('/').pop()}"><figcaption>${p.id}<br>${p.nativeSize.join(' × ')}</figcaption></figure>`).join('')}</main></html>`
const allowed = new Map([
  ['/', [join(out, 'index.html'), 'text/html']], ['/frame', [join(out, 'frame.html'), 'text/html']],
  ['/rig', [join(assets, 'character.json'), 'application/json']], ['/motions', [join(assets, 'animations.json'), 'application/json']],
  ['/manifest', [join(assets, 'manifest.json'), 'application/json']], ['/approved.png', [join(pkg, 'art/approved/bluewhale-neutral-v01.png'), 'image/png']],
  ...manifest.parts.map(p => ['/asset/' + p.file.split('/').pop(), [join(assets, p.file), 'image/png']]),
])
const server = createServer(async (req, res) => {
  if (req.method !== 'GET') { res.writeHead(404).end(); return }
  if (req.url === '/parts') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(partsHtml); return }
  const entry = allowed.get(req.url)
  if (!entry) { res.writeHead(404).end(); return }
  try {
    const bytes = await readFile(entry[0])
    res.setHeader('content-type', entry[1]); res.setHeader('x-content-type-options', 'nosniff')
    if (req.url === '/frame') res.setHeader('content-security-policy', csp)
    res.end(bytes)
  } catch { res.writeHead(500).end() }
})
await new Promise(resolve => server.listen(mode === 'serve' ? 18747 : 0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
if (mode === 'serve') console.log('AI Village phase 2: ' + url)
else {
  let browser
  try {
    const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
    const pnpm = join(source, 'node_modules/.pnpm')
    const name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
    assert.ok(name, 'Playwright 1.61 is required')
    const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
    const folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
    assert.ok(folder, 'Cached Chromium is required')
    let executablePath
    for (const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
      const file = join(cache, folder, candidate)
      if (await stat(file).catch(() => false)) { executablePath = file; break }
    }
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
    const external = [], errors = [], runs = [], contacts = []
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: dpr })
      await page.route('**/*', route => {
        if (route.request().url().startsWith(url + '/') || route.request().url().startsWith('blob:')) return route.continue()
        external.push(route.request().url()); return route.abort()
      })
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(url)
      await page.waitForFunction(() => window.__phase2?.ready || window.__phase2?.errors.length)
      assert.deepEqual(await page.evaluate(() => window.__phase2.errors), [])
      const set = async data => {
        const before = await page.evaluate(() => window.__phase2.state.frames)
        await page.evaluate(data => window.control(data), data)
        await page.waitForFunction(before => window.__phase2.state.frames > before, before)
        return page.evaluate(() => window.__phase2.state)
      }
      const frame = page.frames().find(f => f.url().endsWith('/frame'))
      const isolation = await frame.evaluate(() => {
        let blocked = false
        try { void parent.document.body } catch { blocked = true }
        const canvas = document.querySelector('canvas')
        return { blocked, width: canvas.width, height: canvas.height }
      })
      assert.equal(isolation.blocked, true)
      assert.equal(isolation.width, 512 * dpr); assert.equal(isolation.height, 512 * dpr)
      const first = await set({ action: 'walk', time: 0, running: false })
      const second = await set({ time: .4 })
      assert.notEqual(first.transforms['leg-left'].rotation, second.transforms['leg-left'].rotation)
      await set({ action: 'idle', time: 0, running: true })
      await page.waitForFunction(() => window.__phase2.state.time > .2)
      await page.evaluate(() => window.visibilityForTest(true))
      await page.waitForFunction(() => window.__phase2.state.hidden)
      const hidden = await page.evaluate(() => window.__phase2.state)
      await page.waitForTimeout(250)
      await page.evaluate(() => window.inspectForTest())
      await page.waitForTimeout(30)
      const after = await page.evaluate(() => window.__phase2.state)
      assert.equal(after.frames, hidden.frames); assert.equal(after.time, hidden.time)
      await page.evaluate(() => window.visibilityForTest(false))
      await set({ running: false, time: 0, action: 'idle', height: 320 })
      if (dpr === 1) {
        await page.screenshot({ path: join(qa, 'studio-zh.png'), fullPage: true })
        const shots = [
          ['idle', 0, 'auto', 'idle'], ['idle', 3.25, 'auto', 'blink'],
          ['walk', 0, 'auto', 'walk-a'], ['walk', .4, 'auto', 'walk-b'],
          ['walk', .2, 'auto', 'step-left'], ['walk', .6, 'auto', 'step-right'],
          ['pickup', .35, 'auto', 'pickup'], ['dragging', .4, 'auto', 'dragging'],
          ['put_down', .3, 'auto', 'put-down'], ['idle', 0, 'happy', 'happy'],
          ['idle', 0, 'surprised', 'surprised'], ['idle', 0, 'sleepy', 'sleepy'],
        ]
        for (const [action, time, expression, label] of shots) {
          await set({ action, time, expression, running: false })
          const file = label + '.png'
          await page.locator('#stage').screenshot({ path: join(qa, file) })
          allowed.set('/qa/' + file, [join(qa, file), 'image/png'])
          contacts.push({ file, label })
        }
        for (const height of [96, 128]) {
          await set({ action: 'walk', time: .2, expression: 'auto', height })
          for (const [name, color] of [['white', '#ffffff'], ['gray', '#81858a'], ['dark', '#171f29']]) {
            await page.evaluate(color => document.getElementById('stage').style.background = color, color)
            const file = `size-${height}-${name}.png`
            await page.locator('#stage').screenshot({ path: join(qa, file) })
            allowed.set('/qa/' + file, [join(qa, file), 'image/png'])
          }
        }
        await set({ height: 320, action: 'idle', time: 0 })
        await page.evaluate(() => document.getElementById('stage').style.background = '#ffffff')
        await page.locator('#language').click()
        assert.equal(await page.locator('html').getAttribute('lang'), 'en')
        await page.screenshot({ path: join(qa, 'studio-en.png'), fullPage: true })
      }
      runs.push({ dpr, isolation, hiddenFramesUnchanged: true, hiddenTimeUnchanged: true })
      await page.close()
    }
    const contactHtml = `<!doctype html><meta charset="utf-8"><style>body{background:#f4f1e9;font:14px Segoe UI;color:#263e43;padding:20px}main{display:grid;grid-template-columns:repeat(5,240px);gap:12px}figure{margin:0}img{width:240px;border-radius:12px}figcaption{padding:8px}</style><h1>阶段 2 · 动作与表情 / Motion & expressions</h1><main>${contacts.map(c => `<figure><img src="/qa/${c.file}"><figcaption>${c.label}</figcaption></figure>`).join('')}</main>`
    await writeFile(join(out, 'contacts.html'), contactHtml)
    allowed.set('/contacts', [join(out, 'contacts.html'), 'text/html'])
    const evidence = await browser.newPage({ viewport: { width: 1320, height: 950 } })
    await evidence.goto(url + '/contacts'); await evidence.screenshot({ path: join(qa, 'motion-contact-sheet.png'), fullPage: true })
    await evidence.goto(url + '/parts'); await evidence.screenshot({ path: join(qa, 'parts-contact-sheet.png'), fullPage: true })
    await evidence.close()
    const videoContext = await browser.newContext({ viewport: { width: 560, height: 560 },
      recordVideo: { dir: join(out, 'video'), size: { width: 560, height: 560 } } })
    const videoPage = await videoContext.newPage()
    await videoPage.route('**/*', route => {
      if (route.request().url().startsWith(url + '/') || route.request().url().startsWith('blob:')) return route.continue()
      external.push(route.request().url()); return route.abort()
    })
    videoPage.on('pageerror', error => errors.push(error.message))
    await videoPage.goto(url)
    await videoPage.waitForFunction(() => window.__phase2?.ready)
    // Reframe the real running canvas for a focused recording; no generated animation frames.
    await videoPage.addStyleTag({ content: 'header,aside,.comparison,h2,.notes,.caption{display:none!important}main{padding:24px!important}.studio{display:block!important;margin:0!important}.stage{max-width:none!important}' })
    for (const [action, duration] of [['idle', 1800], ['walk', 2400], ['pickup', 600], ['dragging', 1600], ['put_down', 850], ['idle', 3500]]) {
      await videoPage.evaluate(action => window.control({ action, time: 0, running: true, expression: 'auto', height: 320 }), action)
      await videoPage.waitForTimeout(duration)
      if (['pickup', 'put_down'].includes(action)) {
        assert.equal(await videoPage.evaluate(() => window.__phase2.state.running), false, 'One-shot must stop')
        assert.equal(await videoPage.evaluate(() => window.__phase2.state.ended), true)
      }
    }
    const video = videoPage.video()
    await videoContext.close()
    await copyFile(await video.path(), join(qa, 'motion-preview.webm'))
    assert.deepEqual(external, []); assert.deepEqual(errors, [])
    const files = ['index.html', 'frame.html', 'character.json', 'animations.json', 'manifest.json', 'approved.png', 'THIRD-PARTY-NOTICES.txt', ...manifest.parts.map(p => p.file)]
    await mkdir(join(out, 'parts'), { recursive: true })
    for (const file of ['character.json', 'animations.json', 'manifest.json', ...manifest.parts.map(p => p.file)]) await copyFile(join(assets, file), join(out, file))
    await copyFile(join(pkg, 'art/approved/bluewhale-neutral-v01.png'), join(out, 'approved.png'))
    await copyFile(join(root, '.build/ai-village-phase1/THIRD-PARTY-NOTICES.txt'), join(out, 'THIRD-PARTY-NOTICES.txt'))
    await tar.c({ file: join(out, 'phase2-preview.tgz'), cwd: out, gzip: true }, files)
    const entries = []
    await tar.t({ file: join(out, 'phase2-preview.tgz'), onReadEntry: e => entries.push(e.path) })
    assert.deepEqual(entries.sort(), files.sort())
    const result = { passed: true, command: 'node scripts/ai-village-phase2.mjs check', pixiVersion: '8.22.0',
      parts: manifest.parts.length, actions: ['idle', 'walk', 'pickup', 'dragging', 'put_down'], expressions: ['neutral', 'happy', 'surprised', 'sleepy'],
      frameBytes: (await stat(join(out, 'frame.js'))).size, externalRequests: external, pageErrors: errors, runs,
      logic: JSON.parse(await readFile(join(out, 'logic-result.json'), 'utf8')),
      recording: { file: 'motion-preview.webm', bytes: (await stat(join(qa, 'motion-preview.webm'))).size,
        source: 'Actual Chromium WebGL playback', oneShotStopsVerified: true },
      previewArchive: { bytes: (await stat(join(out, 'phase2-preview.tgz'))).size, entries: entries.length },
      limitations: ['Animation preview only; not scene gameplay', 'Software WebGL, not Desktop hardware performance', 'New parts await motion review; base art approved'] }
    await writeFile(join(qa, 'validation.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } finally {
    await browser?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

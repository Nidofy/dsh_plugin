/** Reproducible phase 1 preview + dependency build + isolated storage experiment. */
import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import * as tar from 'tar'

const root = resolve(import.meta.dirname, '..')
const pkg = join(root, 'packages/ai-village')
const out = join(root, '.build/ai-village-phase1')
const qa = join(pkg, 'art/QA')
const frameCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts"
await mkdir(out, { recursive: true })
await mkdir(qa, { recursive: true })
const mode = process.argv[2] ?? 'check'
assert.ok(['check', 'serve'].includes(mode), 'Expected check or serve')

function html() {
  const label = (zh, en) => `<span data-zh="${zh}" data-en="${en}">${zh}</span>`
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 小院 · 阶段 1 视觉样板</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e9;color:#253d41;font:15px "Segoe UI","Microsoft YaHei",sans-serif}
main{max-width:1380px;margin:auto;padding:38px 36px}header{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:1px solid #cad1c5;padding-bottom:24px}
.eyebrow{font-size:12px;letter-spacing:2px;color:#627c70}h1{font-size:32px;margin:8px 0 12px;font-weight:650}p{color:#647572;line-height:1.7;margin:0}
.badge{border:1px solid #aec2ae;border-radius:30px;padding:9px 16px;white-space:nowrap;background:#e8eee2;color:#466444}
.controls{display:flex;align-items:center;gap:12px}button{cursor:pointer;border:1px solid #aec2ae;border-radius:8px;padding:9px;background:transparent;color:inherit}
h2{font-size:19px;margin:28px 0 8px}.scenes{display:flex;gap:30px;align-items:start;justify-content:space-between;margin-top:22px}
figure{margin:0}.scene{overflow:hidden;border:1px solid #d6d2c8;border-radius:16px;background:#f4ead4;box-shadow:0 10px 30px #30372010}
.scene img{display:block;width:100%;height:auto}.scene iframe{display:block;width:100%;height:100%;border:0}
figcaption{padding:12px 0;font-size:13px;color:#62716d;line-height:1.7}figcaption strong{color:#253d41;font-size:15px}
.mats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:18px 0}
.mat{border:1px solid #cbd0c8;border-radius:14px;padding:16px;display:flex;align-items:end;justify-content:center;gap:32px;height:198px}
.mat figure{text-align:center}.mat img{display:block;object-fit:contain;margin:auto}.mat figcaption{color:inherit;font-size:12px;padding:6px 0 0}
.white{background:white}.gray{background:#81858a;color:white}.dark{background:#171f29;color:#ebf1f5}
footer{border-top:1px solid #cad1c5;margin-top:26px;padding-top:18px;display:flex;justify-content:space-between;gap:30px;font-size:13px;color:#667975}
#status{color:#446c4a}@media(max-width:1100px){.scenes{flex-wrap:wrap;justify-content:center}.mats{grid-template-columns:1fr}main{padding:24px}}
</style>
<main><header><div><div class="eyebrow">DSH · AI VILLAGE / PHASE 01</div><h1>${label('一方小院，一只蓝鲸', 'A quiet courtyard, a little blue whale')}</h1>
<p>${label('先确认角色比例、场景氛围与小尺寸观感。当前为静态样板，尚无拆件、行走或家具互动。', 'Review proportions, atmosphere and small sizes. Static candidates; layers, walking and furniture interactions come later.')}</p></div><div class="controls"><span class="badge">${label('视觉候选 · 待确认', 'Visual candidates · Awaiting approval')}</span><button id="language" type="button" aria-label="Switch language / 切换语言">English</button></div></header>
<h2>${label('放进真实尺寸里看看', 'See it at actual display sizes')}</h2><p>${label('场景按 360 × 480 逻辑尺寸等比显示。中间保留空场景，左右展示角色与环境的大小关系。', 'A 360 × 480 logical scene, scaled proportionally. The empty courtyard sits between two character composites.')}</p>
<section class="scenes">
<figure><div class="scene" style="width:300px;height:400px"><iframe title="300px 宽场景与角色 / Scene at 300px" sandbox="allow-scripts" src="/frame"></iframe></div><figcaption><strong>${label('紧凑浮卡 · 300 CSS px', 'Compact card · 300 CSS px')}</strong><br>${label('128 逻辑像素角色 → 约 107 CSS px', '128 logical px character → about 107 CSS px')}</figcaption></figure>
<figure><div class="scene" style="width:340px"><img src="/scene.png" alt="未摆放人物和家具的温馨小院 / Empty courtyard"></div><figcaption><strong>${label('空场景 · 340 CSS px', 'Empty scene · 340 CSS px')}</strong><br>${label('家具与交互点将在后续独立制作', 'Furniture and interaction points will be separate assets')}</figcaption></figure>
<figure><div class="scene" style="width:360px;height:480px"><iframe title="360px 宽场景与角色 / Scene at 360px" sandbox="allow-scripts" src="/frame"></iframe></div><figcaption><strong>${label('标准画布 · 360 CSS px', 'Standard canvas · 360 CSS px')}</strong><br>${label('128 逻辑像素角色 → 128 CSS px', '128 logical px character → 128 CSS px')}</figcaption></figure>
</section>
<h2>${label('同一角色，两个显示尺寸', 'One character, two display sizes')}</h2><p>${label('以下使用原始透明 PNG 直接缩小。白色围裙、细发丝和尾巴边缘在三种底色上对照。', 'The original transparent PNG scaled down. Compare the white apron, fine hair and tail edges on three backgrounds.')}</p>
<section class="mats">${['white', 'gray', 'dark'].map(color => `<div class="mat ${color}">${[96, 128].map(height => `<figure><img src="/character.png" width="${height}" height="${height}" alt="蓝鲸角色 ${height}px / Bluewhale at ${height}px"><figcaption>${height} CSS px</figcaption></figure>`).join('')}</div>`).join('')}</section>
<footer><span>${label('原生尺寸：角色 1254 × 1254 · 场景 1086 × 1448', 'Native size: character 1254 × 1254 · scene 1086 × 1448')}<br>${label('候选原图保留；本页为尺寸和合成预览。', 'Original candidates are preserved. This page previews sizes and composition.')}</span><span id="status" role="status"></span></footer>
</main>
<script>
const channel='nidofy-ai-village-phase1', instances=new Map(), report={rendered:0,frames:[],errors:[]};window.__phase1=report;
let language='zh', state='loading';
const statuses={loading:['正在加载本地渲染器…','Loading local renderer…'],ready:['本地 WebGL 已就绪 · 静态画面不持续绘制','Local WebGL ready · Static frame, ticker stopped'],failed:['预览失败，请查看验证输出','Preview failed; see validation output']};
function updateStatus(){document.getElementById('status').textContent=statuses[state][language==='zh'?0:1]}
document.getElementById('language').addEventListener('click',()=>{
 language=language==='zh'?'en':'zh';document.documentElement.lang=language==='zh'?'zh-CN':'en';
 document.title=language==='zh'?'AI 小院 · 阶段 1 视觉样板':'AI Village · Phase 1 visual candidates';
 document.querySelectorAll('[data-zh]').forEach(el=>{el.textContent=el.dataset[language]});
 document.getElementById('language').textContent=language==='zh'?'English':'中文';updateStatus();
});updateStatus();
const assets=Promise.all(['/character.png','/scene.png'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('asset unavailable');return r.arrayBuffer()})));
window.addEventListener('message',async event=>{
 const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow===event.source);
 if(!frame||event.origin!=='null'||event.data?.channel!==channel)return;
 const m=event.data;
 if(m.type==='ready'&&!instances.has(frame)){
  const token=crypto.randomUUID();instances.set(frame,token);
  try{const bytes=await assets;const character=bytes[0].slice(0),scene=bytes[1].slice(0);
   frame.contentWindow.postMessage({channel,type:'init',token,character,scene},'*',[character,scene]);
  }catch(e){report.errors.push(String(e));state='failed';updateStatus();}
 }else if(instances.get(frame)===m.token&&m.type==='rendered'){
  report.rendered++;report.frames.push(m);state='ready';updateStatus();
 }else if(instances.get(frame)===m.token&&m.type==='failed'){
  report.errors.push(m.error);state='failed';updateStatus();
 }
});
</script></html>`
}

if (mode !== 'serve') {
  const baseline = JSON.parse(await readFile(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
  assert.equal(baseline.revision, '687f282e8625c6b8d11ff58211a90524be2e4317')
  const upstream = ts.parseConfigFileTextToJson('tsconfig.base.json', await readFile(join(baseline.source, 'tsconfig.base.json'), 'utf8')).config.compilerOptions.paths
  const paths = Object.fromEntries(Object.entries(upstream).map(([key, values]) => [key, values.map(value => resolve(baseline.source, value))]))
  paths['@nidofy/dsh-plugin-shared/durable-file'] = [join(root, 'packages/plugin-shared/src/durable-file.ts')]
  const options = ts.convertCompilerOptionsFromJson({
    target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true,
    types: ['node'], paths,
  }, root)
  assert.equal(options.errors.length, 0)
  const owned = ['frame.ts', 'storage.ts', 'storage-check.ts'].map(name => join(pkg, 'experiments', name))
  const program = ts.createProgram(owned, options.options)
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
  for (const file of owned) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
  if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
  const candidates = JSON.parse(await readFile(join(pkg, 'art/candidates/manifest.json'), 'utf8'))
  for (const asset of candidates.assets) {
    const bytes = await readFile(join(pkg, 'art/candidates', asset.path))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
  }
  await build({ config: false, entry: { frame: join(pkg, 'experiments/frame.ts') }, outDir: out, format: 'iife', platform: 'browser',
    target: 'es2022', dts: false, clean: false, minify: true, deps: { alwaysBundle: [/./] }, outputOptions: { entryFileNames: 'frame.js' } })
  const frame = await readFile(join(out, 'frame.js'), 'utf8')
  // Entire renderer is included locally; no runtime bare imports or remote scripts.
  await writeFile(join(out, 'frame.html'), `<!doctype html><html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${frameCsp}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{width:100%!important;height:100%!important;display:block}</style><script>${frame.replaceAll('</script', '<\\/script')}</script></html>`)
  await writeFile(join(out, 'index.html'), html())
  await copyFile(join(pkg, 'art/candidates/bluewhale-neutral-v01.png'), join(out, 'character.png'))
  await copyFile(join(pkg, 'art/candidates/courtyard-empty-v01.png'), join(out, 'scene.png'))
  await copyFile(join(pkg, 'node_modules/pixi.js/LICENSE'), join(out, 'PIXI-LICENSE.txt'))
  const lock = JSON.parse(await readFile(join(pkg, 'package-lock.json'), 'utf8'))
  const notices = [], dependencyList = []
  for (const [location, record] of Object.entries(lock.packages)) {
    if (!location) continue
    const directory = join(pkg, location)
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    const licenseFiles = (await readdir(directory)).filter(name => /^(licen[sc]e|copying)(\.|$|-)/i.test(name))
    const texts = await Promise.all(licenseFiles.map(name => readFile(join(directory, name), 'utf8')))
    if (!texts.length && metadata.name === '@pixi/colord' && metadata.version === '2.9.6')
      texts.push(await readFile(join(pkg, 'licenses/colord-LICENSE.txt'), 'utf8'))
    assert.ok(texts.length, 'License text missing: ' + metadata.name)
    notices.push(metadata.name + ' ' + metadata.version + '\n' + texts.join('\n'))
    dependencyList.push({ name: metadata.name, version: metadata.version, license: metadata.license, integrity: record.integrity })
  }
  await writeFile(join(out, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n----------------------------------------\n\n'))
  await writeFile(join(out, 'dependencies.json'), JSON.stringify(dependencyList, null, 2) + '\n')
  await build({ config: false, entry: { 'storage-check': join(pkg, 'experiments/storage-check.ts') }, outDir: out, format: 'esm', platform: 'node',
    target: 'es2024', dts: false, clean: false, deps: { neverBundle: ['koffi'], alwaysBundle: [/^@nidofy\//, /^@deepseek-ai\//] },
    plugins: [{ name: 'phase1-pinned-official-atomic', resolveId(id) {
      if (id === '@deepseek-ai/dsh-atomic-write') return join(baseline.source, 'packages/util/atomic-write/src/index.ts').replaceAll('\\', '/')
      if (id === '@nidofy/dsh-plugin-shared/durable-file') return join(root, 'packages/plugin-shared/src/durable-file.ts').replaceAll('\\', '/')
    } }] })
  const storage = spawnSync(process.execPath, [join(out, 'storage-check.mjs'), out], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (storage.status !== 0) throw Error(storage.stderr || storage.stdout)
  await writeFile(join(out, 'storage-result.json'), storage.stdout)
  console.log('Strict types and storage experiment passed')
}

const allowed = new Map([['/', ['index.html', 'text/html']], ['/frame', ['frame.html', 'text/html']], ['/character.png', ['character.png', 'image/png']], ['/scene.png', ['scene.png', 'image/png']]])
const server = createServer(async (req, res) => {
  const entry = allowed.get(req.url)
  if (!entry || req.method !== 'GET') { res.writeHead(404).end(); return }
  try {
    const bytes = await readFile(join(out, entry[0]))
    res.setHeader('content-type', entry[1]); res.setHeader('x-content-type-options', 'nosniff')
    if (req.url === '/frame') res.setHeader('content-security-policy', frameCsp)
    res.end(bytes)
  } catch { res.writeHead(500).end() }
})
await new Promise(resolve => server.listen(mode === 'serve' ? 18746 : 0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
if (mode === 'serve') {
  console.log('AI Village phase 1 preview: ' + url)
} else {
  let browser
  try {
    const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
    const pnpm = join(source, 'node_modules/.pnpm')
    const name = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.'))
    if (!name) throw Error('Existing Playwright 1.61 dependency is required')
    const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
    const folder = (await readdir(cache)).find(name => name.startsWith('chromium_headless_shell-'))
    let executablePath
    for (const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
      const file = join(cache, folder, candidate)
      if (await stat(file).catch(() => false)) { executablePath = file; break }
    }
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
    const errors = [], external = [], runs = []
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1380, height: 1160 }, deviceScaleFactor: dpr })
      await page.route('**/*', route => {
        if (route.request().url().startsWith(url + '/') || route.request().url().startsWith('blob:')) return route.continue()
        external.push(route.request().url()); return route.abort()
      })
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(url)
      try {
        await page.waitForFunction(() => window.__phase1?.rendered === 2 || window.__phase1?.errors.length, undefined, { timeout: 20000 })
      } catch (error) {
        await page.screenshot({ path: join(out, 'failed-preview.png'), fullPage: true })
        console.error('Preview diagnostics:', JSON.stringify({ errors, external, state: await page.evaluate(() => window.__phase1) }))
        throw error
      }
      const status = await page.evaluate(() => window.__phase1)
      assert.deepEqual(status.errors, [])
      assert.ok(status.frames.every(frame => frame.tickerStarted === false && frame.renderer === 'webgl'))
      for (const frame of page.frames().filter(f => f.url().endsWith('/frame'))) {
        const isolation = await frame.evaluate(() => {
          let parentBlocked = false, cookieBlocked = false
          try { void parent.document.body } catch { parentBlocked = true }
          try { void document.cookie } catch { cookieBlocked = true }
          const c = document.querySelector('canvas')
          return { parentBlocked, cookieBlocked, width: c.width, height: c.height }
        })
        assert.equal(isolation.parentBlocked, true); assert.equal(isolation.cookieBlocked, true)
        assert.equal(isolation.width, 360 * dpr); assert.equal(isolation.height, 480 * dpr)
      }
      const sizes = await page.locator('.scene').evaluateAll(elements => elements.map(e => Math.round(e.getBoundingClientRect().width)))
      assert.deepEqual(sizes, [300, 340, 360])
      if (dpr === 1) {
        await page.screenshot({ path: join(qa, 'phase1-overview.png'), fullPage: true })
        await page.locator('.mats').screenshot({ path: join(qa, 'alpha-and-sizes.png') })
        await page.locator('.scene').nth(2).screenshot({ path: join(qa, 'scene-360.png') })
        await page.locator('#language').click()
        assert.equal(await page.locator('html').getAttribute('lang'), 'en')
        assert.match(await page.locator('h1').textContent(), /quiet courtyard/)
        await page.screenshot({ path: join(qa, 'phase1-overview-en.png'), fullPage: true })
      }
      runs.push({ dpr, cssWidths: sizes, status })
      await page.close()
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    const files = ['index.html', 'frame.html', 'character.png', 'scene.png', 'PIXI-LICENSE.txt', 'THIRD-PARTY-NOTICES.txt', 'dependencies.json']
    await tar.c({ file: join(out, 'phase1-preview.tgz'), cwd: out, gzip: true }, files)
    const entries = []
    await tar.t({ file: join(out, 'phase1-preview.tgz'), onReadEntry: entry => entries.push(entry.path) })
    assert.deepEqual(entries.sort(), files.sort())
    const result = { passed: true, date: '2026-10-20', pixiVersion: '8.22.0', frameBytes: (await stat(join(out, 'frame.js'))).size,
      officialRevision: '687f282e8625c6b8d11ff58211a90524be2e4317', runs, externalRequests: external, pageErrors: errors,
      previewArchive: { bytes: (await stat(join(out, 'phase1-preview.tgz'))).size, files: entries },
      limitations: ['Static candidates, not layered animation', 'Temporary preview fixture, not installed DSH', 'Software WebGL, not Electron GPU performance'] }
    await writeFile(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n')
    const storageResult = JSON.parse(await readFile(join(out, 'storage-result.json'), 'utf8'))
    await writeFile(join(qa, 'validation.json'), JSON.stringify({
      date: result.date, passed: result.passed, command: 'node scripts/ai-village-phase1.mjs check',
      officialRevision: result.officialRevision, pixiVersion: result.pixiVersion, frameBytes: result.frameBytes,
      display: { dpr: [1, 2], sceneCssWidths: [300, 340, 360], characterCssHeights: [96, 128], languages: ['zh-CN', 'en'] },
      isolation: { parentDomBlocked: true, cookiesBlocked: true, unsafeEvalAllowed: false, externalRequests: external.length, pageErrors: errors.length },
      storage: { passed: storageResult.passed, checks: storageResult.checks, limitations: storageResult.limitations },
      previewArchive: result.previewArchive, limitations: result.limitations,
    }, null, 2) + '\n')
    console.log(JSON.stringify({ passed: true, frameBytes: result.frameBytes, screenshots: qa, result: join(out, 'result.json') }))
  } finally {
    await browser?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

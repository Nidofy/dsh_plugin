/** Read-only production-art audit and deterministic 12-resident contact sheets. No profile access. */
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { build } from 'tsdown'
import sharp from 'sharp'
import ts from 'typescript'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = join(root, '.build/ai-village-v011-visual-baseline'), qa = join(root, 'docs/ai-village/v011/visual-baseline')
await mkdir(out, { recursive: true }); await mkdir(qa, { recursive: true })
const ids = ['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen', 'seedance', 'glm', 'minimax', 'llama', 'mistral']
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), payload = [], assets = [], definitions = []
const sceneManifest = JSON.parse(await readFile(join(pkg, 'assets/scenes/courtyard/manifest.json'), 'utf8'))
for (const id of ids) {
  const base = join(pkg, 'assets/characters', id), manifest = JSON.parse(await readFile(join(base, 'manifest.json'), 'utf8'))
  const character = JSON.parse(await readFile(join(base, 'character.json'), 'utf8')), animations = JSON.parse(await readFile(join(base, 'animations.json'), 'utf8'))
  const images = {}
  for (const file of ['character.json', 'animations.json', 'manifest.json']) definitions.push({ file: `assets/characters/${id}/${file}`, sha256: hash(await readFile(join(base, file))) })
  const files = new Map(manifest.parts.map(part => [part.file, { file: part.file, absolute: join(base, part.file), expectedHash: part.sha256 }]))
  for (const name of ['work-left', 'work-right', 'eat-left', 'eat-right', 'rest-pose']) {
    const file = `${name}.png`, absolute = id === 'bluewhale' ? join(pkg, 'assets/scenes/courtyard', file) : join(base, 'parts', file)
    const expected = id === 'bluewhale' ? sceneManifest.files.find(part => part.file === file) : manifest.parts.find(part => part.file === `parts/${file}`)
    assert.ok(expected, `${id}/${file} manifest missing`)
    files.set(`activity/${file}`, { file: `activity/${file}`, absolute, expectedHash: expected.sha256 })
  }
  for (const [key, item] of files) {
    const bytes = await readFile(item.absolute); assert.equal(hash(bytes), item.expectedHash, item.absolute)
    images[key] = `data:image/png;base64,${bytes.toString('base64')}`
    if (assets.some(asset => asset.file === item.absolute.slice(pkg.length + 1).replaceAll('\\', '/'))) continue
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let transparent = 0, opaque = 0, partial = 0, minX = info.width, minY = info.height, maxX = -1, maxY = -1, edgeNonzero = 0
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3]
      if (alpha === 0) transparent++; else {
        if (alpha === 255) opaque++; else partial++
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
        if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) edgeNonzero++
      }
    }
    assert.ok(transparent > 0 && opaque + partial > 0, `${id}/${key}: empty or opaque asset`)
    assets.push({ id, file: item.absolute.slice(pkg.length + 1).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes), size: [info.width, info.height], alpha: { transparent, opaque, partial, edgeNonzero, bounds: [minX, minY, maxX, maxY] } })
  }
  payload.push({ id, character, animations, images })
}
const entry = join(pkg, 'experiments/v011-visual-baseline.ts')
const program = ts.createProgram([entry], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true })
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
await build({ config: false, entry: { baseline: entry }, outDir: out, format: 'esm', platform: 'browser', target: 'es2022', clean: false, dts: false, minify: true, deps: { alwaysBundle: [/./] }, outputOptions: { inlineDynamicImports: true, entryFileNames: 'baseline.js' } })
const bundle = await readFile(join(out, 'baseline.js'), 'utf8')
const html = `<!doctype html><meta charset="utf-8"><title>AI Village 12-resident visual baseline</title><style>body{margin:0}#stage{width:960px;height:660px}canvas{display:block;width:960px;height:660px}</style><div id="stage"></div><script>window.baselinePayload=${JSON.stringify(payload).replaceAll('<', '\\u003c')}</script><script type="module">${bundle.replaceAll('</script', '<\\/script')}</script>`
await writeFile(join(out, 'index.html'), html)
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8')), pnpm = join(source, 'node_modules/.pnpm')
const playwright = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.')); assert.ok(playwright)
const { chromium } = await import(pathToFileURL(join(pnpm, playwright, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(name => name.startsWith('chromium_headless_shell-')); assert.ok(folder)
let executablePath
for (const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) if (await stat(join(cache, folder, candidate)).catch(() => false)) { executablePath = join(cache, folder, candidate); break }
assert.ok(executablePath)
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] }), errors = [], network = [], samples = [], screenshots = []
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 660 }, deviceScaleFactor: dpr })
    page.on('pageerror', error => errors.push(String(error))); page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()) })
    await page.goto(pathToFileURL(join(out, 'index.html')).href); await page.waitForFunction(() => window.baselineReview?.ready)
    for (const [background, color] of [['neutral', '#92999e'], ['light', '#f7f0e5'], ['dark', '#20232a']]) for (const state of ['idle', 'work', 'eat', 'rest']) for (const size of [96, 108, 128]) {
      const sample = await page.evaluate(([state, size, color]) => window.baselineReview.set(state, size, color), [state, size, color])
      assert.equal(sample.residents.length, 12); assert.equal(sample.tickerStarted, false)
      assert.ok(sample.residents.every((resident, index) => resident.screenFeet[0] === index % 4 * 240 + 120 && resident.screenFeet[1] === Math.floor(index / 4) * 220 + 180))
      const file = `${state}-${background}-${size}-dpr${dpr}.png`
      await page.locator('#stage').screenshot({ path: join(qa, file) })
      screenshots.push({ file, sha256: hash(await readFile(join(qa, file))), cssSize: [960, 660], dpr }); samples.push(sample)
    }
    await page.close()
  }
} finally { await browser.close() }
assert.deepEqual(errors, []); assert.deepEqual(network, [])
const implementation = []
for (const file of ['scripts/ai-village-v011-visual-baseline.mjs', 'packages/ai-village/experiments/v011-visual-baseline.ts', 'packages/ai-village/src/art/paper-doll.ts', 'packages/ai-village/src/art/animation.ts', 'packages/ai-village/assets/scenes/courtyard/manifest.json']) implementation.push({ file, sha256: hash(await readFile(join(root, file))) })
const result = { scope: 'Deterministic production PaperDoll/samplePose QA. Neutral tabletop occluder; not a live furniture or approval test.', characterIds: ids, implementation, assets, definitions, screenshots, samples, browserErrors: errors, externalRequests: network }
await writeFile(join(qa, 'validation.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ characters: ids.length, assets: assets.length, screenshots: screenshots.length, poses: samples.length * 12, browserErrors: errors.length, externalRequests: network.length, output: qa }, null, 2))

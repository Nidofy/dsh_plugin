/** Candidate-only QA. Does not modify source pixels or production assets. */
import sharp from 'sharp'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const out = import.meta.dirname, root = resolve(out, '../../../../..')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const assets = []
for (const file of ['diary-page-v01.png', 'bookmark-v01.png', 'bookmark-v02.png']) {
  const bytes = await readFile(join(out, file))
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparent = 0, partial = 0, opaque = 0, alphaTotal = 0
  const bounds = { left: info.width, top: info.height, right: -1, bottom: -1 }
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const alpha = data[(y * info.width + x) * 4 + 3]
    alphaTotal += alpha
    if (!alpha) transparent++; else if (alpha === 255) opaque++; else partial++
    if (alpha > 8) { bounds.left = Math.min(bounds.left, x); bounds.top = Math.min(bounds.top, y); bounds.right = Math.max(bounds.right, x); bounds.bottom = Math.max(bounds.bottom, y) }
  }
  assert.ok(transparent > 0 && partial + opaque > 0, 'Native transparent background required')
  assert.ok(bounds.left > 0 && bounds.top > 0 && bounds.right < info.width - 1 && bounds.bottom < info.height - 1, 'Visible content must not clip canvas')
  assets.push({ file, sha256: hash(bytes), bytes: bytes.length, size: [info.width, info.height], alpha: { transparent, partial, opaque, mean: alphaTotal / (info.width * info.height) }, alpha8Bounds: bounds, decodedRGBABytes: info.width * info.height * 4, status: 'CANDIDATE_NOT_APPROVED', source: 'Built-in image_gen; native PNG bytes copied unchanged', runtimeEnabled: false })
}
const rows = assets.map(a => `<section><h2>${a.file}</h2>${['#f5efdf','#364745','#ffffff'].map(bg => `<div class="row" style="background:${bg}">${[20,32,48,96,192].map(size => `<figure><img src="${a.file}" style="width:${size}px;height:${size}px"><figcaption>${size}px</figcaption></figure>`).join('')}</div>`).join('')}</section>`).join('')
await writeFile(join(out, 'props-review.html'), `<!doctype html><meta charset="utf-8"><title>0.15 candidate prop review</title><style>body{font:14px system-ui;background:#ede6d6;margin:18px;color:#233f3e}.row{display:flex;align-items:center;gap:20px;padding:12px;margin:5px}figure{margin:0;text-align:center}img{object-fit:contain}figcaption{background:#ede6d6}h2{font-size:16px}</style><h1>候选道具 / Candidate props — not approved</h1><p>Native alpha; CSS scaling only. Not integrated, not a world/hand-contact acceptance.</p>${rows}`)
const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
const pnpm = join(source, 'node_modules/.pnpm'), pw = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
const { chromium } = await import(pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
const browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe') })
const screenshots = [], errors = [], external = []
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 920, height: 900 }, deviceScaleFactor: dpr })
    page.on('pageerror', e => errors.push(String(e)))
    page.on('request', r => { if (/^https?:/.test(r.url())) external.push(r.url()) })
    await page.goto(pathToFileURL(join(out, 'props-review.html')).href)
    await page.locator('img').evaluateAll(images => Promise.all(images.map(im => im.decode())))
    const file = `props-dpr${dpr}.png`
    await page.screenshot({ path: join(out, file), fullPage: true })
    screenshots.push({ file, sha256: hash(await readFile(join(out, file))) })
    await page.close()
  }
} finally { await browser.close() }
assert.deepEqual(errors, []); assert.deepEqual(external, [])
const gait = { source: '../bluewhale-walk-cycle/renderer.ts', speed: 17, frameHoldSeconds: 0.18, holdTranslation: 17 * 0.18, cycleTranslation: 17 * 0.72, reason: 'Candidate holds each whole-character pose for 0.18s while the world root moves at 17 units/s. Any planted sole moves 3.06 world units during that held pose; sub-frame foot locking is absent. This is a kinematic calculation, not motion capture or a new runtime test.', rightDirection: 'front fallback', turn: '0.18s whole-character crossfade; visible double contour in historical v03 screenshot', qualification: 'NOT_QUALIFIED' }
await writeFile(join(out, 'audit.json'), JSON.stringify({ date: '2026-10-29', status: 'CANDIDATE_TECHNICAL_QA_ONLY', approvedForRelease: false, assets, screenshots, errors, externalRequests: external, gait, notCovered: ['production world/hand contacts','final package registration','human art sign-off','hardware GPU/system DPI'] }, null, 2) + '\n')
console.log(JSON.stringify({ assets: assets.map(a => ({ file: a.file, sha256: a.sha256, bytes: a.bytes, alpha: a.alpha })), screenshots, errors }, null, 2))

import sharp from 'sharp'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = join(pkg, 'assets/scenes/courtyard'), work = join(pkg, 'art/work/phase3')
await mkdir(out, { recursive: true })
const sources = [
  ['desk', 'furniture', [40, 100, 730, 445]], ['table', 'furniture', [790, 100, 715, 445]],
  ['cushion', 'furniture', [135, 590, 635, 380]], ['bowl', 'furniture', [1005, 650, 310, 260]],
  ['work-left', 'activity-arms', [120, 85, 420, 540]], ['work-right', 'activity-arms', [680, 85, 470, 540]],
  ['eat-left', 'activity-arms', [65, 650, 500, 520]], ['eat-right', 'activity-arms', [610, 690, 620, 450]],
  ['rest-pose', 'rest-pose', [0, 0, 1254, 1254]],
]
const files = [], history = []
async function record(file) {
  const bytes = await readFile(join(out, file)), metadata = await sharp(bytes).metadata()
  files.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), size: [metadata.width, metadata.height], alpha: metadata.hasAlpha })
}
for (const [id, source, rect] of sources) {
  const path = join(work, source + '-v01.png'), [left, top, width, height] = rect
  const metadata = await sharp(path).metadata()
  const bytes = await sharp(path).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer()
  let x1 = width, y1 = height, x2 = -1, y2 = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3] >= 16) {
    x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y)
  }
  assert.ok(x2 >= x1 && y2 >= y1)
  x1 = Math.max(0, x1 - 2); y1 = Math.max(0, y1 - 2); x2 = Math.min(width - 1, x2 + 2); y2 = Math.min(height - 1, y2 + 2)
  const crop = { left: left + x1, top: top + y1, width: x2 - x1 + 1, height: y2 - y1 + 1 }
  await sharp(path).extract(crop).png().toFile(join(out, id + '.png'))
  await record(id + '.png')
  const item = { id, source: `art/work/phase3/${source}-v01.png`, sourceSize: [metadata.width, metadata.height], crop }
  if (id === 'desk' || id === 'table') {
    const cut = Math.round(crop.height * .1)
    for (const [suffix, y, h] of [['back', 0, cut], ['front', cut, crop.height - cut]]) {
      await sharp(join(out, id + '.png')).extract({ left: 0, top: y, width: crop.width, height: h }).png().toFile(join(out, `${id}-${suffix}.png`))
      await record(`${id}-${suffix}.png`)
    }
    // Pixel-exact reconstruction of the rear and front slices.
    const combined = await sharp({ create: { width: crop.width, height: crop.height, channels: 4, background: '#00000000' } })
      .composite([{ input: join(out, id + '-back.png'), left: 0, top: 0 }, { input: join(out, id + '-front.png'), left: 0, top: cut }]).raw().toBuffer()
    const original = await sharp(join(out, id + '.png')).raw().toBuffer()
    assert.ok(combined.length === original.length)
    // Alpha premultiplication may change RGB of fully transparent pixels; visible pixels must agree to rounding.
    let maxDifference = 0
    for (let i = 0; i < combined.length; i++) if (original[Math.floor(i / 4) * 4 + 3] > 32) maxDifference = Math.max(maxDifference, Math.abs(combined[i] - original[i]))
    assert.ok(maxDifference <= 2)
    item.split = { cut, ratio: cut / crop.height, reconstructionMaxVisibleDifference: maxDifference }
  }
  history.push(item)
}
await copyFile(join(pkg, 'art/approved/courtyard-empty-v01.png'), join(out, 'background.png')); await record('background.png')
const scene = { schemaVersion: 1, id: 'courtyard', version: 1, size: [360, 480],
  walkable: { x: 45, y: 211, width: 248, height: 222 },
  obstacles: [{ x: 38, y: 290, width: 124, height: 27 }, { x: 204, y: 290, width: 124, height: 27 }],
  spawn: { x: 173, y: 365 },
  hotspots: [
    { id: 'work', hit: { x: 46, y: 225, width: 112, height: 64 }, anchor: { x: 102, y: 283 } },
    { id: 'eat', hit: { x: 212, y: 225, width: 112, height: 64 }, anchor: { x: 268, y: 283 } },
    { id: 'rest', hit: { x: 233, y: 370, width: 90, height: 55 }, anchor: { x: 274, y: 411 } },
  ],
  furniture: [
    { id: 'work', asset: 'desk', rect: { x: 46, y: 239, width: 112, height: 68 }, split: history.find(i => i.id === 'desk').split.ratio },
    { id: 'eat', asset: 'table', rect: { x: 212, y: 239, width: 112, height: 68 }, split: history.find(i => i.id === 'table').split.ratio },
  ],
  cushion: { x: 235, y: 385, width: 78, height: 44 },
}
const priorScene = await readFile(join(out, 'scene.json'), 'utf8').then(JSON.parse).catch(() => null)
const priorManifest = await readFile(join(out, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
const approved = priorManifest?.approvedForRelease === true && JSON.stringify(priorManifest.files) === JSON.stringify(files) && JSON.stringify(priorScene) === JSON.stringify(scene)
await writeFile(join(out, 'scene.json'), JSON.stringify(scene, null, 2) + '\n')
await writeFile(join(out, 'manifest.json'), JSON.stringify({ schemaVersion: 1, status: approved ? 'phase3-scene-approved' : 'phase3-scene-review', approvedForRelease: approved,
  ...(approved ? { approval: priorManifest.approval } : {}),
  files, production: history, processing: 'Measured crop; preserve RGBA. Tables split into lossless aligned rear/front slices.' }, null, 2) + '\n')
console.log(JSON.stringify({ assets: files.length, scene: out }))

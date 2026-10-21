/** Measured atlas cropping and paper-doll registration. No repainting or alpha replacement. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const pkg = resolve(import.meta.dirname, '../packages/ai-village')
const spec = JSON.parse(await readFile(join(pkg, 'art/prompts/roster.json'), 'utf8'))
const names = ['face-neutral', 'face-happy', 'face-surprised', 'face-sleepy', 'torso',
  'arm-left', 'arm-right', 'leg-left', 'leg-right', 'work-left', 'work-right', 'eat-left',
  'eat-right', 'rest-pose', 'back-hair', 'ornament']
// Layout boundaries measured from each native 1254px atlas. Row 4 is intentionally taller.
const layouts = {
  claude: { version: 2, heads: [0, 323, 638, 948, 1254], rows: [0, 319, 635, 887, 1254], torsoEnd: 340 },
  gemini: { version: 2, heads: [0, 331, 639, 950, 1254], rows: [0, 322, 635, 870, 1254], torsoEnd: 378 },
  gpt: { version: 1, heads: [0, 335, 646, 955, 1254], rows: [0, 321, 632, 887, 1254], torsoEnd: 350 },
  grok: { version: 1, heads: [0, 320, 633, 944, 1254], rows: [0, 321, 633, 899, 1254], torsoEnd: 335 },
  kimi: { version: 1, heads: [0, 326, 641, 951, 1254], rows: [0, 317, 632, 885, 1254], torsoEnd: 344 },
  qwen: { version: 1, heads: [0, 325, 638, 946, 1254], rows: [0, 317, 624, 885, 1254], torsoEnd: 349 },
}
const group = (id, parent, pivot, z) => ({ id, parent, pivot, offset: pivot, size: [0, 0], z, mirror: 'never' })
const part = (id, parent, offset, size, pivot, z) => ({ id, parent, file: `parts/${id}.png`, offset, size, pivot, z, mirror: 'never' })
const animationBase = JSON.parse(await readFile(join(pkg, 'assets/characters/bluewhale/animations.json'), 'utf8'))
await mkdir(join(pkg, 'art/QA/roster'), { recursive: true })
const roster = []
for (const entry of spec.characters) {
  const id = entry.id, layout = layouts[id], destination = join(pkg, 'assets/characters', id)
  await mkdir(join(destination, 'parts'), { recursive: true })
  const inventory = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i], row = Math.floor(i / 4), col = i % 4
    const xs = row === 0 ? layout.heads : row === 1 ? [0, layout.torsoEnd, 638, 972, 1254] : [0, 321, 644, 973, 1254]
    let left = xs[col], top = layout.rows[row], width = xs[col + 1] - left, height = layout.rows[row + 1] - top
    let source = `art/work/roster/${id}-v0${layout.version}.png`
    if (id === 'kimi' && name === 'eat-left') { source = 'art/work/roster/kimi-bowl-v02.png'; left = 0; top = 0; width = 1254; height = 1254 }
    // Rest portraits start above the row's spoon. Give that column its own measured boundary.
    if (name === 'rest-pose' || name === 'back-hair') {
      const start = { claude: 887, gemini: 868, gpt: 887, grok: 899, kimi: 885, qwen: 885 }[id]
      top = start; height = 1254 - start
    }
    if (name === 'back-hair') {
      left = id === 'gemini' ? 650 : id === 'grok' ? 634 : 640
      top = 915
      width = (id === 'grok' ? 956 : 969) - left
      height = 1254 - top
    }
    // The leg in row 3 extends lower than its three adjacent hands.
    if (name === 'leg-right') height = 925 - top
    if (name === 'eat-right') { top = 925; height = 1254 - top }
    if (id === 'gemini' && name === 'ornament') { top = 925; height = 1254 - top }
    const input = join(pkg, source), meta = await sharp(input).metadata()
    assert.equal(meta.width, 1254); assert.equal(meta.height, 1254); assert.ok(meta.hasAlpha)
    const raw = await sharp(input).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer()
    let x1 = width, y1 = height, x2 = -1, y2 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (raw[(y * width + x) * 4 + 3] >= 32) {
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y)
    }
    assert.ok(x2 >= x1 && y2 >= y1)
    const crop = { left: left + Math.max(0, x1 - 1), top: top + Math.max(0, y1 - 1),
      width: Math.min(width - 1, x2 + 1) - Math.max(0, x1 - 1) + 1, height: Math.min(height - 1, y2 + 1) - Math.max(0, y1 - 1) + 1 }
    const file = `parts/${name}.png`
    await sharp(input).extract(crop).png().toFile(join(destination, file))
    const bytes = await readFile(join(destination, file))
    inventory.push({ id: name, file, source, crop, nativeSize: [crop.width, crop.height], bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), processing: 'Measured native crop; original RGBA preserved' })
  }
  // Swapping opposite arm slots corrects generated shoulder orientation without mirroring accessories.
  const swapArms = ['gpt', 'qwen'].includes(id)
  const character = {
    schemaVersion: 1, id: `${id}-v01`, canvas: [1024, 1024], feet: [512, 952], visibleHeight: 900,
    parts: [
      group('root', null, [512, 952], 0),
      part('leg-left', 'root', [415, 795], [95, 157], [463, 813], 2),
      part('leg-right', 'root', [526, 795], [95, 157], [573, 813], 2),
      group('body', 'root', [512, 665], 3),
      part('back-hair', 'body', [230, 245], [564, 612], [512, 350], 0),
      { ...part('arm-left', 'body', [320, 555], [170, 228], [445, 576], 2), file: `parts/arm-${swapArms ? 'right' : 'left'}.png` },
      { ...part('arm-right', 'body', [534, 555], [170, 228], [579, 576], 2), file: `parts/arm-${swapArms ? 'left' : 'right'}.png` },
      part('torso', 'body', [300, 530], [424, 345], [512, 555], 3),
      group('head', 'body', [512, 540], 8),
      { id: 'face', parent: 'head', offset: [210, 60], size: [604, 560], pivot: [512, 520], z: 2, mirror: 'never',
        expressions: Object.fromEntries(['neutral', 'happy', 'surprised', 'sleepy'].map(e => [e, `parts/face-${e}.png`])) },
      part('ornament', 'body', id === 'qwen' ? [644, 492] : ['gemini', 'gpt'].includes(id) ? [680, 700] : [615, 610],
        id === 'qwen' ? [100, 245] : ['gemini', 'gpt'].includes(id) ? [230, 210] : [80, 130], [690, 720], id === 'qwen' ? 9 : 1),
    ],
  }
  const animations = structuredClone(animationBase), valid = new Set(character.parts.map(p => p.id))
  for (const clip of Object.values(animations.actions)) {
    clip.tracks = clip.tracks.filter(track => valid.has(track.part))
    clip.tracks.push({ part: 'back-hair', property: 'rotation', keys: [{ time: 0, value: -1 }, { time: clip.duration / 2, value: 1 }, { time: clip.duration, value: -1 }] })
    clip.tracks.push({ part: 'ornament', property: 'rotation', keys: [{ time: 0, value: -2 }, { time: clip.duration / 2, value: 2 }, { time: clip.duration, value: -2 }] })
  }
  await writeFile(join(destination, 'character.json'), JSON.stringify(character, null, 2) + '\n')
  await writeFile(join(destination, 'animations.json'), JSON.stringify(animations, null, 2) + '\n')
  const prior = await readFile(join(destination, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
  const unchanged = prior?.approvedForRelease && JSON.stringify(prior.parts) === JSON.stringify(inventory)
  await writeFile(join(destination, 'manifest.json'), JSON.stringify({ schemaVersion: 1, approvedForRelease: !!unchanged,
    status: unchanged ? 'agent-reviewed' : 'agent-visual-qa-pending', approval: { source: 'delegated-agent-review', userInstruction: '中途不需要额外验收' }, parts: inventory }, null, 2) + '\n')
  roster.push({ id, name: entry.name, parts: inventory.length })
}
console.log(JSON.stringify(roster))

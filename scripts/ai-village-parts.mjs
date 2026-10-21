/** Crop generated component atlases; no synthetic painting, background removal or pixel upscaling. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..')
const pkg = join(root, 'packages/ai-village')
const destination = join(pkg, 'assets/characters/bluewhale')
await mkdir(join(destination, 'parts'), { recursive: true })
await mkdir(join(pkg, 'art/approved'), { recursive: true })
const candidates = JSON.parse(await readFile(join(pkg, 'art/candidates/manifest.json'), 'utf8'))
for (const asset of candidates.assets) {
  asset.status = 'approved-base'
  asset.approved = true
  asset.approval = { source: 'user-message', text: '视觉效果确认通过，可以进入阶段2' }
  await copyFile(join(pkg, 'art/candidates', asset.path), join(pkg, 'art/approved', asset.path))
}
candidates.kind = 'phase1-approved-visual-bases'
await writeFile(join(pkg, 'art/candidates/manifest.json'), JSON.stringify(candidates, null, 2) + '\n')
await writeFile(join(pkg, 'art/approved/manifest.json'), JSON.stringify(candidates, null, 2) + '\n')
// Rectangles are measured against the actual generated atlas dimensions, not assumed grid cells.
const regions = [
  ['back-hair', 'hair', [5, 15, 570, 550]],
  ['front-hair', 'hair', [580, 115, 525, 450]],
  ['curl-left', 'hair', [1260, 60, 220, 480]],
  ['curl-right', 'hair', [135, 570, 220, 430]],
  ['headband', 'hair', [505, 605, 580, 365]],
  ['ear-left', 'hair', [1090, 740, 190, 185]],
  ['ear-right', 'hair', [1330, 740, 200, 185]],
  ['torso', 'torso-skirt', [250, 100, 530, 560]],
  ['skirt', 'torso-skirt', [15, 790, 995, 670]],
  ['leg-left', 'body', [225, 650, 240, 570]],
  ['leg-right', 'body', [780, 650, 250, 570]],
  ['arm-left', 'arms-tail', [80, 145, 455, 470]],
  ['arm-right', 'arms-tail', [725, 145, 455, 470]],
  ['tail-root', 'arms-tail', [25, 785, 635, 390]],
  ['tail-fin', 'arms-tail', [670, 690, 575, 485]],
  ['face-neutral', 'faces', [70, 55, 550, 570]],
  ['face-happy', 'faces', [640, 55, 550, 570]],
  ['face-surprised', 'faces', [70, 640, 550, 565]],
  ['face-sleepy', 'faces', [640, 640, 550, 565]],
  ['ahoge', 'ahoge', [0, 0, 1254, 1254]],
]
const inventory = []
for (const [id, source, region] of regions) {
  const relativeSource = source === 'approved-base' ? 'art/approved/bluewhale-neutral-v01.png' : `art/work/phase2/${source}-v01.png`
  const input = join(pkg, relativeSource)
  const metadata = await sharp(input).metadata()
  const [left, top, width, height] = region
  const cropped = await sharp(input).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer()
  let x1 = width, y1 = height, x2 = -1, y2 = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (cropped[(y * width + x) * 4 + 3] >= 16) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y) }
  }
  assert.ok(x2 >= x1 && y2 >= y1, id + ' empty')
  // Keep a two-pixel feather margin, retaining every original pixel inside the crop.
  x1 = Math.max(0, x1 - 2); y1 = Math.max(0, y1 - 2)
  x2 = Math.min(width - 1, x2 + 2); y2 = Math.min(height - 1, y2 + 2)
  const bounds = { left: left + x1, top: top + y1, width: x2 - x1 + 1, height: y2 - y1 + 1 }
  const file = `parts/${id}.png`
  await sharp(input).extract(bounds).png().toFile(join(destination, file))
  const bytes = await readFile(join(destination, file))
  inventory.push({ id, file, source: relativeSource, sourceSize: [metadata.width, metadata.height],
    crop: bounds, nativeSize: [bounds.width, bounds.height], bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    processing: 'Measured region and alpha-bounds crop only; alpha >=16 locates bounds with 2px margin; no pixel repainting or upscaling',
    completion: source === 'approved-base' ? 'Visible ahoge cut; root overlaps hair cap' : 'Imagegen occlusion completion; overlap checked in rig preview' })
}
const group = (id, parent, pivot, z) => ({ id, parent, pivot, offset: pivot, size: [0, 0], z, mirror: 'never' })
const part = (id, parent, offset, size, pivot, z) => ({ id, parent, file: `parts/${id}.png`, offset, size, pivot, z, mirror: 'never' })
const character = {
  schemaVersion: 1, id: 'bluewhale-v01', canvas: [1024, 1024], feet: [512, 952], visibleHeight: 900,
  status: 'phase2-motion-review', baseApproval: 'User approved phase1 visual bases',
  parts: [
    group('root', null, [512, 952], 0),
    part('tail-root', 'root', [622, 734], [266, 164], [643, 771], 0),
    part('tail-fin', 'tail-root', [790, 616], [212, 178], [885, 782], 1),
    part('leg-left', 'root', [416, 798], [93, 154], [464, 815], 2),
    part('leg-right', 'root', [534, 798], [93, 154], [577, 815], 2),
    group('body', 'root', [512, 673], 3),
    part('back-hair', 'body', [185, 168], [645, 585], [512, 310], 0),
    part('arm-left', 'body', [299, 557], [169, 175], [447, 575], 3),
    part('arm-right', 'body', [558, 557], [169, 175], [579, 575], 3),
    part('skirt', 'body', [284, 641], [456, 232], [512, 655], 4),
    part('torso', 'body', [410, 506], [204, 170], [512, 550], 5),
    group('head', 'body', [512, 503], 10),
    part('ear-left', 'head', [194, 352], [145, 119], [330, 382], 1),
    part('ear-right', 'head', [685, 352], [145, 119], [692, 382], 1),
    { ...part('face', 'head', [347, 230], [330, 310], [512, 490], 2), file: undefined,
      expressions: Object.fromEntries(['neutral', 'happy', 'surprised', 'sleepy'].map(name => [name, `parts/face-${name}.png`])) },
    part('front-hair', 'head', [273, 144], [478, 409], [512, 283], 3),
    part('headband', 'head', [278, 85], [495, 312], [512, 208], 4),
    part('ahoge', 'head', [344, 55], [174, 89], [495, 138], 5),
    part('curl-left', 'head', [280, 480], [100, 208], [325, 493], 6),
    part('curl-right', 'head', [644, 480], [100, 208], [694, 493], 6),
  ],
}
const track = (part, property, values, duration) => ({ part, property, keys: values.map((value, i) => ({ time: duration * i / (values.length - 1), value })) })
const oscillate = (part, property, values, duration) => track(part, property, values, duration)
const idleDuration = 4
const idle = { duration: idleDuration, loop: true, transition: .18, expression: 'neutral',
  expressions: [{ time: 0, value: 'neutral' }, { time: 3.2, value: 'sleepy' }, { time: 3.34, value: 'neutral' }],
  tracks: [
    track('body', 'y', [0, -4, 0, -4, 0], 4), track('head', 'rotation', [0, 1, 0, -1, 0], 4),
    track('tail-root', 'rotation', [-2, 2, -2], 4), track('tail-fin', 'rotation', [0, -4, 0, 4, 0], 4),
    track('curl-left', 'rotation', [0, 1.5, 0, -1.5, 0], 4), track('curl-right', 'rotation', [0, -1.5, 0, 1.5, 0], 4),
    track('ahoge', 'rotation', [0, 3, 0, -3, 0], 4),
  ] }
const walk = { duration: .8, loop: true, transition: .16, expression: 'neutral', tracks: [
  oscillate('leg-left', 'rotation', [-9, 0, 9, 0, -9], .8), oscillate('leg-right', 'rotation', [9, 0, -9, 0, 9], .8),
  oscillate('leg-left', 'y', [0, -9, 0, 0, 0], .8), oscillate('leg-right', 'y', [0, 0, 0, -9, 0], .8),
  oscillate('arm-left', 'rotation', [4, 0, -4, 0, 4], .8), oscillate('arm-right', 'rotation', [-4, 0, 4, 0, -4], .8),
  oscillate('body', 'y', [0, -7, 0, -7, 0], .8), oscillate('skirt', 'rotation', [-1.3, 0, 1.3, 0, -1.3], .8),
  oscillate('curl-left', 'rotation', [0, -3, 0, 3, 0], .8), oscillate('curl-right', 'rotation', [0, -3, 0, 3, 0], .8),
  oscillate('tail-root', 'rotation', [-2, 0, 2, 0, -2], .8), oscillate('tail-fin', 'rotation', [2, -2, 2], .8),
] }
const pickup = { duration: .35, loop: false, transition: .08, expression: 'surprised', tracks: [
  track('root', 'y', [0, -32], .35), track('arm-left', 'rotation', [0, 10], .35), track('arm-right', 'rotation', [0, -10], .35),
  track('leg-left', 'rotation', [0, 6], .35), track('leg-right', 'rotation', [0, -6], .35),
] }
const dragging = { duration: 1.6, loop: true, transition: .16, expression: 'surprised', tracks: [
  track('root', 'y', [-32, -35, -32], 1.6), track('root', 'rotation', [-2, 2, -2], 1.6),
  track('arm-left', 'rotation', [10, 13, 10], 1.6), track('arm-right', 'rotation', [-10, -13, -10], 1.6),
  track('leg-left', 'rotation', [6, 2, 6], 1.6), track('leg-right', 'rotation', [-6, -2, -6], 1.6),
  track('curl-left', 'rotation', [3, -3, 3], 1.6), track('curl-right', 'rotation', [3, -3, 3], 1.6),
  track('tail-fin', 'rotation', [-4, 4, -4], 1.6),
] }
const putDown = { duration: .55, loop: false, transition: .06, expression: 'neutral', tracks: [
  { part: 'root', property: 'y', keys: [{ time: 0, value: -32 }, { time: .25, value: 0 }, { time: .36, value: 3 }, { time: .55, value: 0 }] },
  track('body', 'scaleY', [1, .98, 1], .55), track('arm-left', 'rotation', [10, 0], .55), track('arm-right', 'rotation', [-10, 0], .55),
] }
await writeFile(join(destination, 'character.json'), JSON.stringify(character, null, 2) + '\n')
await writeFile(join(destination, 'animations.json'), JSON.stringify({ schemaVersion: 1, actions: { idle, walk, pickup, dragging, put_down: putDown } }, null, 2) + '\n')
const prior = await readFile(join(destination, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
const unchanged = prior?.approvedForRelease === true && JSON.stringify(prior.parts) === JSON.stringify(inventory)
await writeFile(join(destination, 'manifest.json'), JSON.stringify({ schemaVersion: 1,
  status: unchanged ? 'phase2-motion-approved' : 'phase2-motion-review', approvedForRelease: unchanged,
  ...(unchanged ? { approval: prior.approval } : {}), parts: inventory }, null, 2) + '\n')
console.log(JSON.stringify({ parts: inventory.length, canvas: character.canvas, output: destination }))

/** Reproducible art-only delivery. Native RGBA crops; never repaints or replaces alpha. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const pkg = resolve(import.meta.dirname, '../packages/ai-village')
const output = join(pkg, 'art/deliverables/roster-expansion')
const qa = join(pkg, 'art/QA/roster-expansion')
const spec = JSON.parse(await readFile(join(pkg, 'art/prompts/roster-expansion.json'), 'utf8'))
const names = ['face-neutral', 'face-happy', 'face-surprised', 'face-sleepy', 'torso', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'work-left', 'work-right', 'eat-left', 'eat-right', 'rest-pose', 'back-hair', 'ornament']
const layouts = {
  seedance: { version: 2, heads: [0, 329, 642, 953, 1254], rows: [0, 320, 635, 910, 1254], torsoEnd: 345 },
  glm: { version: 1, heads: [0, 326, 640, 952, 1254], rows: [0, 328, 631, 884, 1254], torsoEnd: 349 },
  minimax: { version: 1, heads: [0, 320, 637, 949, 1254], rows: [0, 325, 636, 878, 1254], torsoEnd: 342 },
  llama: { version: 1, heads: [0, 327, 640, 953, 1254], rows: [0, 336, 636, 880, 1254], torsoEnd: 349 },
  mistral: { version: 1, heads: [0, 326, 640, 950, 1254], rows: [0, 325, 637, 885, 1254], torsoEnd: 375 },
}
await mkdir(qa, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n')
const contact = [], summary = []
for (const entry of spec.characters) {
  const { id } = entry, layout = layouts[id], dir = join(output, 'characters', id)
  await mkdir(join(dir, 'parts'), { recursive: true })
  const source = `art/work/roster-expansion/${id}-v0${layout.version}.png`
  const input = join(pkg, source), meta = await sharp(input).metadata()
  assert.equal(meta.width, 1254); assert.equal(meta.height, 1254); assert.ok(meta.hasAlpha)
  const inventory = []
  for (const [i, name] of names.entries()) {
    const row = Math.floor(i / 4), col = i % 4
    const xs = row === 0 ? layout.heads : row === 1 ? [0, layout.torsoEnd, 641, 978, 1254] : [0, 335, 645, 986, 1254]
    let left = xs[col], top = layout.rows[row], width = xs[col + 1] - left, height = layout.rows[row + 1] - top
    if (name === 'leg-right') height = 925 - top
    if (name === 'eat-right') { top = 925; height = 1254 - top; width = 350 }
    if (name === 'rest-pose') { left = id === 'glm' ? 300 : id === 'mistral' ? 335 : 330; width = (id === 'mistral' ? 674 : id === 'llama' ? 650 : 640) - left }
    if (name === 'back-hair') { left = id === 'mistral' ? 674 : 645; width = (id === 'mistral' ? 1018 : id === 'glm' ? 985 : 978) - left; top = id === 'mistral' ? 895 : 900; height = 1254 - top }
    if (name === 'ornament') { left = id === 'mistral' ? 1025 : 982; width = 1254 - left; top = 910; height = 1254 - top }
    if (name === 'work-left' && id === 'seedance') height = 880 - top
    if (name === 'work-left' && id === 'glm') height = 879 - top
    if (name === 'eat-right' && id === 'minimax') width = 333
    let partSource = source, partInput = input
    if (name === 'back-hair' && ['glm','mistral'].includes(id)) {
      partSource = `art/work/roster-expansion/${id}-back-hair-v02.png`; partInput = join(pkg,partSource)
      left = 0; top = 0; width = 1254; height = 1254
    }
    if (id === 'mistral' && ['work-left','eat-right','rest-pose'].includes(name)) {
      partSource = 'art/work/roster-expansion/mistral-repairs-v02.png'; partInput = join(pkg,partSource)
      const region = { 'work-left': [0,0,650,600], 'eat-right': [680,0,574,600], 'rest-pose': [0,600,740,654] }[name]
      ;[left,top,width,height] = region
    }
    if (id === 'glm' && ['work-left','eat-right','rest-pose'].includes(name)) {
      partSource = 'art/work/roster-expansion/glm-repairs-v03.png'; partInput = join(pkg,partSource)
      const region = { 'work-left': [0,0,625,570], 'eat-right': [625,0,629,570], 'rest-pose': [0,590,680,664] }[name]
      ;[left,top,width,height] = region
    }
    const region = { left, top, width, height }
    const raw = await sharp(partInput).extract(region).ensureAlpha().raw().toBuffer()
    let x1 = width, y1 = height, x2 = -1, y2 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (raw[(y * width + x) * 4 + 3] >= 32) {
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y)
    }
    // Reviewed neighboring-cell islands: tighten the rectangle to the main silhouette.
    // This never erases pixels inside the rectangle or regenerates alpha.
    const isolatedBounds = { seedance: ['eat-right'], glm: ['face-happy','face-surprised'], minimax: ['face-happy','face-surprised','work-left','rest-pose'] }
    if (isolatedBounds[id]?.includes(name)) {
      const seen = new Uint8Array(width*height); let largest = 0
      for (let i=0;i<seen.length;i++) if (!seen[i] && raw[i*4+3]>=32) {
        const stack=[i]; seen[i]=1; let count=0,a=width,b=height,c=-1,d=-1
        while(stack.length) { const n=stack.pop(),x=n%width,y=Math.floor(n/width); count++; a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)
          for(const next of [x?n-1:-1,x+1<width?n+1:-1,y?n-width:-1,y+1<height?n+width:-1]) if(next>=0&&!seen[next]&&raw[next*4+3]>=32){seen[next]=1;stack.push(next)}
        }
        if(count>largest){largest=count;x1=a;y1=b;x2=c;y2=d}
      }
    }
    assert.ok(x2 >= x1 && y2 >= y1, id + '/' + name)
    const crop = { left: left + Math.max(0, x1 - 2), top: top + Math.max(0, y1 - 2), width: Math.min(width - 1, x2 + 2) - Math.max(0, x1 - 2) + 1, height: Math.min(height - 1, y2 + 2) - Math.max(0, y1 - 2) + 1 }
    const file = `parts/${name}.png`
    await sharp(partInput).extract(crop).png().toFile(join(dir, file))
    const bytes = await readFile(join(dir, file))
    inventory.push({ id: name, file, source: partSource, sourceInDelivery: `sources/${basename(partSource)}`, sourceSha256: hash(await readFile(partInput)), crop, nativeSize: [crop.width, crop.height], bytes: bytes.length, sha256: hash(bytes), processing: 'Reviewed native rectangle crop, main-silhouette bounds used to exclude adjacent-cell islands; original RGBA inside rectangle retained' })
  }
  const character = JSON.parse(await readFile(join(pkg, 'assets/characters/claude/character.json'), 'utf8'))
  character.id = `${id}-v01`
  const part = name => character.parts.find(p => p.id === name)
  if (id === 'glm') part('face').size = [604, 605]
  if (id === 'minimax') { part('back-hair').offset = [254, 245]; part('back-hair').size = [516, 480] }
  if (id === 'seedance') { part('back-hair').offset = [290, 245]; part('back-hair').size = [500, 560] }
  if (['glm', 'mistral'].includes(id)) { Object.assign(part('ornament'), { offset: [695, 660], size: [215, 270], pivot: [720, 820], z: 1 }) }
  if (id === 'minimax') { Object.assign(part('ornament'), { offset: [610, 600], size: [145, 185], pivot: [660, 615], z: 4 }) }
  if (id === 'seedance') { Object.assign(part('ornament'), { offset: [640, 650], size: [100, 175], pivot: [660, 665], z: 4 }) }
  if (id === 'llama') { Object.assign(part('ornament'), { offset: [640, 650], size: [90, 150], pivot: [650, 660], z: 4 }) }
  const animations = JSON.parse(await readFile(join(pkg, 'assets/characters/claude/animations.json'), 'utf8'))
  await json(join(dir, 'character.json'), character)
  await json(join(dir, 'animations.json'), animations)
  const activities = { schemaVersion: 1, coordinateSystem: 'character canvas; front view; no mirroring', work: { hide: ['arm-left','arm-right','leg-left','leg-right'], arms: [{ file: 'parts/work-left.png', offset: [325,560], size: [175,200] }, { file: 'parts/work-right.png', offset: [535,560], size: [175,200] }], motion: 'Left writing hand: y += sin(phase*7)*6, rotation = sin(phase*7)*0.025 radians' }, eat: { hide: ['arm-left','arm-right','leg-left','leg-right'], arms: [{ file: 'parts/eat-left.png', offset: [325,495], size: [220,185] }, { file: 'parts/eat-right.png', offset: [535,495], size: [220,185] }], motion: 'Right spoon hand: y -= (1+sin(phase*3))*22; x -= (1+sin(phase*3))*10; rotation=-0.05 radians' }, rest: { file: 'parts/rest-pose.png', anchor: [0.5,1], logicalHeight: 96, motion: 'height *= 1+0.004*sin(phase*2)' } }
  await json(join(dir, 'activities.json'), activities)
  await json(join(dir, 'manifest.json'), { schemaVersion: 1, id, name: entry.name, status: 'art-qa-pending', approvedForRelease: false, integration: 'Art-only delivery; not registered in production roster', generator: 'built-in image_gen', sourceSha256: hash(await readFile(input)), parts: inventory, definitions: await Promise.all(['character.json','animations.json','activities.json'].map(async file => ({ file, sha256: hash(await readFile(join(dir,file))) }))) })
  const ordered = []
  function visit(parent) { for (const p of character.parts.filter(p => p.parent === parent).sort((a,b) => a.z-b.z)) { ordered.push(p); visit(p.id) } }
  visit(null)
  const layers = []
  for (const p of ordered) { const file = p.file ?? p.expressions?.neutral; if (file) layers.push({ input: await sharp(join(dir,file)).resize(...p.size,{fit:'fill'}).toBuffer(), left:p.offset[0], top:p.offset[1] }) }
  const assembled = await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer()
  await writeFile(join(dir,'portrait.png'), assembled)
  await sharp(assembled).resize(128,128).png().toFile(join(dir,'portrait-128.png'))
  contact.push({input:await sharp(assembled).resize(256,256).toBuffer(),left:summary.length*256,top:0})
  summary.push({id,parts:inventory.length,bytes:inventory.reduce((n,p)=>n+p.bytes,0)})
}
await sharp({create:{width:1280,height:256,channels:4,background:'#f5eee2'}}).composite(contact).png().toFile(join(qa,'assembled-contact.png'))
await json(join(output,'inventory.json'), {schemaVersion:1,baseVersion:spec.baseVersion,characters:summary})
console.log(JSON.stringify(summary))

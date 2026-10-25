import { readFile, writeFile, lstat, realpath } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { validateEntranceTheme } from '../packages/ai-village/src/client/entrance-theme.ts'
import { characterIds } from '../packages/ai-village/src/core/roster.ts'
import { approvedSceneAssets } from './ai-village-scene-assets.mjs'
const pkg = resolve(import.meta.dirname, '../packages/ai-village'), root = join(pkg, 'assets')
const read = async p => JSON.parse(await readFile(join(root, p), 'utf8'))
const character = await read('characters/bluewhale/character.json'), animations = await read('characters/bluewhale/animations.json'), scene = await read('scenes/courtyard/scene.json')
const files = []
const entrance = await read('entrance/manifest.json')
if (!['ART_PENDING','ART_REVIEW','APPROVED'].includes(entrance.status)) throw Error('Invalid entrance review status')
if (!Array.isArray(entrance.files) || !Array.isArray(entrance.layers) || entrance.files.length > 8 || new Set(entrance.files.map(e=>e.key)).size !== entrance.files.length) throw Error('Invalid entrance closure')
if (entrance.status === 'ART_PENDING' ? entrance.files.length || entrance.layers.length : !validateEntranceTheme(entrance)) throw Error('Invalid entrance theme')
let entranceBytes = 0, entrancePixels = 0
for (const entry of entrance.files) {
  if (!/^entrance\/[a-z-]+\.png$/.test(entry.key) || entry.file !== entry.key) throw Error('Invalid entrance asset path')
  const path=join(root,entry.file), info=await lstat(path)
  if(!info.isFile() || info.isSymbolicLink() || (await realpath(path)) !== join(await realpath(root),entry.file)) throw Error('Linked entrance asset refused')
  const bytes = await readFile(path), hash = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== entry.bytes || hash !== entry.sha256 || bytes.length < 33 || bytes.length > 8*1024*1024 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Error('Entrance integrity mismatch')
  if(bytes.readUInt32BE(12)!==0x49484452 || bytes[24]!==8 || bytes[25]!==6 || bytes.readUInt32BE(16)<1 || bytes.readUInt32BE(20)<1 || bytes.readUInt32BE(16)>4096 || bytes.readUInt32BE(20)>4096)throw Error('Invalid entrance PNG dimensions/format')
  entranceBytes += bytes.length; entrancePixels += bytes.readUInt32BE(16)*bytes.readUInt32BE(20)
  files.push(entry)
}
if(entrance.files.some(entry=>!entrance.layers.some(layer=>layer.key===entry.key)))throw Error('Unused entrance resource')
if (entranceBytes > 4*1024*1024 || entrancePixels > 8000000) throw Error('Entrance exceeds art budget')
for (const layer of entrance.layers) if (!entrance.files.some(entry=>entry.key===layer.key)) throw Error('Entrance layer is not whitelisted')
await writeFile(join(pkg,'src/entrance-manifest.ts'), `// Generated from the local entrance asset manifest.\nexport const entranceManifest = ${JSON.stringify(entrance,null,2)}\n`)
const roster = {}
const ids = characterIds.filter(id => id !== 'bluewhale')
for (const id of ids) {
  const definition = await read(`characters/${id}/character.json`)
  for (const p of definition.parts) {
    if (p.file) p.file = `${id}/${p.file}`
    if (p.expressions) p.expressions = Object.fromEntries(Object.entries(p.expressions).map(([k, v]) => [k, `${id}/${v}`]))
  }
  roster[id] = { character: definition, animations: await read(`characters/${id}/animations.json`), activityPrefix: `${id}/parts/` }
}
for (const [dir, field, prefix] of [['characters/bluewhale', 'parts', ''], ['scenes/courtyard', 'files', 'scene/'], ...ids.map(id => [`characters/${id}`, 'parts', `${id}/`])]) {
  const manifest = await read(dir + '/manifest.json')
  if (!manifest.approvedForRelease) throw Error('Unapproved assets: ' + dir)
  for (const entry of manifest[field]) {
    const bytes = await readFile(join(root, dir, entry.file)), hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== entry.sha256) throw Error('Asset hash mismatch: ' + entry.file)
    files.push({ key: prefix + entry.file, file: dir + '/' + entry.file, bytes: bytes.length, sha256: hash })
  }
}
// Each scene has its own explicit approval; direction studies stay outside assets.
const map = await read('community-map/manifest.json')
if(map.status!=='APPROVED'||map.approvedForRelease!==true||map.scope!=='community-map-only'||map.files.length!==6)throw Error('Unapproved community map')
let mapBytes=0,mapPixels=0
for(const entry of map.files){
  if(!/^community-map-(terrain|courtyard|bookhouse|tea-square|lakeside-garden|workshop)\.png$/.test(entry.file)||!entry.approvedForRelease)throw Error('Invalid map asset')
  const path=join(root,'community-map',entry.file),info=await lstat(path)
  if(!info.isFile()||info.isSymbolicLink()||(await realpath(path))!==join(await realpath(root),'community-map',entry.file))throw Error('Linked map asset refused')
  const bytes=await readFile(path),hash=createHash('sha256').update(bytes).digest('hex')
  if(bytes.length!==entry.bytes||hash!==entry.sha256||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==entry.size[0]||bytes.readUInt32BE(20)!==entry.size[1])throw Error('Map integrity mismatch')
  mapBytes+=bytes.length;mapPixels+=entry.size[0]*entry.size[1]
  files.push({key:'map/'+entry.file.slice('community-map-'.length),file:'community-map/'+entry.file,bytes:entry.bytes,sha256:hash,width:entry.size[0],height:entry.size[1]})
}
if(new Set(map.files.map(e=>e.file)).size!==6||mapBytes>2*1024*1024||mapPixels*4>6*1024*1024)throw Error('Map budget exceeded')
for(const region of ['tea-square','bookhouse'])files.push(...await approvedSceneAssets(root,region))
for(const entry of [...(await read('portraits/manifest.json')).files,...(await read('thumbnails/manifest.json')).files]) {
  const bytes=await readFile(join(root,entry.file)), hash=createHash('sha256').update(bytes).digest('hex')
  if(hash!==entry.sha256 || bytes.length!==entry.bytes)throw Error('Portrait integrity mismatch: '+entry.file)
  files.push(entry)
}
await writeFile(join(pkg, 'src/definitions.ts'), `// Generated by scripts/ai-village-resources.mjs from reviewed runtime assets.\nimport type { Scene } from './core/world.ts'\nimport type { Character, AnimationSet } from './art/types.ts'\nexport const scene = ${JSON.stringify(scene)} as Scene & { furniture: { id: string; asset: string; rect: import('./core/world.ts').Rect; split: number }[]; cushion: import('./core/world.ts').Rect }\nexport const character = ${JSON.stringify(character)} as Character\nexport const animations = ${JSON.stringify(animations)} as AnimationSet\nexport const roster = ${JSON.stringify(roster)} as Record<string, { character: Character; animations: AnimationSet; activityPrefix: string }>\nexport const resources = ${JSON.stringify(files, null, 2)}\n`)

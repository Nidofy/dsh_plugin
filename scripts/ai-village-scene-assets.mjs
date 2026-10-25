import { readFile, lstat, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

// Shared by generation and packaging: approval is scoped to these exact local scenes.
const contracts = {
  'tea-square': { scope: 'tea-square-scene-only', names: ['background.png','tea-table.png','tea-counter.png','message-tree.png'], bytes: 5*1024*1024, rgba: 12*1024*1024 },
  bookhouse: { scope: 'bookhouse-scene-and-resident-contact', names: ['bookhouse-scene-atlas.png','bookhouse-activity-atlas.png'], bytes: 3*1024*1024, rgba: 8*1024*1024 },
}
export async function approvedSceneAssets(root, region) {
  const contract = contracts[region]
  if (!contract) throw Error('Unknown approved scene')
  const manifest = JSON.parse(await readFile(join(root, region, 'manifest.json'), 'utf8'))
  if (manifest.status !== 'APPROVED' || manifest.approvedForRelease !== true || manifest.scope !== contract.scope || !Array.isArray(manifest.files) || manifest.files.length !== contract.names.length) throw Error('Unapproved scene: '+region)
  const names = new Set(), resources = [], canonicalRoot = await realpath(root)
  let totalBytes=0, totalRGBA=0
  for (const entry of manifest.files) {
    if (!contract.names.includes(entry.file) || names.has(entry.file) || entry.key !== region+'/'+entry.file || !Array.isArray(entry.size) || entry.size.length !== 2 || !entry.size.every(n=>Number.isInteger(n)&&n>0&&n<=2048)) throw Error('Invalid scene asset: '+region)
    names.add(entry.file)
    const path=join(root,region,entry.file), info=await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || await realpath(path) !== join(canonicalRoot,region,entry.file)) throw Error('Linked scene asset refused')
    const bytes=await readFile(path), hash=createHash('sha256').update(bytes).digest('hex')
    const validColorType = bytes[25]===6 || (region==='tea-square' && entry.file==='background.png' && bytes[25]===2)
    if (bytes.length<33 || bytes.length!==entry.bytes || hash!==entry.sha256 || bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || bytes.readUInt32BE(12)!==0x49484452 || bytes[24]!==8 || !validColorType || bytes.readUInt32BE(16)!==entry.size[0] || bytes.readUInt32BE(20)!==entry.size[1]) throw Error('Scene integrity mismatch: '+region+'/'+entry.file)
    totalBytes+=bytes.length; totalRGBA+=entry.size[0]*entry.size[1]*4
    resources.push({key:entry.key,file:region+'/'+entry.file,bytes:bytes.length,sha256:hash,width:entry.size[0],height:entry.size[1]})
  }
  if(totalBytes>contract.bytes || totalRGBA>contract.rgba) throw Error('Scene budget exceeded: '+region)
  return resources
}

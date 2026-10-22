import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { validateEntranceTheme } from '../packages/ai-village/src/client/entrance-theme.ts'
const root = resolve(import.meta.dirname, '..'), sourceArg = process.argv.find(a => a.startsWith('--source='))?.slice(9)
if (!sourceArg || process.argv.some(a => !a.startsWith('--source=') && !['--write','--dry-run'].includes(a) && !a.endsWith('ai-village-entrance-import.mjs') && a !== process.argv[0])) throw Error('Usage: node scripts/ai-village-entrance-import.mjs --source=<art-worktree> [--dry-run|--write]')
const source = await realpath(sourceArg), git = (...args) => execFileSync('git', ['-c', `safe.directory=${source.replaceAll('\\','/')}`, '-C', source, ...args], {windowsHide:true}).toString().trim()
const sha = git('rev-parse','HEAD'), sourcePaths = ['packages/ai-village/assets/boot','packages/ai-village/art/entrance-v1/source']
if (git('status','--porcelain','--',...sourcePaths)) throw Error('Art source must be committed before import')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function input(path) {
  const full = join(source,path), info = await lstat(full), actual = await realpath(full), rel = relative(source,actual)
  if (!info.isFile() || info.isSymbolicLink() || isAbsolute(rel) || rel.startsWith('..') || info.size > 16*1024*1024) throw Error('Unsafe art source: '+path)
  const bytes = await readFile(full)
  const committed = execFileSync('git',['-c',`safe.directory=${source.replaceAll('\\','/')}`,'-C',source,'show',`${sha}:${path}`],{maxBuffer:20*1024*1024,windowsHide:true})
  if (!bytes.equals(committed)) throw Error('Source changed during import: '+path)
  return bytes
}
const base='packages/ai-village/assets/boot/', raw=await input(base+'compat/entrance/manifest.json'), detailedBytes=await input(base+'entrance-art-manifest.json')
const manifest=JSON.parse(raw), detailed=JSON.parse(detailedBytes)
if (manifest.status !== 'ART_REVIEW' || detailed.status !== 'ART_REVIEW') throw Error('Importer only creates unapproved review candidates')
manifest.id='dream-garden'; manifest.revision=1
manifest.portalPolygon=detailed.portal.polygonPx.map(([x,y])=>[x/manifest.designSize.width,y/manifest.designSize.height])
manifest.layers=manifest.layers.map(layer=>({...layer,parallax:detailed.layers.find(v=>v.file===layer.key.slice(9)).parallax}))
// Door leaves precede the stone frame; foreground remains in front of both.
manifest.layers.sort((a,b)=>detailed.layers.find(v=>v.file===a.key.slice(9)).z-detailed.layers.find(v=>v.file===b.key.slice(9)).z)
if(!validateEntranceTheme(manifest)) throw Error('Invalid candidate geometry')
const buffers=[], inventory=[]
for(const entry of manifest.files){
  if(!/^entrance\/[a-z-]+\.png$/.test(entry.key)||entry.file!==entry.key) throw Error('Invalid input path')
  const path=base+'compat/'+entry.file, bytes=await input(path)
  if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==entry.width||bytes.readUInt32BE(20)!==entry.height||bytes[24]!==8||bytes[25]!==6)throw Error('Invalid RGBA PNG: '+path)
  let srgb=false
  for(let offset=8;offset+12<=bytes.length;){const n=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);if(offset+12+n>bytes.length)throw Error('Truncated PNG');if(kind==='iCCP'||kind==='sRGB')srgb=true;offset+=n+12}
  if(!srgb)throw Error('Missing sRGB profile')
  const layer=manifest.layers.find(l=>l.key===entry.key)
  inventory.push({...entry,source_path:path,source_sha256:hash(bytes),output_sha256:hash(bytes),color_profile:'sRGB (source ICC retained)',alpha:'straight RGBA',crop_on_720x960:[Math.round(layer.rect.x*720),Math.round(layer.rect.y*960),entry.width,entry.height],rect:layer.rect,pivot:layer.pivot??null})
  buffers.push([entry.file,bytes])
}
const bytes=inventory.reduce((n,e)=>n+e.bytes,0),pixels=inventory.reduce((n,e)=>n+e.width*e.height,0)
if(bytes>4*1024*1024||pixels>8000000||inventory.length>8)throw Error('Budget exceeded')
const sources=[]
for(const path of ['packages/ai-village/art/entrance-v1/source/master-closed-original.png','packages/ai-village/art/entrance-v1/source/environment-clean-original.png',base+'ART_HANDOFF.md'])sources.push({path,sha256:hash(await input(path))})
manifest.source=`Original dream-garden art commit ${sha}; cropped 2x compatibility export, unchanged PNG bytes; human approval pending.`
const report={status:'ART_REVIEW',source_commit:sha,importer:'ai-village-entrance-import/v1',source_manifest_sha256:hash(raw),geometry_manifest_sha256:hash(detailedBytes),sources,compressed_bytes:bytes,decoded_pixels:pixels,rgba_bytes_lower_bound:pixels*4,budgets:{bytes:4*1024*1024,pixels:8000000,layers:8},files:inventory}
if(process.argv.includes('--write')){
  await mkdir(join(root,'packages/ai-village/assets/entrance'),{recursive:true})
  for(const [file,data] of buffers)await writeFile(join(root,'packages/ai-village/assets',file),data)
  await writeFile(join(root,'packages/ai-village/assets/entrance/manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  const docs=join(root,'docs/ai-village/entrance-parallel/integration');await mkdir(docs,{recursive:true})
  await writeFile(join(docs,'ART_IMPORT.json'),JSON.stringify(report,null,2)+'\n')
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',source_commit:sha,layers:inventory.length,bytes,pixels,status:manifest.status}))

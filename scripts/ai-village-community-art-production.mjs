/** Authorized map-only optimization. Faithful resize of approved sources; no repaint/crop. */
import sharp from 'sharp'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),base=join(root,'packages/ai-village/art/candidates/community-next'),out=join(base,'production-ready')
await mkdir(out,{recursive:true})
const hash=b=>createHash('sha256').update(b).digest('hex'),specs=[['map-terrain-v01.png','community-map-terrain.png',768,576],...['courtyard','bookhouse','tea-square','lakeside-garden','workshop'].map(id=>['landmark-'+id+'-v01.png','community-map-'+id+'.png',256,256])],files=[]
for(const [source,file,width,height]of specs){
 const bytes=await readFile(join(base,source)),sourceMeta=await sharp(bytes).metadata()
 assert.ok(Math.abs(sourceMeta.width/sourceMeta.height-width/height)<.001,'No aspect-ratio change')
 const result=await sharp(bytes).resize(width,height,{kernel:'lanczos3',fit:'fill'}).png({compressionLevel:9,palette:false}).toBuffer()
 const {data,info}=await sharp(result).ensureAlpha().raw().toBuffer({resolveWithObject:true})
 let transparent=0,partial=0,opaque=0
 for(let i=3;i<data.length;i+=4){if(!data[i])transparent++;else if(data[i]===255)opaque++;else partial++}
 if(source.startsWith('landmark-'))assert.ok(transparent>100,'Alpha preserved')
 await writeFile(join(out,file),result)
 files.push({file,source,sourceSha256:hash(bytes),sourceSize:[sourceMeta.width,sourceMeta.height],sha256:hash(result),bytes:result.length,size:[width,height],mime:'image/png',decodedRGBABytes:width*height*4,alpha:{transparent,partial,opaque},approvedForRelease:true})
}
const totals={files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),decodedRGBABytes:files.reduce((s,f)=>s+f.decodedRGBABytes,0)}
assert.ok(totals.bytes<=2*1024*1024,'Compressed budget <=2MiB');assert.ok(totals.decodedRGBABytes<=6*1024*1024,'Decoded budget <=6MiB')
const approval={status:'APPROVED',date:'2026-10-25',scope:'Only community map terrain, five landmark illustrations and their faithful downscaled derivatives.',authorization:'User explicitly approved the map candidate for formal integration in this conversation; communicated to this art worker by the main agent. This is not approval of all art in community-next.',excluded:['bluewhale direction/reading poses','bookhouse scene art','tea-square playable scene/background','lakeside/workshop gameplay'],method:'Lanczos3 proportional resize and lossless non-palette PNG compression. No repaint, crop, geometry change or character edits.',runtimeEnabled:false}
await writeFile(join(out,'approval.json'),JSON.stringify(approval,null,2)+'\n')
const manifest={version:1,status:'APPROVED',approvedForRelease:true,runtimeEnabled:false,scope:'community-map-only',date:'2026-10-25',files,totals,budget:{maxCompressedBytes:2*1024*1024,maxDecodedRGBABytes:6*1024*1024},approval:'approval.json',sourceGeometry:'../map-geometry.json',sourcePrompt:'../prompts.json',source:'built-in image_gen original candidates; faithful resized derivatives',license:'MIT',integration:'Only load these six images while the map is open. Existing 512px review thumbnails are not runtime dependencies. World scenes and regions remain independently gated.'}
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
const map=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));map.status='APPROVED';map.approvedForRelease=true;map.scope='community-map-only';map.approval='production-ready/approval.json';map.runtimeEnabled=false;map.limitations=map.limitations.filter(s=>!s.includes('user visual signoff'));map.limitations.push('Map-only visual approval granted; production integration and final-package QA remain owner tasks. Bluewhale, bookhouse and tea scene studies retain independent unapproved status.');await writeFile(join(base,'manifest.json'),JSON.stringify(map,null,2)+'\n')
console.log(JSON.stringify({output:out,totals},null,2))

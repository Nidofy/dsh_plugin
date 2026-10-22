/** Offline neutral PaperDoll composition using approved transforms and original parts. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
const root = resolve('packages/ai-village/assets'), output = join(root,'portraits')
await mkdir(output,{recursive:true})
const inventory=[]
for(const id of ['bluewhale','claude','gemini','gpt','grok','kimi','qwen']) {
  const dir=join(root,'characters',id), c=JSON.parse(await readFile(join(dir,'character.json'),'utf8')), layers=[]
  const walk=async parent=>{for(const p of c.parts.filter(p=>p.parent===parent).sort((a,b)=>a.z-b.z)) {
    const file=p.file??p.expressions?.neutral
    if(file) layers.push({input:await sharp(join(dir,file)).resize(Math.round(p.size[0]),Math.round(p.size[1])).png().toBuffer(),left:Math.round(p.offset[0]),top:Math.round(p.offset[1])})
    await walk(p.id)
  }}
  await walk(null)
  const full=await sharp({create:{width:c.canvas[0],height:c.canvas[1],channels:4,background:'#00000000'}}).composite(layers).png().toBuffer()
  const bytes=await sharp(full).extract({left:130,top:0,width:780,height:780}).resize(128,128).png().toBuffer()
  await writeFile(join(output,id+'.png'),bytes)
  inventory.push({key:'portraits/'+id+'.png',file:'portraits/'+id+'.png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
}
await writeFile(join(output,'manifest.json'),JSON.stringify({source:'Approved neutral PaperDoll; offline composition, no new art',files:inventory},null,2)+'\n')
console.log('Seven 128x128 complete paper-doll portraits generated')

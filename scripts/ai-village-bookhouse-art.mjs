/** Install the explicitly approved bookhouse atlas bytes and frozen contact metadata. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),candidate=join(pkg,'art/candidates/community-next'),source=join(candidate,'bookhouse-optimized-v01'),out=join(pkg,'assets/bookhouse'),hash=b=>createHash('sha256').update(b).digest('hex')
await mkdir(out,{recursive:true})
const original=JSON.parse(await readFile(join(source,'manifest.json'),'utf8')),seats=JSON.parse(await readFile(join(candidate,'bookhouse-seat-recipes.json'),'utf8'))
const files=[];for(const f of original.files){const b=await readFile(join(source,f.file));if(hash(b)!==f.sha256)throw Error('SOURCE_HASH');await copyFile(join(source,f.file),join(out,f.file));files.push({...f,key:'bookhouse/'+f.file})}
const names={'desk':'reading-desk','window':'window-seat'},props={'prop-open-book':'bookcase','prop-paper-pencil':'reading-desk','prop-window-book':'window-seat'}
const layers=original.layers.map(l=>{const hotspot=props[l.id],id=hotspot?hotspot+'-prop':l.id.replace(/^(desk|window)-/,(_,n)=>names[n]+'-');return{id,key:'bookhouse/'+l.file,sourceRect:l.sourceRect,rect:l.rect,z:l.z,kind:l.id==='background'?'background':hotspot?'prop':'furniture',...(hotspot?{hotspot}:{})}})
const approval={status:'APPROVED',date:'2026-10-25',scope:'bookhouse-scene-and-resident-contact',authorization:'User explicitly approved the complete bookhouse scene and all twelve residents own-identity held-book/seated candidates in this conversation and requested default activation after validation.',source:'art/candidates/community-next/bookhouse-optimized-v01',review:'bookhouse-roster-qa-v07',license:'MIT'}
const manifest={...approval,approvedForRelease:true,files,layers,contacts:original.parts,seats,totals:original.totals,method:original.method}
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
await writeFile(join(pkg,'src/frame/bookhouse-contact-data.ts'),'/** Generated from user-approved bookhouse atlas; preserve frozen geometry. */\nexport const bookhouseLayers = '+JSON.stringify(layers,null,2)+' as const\nexport const bookhouseContactFrames = '+JSON.stringify(original.parts,null,2)+' as const\nexport const bookhouseSeatRecipes = '+JSON.stringify(seats,null,2)+' as const\n')
console.log(JSON.stringify({files,manifest:join(out,'manifest.json')}))

/** Candidate source audit; reads pixels only, never writes transformed images. */
import sharp from 'sharp'
import {readFile,writeFile,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),base=join(pkg,'art/candidates/community-next'),hash=b=>createHash('sha256').update(b).digest('hex'),files=[]
for(const file of['claude-held-book-arms-v01.png','claude-seat-lower-v01.png','gemini-held-book-arms-v01.png']){
 const bytes=await readFile(join(base,file)),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0,partial=0,opaque=0
 for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;else if(data[i]===255)opaque++;else partial++}
 const id=file.split('-')[0],reference='art/work/roster/'+id+'-v02.png'
 files.push({file,sha256:hash(bytes),bytes:bytes.length,size:[info.width,info.height],decodedRGBABytes:info.width*info.height*4,alpha:{transparent,partial,opaque},reference,referenceSha256:hash(await readFile(join(pkg,reference))),source:'built-in image_gen; source PNG copied unchanged',license:'MIT project asset policy; generated original derivative of project identity reference',approvedForRelease:false})
}
await writeFile(join(base,'bookhouse-identity-manifest.json'),JSON.stringify({version:1,status:'ENGINEERING_CANDIDATE_NOT_APPROVED',approvedForRelease:false,runtimeEnabled:false,files,prompts:'bookhouse-identity-prompts.json',renderer:'bookhouse-roster-renderer-v04.ts',validation:'bookhouse-roster-qa-v04/validation.json',geometry:{windowSeatRect:[44,198,116,42],feet:[92,270],hip:[92,225],geminiVisualSole:[92,250],geminiProjectedFootprint:[92,270]},qualification:{claude:{bookcase:'REVIEWABLE',windowSeat:'REVIEWABLE',desk:'EXISTING_OWN_ARMS'},gemini:{bookcase:'REVIEWABLE',windowSeat:'REVIEWABLE: original rest lower texture at natural scale; hanging soles250, projected footprint270; v03 oversized fallback retained as FAIL',desk:'EXISTING_OWN_ARMS'}},remaining:'Other nine residents retain unqualified book/window contacts. No whole-bookhouse approval or production registration. Gemini generation rejected; v03 fallback failed, v04 original-rest derived hanging feet candidate reviewable. No new generated Gemini seated image.'},null,2)+'\n')
console.log(JSON.stringify(files.map(({file,size,alpha})=>({file,size,alpha}))))
const qa=join(base,'bookhouse-roster-qa-v04'),validation=JSON.parse(await readFile(join(qa,'validation.json'),'utf8'))
for(const file of(await readdir(qa)).filter(f=>f.endsWith('.png'))){if(validation.screenshots.some(s=>s.file===file))continue;const bytes=await readFile(join(qa,file)),meta=await sharp(bytes).metadata();validation.screenshots.push({file,sha256:hash(bytes),size:[meta.width,meta.height],dpr:1,kind:file.startsWith('projection-')?'projection-diagnostic':'focus-first-three'})}
await writeFile(join(qa,'validation.json'),JSON.stringify(validation,null,2)+'\n')

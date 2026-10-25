/** Read-only raster measurement of two rejected native-alpha studies; never runtime art. */
import {readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import sharp from 'sharp'
const out=resolve(import.meta.dirname,'../packages/ai-village/art/candidates/bluewhale-walk-cycle'),files=[]
for(const file of ['left-cycle-v01-unqualified.png','left-cycle-v02-unqualified.png','left-passing-a-study.png','left-contact-b-study.png']){
 const bytes=await readFile(join(out,file)),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),midX=Math.floor(info.width/2),midY=Math.floor(info.height/2)
 let transparent=0,partial=0,opaque=0,verticalSeam=0,horizontalSeam=0
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(!a)transparent++;else if(a===255)opaque++;else partial++;if(a>=8&&Math.abs(x-midX)<=1)verticalSeam++;if(a>=8&&Math.abs(y-midY)<=1)horizontalSeam++}
 files.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),size:[info.width,info.height],alpha:{transparent,partial,opaque},cellBoundaryPixelsAlpha8:file.includes('cycle-')?{vertical:verticalSeam,horizontal:horizontalSeam}:null,status:file.includes('cycle-')?'NOT_QUALIFIED':'UNREGISTERED_INDIVIDUAL_STUDY',source:'built-in image_gen; native PNG bytes preserved'})
}
await writeFile(join(out,'manifest.json'),JSON.stringify({status:'NOT_QUALIFIED',approvedForRelease:false,runtimeEnabled:false,date:'2026-10-25',license:'MIT',files,limitations:['Fixed equal-cell sampling would cut through visible tails on the vertical boundary.','The contact phases retain substantially similar arm/leg poses; a complete alternating walk cycle and planted-foot registration have not been established.','No right-facing, rear cycle, stop or turn transition has passed; no sprite mirroring is proposed.','No runtime registration, scene collision data or release assets were derived from these images.'],next:'Produce individual registered left/right/rear contact and passing frames, validate local shoe landmarks and whole-cycle silhouette at 108px, then test turns and stops in the actual renderer before user visual review.'},null,2)+'\n')
console.log(JSON.stringify(files.map(({file,cellBoundaryPixelsAlpha8})=>({file,cellBoundaryPixelsAlpha8})),null,2))

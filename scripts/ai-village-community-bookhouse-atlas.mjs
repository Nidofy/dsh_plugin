/** Mechanical runtime-candidate atlas packing. No repaint; all source PNGs preserved. */
import sharp from 'sharp'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),pkg=join(root,'packages/ai-village'),base=join(pkg,'art/candidates/community-next'),out=join(base,'bookhouse-optimized-v01'),original=join(pkg,'art/deliverables/bookhouse-layered-v02'),hash=b=>createHash('sha256').update(b).digest('hex')
await mkdir(out,{recursive:true})
const scene=JSON.parse(await readFile(join(original,'manifest.json'),'utf8')),frames=JSON.parse(await readFile(join(base,'bookhouse-roster-frame-audit.json'),'utf8')),layers=[],composite=[],files=[]
let y=4
for(const layer of scene.layers){
 const b=await readFile(join(original,layer.file));assert.equal(hash(b),layer.sha256)
 const background=layer.id==='background',left=background?4:728,top=background?4:y,width=background?720:Math.round(layer.rect[2]*2),height=background?960:Math.round(layer.rect[3]*2)
 let pipeline=sharp(b);if(!background)pipeline=pipeline.extract({left:layer.sourceRect[0],top:layer.sourceRect[1],width:layer.sourceRect[2],height:layer.sourceRect[3]})
 const input=await pipeline.resize(width,height,{kernel:'lanczos3',fit:'fill'}).png().toBuffer();composite.push({input,left,top});if(!background)y+=height+8
 const sourceRect=background?[left,top+layer.sourceRect[1]*960/layer.size[1],720,layer.sourceRect[3]*960/layer.size[1]]:[left,top,width,height]
 layers.push({id:layer.id,file:'bookhouse-scene-atlas.png',sourceFile:layer.file,sourceSha256:layer.sha256,originalSourceRect:layer.sourceRect,sourceRect,rect:layer.rect,z:layer.z,sourceSize:layer.size,size:[1024,968]})
}
assert.ok(y<968)
const sceneBytes=await sharp({create:{width:1024,height:968,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png({compressionLevel:9,palette:false}).toBuffer();await writeFile(join(out,'bookhouse-scene-atlas.png'),sceneBytes);files.push({file:'bookhouse-scene-atlas.png',sha256:hash(sceneBytes),bytes:sceneBytes.length,size:[1024,968],decodedRGBABytes:1024*968*4})
const ids=['bluewhale','claude','gemini','gpt','grok','kimi','qwen','seedance','glm','minimax','llama','mistral'],parts=[],activity=[]
const fixed={bluewhale:[82,174,1610,583],claude:[38,87,1701,715],gemini:[26,206,1722,538]}
for(const[index,id]of ids.entries()){
 const file=id+'-held-book-arms-v01.png',frame=fixed[id]??frames[id].bookFrame,b=await readFile(join(base,file)),width=192,height=Math.round(192*frame[3]/frame[2]),left=index%4*256+4,top=Math.floor(index/4)*128+4
 const input=await sharp(b).extract({left:frame[0],top:frame[1],width:frame[2],height:frame[3]}).resize(width,height,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();activity.push({input,left,top});parts.push({id:id+'-held-book',sourceFile:file,sourceSha256:hash(b),originalFrame:frame,sourceRect:[left,top,width,height],rigSize:[460,460*frame[3]/frame[2]]})
}
for(const[index,s]of [{id:'bluewhale',file:'bluewhale-seat-lower-v03.png',frame:[63,315,1130,917],split:285},{id:'claude',file:'claude-seat-lower-v01.png',frame:[84,87,1068,1098],split:413}].entries()){
 const b=await readFile(join(base,s.file)),width=192,height=Math.round(192*s.frame[3]/s.frame[2]),left=index*256+4,top=388,input=await sharp(b).extract({left:s.frame[0],top:s.frame[1],width:s.frame[2],height:s.frame[3]}).resize(width,height,{fit:'fill',kernel:'lanczos3'}).png().toBuffer(),split=s.split/s.frame[3]*height
 activity.push({input,left,top});parts.push({id:s.id+'-seated-waist',sourceFile:s.file,sourceSha256:hash(b),originalFrame:[s.frame[0],s.frame[1],s.frame[2],s.split],sourceRect:[left,top,width,split]},{id:s.id+'-seated-body',sourceFile:s.file,sourceSha256:hash(b),originalFrame:[s.frame[0],s.frame[1]+s.split,s.frame[2],s.frame[3]-s.split],sourceRect:[left,top+split,width,height-split]})
}
for(const part of parts)part.file='bookhouse-activity-atlas.png'
const activityBytes=await sharp({create:{width:1024,height:640,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(activity).png({compressionLevel:9,palette:false}).toBuffer();await writeFile(join(out,'bookhouse-activity-atlas.png'),activityBytes);files.push({file:'bookhouse-activity-atlas.png',sha256:hash(activityBytes),bytes:activityBytes.length,size:[1024,640],decodedRGBABytes:1024*640*4})
await writeFile(join(out,'manifest.json'),JSON.stringify({status:'OPTIMIZED_CANDIDATE_NOT_APPROVED',approvedForRelease:false,runtimeEnabled:false,method:'Mechanical crop of established review Texture frames, Lanczos3 resize, lossless non-palette PNG atlas packing with gutters. No repaint; original source files preserved. Fractional background top crop and seat split preserved in Texture sourceRects.',files,layers,parts,totals:{textures:2,bytes:files.reduce((a,f)=>a+f.bytes,0),decodedRGBABytes:files.reduce((a,f)=>a+f.decodedRGBABytes,0)},textureBudget:{maxSevenResidents:128,incrementalTextures:2,conservativeUpperBoundFromCurrent121:123,optionalRegionSpecificSaving:14,note:'2 atlas image sources replace dozens of standalone candidate image sources; each Sprite/Texture frame remains independent. Count123 conservatively adds both to baseline121 without claiming any removal. Does not include simultaneous map; map must unload. Actual production selector/loader and final package measurement remain owner QA.'},remaining:'Actual renderer preview is bookhouse-roster-qa-v07/validation.json; final owner integration remains pending. Original approved rest textures reused for other ten seated parts; no extra image for those parts. No mipmaps; decoded budget counts base RGBA only.'},null,2)+'\n')
console.log(JSON.stringify(files))

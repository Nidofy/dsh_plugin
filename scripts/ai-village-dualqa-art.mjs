import { readFile, writeFile, mkdir, readdir, realpath, lstat } from 'node:fs/promises'
import { resolve, join, relative, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { root, requireTool, sha256 } from '../tools/ai-village-dualqa/env.mjs'
import { validatePNG } from '../tools/ai-village-dualqa/png.mjs'
const sharp=requireTool('sharp'),args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback
const input=await realpath(resolve(arg('--input',join(root,'../dsh_plugin-entrance-art/packages/ai-village/assets/boot'))))
const out=resolve(arg('--out',join(root,'docs/ai-village/entrance-parallel/qa/art'))),repo=resolve(arg('--repo',root))
if(out===input||out.startsWith(input+'/')||out.startsWith(input+'\\'))throw Error('Read-only input: output must be outside source tree')
const qaRoot=await realpath(root)
if(!out.startsWith(join(qaRoot,'docs/ai-village/entrance-parallel/qa'))&&!out.startsWith(join(qaRoot,'packages/ai-village/art/QA/entrance-dual/qa')))throw Error('Output must be inside this worktree QA evidence ownership')
await mkdir(out,{recursive:true})
const script=await readFile(join(repo,'scripts/ai-village-resources.mjs'),'utf8'),theme=await readFile(join(repo,'packages/ai-village/src/client/entrance-theme.ts'),'utf8')
const byteMatch=script.match(/entranceBytes\s*>\s*(\d+)\s*\*\s*1024\s*\*\s*1024/),pixelMatch=script.match(/entrancePixels\s*>\s*(\d+)/),layerMatch=theme.match(/layers\.length\s*>\s*(\d+)/)
if(!byteMatch||!pixelMatch||!layerMatch)throw Error('Budget contract changed; independent parser needs review')
const budget={bytes:Number(byteMatch[1])*1024*1024,pixels:Number(pixelMatch[1]),layers:Number(layerMatch[1]),perFile:8*1024*1024,sourceSHA:await sha256(Buffer.from(script)),themeSHA:await sha256(Buffer.from(theme))}
const files=[],images=new Map()
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isSymbolicLink())throw Error('SYMLINK:'+relative(input,path));if(e.isDirectory())await walk(path);else if(e.name.endsWith('.png'))files.push(path)}}
await walk(input)
const masters=arg('--masters',null);if(masters)await walk(await realpath(resolve(masters)))
const rows=[]
for(const path of files.sort()){
 const name=relative(input,path).replaceAll('\\','/'),bytes=await readFile(path),hash=await sha256(bytes)
 try{
  const png=validatePNG(bytes),meta=await sharp(bytes,{limitInputPixels:32_000_000}).metadata()
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1,transparent=0,partial=0,opaque=0,whiteEdge=0,blackEdge=0
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,a=data[i+3];if(a===0)transparent++;else{
   minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)
   if(a===255)opaque++;else{partial++;if(data[i]>245&&data[i+1]>245&&data[i+2]>245)whiteEdge++;if(data[i]<10&&data[i+1]<10&&data[i+2]<10)blackEdge++}
  }}
  const bounds=maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}
  rows.push({path:name,sha256:hash,bytes:bytes.length,...png,iccSHA:meta.icc?await sha256(meta.icc):null,iccBytes:meta.icc?.length??0,iccMentionsSRGB:meta.icc?.includes(Buffer.from('sRGB'))??false,decoderSpace:meta.space,hasAlpha:meta.hasAlpha,decodedRGBABytes:info.width*info.height*4,bounds,transparent,partial,opaque,whiteEdge,blackEdge,cropPixelsSaved:info.width*info.height-(bounds?bounds.width*bounds.height:0),status:'PASS'})
  images.set(name,{data,width:info.width,height:info.height,bytes})
 }catch(error){rows.push({path:name,sha256:hash,bytes:bytes.length,status:'FAIL',error:String(error)})}
}
const groups=[]
for(const [name,dir,manifestName] of [['raw','', 'entrance-art-manifest.json'],['compat','compat/entrance','manifest.json'],['runtime','','manifest.json']]){
 let manifest
 try{manifest=JSON.parse(await readFile(join(input,dir,manifestName),'utf8'))}catch{continue}
 const selected=rows.filter(r=>relative(dir||'.',r.path).replaceAll('\\','/').indexOf('/')<0&&(!dir||r.path.startsWith(dir+'/')))
 const bytes=selected.reduce((n,r)=>n+r.bytes,0),pixels=selected.reduce((n,r)=>n+(r.width??0)*(r.height??0),0)
 const failures=[]
 for(const r of selected){if(r.bytes>budget.perFile)failures.push('PER_FILE_BYTES:'+r.path);if(r.width>4096||r.height>4096)failures.push('DIMENSIONS:'+r.path)}
 for(const entry of manifest.files??manifest.layers??[]){const path=join(dir,basename(entry.file??entry.key)).replaceAll('\\','/'),r=rows.find(r=>r.path===path);if(!r)failures.push('MISSING:'+path);else if(entry.sha256!==r.sha256||entry.bytes!==r.bytes)failures.push('INTEGRITY:'+path)}
 groups.push({name,provenance:manifest.source,status:bytes<=budget.bytes&&pixels<=budget.pixels&&manifest.layers.length<=budget.layers&&!failures.length?'PASS':'FAIL',artStatus:manifest.status,bytes,pixels,rgbaBytes:pixels*4,layers:manifest.layers.length,limits:budget,failures})
}
const alpha=(name,x,y)=>{const im=images.get(name);return im&&x>=0&&y>=0&&x<im.width&&y<im.height?im.data[(y*im.width+x)*4+3]/255:0}
let geometry={status:'NOT_RUN',reason:'full-canvas raw portal mask and doors required'}
const mask=images.get('entrance-portal-mask.png'),left=images.get('entrance-gate-left.png'),right=images.get('entrance-gate-right.png')
if(mask&&left&&right&&[left,right].every(im=>im.width===mask.width&&im.height===mask.height)){
 let portalPixels=0,uncovered=0,overlap=0,frameOcclusion=0,maxLeak=0
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
  if(alpha('entrance-portal-mask.png',x,y)<.99)continue
  portalPixels++;const l=alpha('entrance-gate-left.png',x,y),r=alpha('entrance-gate-right.png',x,y),f=alpha('entrance-gate-frame.png',x,y),coverage=1-(1-l)*(1-r)*(1-f)
  if(coverage<.99){uncovered++;maxLeak=Math.max(maxLeak,1-coverage)}
  if(l>.01&&r>.01)overlap++
  if(f>.01)frameOcclusion++
 }
 geometry={status:uncovered?'FAIL':'PASS',method:'raw alpha union(left,right,frame) inside opaque portal mask; not a visual approval',portalPixels,uncovered,overlap,frameOcclusion,maxLeak}
}

try {
 const manifest=JSON.parse(await readFile(join(input,'manifest.json'),'utf8'))
 const {designSize:d,safeApertureRect:s,layers}=manifest
 if(d&&s&&Array.isArray(layers)){
  const sample=(layer,x,y)=>{const r=layer.rect,im=images.get(basename(layer.key));if(!im)return 0;const u=(x/d.width-r.x)/r.width,v=(y/d.height-r.y)/r.height;return u>=0&&u<1&&v>=0&&v<1?im.data[(Math.floor(v*im.height)*im.width+Math.floor(u*im.width))*4+3]/255:0}
  let safePixels=0,closedLeaks=0,exteriorOcclusions=0,maxTransmission=0,over10Percent=0,over50Percent=0,minLeakX=Infinity,maxLeakX=-1
  for(let y=Math.ceil(s.y*d.height)+2;y<(s.y+s.height)*d.height-2;y++)for(let x=Math.ceil(s.x*d.width)+2;x<(s.x+s.width)*d.width-2;x++){
   safePixels++;let doorTransmission=1,exteriorTransmission=1
   for(const layer of layers){const a=sample(layer,x+.5,y+.5);if(['left','right'].includes(layer.kind))doorTransmission*=1-a;else exteriorTransmission*=1-a}
   if(doorTransmission>.01){closedLeaks++;maxTransmission=Math.max(maxTransmission,doorTransmission);minLeakX=Math.min(minLeakX,x);maxLeakX=Math.max(maxLeakX,x)}
   if(doorTransmission>.1)over10Percent++;if(doorTransmission>.5)over50Percent++
   if(exteriorTransmission<.99)exteriorOcclusions++
  }
  const pivots=layers.filter(l=>['left','right'].includes(l.kind)).map(l=>({kind:l.kind,designPixels:[(l.rect.x+l.rect.width*l.pivot[0])*d.width,(l.rect.y+l.rect.height*l.pivot[1])*d.height]}))
  geometry={status:closedLeaks?'FAIL':'PASS',method:'Independent nearest-neighbor reconstruction of cropped door alpha in safe rectangle (2 design px inset); not full polygon/antialias acceptance',safePixels,closedLeaks,maxTransmission,over10Percent,over50Percent,leakX:closedLeaks?[minLeakX,maxLeakX]:null,exteriorOcclusionsBeforeKnockout:exteriorOcclusions,pivots}
 }
}catch(error){if(error.code!=='ENOENT')throw error}

const cards=[]
for(let i=0;i<rows.length;i++){
 const im=images.get(rows[i].path);if(!im)continue
 const thumb=await sharp(im.bytes).resize(220,180,{fit:'contain',background:{r:200,g:200,b:200,alpha:1}}).flatten({background:'#c8c8c8'}).png().toBuffer()
 const label=Buffer.from('<svg width="240" height="40"><rect width="240" height="40" fill="white"/><text x="5" y="15" font-size="10">'+rows[i].path.replace('compat/entrance/','compat/').replaceAll('&','&amp;')+'</text><text x="5" y="30" font-size="10">'+im.width+'x'+im.height+' '+rows[i].bytes+' bytes</text></svg>')
 cards.push({input:thumb,left:(i%4)*240+10,top:Math.floor(i/4)*225},{input:label,left:(i%4)*240,top:Math.floor(i/4)*225+183})
}
if(cards.length)await sharp({create:{width:960,height:Math.ceil(rows.length/4)*225,channels:4,background:'#ddd'}}).composite(cards).png().toFile(join(out,'contact-sheet.png'))
for(const row of rows)if(await sha256(await readFile(join(input,row.path)))!==row.sha256)throw Error('SOURCE_CHANGED_DURING_AUDIT')
const sourceHead=execFileSync('git',['-c','safe.directory=*','-C',input,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()
const report={readOnly:true,sourceHead,sourceDirectory:basename(input),timestamp:new Date().toISOString(),budget,rows,groups,geometry,humanReview:['Color-space UNSPECIFIED is not proof of sRGB','Alpha edge colors are diagnostic counts, not halo judgments','Perspective, pivots, visual style and copyright need human review']}
await writeFile(join(out,'ART_AUDIT.json'),JSON.stringify(report,null,2))
await writeFile(join(out,'RESOURCE_BUDGET.json'),JSON.stringify({sourceHead,budget,groups},null,2))
await writeFile(join(out,'ART_AUDIT.md'),'# Independent art audit\\n\\n'.replaceAll('\\n','\n')+
 'Source commit: '+sourceHead+'. Source bytes unchanged during this read-only run. ART_REVIEW only.\n\n'+
 groups.map(g=>'- '+g.name+': '+g.status+'; '+g.bytes+' bytes; '+g.pixels+' pixels; '+g.layers+' layers.').join('\n')+
 '\n\nGeometry: '+JSON.stringify(geometry)+'\n\n|PNG|Size|Bytes|Alpha|Color|Crop pixels saved|\n|---|---|---:|---|---|---:|\n'+rows.map(r=>'|'+r.path+'|'+r.width+'×'+r.height+'|'+r.bytes+'|'+r.hasAlpha+'|'+r.colorSpace+'|'+r.cropPixelsSaved+'|').join('\n')+'\n\nContact sheet: [contact-sheet.png](contact-sheet.png). Pixel and geometry details: [ART_AUDIT.json](ART_AUDIT.json). Human art/GPU review remains pending.\n')
console.log(JSON.stringify({sourceHead,groups:groups.map(({limits,...g})=>g),geometry,pngs:rows.length,decodeFailures:rows.filter(r=>r.status==='FAIL').length},null,2))
if(rows.some(r=>r.status==='FAIL')||groups.some(g=>g.status==='FAIL')||geometry.status==='FAIL')process.exitCode=1

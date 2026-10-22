import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,relative} from 'node:path'
import {root,requireTool,sha256} from '../tools/ai-village-dualqa/env.mjs'
const [a,b,name='comparison']=process.argv.slice(2)
if(!a||!b||!/^[a-z0-9-]+$/.test(name))throw Error('Usage: node scripts/ai-village-dualqa-compare.mjs before.png after.png [label]')
const sharp=requireTool('sharp'),out=join(root,'packages/ai-village/art/QA/entrance-dual/qa/compare');await mkdir(out,{recursive:true})
const before=await readFile(resolve(a)),after=await readFile(resolve(b))
const x=await sharp(before).ensureAlpha().raw().toBuffer({resolveWithObject:true}),y=await sharp(after).ensureAlpha().raw().toBuffer({resolveWithObject:true})
if(x.info.width!==y.info.width||x.info.height!==y.info.height)throw Error('IMAGE_SIZE_MISMATCH: compare matching viewport/DPR/phase only')
const diff=Buffer.alloc(x.data.length);let changed=0,total=0,max=0
for(let i=0;i<diff.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(x.data[i+c]-y.data[i+c]);delta=Math.max(delta,d);total+=d;diff[i+c]=d}diff[i+3]=255;if(delta>8)changed++;max=Math.max(max,delta)}
await sharp(diff,{raw:x.info}).png().toFile(join(out,name+'-diff.png'))
await sharp({create:{width:x.info.width*3,height:x.info.height,channels:4,background:'#eee'}}).composite([{input:before,left:0,top:0},{input:after,left:x.info.width,top:0},{input:await sharp(diff,{raw:x.info}).png().toBuffer(),left:x.info.width*2,top:0}]).png().toFile(join(out,name+'-contact.png'))
const result={before:relative(root,resolve(a)),after:relative(root,resolve(b)),beforeSHA:await sha256(before),afterSHA:await sha256(after),width:x.info.width,height:x.info.height,meanAbsoluteRGB:total/(x.info.width*x.info.height*3),changedFraction:changed/(x.info.width*x.info.height),maxChannelDelta:max,status:'MEASURED',approval:'NEEDS_HUMAN_REVIEW; metric alone is not a visual acceptance threshold'}
await writeFile(join(out,name+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))

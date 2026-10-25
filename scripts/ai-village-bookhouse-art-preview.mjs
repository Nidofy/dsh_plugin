/** Read-only alpha/hash audit plus isolated browser preview. Never writes runtime assets. */
import sharp from 'sharp'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = join(pkg, 'art/deliverables/bookhouse-layered-v02')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const specs = [
  ['background', [0,0,360,480], -100],
  ['bookcase-back', [234,126,86,106], 1259], ['bookcase-front', [234,232,86,8], 2400],
  ['desk-back', [123,292,37,34], 2919], ['desk-front', [72,292,140,67], 3590],
  ['window-back', [44,198,116,29], 1979], ['window-front', [44,222,116,18], 2400],
  ['prop-open-book', [258,230,36,21], 2683], ['prop-paper-pencil', [122,298,38,22], 3598],
  ['prop-window-book', [110,236,12,17], 2703],
]
const layers = []
for (const [id, rect, z] of specs) {
  const file=id==='background'?'background-v03.png':id+'.png',bytes = await readFile(join(out,file))
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x1=info.width,y1=info.height,x2=-1,y2=-1,sx=info.width,sy=info.height,ex=-1,ey=-1,transparent=0,partial=0,opaque=0,nearOpaque=0
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const a=data[(y*info.width+x)*4+3]; if(a>=240)nearOpaque++
    if(a>=8){sx=Math.min(sx,x);sy=Math.min(sy,y);ex=Math.max(ex,x);ey=Math.max(ey,y)}
    if(a===0)transparent++;else{if(a===255)opaque++;else partial++;x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y)}
  }
  assert.ok(x2>=x1)
  // Native generator uses alpha 254 across many solid interiors; keep these bytes intact.
  if(id!=='background') assert.ok(transparent>100 && nearOpaque>100 && partial>0, id+': genuine native alpha required')
  sx=Math.max(0,sx-4);sy=Math.max(0,sy-4);ex=Math.min(info.width-1,ex+4);ey=Math.min(info.height-1,ey+4)
  let omittedNonzeroAlpha=0,maxOmittedAlpha=0
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x<sx||x>ex||y<sy||y>ey){const a=data[(y*info.width+x)*4+3];if(a){omittedNonzeroAlpha++;maxOmittedAlpha=Math.max(maxOmittedAlpha,a)}}
  assert.ok(maxOmittedAlpha<8)
  const backgroundTop=(682-220/480*info.height)/(1-220/480)
  layers.push({id,file,size:[info.width,info.height],sourceRect:id==='background'?[0,backgroundTop,info.width,info.height-backgroundTop]:[sx,sy,ex-sx+1,ey-sy+1],fullAlphaBounds:[x1,y1,x2-x1+1,y2-y1+1],sourceRectRule:id==='background'?'Explicit top crop registration: measured floor begins source y682; solve (682-top)/(1448-top)*480=220. Full width and bottom retained. Original PNG unchanged.':'alpha >= 8 bounding box + 4 source pixels padding; original PNG unchanged',omittedNonzeroAlpha,maxOmittedAlpha,...(id==='background'?{horizon:{sourcePixelY:682,targetLogicalY:220,topCropPixels:backgroundTop,mappedLogicalY:(682-backgroundTop)/(info.height-backgroundTop)*480}}:{}),rect,z,
    bytes:bytes.length,sha256:sha(bytes),decodedRGBABytes:info.width*info.height*4,alpha:{transparent,partial,opaque,nearOpaque},
    source:'built-in image_gen; original PNG bytes preserved',approvedForRelease:false})
}
const manifest = {status:'LAYERED_REVIEW_CANDIDATE',approvedForRelease:false,runtimeEnabled:false,date:'2026-10-24',
  baseline:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),
  generator:'built-in image_gen',license:'MIT',worldSize:[360,480],
  sourcePrompt:'../../prompts/bookhouse-layered-v02.json',
  mapping:'Furniture/props: alpha >= 8 bounds + 4 source-pixel padding mapped to frozen logical rect, omitting only detached alpha 1..7 outside frame. Background: explicit top crop 33.846153846 pixels registers measured floor start y682 exactly at world y220 while retaining full width/bottom. No original PNG bytes, alpha, or production geometry are rewritten. This background registration slightly changes vertical illustration scale and requires visual signoff.',
  frozenFurniture:[{id:'bookcase',rect:[234,126,86,114],split:.82,anchor:[276,268]},{id:'reading-desk',rect:[72,292,140,67],split:.5,anchor:[142,328]},{id:'window-seat',rect:[44,198,116,42],split:.6,anchor:[92,270]}],
  layers, totals:{files:layers.length,bytes:layers.reduce((n,l)=>n+l.bytes,0),decodedRGBABytes:layers.reduce((n,l)=>n+l.decodedRGBABytes,0)},
  limitations:['Isolated static browser composition, not production Pixi integration or release acceptance.',
    'Raw background v03 floor starts at source y682 (~world226.08). Explicit texture-frame registration maps that measured horizon to world220; painted column feet can extend below the horizon. Cropping slightly changes vertical scale and still requires visual signoff.',
    'Original large PNG masters are not optimized runtime textures; release budgets and real GPU load/release remain NOT RUN.',
    'Static paper-doll composition uses existing body/foreground/activity-arm depths; animated hand/hair contacts require production renderer review.',
    'Theme and dusk previews are labeled simulations, not screenshots of final runtime UI or baked night assets.']}
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
const residents={}
for(const id of ['bluewhale','claude','gemini','gpt','grok','kimi','qwen','seedance','glm','minimax','llama','mistral']) residents[id]=JSON.parse(await readFile(join(pkg,'assets/characters',id,'character.json'),'utf8'))
const html=`<!doctype html><meta charset="utf-8"><title>Bookhouse layered v02 · review candidate</title>
<style>body{margin:24px;background:#f4eee3;color:#473b2d;font:15px system-ui}body.dark{background:#242724;color:#eee5d3}h1{font-size:23px}p{max-width:850px;line-height:1.6}button,select,label{margin:4px;padding:6px}canvas{width:360px;height:480px;max-width:100%;border:1px solid #847457}main{display:flex;flex-wrap:wrap;gap:24px}aside{max-width:460px}code{font-size:12px}.legend{color:#98654c}#status{font-size:13px}</style>
<h1>书屋分层美术 v02 · 待签收候选</h1><p>10 张独立原生 PNG；固定 360×480 几何。此页为独立 Canvas 合成检查，未替换正式场景。家具纹理框采用 alpha≥8 外接框加4像素边缘；背景裁去顶部33.846像素，以渲染映射将墙脚注册到 y220。原图字节不变。</p>
<div><label>居民 <select id="resident"><option value="">空场景</option>${Object.keys(residents).map(id=>'<option>'+id+'</option>').join('')}</select></label>
<label>活动位置 <select id="station"><option value="all">三处对照（同一居民示意）</option><option value="bookcase">书柜</option><option value="desk">阅读桌</option><option value="window">窗座</option></select></label>
<label><input type="checkbox" id="geometry">固定几何</label><label><input type="checkbox" id="fronts" checked>家具前层</label><label><input type="checkbox" id="dark">深色页面</label><label><input type="checkbox" id="dusk">暮色叠色示意</label></div>
<main><canvas id="scene" width="720" height="960"></canvas><aside><p><strong>独立分层，不是一张家具烘焙的概念图。</strong></p><p>书柜后层＋前踢脚；阅读桌椅背＋桌面/前腿（腿间真实透明）；窗座座背＋座缘/短腿；书本、纸笔、小书独立。</p><p class="legend">橙色：家具冻结 rect。蓝色：交互脚点。此页静态纸偶用于构图诊断，不证明实际动画/脚点/手臂通过。</p><p>沿用现有深度：身体按脚点 y×10；桌前层 3590、纸笔 3598、活动手臂 3600。阅读桌隐藏站立手臂/腿并显示现有工作手臂。取消「家具前层」可检查被遮挡部分。尚未变更运行代码。</p><p>新背景原图墙脚约 y226；裁框映射后测量墙脚为 y220。原图、旧背景和对照均保留；裁框及轻微纵向比例变化仍待视觉签收。</p><div id="status">正在加载…</div></aside></main>
<script>
const layers=${JSON.stringify(layers)},residents=${JSON.stringify(residents)},images=new Map(),c=document.querySelector('canvas'),g=c.getContext('2d');
const el=id=>document.getElementById(id);const load=async key=>{if(images.has(key))return images.get(key);const im=new Image();im.src=key;await im.decode();images.set(key,im);return im};
function asset(l){g.drawImage(images.get(l.file),...l.sourceRect,...l.rect)}
function character(id,x,y,busy=false){const d=residents[id],k=108/d.visibleHeight;g.save();g.translate(x-d.feet[0]*k,y-d.feet[1]*k);g.scale(k,k);function walk(parent){for(const p of d.parts.filter(p=>p.parent===parent).sort((a,b)=>a.z-b.z)){if(busy&&/^(arm|leg)-/.test(p.id))continue;const file=p.file||p.expressions?.neutral;if(file)g.drawImage(images.get('../../../assets/characters/'+id+'/'+file),...p.offset,...p.size);walk(p.id)}}walk(null);g.restore()}
const armPath=(id,side)=>'../../../assets/'+(id==='bluewhale'?'scenes/courtyard/':'characters/'+id+'/parts/')+'work-'+side+'.png';
function arms(id,x,y){const d=residents[id],k=108/d.visibleHeight;g.save();g.translate(x-d.feet[0]*k,y-d.feet[1]*k);g.scale(k,k);g.drawImage(images.get(armPath(id,'left')),325,560,175,200);g.drawImage(images.get(armPath(id,'right')),535,560,175,200);g.restore()}
async function paint(){window.previewReady=false;const id=el('resident').value;if(id){for(const p of residents[id].parts){const file=p.file||p.expressions?.neutral;if(file)await load('../../../assets/characters/'+id+'/'+file)}await load(armPath(id,'left'));await load(armPath(id,'right'))}
g.setTransform(2,0,0,2,0,0);g.clearRect(0,0,360,480);const nodes=layers.filter(l=>!l.id.startsWith('prop-')&&(el('fronts').checked||!l.id.endsWith('-front'))).map(l=>({z:l.z,draw:()=>asset(l)}));
const stations=[['bookcase',276,268,2680,'prop-open-book'],['desk',142,328,3280,'prop-paper-pencil'],['window',92,270,2700,'prop-window-book']];
if(id)for(const [station,x,y,z,prop] of stations){if(el('station').value!=='all'&&el('station').value!==station)continue;nodes.push({z,draw:()=>character(id,x,y,station==='desk')});if(station==='desk')nodes.push({z:3600,draw:()=>arms(id,x,y)});const l=layers.find(l=>l.id===prop);nodes.push({z:l.z,draw:()=>asset(l)})}
nodes.sort((a,b)=>a.z-b.z).forEach(n=>n.draw());if(el('dusk').checked){g.fillStyle='#42487142';g.fillRect(0,0,360,480)}
if(el('geometry').checked){g.lineWidth=1;g.strokeStyle='#de693e';for(const r of [[234,126,86,114],[72,292,140,67],[44,198,116,42]])g.strokeRect(...r);g.strokeStyle='#258bb1';for(const [,x,y]of stations){g.beginPath();g.moveTo(x-5,y);g.lineTo(x+5,y);g.moveTo(x,y-5);g.lineTo(x,y+5);g.stroke()}}
document.body.classList.toggle('dark',el('dark').checked);el('status').textContent='10 masters · '+${manifest.totals.bytes}+' bytes · '+(${manifest.totals.decodedRGBABytes}/1048576).toFixed(2)+' MiB decoded RGBA · approvedForRelease=false';window.previewReady=true}
for(const id of ['resident','station','geometry','fronts','dark','dusk'])el(id).onchange=paint;
Promise.all(layers.map(l=>load(l.file))).then(paint).catch(e=>{el('status').textContent=e.message;window.previewError=e.message});
</script>`
await writeFile(join(out,'preview.html'),html)
await writeFile(join(out,'background-comparison.html'),`<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;background:#f4eee3;margin:12px}main{display:flex;gap:12px}canvas{width:300px;height:400px;border:1px solid #876}p{max-width:920px}</style><h2>背景注册对照 · 原 PNG 均未改写 · 橙线=世界 y220</h2><main>${['v02 原图 ≈ y235','v03 原图：source y682 → world226.08','v03 裁框：source y682 → world220'].map((s,i)=>'<div><p>'+s+'</p><canvas id="c'+i+'" width="720" height="960"></canvas></div>').join('')}</main><p>第三栏 sourceRect=[0,33.846153846,1086,1414.153846154]，保持全宽与底边。此处是渲染取样框注册，不是生成模型精确绘制的声明。中央柱脚的自然凸起不是水平墙脚测量线。</p><script>Promise.all(['background.png','background-v03.png'].map(async f=>{const i=new Image();i.src=f;await i.decode();return i})).then(images=>{for(let n=0;n<3;n++){const g=document.getElementById('c'+n).getContext('2d'),im=images[n?1:0],t=n===2?440/13:0;g.scale(2,2);g.drawImage(im,0,t,1086,1448-t,0,0,360,480);g.strokeStyle='#ff6a32';g.lineWidth=1;g.beginPath();g.moveTo(0,220);g.lineTo(360,220);g.stroke()}window.comparisonReady=true})</script>`)
console.log(JSON.stringify({manifest:join(out,'manifest.json'),preview:join(out,'preview.html'),totals:manifest.totals},null,2))
if(process.argv.includes('--capture')){
  const {source}=JSON.parse(await readFile(join(root,'.local/environment.json'),'utf8'))
  const pnpm=join(source,'node_modules/.pnpm'),pw=(await readdir(pnpm)).find(n=>n.startsWith('playwright@1.61.'))
  const {chromium}=await import(pathToFileURL(join(pnpm,pw,'node_modules/playwright/index.mjs')).href)
  const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),folder=(await readdir(cache)).filter(n=>n.startsWith('chromium_headless_shell-')).sort().at(-1)
  const browser=await chromium.launch({headless:true,executablePath:join(cache,folder,'chrome-headless-shell-win64/chrome-headless-shell.exe'),args:['--allow-file-access-from-files']})
  try{const page=await browser.newPage({viewport:{width:1100,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(join(out,'preview.html')).href);await page.waitForFunction(()=>window.previewReady||window.previewError);assert.equal(await page.evaluate(()=>window.previewError),undefined);await page.screenshot({path:join(out,'preview-empty.png')});await page.selectOption('#resident','llama');await page.waitForFunction(()=>window.previewReady);await page.screenshot({path:join(out,'preview-llama-activities.png')});await page.check('#geometry');await page.waitForFunction(()=>window.previewReady);await page.screenshot({path:join(out,'preview-llama-geometry.png')});await page.goto(pathToFileURL(join(out,'background-comparison.html')).href);await page.waitForFunction(()=>window.comparisonReady);await page.screenshot({path:join(out,'background-registration-comparison.png')});assert.deepEqual(errors,[])}finally{await browser.close()}
}

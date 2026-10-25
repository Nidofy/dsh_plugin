/** Isolated approval fixture: production PaperDoll/samplePose and fixed bookhouse geometry. */
import { Application, Container, Sprite, Texture, Rectangle, Graphics, Text } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { PaperDoll } from '../../../src/art/paper-doll.ts'
import { samplePose } from '../../../src/art/animation.ts'
import { bookhouseScene } from '../../../src/core/bookhouse-scene.ts'
import { furnitureDepth } from '../../../src/frame/furniture.ts'
import type { Character, AnimationSet } from '../../../src/art/types.ts'
interface Layer { id:string; file:string; rect:number[]; sourceRect:number[]; z:number }
interface Entry { id:string;character:Character;animations:AnimationSet;images:Record<string,string> }
declare global { interface Window { artPayload:{residents:Entry[];layers:Layer[];images:Record<string,string>;corrections:Record<string,{data:string;frame:number[]}>};artReview:{ready:boolean;set:(station:string,light:string,theme:string,proposal?:boolean,width?:number,time?:number)=>unknown} } }
const app=new Application()
await app.init({width:1080,height:780,backgroundAlpha:0,antialias:true,resolution:devicePixelRatio,autoStart:false,sharedTicker:false,preference:'webgl'})
document.querySelector('#stage')!.append(app.canvas)
const texture=async(data:string)=>{const image=new Image();image.src=data;await image.decode();return Texture.from(image)}
const artTextures=new Map<string,Texture>()
for(const layer of window.artPayload.layers){const original=await texture(window.artPayload.images[layer.file]!);artTextures.set(layer.id,new Texture({source:original.source,frame:new Rectangle(...layer.sourceRect as [number,number,number,number])}))}
const rigs=[] as {entry:Entry;panel:Container;mask:Graphics;room:Container;content:Container;doll:PaperDoll;rest:Sprite;arms:Container;left:Sprite;right:Sprite;backdrop:Sprite;props:Map<string,Sprite>;label:Text}[]
for(const[index,entry]of window.artPayload.residents.entries()){
 const textures=new Map<string,Texture>();for(const[key,data]of Object.entries(entry.images))textures.set(key,await texture(data))
 if(entry.id==='bluewhale'){
  entry.character=structuredClone(entry.character)
  for(const[file,{data,frame}]of Object.entries(window.artPayload.corrections).filter(([key])=>!key.startsWith('claude-')&&!key.startsWith('gemini-'))){const t=await texture(data);textures.set(file,new Texture({source:t.source,frame:new Rectangle(...frame as[number,number,number,number])}))}
  const k=45/632/.12
  entry.character.parts.push({id:'held-book',parent:'body',file:'held-book',offset:[282,557],size:[460,460*583/1610],pivot:[512,673],z:8,mirror:'never'},
  {id:'seated-body',parent:'body',file:'seated-body',offset:[512+(63-628)*k,952+(600-1232)*k],size:[1130*k,632*k],pivot:[512,673],z:5,mirror:'never'},
  {id:'seated-waist',parent:'body',file:'seated-waist',offset:[512+(63-628)*k,952+(218-270)/.12],size:[1130*k,7/.12],pivot:[512,673],z:5,mirror:'never'})
 }
 if(entry.id==='claude'||entry.id==='gemini'){
  entry.character=structuredClone(entry.character)
  for(const[key,{data,frame}]of Object.entries(window.artPayload.corrections).filter(([key])=>key.startsWith(entry.id+'-'))){const t=await texture(data);textures.set(key.slice(entry.id.length+1),new Texture({source:t.source,frame:new Rectangle(...frame as[number,number,number,number])}))}
  const isClaude=entry.id==='claude',k=45/685/.12
  const torso=textures.get('parts/torso.png')!,cut=isClaude?115:125
  textures.set('seat-torso',new Texture({source:torso.source,frame:new Rectangle(0,0,torso.width,cut)}))
  entry.character.parts.push({id:'held-book',parent:'body',file:'held-book',offset:[282,620],size:[460,460*(isClaude?715/1701:538/1722)],pivot:[512,665],z:9,mirror:'never'},
   {id:'seat-torso',parent:'body',file:'seat-torso',offset:[300,530],size:[424,345*cut/torso.height],pivot:[512,555],z:3,mirror:'never'})
  if(isClaude)entry.character.parts.push({id:'seated-body',parent:'body',file:'seated-body',offset:[512+(84-618)*k,952-685*k],size:[1068*k,685*k],pivot:[512,665],z:5,mirror:'never'},
   {id:'seated-waist',parent:'body',file:'seated-waist',offset:[512+(84-618)*k,952+(218-270)/.12],size:[1068*k,7/.12],pivot:[512,665],z:5,mirror:'never'})
  else{
   const rest=textures.get('activity/rest-pose.png')!,g=45/99/.12
   textures.set('seated-body',new Texture({source:rest.source,frame:new Rectangle(50,245,196,115)}))
   entry.character.parts.push({id:'seated-body',parent:'body',file:'seated-body',offset:[512-98*g,952-114*g],size:[196*g,115*g],pivot:[512,665],z:5,mirror:'never'})
  }
 }
 const panel=new Container(),room=new Container(),content=new Container(),mask=new Graphics().rect(0,0,262,226).fill(0xffffff)
 panel.position.set(index%4*270+4,Math.floor(index/4)*260+4);panel.addChild(room,mask);room.mask=mask;room.sortableChildren=true;content.sortableChildren=true;room.addChild(content);app.stage.addChild(panel)
 let backdrop!:Sprite;const props=new Map<string,Sprite>()
 for(const layer of window.artPayload.layers){const sprite=new Sprite(artTextures.get(layer.id)!);sprite.position.set(layer.rect[0]!,layer.rect[1]!);sprite.width=layer.rect[2]!;sprite.height=layer.rect[3]!;sprite.zIndex=layer.z;if(layer.id==='background'){backdrop=sprite;room.addChild(sprite)}else content.addChild(sprite);if(layer.id.startsWith('prop-'))props.set(layer.id,sprite)}
 const doll=new PaperDoll(entry.character,textures),arms=new Container(),left=new Sprite(textures.get('activity/work-left.png')!),right=new Sprite(textures.get('activity/work-right.png')!)
 const rest=new Sprite(textures.get('activity/rest-pose.png')!);rest.anchor.set(.5,1);rest.visible=false
 content.addChild(doll.root,rest,arms);arms.addChild(left,right)
 const label=new Text({text:entry.id,style:{fontFamily:'Arial,sans-serif',fontSize:14,fill:0x282b30}});label.position.set(4,232);panel.addChild(label)
 rigs.push({entry,panel,mask,room,content,doll,rest,arms,left,right,backdrop,props,label})
}
function set(station:string,light:string,theme:string,proposal=false,width=340,time=.4){
 const furniture=bookhouseScene.furniture.find(f=>f.id===station)!,hotspot=bookhouseScene.hotspots.find(h=>h.id===station)!,busy=station==='reading-desk',dusk=light==='dusk',dark=theme==='dark'
 if(!furniture||!hotspot)throw Error('UNKNOWN_STATION')
 const crop=[0,0,360,480],zoom=width/360,height=width*480/360,totalWidth=3*(width+8)+8,totalHeight=4*(height+28)+8
 app.renderer.resize(totalWidth,totalHeight)
 const stage=document.querySelector<HTMLElement>('#stage')!;stage.style.width=totalWidth+'px';stage.style.height=totalHeight+'px';app.canvas.style.width=totalWidth+'px';app.canvas.style.height=totalHeight+'px'
 document.querySelector<HTMLElement>('#stage')!.style.background=dark?'#20232a':'#f7f0e5'
 for(const[index,{entry:{id,character,animations},panel,mask,room,content,doll,rest,arms,left,right,backdrop,props,label}]of rigs.entries()){
  panel.position.set(index%3*(width+8)+4,Math.floor(index/3)*(height+28)+4);mask.clear().rect(0,0,width,height).fill(0xffffff);label.position.set(4,height+4)
  room.scale.set(zoom);room.position.set(-crop[0]!*zoom,-crop[1]!*zoom)
  backdrop.tint=dusk?0x9eaccd:0xffffff;content.tint=dusk?0xd2dcf0:0xffffff
  const scale=108/character.visibleHeight,pose=samplePose(character,animations.actions.idle,time);pose.expression='neutral';if(id==='bluewhale'&&station==='window-seat'&&!proposal){pose.transforms.body!.y=-70;pose.transforms['seated-body']!.y=70;pose.transforms['seated-waist']!.y=70}doll.apply(pose)
  if((id==='claude'||id==='gemini')&&station==='window-seat'&&!proposal){pose.transforms.body!.y=-130;pose.transforms.body!.rotation=0;pose.transforms['seated-body']!.y=130;if(id==='claude')pose.transforms['seated-waist']!.y=130;doll.apply(pose)}
  doll.root.position.set(hotspot.anchor.x-character.feet[0]*scale,hotspot.anchor.y-character.feet[1]*scale);doll.root.scale.set(scale);doll.root.zIndex=hotspot.anchor.y*10;doll.root.visible=!proposal
  rest.visible=proposal;rest.width=96*rest.texture.width/rest.texture.height;rest.height=96;rest.position.set(hotspot.anchor.x,hotspot.anchor.y);rest.zIndex=hotspot.anchor.y*10
  for(const id of['arm-left','arm-right','leg-left','leg-right'])doll.nodes.get(id)!.visible=!busy
  if(id==='bluewhale'){
   doll.nodes.get('skirt')!.visible=true
   const seated=station==='window-seat'&&!proposal,reading=station==='bookcase'||seated
   doll.nodes.get('held-book')!.visible=reading;doll.nodes.get('seated-body')!.visible=seated;doll.nodes.get('seated-waist')!.visible=seated
   if(reading){doll.nodes.get('arm-left')!.visible=false;doll.nodes.get('arm-right')!.visible=false}
   if(seated){for(const part of['skirt','leg-left','leg-right'])doll.nodes.get(part)!.visible=false}
   (doll.nodes.get('torso')!.children[0] as Sprite).height=seated?85:170
  }
  if(id==='claude'||id==='gemini'){
   const seated=station==='window-seat'&&!proposal,reading=station==='bookcase'||seated
   doll.nodes.get('held-book')!.visible=reading;doll.nodes.get('seated-body')!.visible=seated;doll.nodes.get('seat-torso')!.visible=seated;doll.nodes.get('torso')!.visible=!seated
   if(id==='claude'){doll.nodes.get('seated-waist')!.visible=seated;doll.nodes.get('ornament')!.visible=!seated}
   if(reading)for(const part of['arm-left','arm-right'])doll.nodes.get(part)!.visible=false
   if(seated)for(const part of['leg-left','leg-right'])doll.nodes.get(part)!.visible=false
  }
  arms.visible=busy;arms.position.copyFrom(doll.root.position);arms.scale.set(scale);arms.zIndex=furnitureDepth(bookhouseScene,station)!
  left.position.set(325,560+Math.sin(time*7)*6);right.position.set(535,560);left.width=right.width=175;left.height=right.height=200;left.rotation=Math.sin(time*7)*.025
  for(const[id,sprite]of props)sprite.visible=id===(busy?'prop-paper-pencil':station==='bookcase'?'prop-open-book':'prop-window-book')
  if(['bluewhale','claude','gemini'].includes(id)&&!busy&&!proposal)for(const sprite of props.values())sprite.visible=false
  label.style.fill=dark?0xf4eee4:0x292d31;label.text=id+(proposal?' · REST PROPOSAL':['bluewhale','claude','gemini'].includes(id)?' · candidate':' · existing pose')
 }
 app.render()
 const contact=rigs.filter(r=>r.entry.id==='claude').map(r=>{const sprite=r.doll.nodes.get('seated-body')!.children[0] as Sprite,hip=r.content.toLocal(sprite.toGlobal({x:534,y:0})),sole=r.content.toLocal(sprite.toGlobal({x:534,y:685}));return{id:r.entry.id,actualHip:[hip.x,hip.y],actualSole:[sole.x,sole.y],visible:station==='window-seat'&&!proposal}})
 return{station,light,theme,proposal,time,width,dpr:devicePixelRatio,crop,zoom,tickerStarted:app.ticker.started,furnitureRect:furniture.rect,anchor:hotspot.anchor,bodyDepth:hotspot.anchor.y*10,frontDepth:furnitureDepth(bookhouseScene,station)!-10,activityArmDepth:busy?furnitureDepth(bookhouseScene,station):null,contact,residents:rigs.map(r=>({id:r.entry.id,feet:[hotspot.anchor.x,hotspot.anchor.y],visibleHeight:proposal?96:108}))}
}
window.artReview={ready:true,set};set('bookcase','day','light')

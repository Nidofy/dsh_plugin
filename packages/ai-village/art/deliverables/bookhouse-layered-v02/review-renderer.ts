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
declare global { interface Window { artPayload:{residents:Entry[];layers:Layer[];images:Record<string,string>};artReview:{ready:boolean;set:(station:string,light:string,theme:string,proposal?:boolean)=>unknown} } }
const app=new Application()
await app.init({width:1080,height:780,backgroundAlpha:0,antialias:true,resolution:devicePixelRatio,autoStart:false,sharedTicker:false,preference:'webgl'})
document.querySelector('#stage')!.append(app.canvas)
const texture=async(data:string)=>{const image=new Image();image.src=data;await image.decode();return Texture.from(image)}
const artTextures=new Map<string,Texture>()
for(const layer of window.artPayload.layers){const original=await texture(window.artPayload.images[layer.file]!);artTextures.set(layer.id,new Texture({source:original.source,frame:new Rectangle(...layer.sourceRect as [number,number,number,number])}))}
const rigs=[] as {entry:Entry;panel:Container;room:Container;content:Container;doll:PaperDoll;rest:Sprite;arms:Container;left:Sprite;right:Sprite;backdrop:Sprite;props:Map<string,Sprite>;label:Text}[]
for(const[index,entry]of window.artPayload.residents.entries()){
 const textures=new Map<string,Texture>();for(const[key,data]of Object.entries(entry.images))textures.set(key,await texture(data))
 const panel=new Container(),room=new Container(),content=new Container(),mask=new Graphics().rect(0,0,262,226).fill(0xffffff)
 panel.position.set(index%4*270+4,Math.floor(index/4)*260+4);panel.addChild(room,mask);room.mask=mask;room.sortableChildren=true;content.sortableChildren=true;room.addChild(content);app.stage.addChild(panel)
 let backdrop!:Sprite;const props=new Map<string,Sprite>()
 for(const layer of window.artPayload.layers){const sprite=new Sprite(artTextures.get(layer.id)!);sprite.position.set(layer.rect[0]!,layer.rect[1]!);sprite.width=layer.rect[2]!;sprite.height=layer.rect[3]!;sprite.zIndex=layer.z;if(layer.id==='background'){backdrop=sprite;room.addChild(sprite)}else content.addChild(sprite);if(layer.id.startsWith('prop-'))props.set(layer.id,sprite)}
 const doll=new PaperDoll(entry.character,textures),arms=new Container(),left=new Sprite(textures.get('activity/work-left.png')!),right=new Sprite(textures.get('activity/work-right.png')!)
 const rest=new Sprite(textures.get('activity/rest-pose.png')!);rest.anchor.set(.5,1);rest.visible=false
 content.addChild(doll.root,rest,arms);arms.addChild(left,right)
 const label=new Text({text:entry.id,style:{fontFamily:'Arial,sans-serif',fontSize:14,fill:0x282b30}});label.position.set(4,232);panel.addChild(label)
 rigs.push({entry,panel,room,content,doll,rest,arms,left,right,backdrop,props,label})
}
function set(station:string,light:string,theme:string,proposal=false){
 const furniture=bookhouseScene.furniture.find(f=>f.id===station)!,hotspot=bookhouseScene.hotspots.find(h=>h.id===station)!,busy=station==='reading-desk',dusk=light==='dusk',dark=theme==='dark',time=.4
 if(!furniture||!hotspot)throw Error('UNKNOWN_STATION')
 const crop=station==='bookcase'?[198,105,154,189]:station==='reading-desk'?[45,202,200,173]:[18,150,170,150]
 const zoom=Math.min(262/crop[2]!,226/crop[3]!)
 document.querySelector<HTMLElement>('#stage')!.style.background=dark?'#20232a':'#f7f0e5'
 for(const{entry:{id,character,animations},room,content,doll,rest,arms,left,right,backdrop,props,label}of rigs){
  room.scale.set(zoom);room.position.set(-crop[0]!*zoom,-crop[1]!*zoom)
  backdrop.tint=dusk?0x9eaccd:0xffffff;content.tint=dusk?0xd2dcf0:0xffffff
  const scale=108/character.visibleHeight,pose=samplePose(character,animations.actions.idle,time);pose.expression='neutral';doll.apply(pose)
  doll.root.position.set(hotspot.anchor.x-character.feet[0]*scale,hotspot.anchor.y-character.feet[1]*scale);doll.root.scale.set(scale);doll.root.zIndex=hotspot.anchor.y*10;doll.root.visible=!proposal
  rest.visible=proposal;rest.width=96*rest.texture.width/rest.texture.height;rest.height=96;rest.position.set(hotspot.anchor.x,hotspot.anchor.y);rest.zIndex=hotspot.anchor.y*10
  for(const id of['arm-left','arm-right','leg-left','leg-right'])doll.nodes.get(id)!.visible=!busy
  arms.visible=busy;arms.position.copyFrom(doll.root.position);arms.scale.set(scale);arms.zIndex=furnitureDepth(bookhouseScene,station)!
  left.position.set(325,560+Math.sin(time*7)*6);right.position.set(535,560);left.width=right.width=175;left.height=right.height=200;left.rotation=Math.sin(time*7)*.025
  for(const[id,sprite]of props)sprite.visible=id===(busy?'prop-paper-pencil':station==='bookcase'?'prop-open-book':'prop-window-book')
  label.style.fill=dark?0xf4eee4:0x292d31;label.text=id+(proposal?' · REST PROPOSAL':'')
 }
 app.render()
 return{station,light,theme,proposal,time,dpr:devicePixelRatio,crop,zoom,tickerStarted:app.ticker.started,furnitureRect:furniture.rect,anchor:hotspot.anchor,bodyDepth:hotspot.anchor.y*10,frontDepth:furnitureDepth(bookhouseScene,station)!-10,activityArmDepth:busy?furnitureDepth(bookhouseScene,station):null,residents:rigs.map(r=>({id:r.entry.id,feet:[hotspot.anchor.x,hotspot.anchor.y],visibleHeight:proposal?96:108}))}
}
window.artReview={ready:true,set};set('bookcase','day','light')

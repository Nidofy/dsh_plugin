/** Real production PaperDoll fixture for independent bookhouse contact corrections. */
import {Application,Container,Sprite,Texture,Rectangle,Graphics,Text,Point}from'pixi.js'
import'pixi.js/unsafe-eval'
import{PaperDoll}from'../../../src/art/paper-doll.ts'
import{samplePose}from'../../../src/art/animation.ts'
import{bookhouseScene}from'../../../src/core/bookhouse-scene.ts'
import type{Character,AnimationSet,Part}from'../../../src/art/types.ts'
interface Layer{id:string;file:string;rect:number[];sourceRect:number[];z:number}
declare global{interface Window{contactPayload:{character:Character;animations:AnimationSet;layers:Layer[];images:Record<string,string>;parts:Record<string,string>;corrections:Record<string,{data:string;frame:number[]}>};contactReview:{ready:boolean;set:(time:number,dusk:boolean,dark:boolean)=>unknown}}}
const p=window.contactPayload,app=new Application()
await app.init({width:1080,height:760,backgroundAlpha:0,antialias:true,resolution:devicePixelRatio,autoStart:false,sharedTicker:false,preference:'webgl'})
document.querySelector('#stage')!.append(app.canvas)
const get=async(data:string)=>{const image=new Image();image.src=data;await image.decode();return Texture.from(image)}
const base=new Map<string,Texture>();for(const[file,data]of Object.entries(p.parts))base.set(file,await get(data))
for(const[file,{data,frame}]of Object.entries(p.corrections)){const t=await get(data);base.set(file,new Texture({source:t.source,frame:new Rectangle(...frame as[number,number,number,number])}))}
const sceneTextures=new Map<string,Texture>();for(const l of p.layers){const t=await get(p.images[l.file]!);sceneTextures.set(l.id,new Texture({source:t.source,frame:new Rectangle(...l.sourceRect as[number,number,number,number])}))}
const rigs:{doll:PaperDoll;character:Character;station:string;corrected:boolean;content:Container;background:Sprite;label:Text;anchor:{x:number;y:number}}[]=[]
const scale=108/900,seatSource={hip:[628,600],feet:[628,1232]},seatRatio=45/(1232-600),seatFrame=[63,600,1130,632]
for(const[index,[station,corrected]]of([['bookcase',false],['bookcase',true],['window-seat',false],['window-seat',true]]as const).entries()){
 const panel=new Container(),room=new Container(),content=new Container(),label=new Text({text:station+(corrected?' · corrected':' · previous'),style:{fontSize:16,fontFamily:'Arial',fill:0x35463c}})
 panel.position.set(index%2*540+8,Math.floor(index/2)*380+8);panel.addChild(room,label);label.position.set(4,340);app.stage.addChild(panel)
 const crop=station==='bookcase'?[198,125,154,170]:[28,145,154,155],zoom=1.85;room.scale.set(zoom);room.position.set(90-crop[0]!*zoom,-crop[1]!*zoom);room.sortableChildren=true;content.sortableChildren=true;room.addChild(content)
 const mask=new Graphics().rect(0,0,520,330).fill(0xffffff);panel.addChild(mask);room.mask=mask
 let background!:Sprite
 for(const l of p.layers){if(l.id.startsWith('prop-')&&(corrected||l.id!==(station==='bookcase'?'prop-open-book':'prop-window-book')))continue;const s=new Sprite(sceneTextures.get(l.id)!);s.position.set(l.rect[0]!,l.rect[1]!);s.width=l.rect[2]!;s.height=l.rect[3]!;s.zIndex=l.z;if(l.id==='background'){background=s;room.addChild(s)}else content.addChild(s)}
 const character=structuredClone(p.character)
 if(corrected){
  const book:Part={id:'held-book',parent:'body',file:'held-book',offset:[282,557],size:[460,460*583/1610],pivot:[512,673],z:8,mirror:'never'}
  character.parts.push(book)
  if(station==='window-seat')character.parts.push({id:'seated-body',parent:'body',file:'seated-body',offset:[512+(seatFrame[0]!-628)*seatRatio/scale,952+(seatFrame[1]!-1232)*seatRatio/scale],size:[seatFrame[2]!*seatRatio/scale,seatFrame[3]!*seatRatio/scale],pivot:[512,673],z:5,mirror:'never'})
 }
 if(corrected&&station==='window-seat')character.parts.find(p=>p.id==='torso')!.size[1]=85
 if(corrected&&station==='window-seat')character.parts.push({id:'seated-waist',parent:'body',file:'seated-waist',offset:[512+(63-628)*seatRatio/scale,952+(218-270)/scale],size:[1130*seatRatio/scale,7/scale],pivot:[512,673],z:5,mirror:'never'})
 const doll=new PaperDoll(character,base),anchor=bookhouseScene.hotspots.find(h=>h.id===station)!.anchor
 doll.root.scale.set(scale);doll.root.position.set(anchor.x-character.feet[0]*scale,anchor.y-character.feet[1]*scale);doll.root.zIndex=anchor.y*10;content.addChild(doll.root)
 if(corrected){for(const id of['arm-left','arm-right'])doll.nodes.get(id)!.visible=false;if(station==='window-seat')for(const id of['skirt','leg-left','leg-right'])doll.nodes.get(id)!.visible=false}
 const marks=new Graphics().circle(anchor.x,anchor.y,1.4).fill(0x287c9c);marks.zIndex=9999
 if(station==='window-seat')marks.moveTo(44,225).lineTo(160,225).stroke({color:0xa45c31,width:.5,alpha:.65})
 content.addChild(marks);rigs.push({doll,character,station,corrected,content,background,label,anchor})
}
function set(time:number,dusk:boolean,dark:boolean){
 document.querySelector<HTMLElement>('#stage')!.style.background=dark?'#25302c':'#f7f0e5'
 const measurements=[]
 for(const r of rigs){const pose=samplePose(r.character,p.animations.actions.idle,time)
 if(r.corrected&&r.station==='window-seat'){pose.transforms.body!.y=-70;pose.transforms.body!.rotation=0;pose.transforms["seated-body"]!.y=70;pose.transforms["seated-waist"]!.y=70}
 r.doll.apply(pose);r.background.tint=dusk?0x9eaccd:0xffffff;r.content.tint=dusk?0xd2dcf0:0xffffff;r.label.style.fill=dark?0xf4eee4:0x35463c
 const seated=r.corrected&&r.station==="window-seat",lower=seated?r.doll.nodes.get("seated-body")!.children[0] as Sprite:null;const hip=lower?r.content.toLocal(lower.toGlobal(new Point(628-63,0))):null,feet=lower?r.content.toLocal(lower.toGlobal(new Point(628-63,632))):null
 measurements.push({renderedHip:hip?[hip.x,hip.y]:null,renderedSoles:feet?[feet.x,feet.y]:null,station:r.station,corrected:r.corrected,feet:[r.anchor.x,r.anchor.y],hipTargetY:r.station==='window-seat'?225:null,hipMappedY:r.corrected&&r.station==='window-seat'?270+(seatSource.hip[1]!-seatSource.feet[1]!)*seatRatio:null,bodyBob:pose.transforms.body!.y,originalHeadRetained:true,mirrored:false,headTransform:pose.transforms.head})
 }app.render();return{time,dusk,dark,dpr:devicePixelRatio,tickerStarted:app.ticker.started,measurements}}
window.contactReview={ready:true,set};set(.4,false,false)

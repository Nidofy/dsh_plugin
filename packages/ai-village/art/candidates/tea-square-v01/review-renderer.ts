/** Candidate-only scene review using the actual production PaperDoll. No world/save owner. */
import {Application,Container,Sprite,Texture,Graphics} from 'pixi.js'
import 'pixi.js/unsafe-eval'
import {PaperDoll} from '../../../src/art/paper-doll.ts'
import {samplePose,applyLifePose} from '../../../src/art/animation.ts'
import type {Character,AnimationSet} from '../../../src/art/types.ts'
import {teaSquareScene,teaSquareSeats,teaSquareEntries} from '../../../src/core/tea-square-scene.ts'
declare global { interface Window {teaArtPayload:{images:Record<string,string>;characters:{character:Character;animations:AnimationSet;parts:Record<string,string>}[]};teaArtReview:{ready:boolean;set:(mode:string,time:number,dusk:boolean,dark:boolean,geometry:boolean)=>unknown}} }
const app=new Application(),p=window.teaArtPayload
await app.init({width:360,height:480,backgroundAlpha:0,antialias:true,resolution:devicePixelRatio,autoStart:false,sharedTicker:false,preference:'webgl'})
document.querySelector('#stage')!.append(app.canvas)
const texture=async(data:string)=>{const i=new Image();i.src=data;await i.decode();return Texture.from(i)}
const background=new Sprite(await texture(p.images.background!));background.width=360;background.height=480;background.zIndex=-100
const room=new Container();room.sortableChildren=true;room.addChild(background);app.stage.addChild(room)
for(const f of teaSquareScene.furniture){const s=new Sprite(await texture(p.images[f.id]!));s.position.set(f.rect.x,f.rect.y);s.width=f.rect.width;s.height=f.rect.height;s.zIndex=(f.rect.y+f.rect.height)*10-10;room.addChild(s)}
const rigs=[]
for(const c of p.characters){const textures=new Map<string,Texture>();for(const [key,url] of Object.entries(c.parts))textures.set(key,await texture(url));const doll=new PaperDoll(c.character,textures);room.addChild(doll.root);rigs.push({...c,doll})}
const props=new Graphics();props.zIndex=3211;room.addChild(props)
for(let i=0;i<3;i++){const x=128+i*52;props.circle(x,280,7).fill([0xc7dce0,0x91af7e,0xeac579][i]!).stroke({color:0x947951,width:.5});if(i===0)props.circle(x-2,280,2).circle(x+1,279,2.6).fill(0xffffff);if(i===1)props.ellipse(x,280,2,4).fill(0x587c51);if(i===2)props.star(x,280,5,4,2).fill(0xfff1bb)}
const marks=new Graphics();marks.zIndex=20000;room.addChild(marks)
function set(mode:string,time:number,dusk:boolean,dark:boolean,geometry:boolean){
 document.body.dataset.theme=dark?'dark':'light';background.tint=dusk?0x9eaccd:0xffffff
 const feet=[]
 for(const [index,r] of rigs.entries()){
  const point=mode==='entrance'?teaSquareEntries[index]!:index<3?teaSquareSeats[index]!:({x:[48,112,248,312][index-3]!,y:398})
  const scale=108/r.character.visibleHeight,pose=samplePose(r.character,r.animations.actions.idle,time)
  if(mode!=='entrance'&&index<3)applyLifePose(pose,r.character.id.split('-v')[0] as never,'listen',time,false)
  r.doll.apply(pose);r.doll.root.scale.set(scale);r.doll.root.position.set(point.x-r.character.feet[0]*scale,point.y-r.character.feet[1]*scale);r.doll.root.zIndex=point.y*10;r.doll.root.visible=mode==='seven'||mode==='entrance'||index<3
  feet.push({...point,id:r.character.id})
 }
 marks.clear();marks.visible=geometry
 if(geometry){for(const rect of teaSquareScene.obstacles)marks.rect(rect.x,rect.y,rect.width,rect.height).stroke({color:0xc34237,width:1});for(const h of teaSquareScene.hotspots)marks.circle(h.anchor.x,h.anchor.y,2).fill(0x157f9b)}
 app.render();return{mode,time,dusk,dark,geometry,feet,textureSources:4,sceneCanvas:[360,480],tickerStarted:app.ticker.started}
}
window.teaArtReview={ready:true,set};set('three',.4,false,false,false)

/** Independent review only: real Pixi + production pose/controller; no Host, SaveStore or owner registration. */
import {Application,Container,Graphics,Sprite,Texture,Text} from 'pixi.js'
import 'pixi.js/unsafe-eval'
import {PaperDoll} from '../../../src/art/paper-doll.ts'
import {samplePose} from '../../../src/art/animation.ts'
import {LivingController} from '../../../src/core/living-controller.ts'
import {createLivingWorld} from '../../../src/core/living-state.ts'
import {switchRegion} from '../../../src/core/region-engine.ts'
import {requestManualMove,cancelManualMove} from '../../../src/core/manual-move.ts'
import {scene} from '../../../src/definitions.ts'
import {bookhouseScene} from '../../../src/core/bookhouse-scene.ts'
import type {Character,AnimationSet} from '../../../src/art/types.ts'
type Direction='front'|'left'|'rear'|'right'
type Registration={id:string;top:number;floor:number;hip:[number,number];head:[number,number];soles:[number,number][];sourceSize:[number,number]}
declare global{interface Window{cyclePayload:{character:Character;animations:AnimationSet;parts:Record<string,string>;frames:Record<string,string>;registration:Registration[]};cycleReview:any}}
const p=window.cyclePayload,app=new Application();await app.init({width:1100,height:780,resolution:devicePixelRatio,autoDensity:true,autoStart:false,sharedTicker:false,preference:'webgl',antialias:true,background:0xf5efdf});document.querySelector('#stage')!.append(app.canvas)
const textures=new Map<string,Texture>(),load=async(k:string,data:string)=>{const im=new Image();im.src=data;await im.decode();textures.set(k,Texture.from(im))}
for(const[k,data]of Object.entries(p.parts))await load(k,data);for(const[k,data]of Object.entries(p.frames))await load(k,data)
const label=(text:string,x:number,y:number,size=13)=>{const t=new Text({text,style:{fontFamily:'Arial',fontSize:size,fill:0x304d50}});t.position.set(x,y);app.stage.addChild(t);return t}
const reg=(id:string)=>p.registration.find(f=>f.id===id)!
function candidate(id:string,parent:Container){const r=reg(id),s=new Sprite(textures.get(id)!);s.scale.set(108/(r.floor-r.top)*r.sourceSize[0]/s.texture.width);s.position.set(-r.hip[0]*108/(r.floor-r.top),-r.floor*108/(r.floor-r.top));parent.addChild(s);return s}
function front(parent:Container){const doll=new PaperDoll(p.character,textures),s=108/p.character.visibleHeight;doll.root.scale.set(s);doll.root.position.set(-p.character.feet[0]*s,-p.character.feet[1]*s);parent.addChild(doll.root);return doll}
const gallery=new Container();app.stage.addChild(gallery)
p.registration.forEach((r,i)=>{const group=new Container();group.position.set(55+i*133,166);gallery.addChild(group);candidate(r.id,group);const k=108/(r.floor-r.top),marks=new Graphics().moveTo(-40,0).lineTo(80,0).stroke({color:0x477c75,width:1}).circle(0,0,2).fill(0x477c75).circle(0,(r.hip[1]-r.floor)*k,2).fill(0xd66d33);for(const[x,y]of r.soles)marks.circle((x-r.hip[0])*k,(y-r.floor)*k,2).fill(0xd23f6b);group.addChild(marks);label(r.id,10+i*133,182,11)})
label('108px independent frames · green floor/anchor · orange hip · pink manually marked soles',18,10,15)
const world=new Container();world.position.set(20,225);app.stage.addChild(world)
world.addChild(new Graphics().rect(0,0,360,480).fill(0xe4e8dd).rect(36,220,288,220).fill(0xfaf3da))
for(const o of bookhouseScene.obstacles)world.addChild(new Graphics().rect(o.x,o.y,o.width,o.height).fill(0x9f957f))
const routeGraphic=new Graphics();world.addChild(routeGraphic)
label('Independent bookhouse geometry (not production scenery)',20,205,12)
label('Original front rig / fallback for right',425,225,15)
const frontSample=new Container();frontSample.position.set(510,400);app.stage.addChild(frontSample);const original=front(frontSample)
label('Live direction preview ×2 · 0.18s crossfade is not turn art',425,430,15)
const large=new Container();large.position.set(700,730);large.scale.set(2);app.stage.addChild(large)
function avatar(parent:Container){const root=new Container();parent.addChild(root);const f=new Container(),l=new Container(),b=new Container();root.addChild(f,l,b);return{root,nodes:{front:f,right:f,left:l,rear:b},doll:front(f),left:candidate('left-a',l),rear:candidate('rear-a',b)}}
const small=avatar(world),big=avatar(large),controller=new LivingController(switchRegion(createLivingWorld(scene),scene,'bookhouse'),scene,()=>{})
let dir:Direction='front',previous:Direction='front',fade=.18,elapsed=0,walking=true,paused=false,reduced=false,hidden=false,autoDirection=false,live=false,last=0,raf=0
const history:{tick:number;distance:number;x:number;y:number}[]=[]
const mapped=(d:Direction)=>d==='right'?'front':d
function direction(d:Direction){previous=dir;dir=d;fade=0;document.querySelector<HTMLSelectElement>('#direction')!.value=d;draw()}
function state(){return{direction:dir,previous,fade,elapsed,walking,paused,reduced,hidden,live,ticks:controller.world.ticks,position:{...controller.world.actor.position},manualMove:controller.world.manualMove,history:history.slice(-5000),renderer:'Pixi WebGL',tickerStarted:app.ticker.started,rightFallback:dir==='right',mirrored:false}}
function applyFrame(sprite:Sprite,id:string){const r=reg(id),t=textures.get(id)!;sprite.texture=t;const k=108/(r.floor-r.top);sprite.scale.set(k*r.sourceSize[0]/t.width);sprite.position.set(-r.hip[0]*k,-r.floor*k)}
function draw(){
 const cycle=Math.floor(elapsed/.18)%4,left=['left-a','left-pass-a','left-b','left-pass-b'][walking?cycle:0]!,rear=['rear-a','rear-neutral','rear-b','rear-neutral'][walking?cycle:1]!
 for(const a of[small,big]){a.doll.apply(samplePose(p.character,p.animations.actions[walking?'walk':'idle'],elapsed));applyFrame(a.left,left);applyFrame(a.rear,rear);for(const n of[a.nodes.front,a.nodes.left,a.nodes.rear])n.alpha=0;a.nodes[mapped(dir)].alpha=1;if(fade<.18&&mapped(previous)!==mapped(dir)){a.nodes[mapped(dir)].alpha=fade/.18;a.nodes[mapped(previous)].alpha=1-fade/.18}}
 original.apply(samplePose(p.character,p.animations.actions[walking?'walk':'idle'],elapsed));small.root.position.copyFrom(controller.world.actor.position)
 routeGraphic.clear();const a=controller.world.actor;routeGraphic.circle(a.position.x,a.position.y,3).fill(0x2a7a71);if(controller.world.manualMove){routeGraphic.moveTo(a.position.x,a.position.y);for(const v of controller.world.manualMove.route)routeGraphic.lineTo(v.x,v.y);routeGraphic.stroke({color:0x599b89,width:1})}
 document.querySelector('#status')!.textContent=`${dir}${dir==='right'?' (original front fallback)':''} · frame ${cycle} · ${elapsed.toFixed(3)}s · tick ${controller.world.ticks} · ${paused||hidden||reduced?'frozen':'active'} · 17 units/s; no saves`
 app.render()
}
function advance(dt:number){if(paused||reduced||hidden||document.hidden)return state();if(walking){elapsed+=dt;fade=Math.min(.18,fade+dt)}if(controller.world.manualMove){const before={...controller.world.actor.position};controller.advance(dt);const after=controller.world.actor.position,dx=after.x-before.x,dy=after.y-before.y;history.push({tick:controller.world.ticks,distance:Math.hypot(dx,dy),...after});if(history.length>5000)history.shift();if(autoDirection&&Math.hypot(dx,dy)>.001){const next:Direction=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'rear':'front';if(next!==dir)direction(next)}if(!controller.world.manualMove)walking=false}draw();return state()}
function loop(t:number){raf=0;if(!live||paused||hidden||reduced||document.hidden){last=0;return}if(last)advance(Math.min((t-last)/1000,.05));last=t;raf=requestAnimationFrame(loop)}
function schedule(){cancelAnimationFrame(raf);last=0;if(live&&!paused&&!hidden&&!reduced&&!document.hidden)raf=requestAnimationFrame(loop)}
function set(opts:any){if(opts.direction)direction(opts.direction);if(opts.elapsed!==undefined)elapsed=opts.elapsed;if(opts.walking!==undefined)walking=opts.walking;if(opts.paused!==undefined)paused=opts.paused;if(opts.reduced!==undefined)reduced=opts.reduced;if(opts.hidden!==undefined)hidden=opts.hidden;if(opts.live!==undefined)live=opts.live;draw();schedule();return state()}
function move(x:number,y:number){controller.world=requestManualMove(controller.world,scene,{x,y});autoDirection=true;walking=true;draw();return state()}
function stop(){cancelManualMove(controller.world);walking=false;fade=.18;draw();return state()}
document.addEventListener('visibilitychange',()=>{draw();schedule()})
document.querySelector<HTMLSelectElement>('#direction')!.onchange=e=>{autoDirection=false;direction((e.target as HTMLSelectElement).value as Direction)}
document.querySelector('#pause')!.addEventListener('click',()=>set({paused:!paused}))
document.querySelector('#play')!.addEventListener('click',()=>set({walking:true,paused:false,live:true}))
document.querySelector('#stop')!.addEventListener('click',stop)
document.querySelector<HTMLInputElement>('#reduced')!.onchange=e=>set({reduced:(e.target as HTMLInputElement).checked})
document.querySelector<HTMLInputElement>('#hidden')!.onchange=e=>set({hidden:(e.target as HTMLInputElement).checked})
document.querySelector('#route')!.addEventListener('click',()=>{if(controller.world.actor.position.x>200)move(48,402);else move(300,310);set({live:true,paused:false})})
window.cycleReview={ready:true,set,state,advance,move,stop,dispose(){live=false;cancelAnimationFrame(raf);app.destroy(true,{children:true,texture:true,textureSource:true})}};draw()

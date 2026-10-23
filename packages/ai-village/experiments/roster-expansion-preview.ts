/** Offline art review using the production PaperDoll and pose sampler. No world/save owner. */
import { Application, Container, Sprite, Texture, Graphics } from 'pixi.js'
import 'pixi.js/unsafe-eval'
import { PaperDoll } from '../src/art/paper-doll.ts'
import { samplePose } from '../src/art/animation.ts'
import type { Character, AnimationSet, Action, Expression } from '../src/art/types.ts'
declare global { interface Window { artPayload: { id: string; character: Character; animations: AnimationSet; images: Record<string,string> }[]; artReview: { ready: boolean; set: (state:string,time:number,size?:number,expression?:string,background?:string)=>void; metrics:()=>unknown } } }
const app = new Application()
await app.init({ width: 1280, height: 340, backgroundAlpha: 0, antialias: true, resolution: 1, autoStart: false, sharedTicker: false, preference: 'webgl' })
document.querySelector('#stage')!.append(app.canvas)
let state = 'idle', time = 0, size = 216, expression = 'auto', playing = true
const rigs = [] as { doll:PaperDoll; root:Container; arms:Map<string,Sprite>; rest:Sprite; table:Graphics; character:Character; animations:AnimationSet }[]
for (const [i, entry] of window.artPayload.entries()) {
  const textures = new Map<string,Texture>()
  for (const [file,data] of Object.entries(entry.images)) { const image = new Image(); image.src = data; await image.decode(); textures.set(file,Texture.from(image)) }
  const root = new Container(), doll = new PaperDoll(entry.character,textures), arms = new Map<string,Sprite>(), table = new Graphics()
  root.position.set(i*256+128,290); app.stage.addChild(root); root.addChild(doll.root,table)
  const rest = new Sprite(textures.get('parts/rest-pose.png')!); rest.anchor.set(.5,1); root.addChild(rest)
  for (const name of ['work-left','work-right','eat-left','eat-right']) { const sprite = new Sprite(textures.get(`parts/${name}.png`)!); root.addChild(sprite); arms.set(name,sprite) }
  rigs.push({root,doll,arms,rest,table,character:entry.character,animations:entry.animations})
}
function draw() {
  for (const rig of rigs) {
    const {doll,arms,rest,table,character,animations} = rig, busy = state==='work'||state==='eat'
    const action = ['work','eat','rest'].includes(state) ? 'idle' : state as Action
    const pose = samplePose(character,animations.actions[action],time)
    if (expression !== 'auto') pose.expression = expression as Expression
    else if (state === 'eat') pose.expression = Math.sin(time*4)>0?'happy':'neutral'
    doll.apply(pose)
    const scale = size/character.visibleHeight
    doll.root.scale.set(scale); doll.root.position.set(-character.feet[0]*scale,-character.feet[1]*scale)
    doll.root.visible = state !== 'rest'
    for (const id of ['arm-left','arm-right','leg-left','leg-right']) doll.nodes.get(id)!.visible = !busy
    rest.visible = state === 'rest'; rest.height = size*96/108*(1+.004*Math.sin(time*2)); rest.width = rest.height*rest.texture.width/rest.texture.height
    table.clear(); table.visible = busy
    if (busy) {
      // Neutral review occluder only; arm dimensions and placement below match scene.ts.
      const w = size*1.06, y = -size*.29
      table.roundRect(-w/2,y,w,size*.105,5).fill(0xc2a27b).stroke({color:0x755c46,width:1})
      table.rect(-w*.43,y+size*.105,size*.055,size*.22).fill(0x876a4b)
      table.rect(w*.375,y+size*.105,size*.055,size*.22).fill(0x876a4b)
    }
    for (const [name,sprite] of arms) {
      sprite.visible = busy&&name.startsWith(state+'-'); const left = name.endsWith('left')
      let x=left?325:535,y=state==='eat'?495:560
      sprite.rotation=0
      if(state==='work'&&left){y+=Math.sin(time*7)*6;sprite.rotation=Math.sin(time*7)*.025}
      if(state==='eat'&&!left){y-=(1+Math.sin(time*3))*22;x-=(1+Math.sin(time*3))*10;sprite.rotation=-.05}
      sprite.position.set((x-character.feet[0])*scale,(y-character.feet[1])*scale)
      sprite.width=(state==='work'?175:220)*scale;sprite.height=(state==='work'?200:185)*scale
    }
  }
  app.render()
}
window.artReview = { ready:true, set:(s,t,z=216,e='auto',bg='#f5eee2')=>{state=s;time=t;size=z;expression=e;playing=false;document.querySelector<HTMLElement>('#stage')!.style.background=bg;draw()}, metrics:()=>({rigs:rigs.length,textures:window.artPayload.reduce((n,x)=>n+Object.keys(x.images).length,0),state,time,size}) }
for(const id of ['action','expression','size','background'])document.getElementById(id)!.addEventListener('change',()=>{state=(document.getElementById('action') as HTMLSelectElement).value;expression=(document.getElementById('expression') as HTMLSelectElement).value;size=Number((document.getElementById('size') as HTMLSelectElement).value);document.querySelector<HTMLElement>('#stage')!.style.background=(document.getElementById('background') as HTMLSelectElement).value;time=0;draw()})
document.getElementById('pause')!.addEventListener('click',()=>{playing=!playing;document.getElementById('pause')!.textContent=playing?'暂停 / Pause':'播放 / Play'})
let last=performance.now()
function tick(now:number){if(playing)time+=Math.min(.05,(now-last)/1000);last=now;draw();requestAnimationFrame(tick)}
requestAnimationFrame(tick)

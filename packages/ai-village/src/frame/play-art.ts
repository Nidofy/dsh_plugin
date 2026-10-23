import { keepsakePositions } from '../core/keepsake-observation.ts'
import { Container, Graphics } from 'pixi.js'
import { playDecorationIds } from '../core/play-catalog.ts'
import { whalePoint } from '../core/living-engine.ts'
import type { LivingWorld } from '../core/living-state.ts'
import type { Scene } from '../core/world.ts'

/** Bounded authored vector keepsakes, sharing the existing tea/book/wind-chime palette. */
export class PlayArt {
  readonly root = new Container()
  private drawing = new Graphics()
  constructor(){this.root.addChild(this.drawing);this.root.zIndex=4801}
  paint(world:LivingWorld|null,base:Scene,reduced:boolean){
    const g=this.drawing;g.clear();if(!world)return
    const draw=(id:string,x:number,y:number)=>{
      const outline={color:0x7b6854,width:.8}
      if(id==='message-board'){
        g.moveTo(x-7,y+5).lineTo(x-7,y+16).moveTo(x+7,y+5).lineTo(x+7,y+16).stroke({color:0x947452,width:3})
        g.roundRect(x-14,y-10,28,20,2).fill(0xcaa77b).stroke(outline)
        g.poly([x-10,y-6,x+9,y-7,x+10,y+6,x-9,y+7]).fill(0xfff5d9).stroke(outline)
        g.circle(x,y-5,1.5).fill(0xb86654);g.moveTo(x-6,y).lineTo(x+6,y).moveTo(x-6,y+3).lineTo(x+3,y+3).stroke({color:0x789486,width:1})
      }else if(id==='leaf-pot'){
        g.moveTo(x,y+4).quadraticCurveTo(x-3,y-5,x+2,y-15).stroke({color:0x6c8966,width:1.5})
        g.ellipse(x-4,y-8,6,3).fill(0x9ab27c).stroke(outline);g.ellipse(x+5,y-13,6,3).fill(0xd1b678).stroke(outline)
        g.poly([x-9,y,x+9,y,x+6,y+13,x-6,y+13]).fill(0xc68d70).stroke(outline)
        g.ellipse(x,y,9,3).fill(0x8b735b).stroke(outline)
      }else if(id==='rice-bowl'){
        g.ellipse(x,y-2,10,4).fill(0xfff8e6).stroke(outline)
        for(const dx of [-5,0,5])g.ellipse(x+dx,y-4,3,2).fill(0xffffff)
        g.moveTo(x-10,y).quadraticCurveTo(x-8,y+12,x,y+12).quadraticCurveTo(x+8,y+12,x+10,y).closePath().fill(0x90bdcb).stroke(outline)
        g.ellipse(x,y+12,5,1.5).fill(0x6b94aa)
      }else if(id==='table-stones'){
        g.roundRect(x-13,y-6,26,18,3).fill(0xf1dfb4).stroke(outline);g.circle(x-5,y+2,4).stroke({color:0x487967,width:1.5});g.moveTo(x+3,y-2).lineTo(x+10,y+5).moveTo(x+10,y-2).lineTo(x+3,y+5).stroke({color:0x916658,width:1.5})
      }else if(id==='whale-token'){
        g.ellipse(x,y,12,8).fill(0x72b6ca).stroke(outline)
        g.moveTo(x+8,y).quadraticCurveTo(x+19,y-10,x+18,y+2).lineTo(x+9,y+6).fill(0x72b6ca).stroke(outline)
        g.ellipse(x-3,y+4,6,3).fill(0xdbeeed);g.circle(x-6,y-2,1.4).fill(0x354e66)
        g.moveTo(x-4,y-9).quadraticCurveTo(x-8,y-16,x-11,y-12).stroke({color:0x78aabc,width:1.5})
      }else if(id==='page-marker'){
        g.roundRect(x-12,y-7,24,18,2).fill(0xf7ebce).stroke(outline);g.moveTo(x,y-6).lineTo(x,y+10).stroke(outline)
        g.moveTo(x+4,y-7).lineTo(x+9,y-7).lineTo(x+9,y+7).lineTo(x+6.5,y+4).lineTo(x+4,y+7).closePath().fill(0x779d80)
      }else if(id==='snack-tray'){
        g.ellipse(x,y+5,16,5).fill(0xd6b786).stroke(outline);g.roundRect(x-6,y-7,11,12,3).fill(0xf7efcf).stroke(outline)
        g.ellipse(x-.5,y-7,5.5,2).fill(0x91714b);g.circle(x+10,y+1,4).fill(0xd49a83)
      }else if(id==='wind-ribbon'){
        g.moveTo(x,y-12).lineTo(x,y-4).stroke(outline);g.roundRect(x-8,y-4,16,18,2).fill(0xf3e4bc).stroke(outline)
        g.moveTo(x-4,y+1).lineTo(x+4,y+1).moveTo(x-4,y+5).lineTo(x+2,y+5).stroke({color:0x91a58d,width:1})
        g.moveTo(x,y+14).quadraticCurveTo(x+7,y+20,x+2,y+23).stroke({color:0x8aa9aa,width:2})
      }else{
        const star=(cx:number,cy:number,r:number)=>{const pts=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,k=i%2?r*.45:r;return[cx+Math.cos(a)*k,cy+Math.sin(a)*k]}).flat();g.poly(pts).fill(0xe8c782).stroke(outline)}
        if(id==='star-mobile'){g.moveTo(x-13,y-10).lineTo(x+13,y-10).stroke(outline);for(const [dx,dy]of[[-10,4],[0,12],[10,4]]){g.moveTo(x+dx!,y-10).lineTo(x+dx!,y+dy!).stroke(outline);star(x+dx!,y+dy!,5)}}else{g.roundRect(x-12,y+7,24,5,2).fill(0xb99676);star(x,y,10)}
      }
    }
    for(const item of keepsakePositions(world))draw(item.id,item.x,item.y)
    const token=whalePoint(world,base)
    if(token)draw('whale-token',token.x,token.y+(reduced?0:Math.sin(world.ticks/30)*.8))
  }
}

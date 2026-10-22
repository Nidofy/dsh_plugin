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
      if(id==='rice-bowl'){
        g.ellipse(x,y-2,10,4).fill(0xfff8e6).stroke(outline)
        for(const dx of [-5,0,5])g.ellipse(x+dx,y-4,3,2).fill(0xffffff)
        g.moveTo(x-10,y).quadraticCurveTo(x-8,y+12,x,y+12).quadraticCurveTo(x+8,y+12,x+10,y).closePath().fill(0x90bdcb).stroke(outline)
        g.ellipse(x,y+12,5,1.5).fill(0x6b94aa)
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

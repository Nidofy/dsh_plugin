import type { Graphics } from 'pixi.js'
import type { LivingWorld } from '../core/living-state.ts'
import { actors } from '../core/world.ts'
import { communityCollection } from '../core/community-life.ts'
/** Small paper props use the existing vector vocabulary and approved scene art. */
export function paintAfternoon(g:Graphics,prop:Graphics,w:LivingWorld){
 g.zIndex=w.region.active==='tea-square'?2401:1991
 if(w.region.active==='tea-square'){
  for(const [i,id] of (['tea-bookmark','reflection-shapes'] as const).entries())if(w.afternoon.keepsakes[id]){
   const x=263+i*20,y=132+i*4
   g.moveTo(x+5,y).lineTo(x+5,y-12).stroke({color:0x987550,width:1})
   g.roundRect(x,y,11,20,2).fill(i?0xd5e4e6:0xf0ddb0).stroke({color:0x997e5b,width:1})
   if(i)g.moveTo(x+2,y+12).lineTo(x+5,y+5).lineTo(x+8,y+12).stroke({color:0x6e9aa2,width:1})
   else g.ellipse(x+5,y+8,2,4).fill(0x83a279)
  }
  const e=w.afternoon.active
  if(e&&e.phase!=='approaching'){
   const a=actors(w).filter(a=>e.participants.includes(a.id)).sort((a,b)=>b.position.y-a.position.y||a.id.localeCompare(b.id))[0]!
   // Put the shared prop on the open hand side; a foreground bystander can cover the other side.
   const candidates=[a.position.x+16,a.position.x-36]
   const occlusion=(x:number)=>(x<8||x+26>352?100:0)+actors(w).filter(b=>b.id!==a.id&&b.position.y>=a.position.y&&b.position.y-a.position.y<100&&Math.abs(b.position.x-(x+8))<40).length
   const x=candidates.sort((x,y)=>occlusion(x)-occlusion(y))[0]!,y=a.position.y-48
   prop.zIndex=a.position.y*10+4
   if(e.storyId==='tea-bookmark'){
    prop.poly([x,y,x+17,y+2,x+15,y+13,x+2,y+12]).fill(0xf8e8c9).stroke({color:0xb08a60,width:1})
    if(e.selection)prop.moveTo(x+8,y+1).lineTo(x+8,y+12).stroke({color:0xb08a60,width:1})
    if(e.selection==='leaf')prop.ellipse(x+5,y+6,2,3).fill(0x7e9975)
    if(e.selection==='wave')prop.moveTo(x+2,y+6).quadraticCurveTo(x+5,y+2,x+7,y+7).stroke({color:0x729ba5,width:1})
   }else{
    prop.ellipse(x+8,y+6,13,7).fill(0x9fb9b9).stroke({color:0xead4b0,width:2})
    const sign=e.selection==='right'?-1:1
    prop.moveTo(x+8,y+2).lineTo(x+8+sign*6,y+8).lineTo(x+8-sign*4,y+8).stroke({color:0xf8f0d0,width:1.5})
   }
  }
 }
 const c=communityCollection(w)
 if(w.region.active==='courtyard'&&c.threeRegions.placement){const {x,y}=c.threeRegions.placement;g.roundRect(x-13,y-10,26,20,3).fill(0xf0dfbe).stroke({color:0x947955,width:1});for(let i=0;i<3;i++)g.ellipse(x-8+i*8,y,2.5,5).fill([0x8d9e74,0xb3926b,0x7faaa9][i]!)}
}

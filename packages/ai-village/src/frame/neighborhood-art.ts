import { Container, Graphics } from 'pixi.js'
import { offsets, type Home } from '../core/home-state.ts'
import type { NeighborhoodWorld } from '../core/neighborhood-state.ts'
import type { Actor } from '../core/world.ts'
import type { Pose } from '../art/types.ts'
import { actors } from '../core/world.ts'
/** Small original vector props, in the same world coordinates as the residents. */
export class NeighborhoodArt {
  readonly benchBack = new Graphics(); readonly bench = new Graphics(); readonly corner = new Graphics(); readonly props = new Graphics(); readonly decorations = {lantern: new Graphics(), planter: new Graphics()}
  private layout = ''
  constructor(stage: Container) {
    this.benchBack.zIndex = 2050; this.bench.zIndex = 2410; this.corner.zIndex = 2460; this.props.zIndex = 5000; this.decorations.lantern.zIndex = 3; this.decorations.planter.zIndex = 3
    stage.addChild(this.benchBack,this.bench,this.corner,this.props,...Object.values(this.decorations))
  }
  paint(world: NeighborhoodWorld, reduced: boolean, draft?: { id: 'lantern' | 'planter'; slot: 'window' | 'door' | 'wall' | null } | null, home?: Home) {
    if (this.layout !== world.neighborhood.layout) {
      this.layout = world.neighborhood.layout; const b=this.bench,c=this.corner;b.clear();c.clear();this.benchBack.clear()
      this.benchBack.roundRect(37,211,168,8,3).fill(0xa58058).stroke({color:0x705638,width:1})
      b.roundRect(37,226,168,10,3).fill(0xc8a877).stroke({color:0x846640,width:1})
      for(const x of [45,190]) b.roundRect(x,234,7,15,2).fill(0x8d704c)
      if(this.layout==='reading') {
        c.roundRect(240,197,66,53,3).fill(0xb4956c).stroke({color:0x756046,width:1.3})
        c.rect(245,202,56,38).fill(0x78664d)
        for(let i=0;i<7;i++)c.roundRect(247+i*7,206+(i%2)*3,6,30-(i%2)*3,1).fill([0x809887,0xb78b78,0xcbb781][i%3]!)
        c.rect(240,239,66,5).fill(0xd3b987)
      } else if(this.layout==='garden') {
        c.roundRect(251,225,43,25,5).fill(0xb88667).stroke({color:0x805e47,width:1})
        c.ellipse(272,225,23,5).fill(0x6c694a)
        for(let i=0;i<5;i++){const x=252+i*10,y=205+(i%2)*5;c.moveTo(272,226).lineTo(x,y).stroke({color:0x637c52,width:2});c.ellipse(x,y,11,5).fill(i%2?0x91ab72:0x708e62)}
      }
    }
    const benchOffset = home ? offsets.bench[home.positions.bench]! : {x:0,y:0}, cornerOffset = home ? offsets.corner[home.positions.corner]! : {x:0,y:0}
    this.bench.position.set(benchOffset.x,benchOffset.y);this.benchBack.position.copyFrom(this.bench.position);this.bench.zIndex=2410+benchOffset.y*10;this.benchBack.zIndex=2050+benchOffset.y*10
    this.corner.position.set(cornerOffset.x,cornerOffset.y);this.corner.zIndex=2460+cornerOffset.y*10
    const p=this.props;p.clear()
    const event=world.neighborhood.event
    for(const a of actors(world)){
      const reading=a.behavior==='read'||event?.phase==='acting'&&event.definitionId==='shared-book'&&event.participants.includes(a.id)
      const tending=a.behavior==='tend'
      if(reading){p.poly([a.position.x-20,a.position.y-39,a.position.x,a.position.y-35,a.position.x+20,a.position.y-39,a.position.x+20,a.position.y-20,a.position.x,a.position.y-16,a.position.x-20,a.position.y-20]).fill(0xf5e8c7).stroke({color:0xa38a61,width:1});p.moveTo(a.position.x,a.position.y-35).lineTo(a.position.x,a.position.y-16).stroke({color:0xc7b18a,width:1})}
      if(tending){const x=a.position.x+21,y=a.position.y-25;p.roundRect(x-7,y,14,15,3).fill(0x789fa0).stroke({color:0x466c70,width:1});p.moveTo(x+6,y+4).lineTo(x+18,y-3).stroke({color:0x789fa0,width:4});if(!reduced)for(let i=0;i<3;i++)p.circle(x+18+i,y+((world.ticks/3+i*4)%12),1.1).fill(0x96c6ce)}
    }
    for(const d of Object.values(this.decorations))d.clear()
    for(const [id,slot] of Object.entries({...world.neighborhood.decorations,...(draft?{[draft.id]:draft.slot}:{})})){
      if(!slot)continue;const d=this.decorations[id as 'lantern'|'planter'];const [x,y]=({window:[166,101],door:[250,115],wall:[76,104]} as const)[slot]
      if(id==='lantern'){d.moveTo(x,y).lineTo(x,y+8).stroke({color:0x827150,width:1});d.roundRect(x-9,y+8,18,24,7).fill(0xe2ae70).stroke({color:0xa77d47,width:1});d.moveTo(x,y+10).lineTo(x,y+30).stroke({color:0xf3d79d,width:2});d.rect(x-4,y+32,8,3).fill(0x947248)}
      else {d.moveTo(x-13,y+3).quadraticCurveTo(x,y+20,x+13,y+3).stroke({color:0x8d9764,width:1});for(let i=0;i<5;i++)d.ellipse(x-12+i*6,y+6+(2-Math.abs(i-2))*3,5,3).fill(i%2?0x8ba87a:0x61876c)}
    }
  }
}
export function microPose(pose: Pose, actor: Actor, world: NeighborhoodWorld, reduced: boolean) {
  if(reduced)return
  const e=world.neighborhood.event, active=e?.phase==='acting'&&e.participants.includes(actor.id)
  if(!active&&actor.behavior!=='idle')return
  const wave=Math.sin(actor.phase*3), slow=Math.sin(actor.phase*1.4), arm=pose.transforms['arm-right'], head=pose.transforms['head'], body=pose.transforms['body']
  switch(actor.id){
    case 'bluewhale':if(arm)arm.rotation+=wave*8;break
    case 'claude':if(head)head.rotation+=slow*4;break
    case 'gemini':if(head)head.y-=Math.max(0,wave)*5;break
    case 'gpt':if(arm)arm.rotation-=Math.max(0,wave)*10;break
    case 'grok':if(head)head.rotation+=wave*5;break
    case 'kimi':if(body)body.y+=slow*3;break
    case 'qwen':if(pose.transforms['arm-left'])pose.transforms['arm-left'].rotation+=slow*9;break
  }
  if(active)pose.expression='happy'
}

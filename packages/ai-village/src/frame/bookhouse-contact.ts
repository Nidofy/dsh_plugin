import { Rectangle, Sprite, Texture } from 'pixi.js'
import { PaperDoll } from '../art/paper-doll.ts'
import type { Character, Pose, Part } from '../art/types.ts'
import type { Actor, Point } from '../core/world.ts'
import type { BookhouseEvent } from '../core/bookhouse-state.ts'
import { bookhouseScene } from '../core/bookhouse-scene.ts'
import { bookhouseContactFrames, bookhouseSeatRecipes } from './bookhouse-contact-data.ts'

export type BookhousePose = 'none' | 'reading' | 'writing' | 'seated'
/** Presentation only: an event's two legal targets are not interchangeable furniture seats. */
export function bookhousePresentation(actor: Actor, point: Point, event: BookhouseEvent | null, dragging = false): BookhousePose {
  if (dragging) return 'none'
  const index=event?.participants.indexOf(actor.id)??-1
  if(event&&index>=0){
    const target=event.targets[index]
    if(event.phase==='approaching'||!target||Math.hypot(target.x-point.x,target.y-point.y)>.01)return 'none'
    if(event.stage===1&&Math.abs(point.y-328)<.01&&point.x>=90&&point.x<=194)return 'writing'
    if(event.stage===2&&Math.abs(point.y-270)<.01&&point.x>=64&&point.x<=140)return 'seated'
    return 'reading'
  }
  const hotspot=bookhouseScene.hotspots.find(h=>h.activity===actor.behavior&&Math.hypot(h.anchor.x-point.x,h.anchor.y-point.y)<.01
    &&(!actor.intent||actor.intent.furnitureId===h.id&&actor.intent.seat==='main'&&actor.intent.stage==='use'))
  return hotspot?.id==='bookcase'?'reading':hotspot?.id==='reading-desk'?'writing':hotspot?.id==='window-seat'?'seated':'none'
}
interface SeatRecipe {frame:readonly number[];hip:readonly number[];sole:readonly number[];visualSoleY:number;upperCutRatio:number;bodyLift?:number;soleOccluded?:boolean}

/** Owns Texture views only. Loader owns shared image sources and original identity textures. */
export class BookhouseContactRig {
  readonly character:Character
  readonly doll:PaperDoll
  readonly views:Texture[]=[]
  mode:BookhousePose='none'
  private readonly recipe:SeatRecipe|undefined
  constructor(readonly id:string, original:Character, borrowed:ReadonlyMap<string,Texture>, activityPrefix:string){
    this.character=structuredClone(original)
    this.recipe=(bookhouseSeatRecipes as Record<string,SeatRecipe>)[id]
    const textures=new Map(borrowed),atlas=borrowed.get('bookhouse/bookhouse-activity-atlas.png')
    if(!atlas)throw Error('MISSING_BOOKHOUSE_ACTIVITY_ATLAS')
    const addView=(key:string,texture:Texture,rect:readonly number[])=>{const view=new Texture({source:texture.source,frame:new Rectangle(texture.frame.x+rect[0]!,texture.frame.y+rect[1]!,rect[2]!,rect[3]!)});this.views.push(view);textures.set(key,view);return key}
    const sourcePart=(suffix:string)=>{const entry=bookhouseContactFrames.find(p=>p.id===id+'-'+suffix);if(!entry)throw Error('MISSING_BOOKHOUSE_PART');return {file:addView('bookhouse-part/'+suffix,atlas,entry.sourceRect),original:entry.originalFrame}}
    const part=(id:string,file:string,offset:[number,number],size:[number,number],z:number,pivot:[number,number]=[512,665]):Part=>({id,parent:'body',file,offset,size,pivot,z,mirror:'never'})
    const book=sourcePart('held-book'),blue=id==='bluewhale',claude=id==='claude'
    this.character.parts.push(part('held-book',book.file,[282,blue?557:id==='glm'?665:620],[460,460*book.original[3]/book.original[2]],blue?8:10,blue?[512,673]:[512,665]))
    if(blue||claude){
      const lower=sourcePart('seated-body'),upper=sourcePart('seated-waist'),[x,y,w,h]=lower.original,center=blue?628:618,k=45/h/.12
      this.character.parts.push(part('seated-body',lower.file,[512+(x-center)*k,952-45/.12],[w*k,45/.12],5),part('seated-waist',upper.file,[512+(x-center)*k,952-52/.12],[w*k,7/.12],5))
    }else{
      const s=this.recipe??{frame:[50,245,196,115],hip:[148,260],sole:[148,359],visualSoleY:250,upperCutRatio:125/271},g=(s.visualSoleY-225)/(s.sole[1]!-s.hip[1]!)/.12
      const rest=borrowed.get(activityPrefix+'rest-pose.png');if(!rest)throw Error('MISSING_BOOKHOUSE_REST')
      const file=addView('bookhouse-part/seated-body',rest,s.frame),[x,y,w,h]=s.frame
      this.character.parts.push(part('seated-body',file,[512+(x!-s.hip[0]!)*g,952-45/.12+(y!-s.hip[1]!)*g],[w!*g,h!*g],5))
    }
    if(!blue){
      const torsoPart=this.character.parts.find(p=>p.id==='torso')!,torso=borrowed.get(torsoPart.file!)!;const cut=claude?115:id==='gemini'?125:Math.round(torso.height*this.recipe!.upperCutRatio)
      const file=addView('bookhouse-part/seat-torso',torso,[0,0,torso.width,cut]);this.character.parts.push(part('seat-torso',file,[300,530],[424,345*cut/torso.height],3,[512,555]))
    }
    this.doll=new PaperDoll(this.character,textures)
  }
  prepare(pose:Pose,mode:BookhousePose):void{
    this.mode=mode
    if(mode!=='seated')return
    const lift=this.id==='bluewhale'?70:this.recipe?.bodyLift??130
    Object.assign(pose.transforms.body!,{y:-lift,rotation:0})
    pose.transforms['seated-body']!.y=lift
    if(pose.transforms['seated-waist'])pose.transforms['seated-waist'].y=lift
  }
  paint():void{
    const seated=this.mode==='seated',reading=seated||this.mode==='reading',n=this.doll.nodes
    n.get('held-book')!.visible=reading;n.get('seated-body')!.visible=seated
    if(n.has('seated-waist'))n.get('seated-waist')!.visible=seated
    if(reading)for(const id of['arm-left','arm-right'])n.get(id)!.visible=false
    if(seated)for(const id of['leg-left','leg-right'])n.get(id)!.visible=false
    if(this.id==='bluewhale'){n.get('skirt')!.visible=!seated;(n.get('torso')!.children[0] as Sprite).height=seated?85:170}
    else{n.get('seat-torso')!.visible=seated;n.get('torso')!.visible=!seated;if(this.id==='claude')n.get('ornament')!.visible=!seated}
  }
  inspect(){
    const root=this.doll.root,parent=root.parent,foot=parent?.toLocal(root.toGlobal({x:this.character.feet[0],y:this.character.feet[1]}))
    const sprite=this.doll.nodes.get('seated-body')!.children[0] as Sprite,s=this.recipe
    const hip=this.id==='gemini'?{x:98,y:15}:s?{x:s.hip[0]!-s.frame[0]!,y:s.hip[1]!-s.frame[1]!}:{x:sprite.texture.width/2,y:0}
    const sole=this.id==='gemini'?{x:98,y:114}:s?{x:s.sole[0]!-s.frame[0]!,y:s.sole[1]!-s.frame[1]!}:{x:sprite.texture.width/2,y:sprite.texture.height}
    const h=parent?.toLocal(sprite.toGlobal(hip)),f=parent?.toLocal(sprite.toGlobal(sole))
    return{mode:this.mode,projectedFeet:foot?[foot.x,foot.y]:null,hip:this.mode==='seated'&&h?[h.x,h.y]:null,visualSole:this.mode==='seated'&&f?[f.x,f.y]:null,soleOccluded:s?.soleOccluded??false}
  }
  destroy():void{this.doll.destroy();for(const view of this.views)view.destroy(false);this.views.length=0}
}

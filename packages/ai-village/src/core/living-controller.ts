import { cancelBookhouseStory } from './bookhouse-engine.ts'
import { isCharacterId } from './roster.ts'
import { WorldController, type PointerIntent } from './controller.ts'
import { cancelManualMove } from './manual-move.ts'

import { validateLivingWorld, regionScene, type LivingWorld } from './living-state.ts'
import { cancelTea, cancelPlay, stepLiving } from './living-engine.ts'
import { cancelCommunitySocial as cancelLifeSocial } from './community-life.ts'
import { actors, type Scene } from './world.ts'
export class LivingController extends WorldController<LivingWorld> {
  moveOutcome: 'arrived' | 'blocked' | null = null
  constructor(world:LivingWorld,readonly baseScene:Scene,changed:()=>void){super(world,regionScene(world,baseScene),changed)}
  syncScene(){this.scene=regionScene(this.world,this.baseScene)}
  override pointer(input: PointerIntent){
    const drag=this.drag,w=this.world
    // Selection is still allowed. A drag cannot implicitly cancel an important event.
    if(input.type==='up'&&drag?.id===input.id&&(drag.active||Math.hypot(input.css.x-drag.origin.x,input.css.y-drag.origin.y)>=5)){
      const participants=[...w.afternoon.active?.participants??[],...w.teaSquare.active?.participants??[],...w.bookhouse.active?.participants??[],...w.play.active?.participants??[],...w.activeEvent?.participants??[],...w.neighborhood.event?.participants??[]]
      if(participants.includes(drag.actorId)){this.cancelDrag();this.lastPlacement='story-blocked';return}
    }
    super.pointer(input)
  }
  override advance(seconds:number){
    if(this.pauseReasons.size||this.drag||!Number.isFinite(seconds)||seconds<0)return
    this.syncScene();this.accumulator+=Math.min(seconds,.1)
    while(this.accumulator>=1/30){const outcome=stepLiving(this.world,this.baseScene);if(outcome==='arrived'||outcome==='blocked')this.moveOutcome=outcome;this.accumulator-=1/30}
  }
  protected override placed(){
    const w=this.world,a=w.actor
    if(w.teaSquare.activity?.actorId===a.id)w.teaSquare.activity=null
    // Placement already assigned its new activity; discard only the old manual order.
    if(w.manualMove?.actorId===a.id)w.manualMove=null
    cancelLifeSocial(w,[a.id])
    if(w.bookhouse.active?.participants.includes(a.id))cancelBookhouseStory(w)
    if(w.play.active?.participants.includes(a.id)){const other=w.play.active.participants.filter(id=>id!==a.id);w.play.active=null;for(const id of other){const resident=actors(w).find(a=>a.id===id)!;resident.intent=null;resident.destination=null;resident.behavior='idle';resident.remaining=3}}
    const e=w.neighborhood.event
    if(e?.participants.includes(a.id)){const seat=e.seats[e.participants.indexOf(a.id)];if(!seat||a.intent?.furnitureId+'/'+a.intent?.seat!==seat)cancelTea(w)}
    const i=w.activeEvent?.participants.indexOf(a.id)??-1
    if(i>=0&&!(a.intent?.furnitureId==='eat'&&a.intent.seat===(i?'right':'left')))cancelTea(w)
  }
  override setCharacterPresent(id:unknown,present:boolean){
    if(!isCharacterId(id))return
    if(this.world.region.active!=='courtyard')return
    this.syncScene()
    if(!present&&this.world.manualMove?.actorId===id)cancelManualMove(this.world)
    if(!present&&actors(this.world).some(a=>a.id===id)&&this.world.companions.length&&this.world.region.returns.bookhouse)this.world.region.returns.bookhouse=this.world.region.returns.bookhouse.filter(p=>p.id!==id)
    if(!present){if(this.world.play.active?.participants.some(p=>p===id))cancelPlay(this.world);if([...this.world.activeEvent?.participants??[],...this.world.neighborhood.event?.participants??[]].some(p=>p===id))cancelTea(this.world);cancelLifeSocial(this.world)}
    if(!present&&this.world.region.returns['tea-square'])this.world.region.returns['tea-square']=this.world.region.returns['tea-square'].filter(p=>p.id!==id)
    super.setCharacterPresent(id,present)
  }
  override selectCharacter(id:unknown){
    if(!isCharacterId(id))return
    if((this.world.afternoon.active||this.world.teaSquare.active||this.world.play.active||this.world.activeEvent||this.world.neighborhood.event)&&!actors(this.world).some(a=>a.id===id))return
    if(!actors(this.world).some(a=>a.id===id)){
      cancelManualMove(this.world)
      if(this.world.region.active!=='courtyard')return
      cancelLifeSocial(this.world)
      if(this.world.region.returns.bookhouse)this.world.region.returns.bookhouse=this.world.region.returns.bookhouse.filter(p=>p.id!==this.world.actor.id)
    }
    if(!actors(this.world).some(a=>a.id===id)&&this.world.region.returns['tea-square'])this.world.region.returns['tea-square']=this.world.region.returns['tea-square'].filter(p=>p.id!==this.world.actor.id)
    super.selectCharacter(id)
  }
  override snapshot(){return validateLivingWorld(this.world,this.baseScene)}
}

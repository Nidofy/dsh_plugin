import { isCharacterId } from './roster.ts'
import { WorldController } from './controller.ts'

import { validateLivingWorld, regionScene, type LivingWorld } from './living-state.ts'
import { cancelTea, cancelPlay, stepLiving } from './living-engine.ts'
import { cancelLifeSocial } from './life-engine.ts'
import { actors, type Scene } from './world.ts'
export class LivingController extends WorldController<LivingWorld> {
  constructor(world:LivingWorld,readonly baseScene:Scene,changed:()=>void){super(world,regionScene(world,baseScene),changed)}
  syncScene(){this.scene=regionScene(this.world,this.baseScene)}
  override advance(seconds:number){
    if(this.pauseReasons.size||this.drag||!Number.isFinite(seconds)||seconds<0)return
    this.syncScene();this.accumulator+=Math.min(seconds,.1)
    while(this.accumulator>=1/30){stepLiving(this.world,this.baseScene);this.accumulator-=1/30}
  }
  protected override placed(){
    const w=this.world,a=w.actor
    cancelLifeSocial(w,[a.id])
    if(w.play.active?.participants.includes(a.id)){const other=w.play.active.participants.filter(id=>id!==a.id);w.play.active=null;for(const id of other){const resident=actors(w).find(a=>a.id===id)!;resident.intent=null;resident.destination=null;resident.behavior='idle';resident.remaining=3}}
    const e=w.neighborhood.event
    if(e?.participants.includes(a.id)){const seat=e.seats[e.participants.indexOf(a.id)];if(!seat||a.intent?.furnitureId+'/'+a.intent?.seat!==seat)cancelTea(w)}
    const i=w.activeEvent?.participants.indexOf(a.id)??-1
    if(i>=0&&!(a.intent?.furnitureId==='eat'&&a.intent.seat===(i?'right':'left')))cancelTea(w)
  }
  override setCharacterPresent(id:unknown,present:boolean){
    if(!isCharacterId(id))return
    if(this.world.region.active==='bookhouse')return
    this.syncScene()
    if(!present&&actors(this.world).some(a=>a.id===id)&&this.world.companions.length&&this.world.region.returns.bookhouse)this.world.region.returns.bookhouse=this.world.region.returns.bookhouse.filter(p=>p.id!==id)
    if(!present){if(this.world.play.active?.participants.some(p=>p===id))cancelPlay(this.world);if([...this.world.activeEvent?.participants??[],...this.world.neighborhood.event?.participants??[]].some(p=>p===id))cancelTea(this.world);cancelLifeSocial(this.world)}
    super.setCharacterPresent(id,present)
  }
  override selectCharacter(id:unknown){
    if(!isCharacterId(id))return
    if((this.world.play.active||this.world.activeEvent||this.world.neighborhood.event)&&!actors(this.world).some(a=>a.id===id))return
    if(!actors(this.world).some(a=>a.id===id)){
      if(this.world.region.active==='bookhouse')return
      cancelLifeSocial(this.world)
      if(this.world.region.returns.bookhouse)this.world.region.returns.bookhouse=this.world.region.returns.bookhouse.filter(p=>p.id!==this.world.actor.id)
    }
    super.selectCharacter(id)
  }
  override snapshot(){return validateLivingWorld(this.world,this.baseScene)}
}

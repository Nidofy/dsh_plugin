import { scene } from '../src/definitions.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { switchRegion } from '../src/core/region-engine.ts'
/** Unit-test setup through the same approved travel command. Not evidence of browser/native play. */
export function teaSquareFixture(seven=false){
 const c=new LivingController(createLivingWorld(scene),scene,()=>{})
 for(const id of seven?['claude','gemini','gpt','grok','kimi','seedance']:['claude','gemini'])c.setCharacterPresent(id,true)
 return switchRegion(c.snapshot(),scene,'tea-square')
}

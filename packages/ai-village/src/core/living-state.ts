import * as v14 from './living-state-v14.ts'
import type { HomeWorld } from './home-state.ts'
import type { Scene } from './world.ts'
import { validateLifeState } from './life-engine.ts'
import { blankAfternoon, validateAfternoon, type AfternoonState } from './afternoon-state.ts'
import { initialCommunityState, validateCommunityState, type CommunityState } from './community-life.ts'
import type { WorldCodec } from './migrations.ts'
export { blankPlay, isPlayId, idlePose, isRegionId } from './living-state-v14.ts'
export type { ParkedPose, PlayEvent, PlayMemory, PlayState, ManualMoveIntent, RegionId, RegionState } from './living-state-v14.ts'
export interface LivingWorld extends Omit<v14.LivingWorld,'schemaVersion'|'contentRevision'> {schemaVersion:15;contentRevision:11;afternoon:AfternoonState;community:CommunityState}
export function requireCourtyard(w:LivingWorld){if(w.region.active!=='courtyard')throw Error('COURTYARD_REQUIRED')}
function previous(w:LivingWorld):v14.LivingWorld {
 const {afternoon:_afternoon,community:_community,...rest}=w
 return {...rest,schemaVersion:14,contentRevision:10,life:w.region.active==='tea-square'?{social:null}:w.life}
}
export function regionScene(w:LivingWorld,base:Scene){return v14.regionScene(previous(w),base)}
export function homeProjection(w:LivingWorld):HomeWorld{return v14.homeProjection(previous(w))}
export function withLiving(base:HomeWorld,source?:LivingWorld):LivingWorld {
 const old=v14.withLiving(base,source?previous(source):undefined)
 return {...old,schemaVersion:15,contentRevision:11,afternoon:structuredClone(source?.afternoon??blankAfternoon()),community:structuredClone(source?.community??initialCommunityState(old.ticks))}
}
export function validateLivingWorld(value:unknown,base:Scene):LivingWorld {
 const w=value as LivingWorld
 if(!w||w.schemaVersion!==15||w.contentRevision!==11)throw Error('UNSUPPORTED_WORLD_VERSION')
 if(new TextEncoder().encode(JSON.stringify(w)).length>48*1024)throw Error('SAVE_TOO_LARGE')
 const old=v14.validateLivingWorld(previous(w),base)
 const result:LivingWorld={...old,schemaVersion:15,contentRevision:11,life:validateLifeState(w.life,old,v14.regionScene(old,base)),afternoon:w.afternoon,community:w.community}
 if(result.region.active==='tea-square'&&result.life.social&&(result.teaSquare.active||result.teaSquare.activity||result.manualMove))throw Error('INVALID_LIFE_STATE')
 result.afternoon=validateAfternoon(w.afternoon,result)
 result.community=validateCommunityState(w.community,result)
 return result
}
export function createLivingWorld(base:Scene):LivingWorld{return migrateLivingWorld(v14.createLivingWorld(base),base)}
export function migrateLivingWorld(value:unknown,base:Scene):LivingWorld {
 if((value as LivingWorld)?.schemaVersion===15)return validateLivingWorld(value,base)
 const old=v14.migrateLivingWorld(value,base)
 return validateLivingWorld({...old,schemaVersion:15,contentRevision:11,afternoon:blankAfternoon(),community:initialCommunityState(old.ticks)},base)
}
export function livingWorldCodec(base:Scene):WorldCodec<LivingWorld>{return {decode:v=>migrateLivingWorld(v,base),validate:v=>validateLivingWorld(v,base),needsUpgrade:v=>(v as LivingWorld)?.schemaVersion!==15}}

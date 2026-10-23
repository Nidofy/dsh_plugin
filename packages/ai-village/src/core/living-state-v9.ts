import { migrateLivingWorld as migrateV8 } from './living-state-v8.ts'
import { validTableHistory, tableResult } from './table-game.ts'
import { createHomeWorld, validateHomeWorld, homeScene, type HomeWorld } from './home-state.ts'
import { stories, type StoryId } from './neighborhood-catalog.ts'
import { actors, walkable, reachable, type Scene, type Point } from './world.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { uuid, type BellSlot } from './content-state.ts'
import { playDefinitions, type PlayId, type PlayDecorationId } from './play-catalog-v6.ts'
import { validateLifeState, type LifeState } from './life-engine.ts'
import type { WorldCodec } from './migrations.ts'

export interface PlayMemory { id: StoryId | PlayId; eventId: string; participants: CharacterId[]; completedTick: number; count: number }
export interface PlayEvent {
  id: string; definitionId: PlayId; participants: CharacterId[]; stage: number
  phase: 'approaching' | 'observing' | 'ready'; remainingTicks: number; approachRemainingTicks: number
  target: string | null; choices: string[]; board: number[]; targets: Point[]; routes: Point[][]
}
export interface PlayState { encounterWindow: number; tableMode: 'dining' | 'game'; active: PlayEvent | null; decorations: Record<PlayDecorationId, BellSlot | null>; nextTick: number; lastEventId: string | null }
export interface LivingWorld extends Omit<HomeWorld, 'schemaVersion' | 'simulationRulesVersion' | 'contentRevision' | 'neighborhood'> {
  schemaVersion: 9; simulationRulesVersion: 4; contentRevision: 6
  neighborhood: Omit<HomeWorld['neighborhood'], 'memories'> & { memories: PlayMemory[] }
  play: PlayState; life: LifeState
}
export const blankPlay = (): PlayState => ({ encounterWindow: -1, tableMode: 'dining', active: null, decorations: Object.fromEntries(playDefinitions.map(d => [d.reward, null])) as PlayState['decorations'], nextTick: 0, lastEventId: null })
export const isPlayId = (id: unknown): id is PlayId => playDefinitions.some(d => d.id === id)
/** Frozen v6 sees only its own content. No caller may publish this projection as current state. */
export function homeProjection(w: LivingWorld): HomeWorld {
  const { play: _play, life: _life, ...base } = w
  return { ...base, schemaVersion: 6, simulationRulesVersion: 3, contentRevision: 3,
    neighborhood: { ...base.neighborhood, memories: base.neighborhood.memories.filter(m => stories.some(s => s.id === m.id)) as HomeWorld['neighborhood']['memories'] } }
}
export function withLiving(base: HomeWorld, source?: LivingWorld): LivingWorld {
  return { ...base, schemaVersion: 9, simulationRulesVersion: 4, contentRevision: 6,
    neighborhood: { ...base.neighborhood, memories: structuredClone([...base.neighborhood.memories, ...source?.neighborhood.memories.filter(m => isPlayId(m.id)) ?? []]).sort((a,b) => a.completedTick-b.completedTick) },
    play: structuredClone(source?.play ?? blankPlay()), life: structuredClone(source?.life ?? { social: null }) }
}
const fail = (): never => { throw Error('INVALID_LIVING_WORLD') }
function exact(value: unknown, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value,k))) return fail()
  return value as Record<string, any>
}
const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max
export function validateLivingWorld(value: unknown, base: Scene): LivingWorld {
  const w = value as LivingWorld
  if (!w || w.schemaVersion !== 9 || w.sceneVersion !== 3 || w.simulationRulesVersion !== 4 || w.contentRevision !== 6) throw Error('UNSUPPORTED_WORLD_VERSION')
  if (new TextEncoder().encode(JSON.stringify(w)).length > 48*1024) throw Error('SAVE_TOO_LARGE')
  // Validate the entire closed v6 structure, including unknown top-level fields.
  if (!Array.isArray(w.neighborhood?.memories) || w.neighborhood.memories.length > stories.length + playDefinitions.length) return fail()
  const old = validateHomeWorld(homeProjection(w), base), scene = homeScene(base, old.neighborhood.layout, old.home)
  const events = new Set([...old.journal.map(m=>m.eventId), ...old.neighborhood.memories.map(m=>m.eventId)]), ids = new Set<string>()
  let previous = 0
  for (const memory of w.neighborhood.memories) {
    const m = exact(memory, ['id','eventId','participants','completedTick','count'])
    if (ids.has(m.id) || !integer(m.completedTick,previous,w.ticks)) return fail()
    ids.add(m.id); previous = m.completedTick
    if (stories.some(s=>s.id===m.id)) continue
    const d = playDefinitions.find(d=>d.id===m.id)
    if (!d || !uuid(m.eventId) || events.has(m.eventId) || !Array.isArray(m.participants) || m.participants.length !== d.count || !m.participants.every(isCharacterId)
      || new Set(m.participants).size !== d.count || !integer(m.count,1,1000000) || (d.id==='lost-rice' && m.participants[0]!=='bluewhale')) return fail()
    events.add(m.eventId)
  }
  const p = exact(w.play,['encounterWindow','tableMode','active','decorations','nextTick','lastEventId'])
  if (!integer(p.encounterWindow,-1,Math.floor(w.ticks/2700)) || !['dining','game'].includes(p.tableMode)) return fail()
  if (!integer(p.nextTick,0,w.ticks+900) || (p.lastEventId!==null&&!uuid(p.lastEventId)) || (w.neighborhood.memories.some(m=>isPlayId(m.id)) !== (p.lastEventId!==null))) return fail()
  const decorations = exact(p.decorations,playDefinitions.map(d=>d.reward))
  for (const d of playDefinitions) if (decorations[d.reward] !== null && (!['window','door','wall'].includes(decorations[d.reward]) || !ids.has(d.id))) return fail()
  if (p.active !== null) {
    const e = exact(p.active,['id','definitionId','participants','stage','phase','remainingTicks','approachRemainingTicks','target','choices','board','targets','routes'])
    const d = playDefinitions.find(d=>d.id===e.definitionId)
    if (!d || !uuid(e.id) || events.has(e.id) || e.id===p.lastEventId || e.id===old.progress.lastCompletedEventId || e.id===old.neighborhood.lastEventId || old.activeEvent || old.neighborhood.event
      || !Array.isArray(e.participants) || e.participants.length!==d.count || new Set(e.participants).size!==d.count || !e.participants.every((id:unknown)=>isCharacterId(id)&&actors(old).some(a=>a.id===id))
      || (d.id==='lost-rice'&&e.participants[0]!=='bluewhale') || !integer(e.stage,0,d.stages.length-1)
      || !['approaching','observing','ready'].includes(e.phase) || !integer(e.remainingTicks,0,d.stages[e.stage]!.observeTicks) || !integer(e.approachRemainingTicks,0,1800)
      || e.target!==d.stages[e.stage]!.target
      || !Array.isArray(e.targets) || e.targets.length!==d.count || !Array.isArray(e.routes) || e.routes.length!==d.count) return fail()
    if (d.kind==='event' && p.encounterWindow<0) return fail()
    if (d.id==='table-game') {
      if (p.tableMode!=='game' || !validTableHistory(e.board,e.choices,e.participants[1]) || (e.stage===1)!==!!tableResult(e.board)) return fail()
      const seats=scene.hotspots.filter(h=>h.id==='eat').map(h=>h.anchor)
      if(e.targets.length!==2 || e.targets.some((p:Point,i:number)=>p.x!==seats[i]?.x||p.y!==seats[i]?.y)) return fail()
      if(actors(old).some(a=>!e.participants.includes(a.id)&&(a.intent?.furnitureId==='eat'||seats.some(p=>Math.hypot(p.x-a.position.x,p.y-a.position.y)<24))))return fail()
    } else {
      if (!Array.isArray(e.choices) || e.choices.length>4 || e.choices.some((v:unknown)=>!['rice','tea','fruit','hint'].includes(v as string))
        || !Array.isArray(e.board) || e.board.length!==3 || e.board.some((n:unknown)=>!integer(n,-1,2)) || new Set(e.board.filter((n:number)=>n>=0)).size!==e.board.filter((n:number)=>n>=0).length) return fail()
    if (d.id==='find-whale' ? e.choices.some((v:string)=>v!=='hint')||e.choices.length>2 : d.id==='snack-table' ? e.choices.some((v:string)=>!['rice','tea','fruit'].includes(v))||e.choices.length>3||(e.stage===1&&e.choices.length!==3) : e.choices.length!==0) return fail()
    if (d.id==='tidy-desk' ? e.stage===1&&!e.board.every((item:number,slot:number)=>item===slot) : e.board.some((item:number)=>item!==-1)) return fail()
    }
    e.targets.forEach((point:unknown,i:number)=>{
      const target = exact(point,['x','y']) as unknown as Point, actor = actors(old).find(a=>a.id===e.participants[i])!
      if (!walkable(scene,target) || e.targets.some((p:Point,j:number)=>j!==i && Math.hypot(p.x-target.x,p.y-target.y)<24) || !Array.isArray(e.routes[i]) || e.routes[i].length>9 || actor.intent) fail()
      let last = actor.position
      for (const raw of e.routes[i]) { const point = exact(raw,['x','y']) as unknown as Point; if(!walkable(scene,point)||!reachable(scene,last,point))fail(); last=point }
      if (e.routes[i].length) { const end=e.routes[i].at(-1); if(end.x!==target.x||end.y!==target.y||actor.behavior!=='walk'||JSON.stringify(actor.destination)!==JSON.stringify(e.routes[i][0]))fail() }
      else if(Math.hypot(actor.position.x-target.x,actor.position.y-target.y)>0.01||actor.destination!==null||actor.behavior!=='idle')fail()
      if (e.phase!=='approaching' && (Math.hypot(actor.position.x-target.x,actor.position.y-target.y)>0.01 || actor.behavior!=='idle' || actor.destination!==null)) fail()
    })
    if(e.phase==='ready'&&e.remainingTicks!==0)fail()
  }
  const canonical = withLiving(old,w)
  canonical.life = validateLifeState(w.life, canonical, scene)
  if ((canonical.play.active || canonical.activeEvent || canonical.neighborhood.event) && canonical.life.social) return fail()
  return canonical
}
export function createLivingWorld(base: Scene): LivingWorld { return withLiving(createHomeWorld(base)) }
export function migrateLivingWorld(value: unknown, base: Scene): LivingWorld {
  if ((value as LivingWorld)?.schemaVersion===9) return validateLivingWorld(value,base)
  const old = migrateV8(value,base)
  const upgraded = { ...old, schemaVersion:9, contentRevision:6, play:{...old.play,encounterWindow:-1,decorations:{...old.play.decorations,'message-board':null,'leaf-pot':null}} }
  return validateLivingWorld(upgraded,base)
}
export function livingWorldCodec(base: Scene): WorldCodec<LivingWorld> {
  return {decode:v=>migrateLivingWorld(v,base),validate:v=>validateLivingWorld(v,base),needsUpgrade:v=>(v as LivingWorld)?.schemaVersion!==9}
}

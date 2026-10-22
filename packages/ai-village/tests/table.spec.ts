import { expect, it } from 'vitest'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scene } from '../src/definitions.ts'
import { blankTableBoard, tableResult, tableRound, validTableHistory } from '../src/core/table-game.ts'
import { createLivingWorld as createV7, livingWorldCodec as codecV7 } from '../src/core/living-state-v7.ts'
import { migrateLivingWorld, validateLivingWorld, livingWorldCodec, type LivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { startPlay, playAction, stepLiving, setTableMode, cancelPlay, arrangeHome, inviteTea, cancelTea } from '../src/core/living-engine.ts'
import { homeScene } from '../src/core/home-state.ts'
import { displayGameBoard, tableBoardGeometry, tableCellAt } from '../src/core/table-geometry.ts'
import { characterIds } from '../src/core/roster.ts'
import { actors, available } from '../src/core/world.ts'
import { validUIInput } from '../src/core/frame-protocol.ts'
import { SaveStore } from '../src/host/save-store.ts'

function ready(w: LivingWorld) {
  for(let i=0;i<1900&&w.play.active?.phase!=='ready';i++) {
    const before=actors(w).map(a=>({...a.position}));stepLiving(w,scene)
    actors(w).forEach((a,j)=>{expect(available(w,a.position,a.id)).toBe(true);expect(Math.hypot(a.position.x-before[j]!.x,a.position.y-before[j]!.y)).toBeLessThanOrEqual(17/30+1e-6)})
  }
  expect(w.play.active?.phase).toBe('ready');return validateLivingWorld(w,scene)
}
const token = (w:LivingWorld) => `${w.play.active!.id}:${w.play.active!.stage}:${w.play.active!.choices.length}`
function world(position:0|1=0) {const c=new LivingController(migrateLivingWorld(createV7(scene),scene),scene,()=>{});c.setCharacterPresent('claude',true);c.world.home.positions.eat=position;return setTableMode(c.snapshot(),scene,'game')}

it('replays every reachable human branch for seven deterministic opponents without illegal moves or extra turns',()=>{
  for(const resident of characterIds) {
    let terminal=0
    function visit(board:number[],history:string[]) {
      expect(validTableHistory(board,history,resident)).toBe(true)
      if(tableResult(board)){terminal++;expect(()=>tableRound(board,0,resident)).toThrow();return}
      board.forEach((v,i)=>{if(v!==-1)return;const before=[...board],next=tableRound(board,i,resident)
        expect(board).toEqual(before);expect(next.choices[0]).toBe(String(i));expect(new Set([...history,...next.choices]).size).toBe(history.length+next.choices.length)
        visit(next.board,[...history,...next.choices])
      })
    }
    visit(blankTableBoard(),[]);expect(terminal).toBeGreaterThan(20)
  }
  expect(validTableHistory([0,0,0,1,1,-1,-1,-1,-1],['0','3','1','4','2'],'claude')).toBe(false)
})
it.each([0,1] as const)('binds the game to two real seats, shared geometry, input and confirmed completion at anchor %s',position=>{
  let w=world(position);const geometry=homeScene(scene,w.neighborhood.layout,w.home),before=structuredClone(geometry)
  const boardGeometry=tableBoardGeometry(w.home);for(const cell of boardGeometry.cells)expect(tableCellAt(w.home,cell.center)).toBe(cell.index)
  expect(boardGeometry.rect.x).toBe(position?135:189)
  w=ready(startPlay(w,scene,'table-game',['bluewhale','claude'],crypto.randomUUID()))
  expect(w.play.active!.targets).toEqual(geometry.hotspots.filter(h=>h.id==='eat').map(h=>h.anchor))
  const firstToken=token(w),rng=w.rng,first=structuredClone(w)
  w=playAction(w,scene,'move','0',firstToken);expect(first.play.active!.choices).toEqual([]);expect(w.play.active!.choices).toHaveLength(2)
  expect(()=>playAction(ready(w),scene,'move','1',firstToken)).toThrow('STALE_PLAY_ACTION')
  expect(()=>setTableMode(w,scene,'dining')).toThrow('EVENT_ACTIVE');expect(()=>arrangeHome(w,scene,w.home,w.neighborhood.layout,w.home.revision)).toThrow('EVENT_ACTIVE')
  while(w.play.active!.stage===0){w=ready(w);const copy=JSON.stringify(w);expect(()=>playAction(w,scene,'move','0',token(w))).toThrow('INVALID_TABLE_MOVE');expect(JSON.stringify(w)).toBe(copy);w=playAction(w,scene,'move',String(w.play.active!.board.indexOf(-1)),token(w))}
  expect(w.neighborhood.memories).toEqual([]);expect(tableResult(w.play.active!.board)).not.toBeNull();w=ready(w)
  const cold=validateLivingWorld(JSON.parse(JSON.stringify(w)),scene);expect(cold).toEqual(w)
  const finalToken=token(w);w=playAction(w,scene,'finish',undefined,finalToken);expect(w.neighborhood.memories[0]!.id).toBe('table-game');expect(w.neighborhood.memories[0]!.count).toBe(1)
  expect(w.rng).toBe(rng);expect(()=>playAction(w,scene,'finish',undefined,finalToken)).toThrow('STALE_PLAY_ACTION');expect(homeScene(scene,w.neighborhood.layout,w.home)).toEqual(before)
})
it('pauses both marks, rejects forged board/history and cancels on valid departure or drag',()=>{
  let w=ready(startPlay(world(),scene,'table-game',['bluewhale','claude'],crypto.randomUUID()))
  w=playAction(w,scene,'move','0',token(w));const c=new LivingController(w,scene,()=>{})
  c.pause('hidden',true);c.pause('user',true);const before=c.snapshot();c.advance(.1);expect(c.snapshot()).toEqual(before);c.pause('hidden',false);c.advance(.1);expect(c.snapshot()).toEqual(before)
  const forged=structuredClone(w);forged.play.active!.board[8]=1;expect(()=>validateLivingWorld(forged,scene)).toThrow()
  c.setCharacterPresent('claude',false);expect(c.world.play.active).toBeNull();expect(c.world.neighborhood.memories).toEqual([])
  const d=new LivingController(ready(startPlay(world(),scene,'table-game',['bluewhale','claude'],crypto.randomUUID())),scene,()=>{}),a=d.world.actor
  d.pointer({type:'down',id:1,point:{x:a.position.x,y:a.position.y-35},css:{x:100,y:100}})
  d.pointer({type:'move',id:1,point:{x:60,y:385},css:{x:180,y:200}});d.pointer({type:'up',id:1,point:{x:60,y:385},css:{x:180,y:200}})
  expect(d.lastPlacement).toBe('accepted')
  expect(d.world.play.active).toBeNull();expect(d.world.neighborhood.memories).toEqual([])
})
it('migrates v7 without changing its original bytes or old codec, preserving upgrade backup after repeated saves',async()=>{
  const old=createV7(scene),raw=JSON.stringify(old),next=migrateLivingWorld(old,scene)
  expect(next.schemaVersion).toBe(8);expect(next.play.tableMode).toBe('dining');expect(JSON.stringify(old)).toBe(raw);expect(()=>codecV7(scene).validate(next)).toThrow()
  const root=await mkdtemp(join(tmpdir(),'village-table-')),legacy=await SaveStore.open(root,scene,codecV7(scene));await legacy.save(0,old,crypto.randomUUID())
  const pointer=await readFile(join(legacy.directory,'current.json'),'utf8'),name=JSON.parse(pointer).snapshot,bytes=await readFile(join(legacy.directory,'snapshots',name))
  const store=await SaveStore.open(root,scene,livingWorldCodec(scene));let saved=(await store.read())!;expect(saved.world).toEqual(next)
  for(let i=0;i<42;i++)saved=await store.save(saved.revision,saved.world,crypto.randomUUID())
  expect(await readFile(join(store.directory,'snapshots',name))).toEqual(bytes)
  const upgrades=(await readdir(store.directory)).filter(n=>n.startsWith('upgrade-v1-'));expect(await Promise.all(upgrades.map(n=>readFile(join(store.directory,n),'utf8')))).toContain(pointer)
})
it('keeps a canceled board out of memories and refuses non-closed frame commands',()=>{
  const w=ready(startPlay(world(),scene,'table-game',['bluewhale','claude'],crypto.randomUUID()));cancelPlay(w);expect(w.neighborhood.memories).toEqual([])
  const t=crypto.randomUUID()+':0:2',input={kind:'table-move',token:t,cell:3,point:{x:201,y:344}}
  expect(validUIInput(input)).toBe(true)
  for(const bad of [{...input,cell:9},{...input,token:t+':0'},{...input,point:{x:Infinity,y:2}},{...input,extra:1}])expect(validUIInput(bad)).toBe(false)
})
it('preserves an in-progress v7 story through migration without consuming ticks or adding new rewards',()=>{
  const current=startPlay(migrateLivingWorld(createV7(scene),scene),scene,'find-whale',['bluewhale'],crypto.randomUUID())
  stepLiving(current,scene)
  const old:any=structuredClone(current);old.schemaVersion=7;old.contentRevision=4;delete old.play.tableMode;delete old.play.decorations['table-stones']
  const checked=codecV7(scene).validate(old),raw=JSON.stringify(checked),next=migrateLivingWorld(checked,scene)
  expect(next.play.active).toEqual(checked.play.active);expect(next.actor).toEqual(checked.actor);expect(next.ticks).toBe(checked.ticks)
  expect(next.neighborhood.memories).toEqual(checked.neighborhood.memories);expect(next.play.decorations['table-stones']).toBeNull();expect(JSON.stringify(checked)).toBe(raw)
})
it('never takes an eat seat already reserved by an approaching non-participant',()=>{
  const c=new LivingController(world(),scene,()=>{});c.setCharacterPresent('gpt',true)
  for(let i=0;i<10000&&!actors(c.world).some(a=>a.id==='gpt'&&a.intent?.furnitureId==='eat'&&a.intent.stage==='approach');i++)stepLiving(c.world,scene)
  const guest=actors(c.world).find(a=>a.id==='gpt')!;expect(guest.intent?.furnitureId).toBe('eat');expect(guest.intent?.stage).toBe('approach')
  const before=c.snapshot();expect(()=>startPlay(c.world,scene,'table-game',['bluewhale','claude'],crypto.randomUUID())).toThrow('FURNITURE_OCCUPIED');expect(c.snapshot()).toEqual(before)
})
it('temporarily clears the board for real autonomous meals without changing rules4 decisions or RNG',()=>{
  const game=world(),dining=structuredClone(game);dining.play.tableMode='dining'
  let approaches=0,meals=0,free=0
  expect(displayGameBoard(game)).toBe(true)
  for(let i=0;i<9000;i++){
    stepLiving(game,scene);stepLiving(dining,scene)
    const residents=actors(game),reserved=residents.some(a=>a.intent?.furnitureId==='eat'),eating=residents.some(a=>a.behavior==='eat')
    if(residents.some(a=>a.intent?.furnitureId==='eat'&&a.intent.stage==='approach'))approaches++
    if(eating)meals++
    if(reserved||eating)expect(displayGameBoard(game)).toBe(false)
    else {free++;expect(displayGameBoard(game)).toBe(true)}
    expect(displayGameBoard(dining)).toBe(false)
    if(i%120===0){
      expect(game.rng).toBe(dining.rng);expect(game.ticks).toBe(dining.ticks);expect(actors(game)).toEqual(actors(dining));expect(game.life).toEqual(dining.life)
      const before=JSON.stringify(game);displayGameBoard(game);expect(JSON.stringify(game)).toBe(before)
    }
  }
  expect(approaches).toBeGreaterThan(0);expect(meals).toBeGreaterThan(0);expect(free).toBeGreaterThan(0)
  expect({...game,play:{...game.play,tableMode:'dining'}}).toEqual(dining)
})
it.each(['rice','tea'] as const)('keeps old %s gatherings available and hides the board throughout their actual approach and meal',food=>{
  const game=world(),dining=structuredClone(game);dining.play.tableMode='dining';const id=crypto.randomUUID()
  const gathered=inviteTea(game,scene,['bluewhale','claude'],food,id),oldUse=inviteTea(dining,scene,['bluewhale','claude'],food,id)
  expect(gathered.play.tableMode).toBe('game');expect(displayGameBoard(gathered)).toBe(false)
  for(let i=0;i<1800&&gathered.activeEvent?.phase!=='talking';i++){
    stepLiving(gathered,scene);stepLiving(oldUse,scene);expect(displayGameBoard(gathered)).toBe(false)
  }
  expect(gathered.activeEvent?.phase).toBe('talking');expect(actors(gathered).every(a=>a.behavior==='eat')).toBe(true)
  expect({...gathered,play:{...gathered.play,tableMode:'dining'}}).toEqual(oldUse)
  cancelTea(gathered);expect(displayGameBoard(gathered)).toBe(true);expect(gathered.play.tableMode).toBe('game')
})
it('clears the board for an eat-target story, restores it away from the table, and keeps a real three-in-a-row session visible',()=>{
  let story=startPlay(world(),scene,'lost-rice',['bluewhale','claude'],crypto.randomUUID())
  expect(story.play.active!.target).toBe('eat');expect(actors(story).every(a=>a.intent===null)).toBe(true)
  expect(displayGameBoard(story)).toBe(false);story=ready(story);expect(displayGameBoard(story)).toBe(false)
  story=playAction(story,scene,'talk',undefined,`${story.play.active!.id}:0`)
  expect(story.play.active!.target).toBe('work');expect(displayGameBoard(story)).toBe(true)
  const snack=startPlay(world(),scene,'snack-table',['bluewhale','claude'],crypto.randomUUID())
  expect(displayGameBoard(snack)).toBe(false)
  let match=startPlay(world(),scene,'table-game',['bluewhale','claude'],crypto.randomUUID())
  expect(match.play.active!.target).toBe('eat');expect(displayGameBoard(match)).toBe(true)
  match=ready(match);expect(displayGameBoard(match)).toBe(true)
  const rng=match.rng;match=playAction(match,scene,'move','0',token(match))
  expect(displayGameBoard(match)).toBe(true);expect(match.rng).toBe(rng)
})

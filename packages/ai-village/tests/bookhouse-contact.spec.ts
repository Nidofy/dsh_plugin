import { describe,it,expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Container,Texture,TextureSource,Sprite } from 'pixi.js'
import { BookhouseContactRig,bookhousePresentation } from '../src/frame/bookhouse-contact.ts'
import { BookhouseArt } from '../src/frame/bookhouse-art.ts'
import { bookhouseLayers } from '../src/frame/bookhouse-contact-data.ts'
import { samplePose } from '../src/art/animation.ts'
import { bookhouseScene } from '../src/core/bookhouse-scene.ts'
import { createWorld,actors } from '../src/core/world.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { startBookhouseStory,stepBookhouseStory,bookhouseStoryAction } from '../src/core/bookhouse-engine.ts'
import { scene } from '../src/definitions.ts'
import type { Character,AnimationSet } from '../src/art/types.ts'
const root=resolve(import.meta.dirname,'..'),ids=['bluewhale','claude','gemini','gpt','grok','kimi','qwen','seedance','glm','minimax','llama','mistral']
function texture(width:number,height:number){return new Texture({source:new TextureSource({width,height})})}
function fixture(id:string){
 const dir=resolve(root,'assets/characters',id),character=JSON.parse(readFileSync(resolve(dir,'character.json'),'utf8')) as Character,animations=JSON.parse(readFileSync(resolve(dir,'animations.json'),'utf8')) as AnimationSet,textures=new Map<string,Texture>()
 for(const p of character.parts)for(const file of [p.file,...Object.values(p.expressions??{})])if(file&&!textures.has(file)){const b=readFileSync(resolve(dir,file));textures.set(file,texture(b.readUInt32BE(16),b.readUInt32BE(20)))}
 const rest=readFileSync(id==='bluewhale'?resolve(root,'assets/scenes/courtyard/rest-pose.png'):resolve(dir,'parts/rest-pose.png'));textures.set('activity/rest-pose.png',texture(rest.readUInt32BE(16),rest.readUInt32BE(20)))
 textures.set('bookhouse/bookhouse-activity-atlas.png',texture(1024,640));return{character,animations,textures}
}
describe('approved bookhouse contact integration',()=>{
 it.each(ids)('%s retains identity, projected feet and natural seat contacts across phases and tears down only owned views',id=>{
  const {character,animations,textures}=fixture(id),before=JSON.stringify(character),rig=new BookhouseContactRig(id,character,textures,'activity/'),parent=new Container();parent.addChild(rig.doll.root)
  for(const time of[0,.4,1.4,3.25]){
   const pose=samplePose(rig.character,animations.actions.idle,time);rig.prepare(pose,'seated');rig.doll.apply(pose);const s=108/character.visibleHeight;rig.doll.root.scale.set(s);rig.doll.root.position.set(92-character.feet[0]*s,270-character.feet[1]*s);rig.paint()
   const p=rig.inspect();expect(p.projectedFeet![0]).toBeCloseTo(92);expect(p.projectedFeet![1]).toBeCloseTo(270);expect(p.hip![0]).toBeCloseTo(92);expect(p.hip![1]).toBeCloseTo(225)
   expect(p.visualSole![1]).toBeCloseTo(['bluewhale','claude'].includes(id)?270:id==='seedance'?248:id==='mistral'?239.4:250)
   expect(p.soleOccluded).toBe(id==='mistral');expect(rig.doll.nodes.get('held-book')!.visible).toBe(true)
  }
  const pose=samplePose(rig.character,animations.actions.idle,0);rig.prepare(pose,'none');rig.doll.apply(pose);rig.paint();expect(rig.doll.nodes.get('seated-body')!.visible).toBe(false);expect(rig.doll.nodes.get('held-book')!.visible).toBe(false);expect(rig.doll.nodes.get('torso')!.visible).toBe(true)
  if(id==='bluewhale')expect((rig.doll.nodes.get('torso')!.children[0] as Sprite).height).toBeCloseTo(170)
  expect(JSON.stringify(character)).toBe(before);const views=[...rig.views];rig.destroy();expect(views.every(t=>t.destroyed)).toBe(true);expect([...textures.values()].every(t=>!t.destroyed&&!t.source.destroyed)).toBe(true);for(const t of textures.values())t.destroy(true);parent.destroy()
 })
 it('ordinary activities require their real use footpoint, and dragging cancels contact immediately',()=>{
  for(const h of bookhouseScene.hotspots){const a=createWorld(bookhouseScene).actor;a.behavior=h.activity!;a.position={...h.anchor};a.intent={furnitureId:h.id,seat:'main',activity:h.activity!,stage:'use',route:[],expires:200};expect(bookhousePresentation(a,a.position,null)).toBe(h.id==='bookcase'?'reading':h.id==='reading-desk'?'writing':'seated');expect(bookhousePresentation(a,a.position,null,true)).toBe('none');expect(bookhousePresentation(a,{x:a.position.x+2,y:a.position.y},null)).toBe('none');a.intent.stage='approach';expect(bookhousePresentation(a,a.position,null)).toBe('none')}
 })
 it.each(['reading','puzzle'] as const)('real %s lifecycle selects matching stage poses without mutating world or seating unsupported targets',kind=>{
  const c=new LivingController(createLivingWorld(scene),scene,()=>{});c.setCharacterPresent('claude',true);let w=startBookhouseStory(switchRegion(c.world,scene,'bookhouse'),scene,'claude',crypto.randomUUID(),kind)
  for(let stage=0;stage<3;stage++){
   for(const a of actors(w))expect(bookhousePresentation(a,a.position,w.bookhouse.active)).toBe('none')
   for(let tick=0;tick<4000&&w.bookhouse.active!.phase!=='ready';tick++)stepBookhouseStory(w)
   expect(w.bookhouse.active!.phase).toBe('ready');const before=JSON.stringify(w)
   for(const a of actors(w))expect(bookhousePresentation(a,a.position,w.bookhouse.active)).toBe(stage===0?'reading':stage===1?'writing':'seated')
   expect(JSON.stringify(w)).toBe(before)
   if(stage===2){const e=structuredClone(w.bookhouse.active!),a=structuredClone(w.actor);a.position={x:92,y:302};e.targets[0]=a.position;expect(bookhousePresentation(a,a.position,e)).toBe('reading')}
   const e=w.bookhouse.active!
   if(kind==='puzzle'&&stage===1){for(let slot=0;slot<3;slot++)w=bookhouseStoryAction(w,scene,`${e.id}:1`,`${slot}:${slot}`)}
   else w=bookhouseStoryAction(w,scene,`${e.id}:${e.stage}`,kind==='reading'&&stage===0?'light':undefined)
  }
  expect((kind==='reading'?w.bookhouse.memory:w.bookhouse.puzzleMemory)?.count).toBe(1);expect(bookhousePresentation(w.actor,w.actor.position,w.bookhouse.active)).toBe('none')
 })
 it('approved scene atlas installs all roles, gives both story writers paper, and releases no borrowed image source',()=>{
  const borrowed=texture(1024,968),parent=new Container(),art=new BookhouseArt(parent,{textures:new Map([['bookhouse/bookhouse-scene-atlas.png',borrowed]]),layers:bookhouseLayers,residentContacts:true})
  expect(art.artwork).toBe('raster');const a=createWorld(bookhouseScene).actor,b={...a,id:'claude' as const};art.paint([{actor:a,point:{x:142,y:328},presentation:'writing'},{actor:b,point:{x:174,y:328},presentation:'writing'}],0,false)
  const papers=parent.children.filter(n=>n.label.startsWith('bookhouse-writing-paper-'));expect(papers).toHaveLength(2);expect(papers.map(p=>p.x)).toEqual([122,154]);expect(art.sprites.get('bookcase-prop')!.visible).toBe(false)
  art.paint([],0,true);expect(papers.every(p=>p.destroyed)).toBe(true);art.destroy();expect(borrowed.destroyed).toBe(false);borrowed.destroy(true);parent.destroy()
 })
})

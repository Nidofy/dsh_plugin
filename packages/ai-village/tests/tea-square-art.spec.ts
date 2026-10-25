import { expect,it } from 'vitest'
import { Container, Texture, TextureSource } from 'pixi.js'
import { TeaSquareArt, teaSquareTextureKeys } from '../src/frame/tea-square-art.ts'
import { teaSquareFixture } from './tea-square.fixture.ts'
it('tea development art separates table contact and props, draws only the unique placed memory, and disposes its owned nodes',()=>{
 const parent=new Container(),unrelated=new Container();parent.addChild(unrelated);const art=new TeaSquareArt(parent),world=teaSquareFixture()
 expect(parent.children).toHaveLength(8);expect(art.tableFront.zIndex).toBeGreaterThan(2760);expect(art.props.zIndex).toBeGreaterThan(art.tableFront.zIndex)
 const before=JSON.stringify(world);art.paint(world);expect(art.keepsake.context.instructions).toHaveLength(0);expect(JSON.stringify(world)).toBe(before)
 world.teaSquare.keepsake='message-tree';art.paint(world);expect(art.keepsake.context.instructions).toHaveLength(0)
 world.teaSquare.memory={eventId:crypto.randomUUID(),participants:['bluewhale','claude','gemini'],completedTick:0,day:1,count:1};art.paint(world);expect(art.keepsake.context.instructions.length).toBeGreaterThan(0)
 world.teaSquare.keepsake=null;art.paint(world);expect(art.keepsake.context.instructions).toHaveLength(0)
 art.destroy();expect(parent.children).toEqual([unrelated]);expect(unrelated.destroyed).toBe(false);parent.destroy({children:true})
})

const textureMap=()=>new Map(teaSquareTextureKeys.map(key=>[key,new Texture({source:new TextureSource({width:16,height:16})})]))
it('uses all four borrowed textures at frozen front depths and never destroys their shared sources',()=>{
 const parent=new Container(),textures=textureMap(),art=new TeaSquareArt(parent,textures)
 expect(art.artwork).toBe('raster');expect(art.sprites.size).toBe(4);expect(art.background.visible).toBe(false);expect(art.tableFront.visible).toBe(false)
 expect(art.sprites.get('tea-square/background.png')).toMatchObject({x:0,y:0,width:360,height:480,zIndex:-100})
 expect(art.sprites.get('tea-square/tea-table.png')).toMatchObject({x:96,y:252,width:168,height:70,zIndex:3210})
 expect(art.sprites.get('tea-square/tea-counter.png')).toMatchObject({x:40,y:154,width:72,height:88,zIndex:2410})
 expect(art.sprites.get('tea-square/message-tree.png')).toMatchObject({x:254,y:112,width:70,height:126,zIndex:2370})
 expect(art.props.zIndex).toBe(3211);art.paint(teaSquareFixture());const sprites=[...art.sprites.values()]
 art.destroy();expect(sprites.every(s=>s.destroyed)).toBe(true);expect(parent.children).toHaveLength(0)
 expect([...textures.values()].every(t=>!t.destroyed&&!t.source.destroyed)).toBe(true)
 for(const texture of textures.values())texture.destroy(true);parent.destroy()
})
it.each(teaSquareTextureKeys)('rejects partial resource maps without mixing missing %s into the raster scene',missing=>{
 const parent=new Container(),all=textureMap(),partial=new Map(all);partial.delete(missing);const art=new TeaSquareArt(parent,partial)
 expect(art.artwork).toBe('development-preview');expect(art.sprites.size).toBe(0);expect(art.background.visible).toBe(true);expect(art.background.label).toContain('development-preview')
 art.destroy();for(const texture of all.values())texture.destroy(true);parent.destroy()
})
it('falls back when a provided texture was already destroyed',()=>{
 const parent=new Container(),textures=textureMap();textures.get('tea-square/tea-table.png')!.destroy(true)
 const art=new TeaSquareArt(parent,textures);expect(art.artwork).toBe('development-preview');expect(art.sprites.size).toBe(0)
 art.destroy();for(const texture of textures.values())if(!texture.destroyed)texture.destroy(true);parent.destroy()
})

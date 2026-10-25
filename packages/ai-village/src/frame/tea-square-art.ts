import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { LivingWorld } from '../core/living-state.ts'
import { teaSquareScene } from '../core/tea-square-scene.ts'
export const teaSquareTextureKeys=['tea-square/background.png','tea-square/tea-table.png','tea-square/tea-counter.png','tea-square/message-tree.png'] as const
/** Optional borrowed textures; missing resources keep the explicit development preview. */
export class TeaSquareArt {
 readonly artwork:'raster'|'development-preview'
 readonly sprites=new Map<string,Sprite>()
 readonly background=new Graphics()
 readonly back=new Graphics()
 readonly tableFront=new Graphics()
 readonly counterFront=new Graphics()
 readonly treeFront=new Graphics()
 readonly props=new Graphics()
 readonly keepsake=new Graphics()
 constructor(parent:Container,textures?:ReadonlyMap<string,Texture>){
  this.artwork=teaSquareTextureKeys.every(key=>{const t=textures?.get(key);return t instanceof Texture&&!t.destroyed&&!!t.source&&!t.source.destroyed&&t.width>0&&t.height>0})?'raster':'development-preview'
  for(const [name,node,depth] of [['background',this.background,-100],['furniture-back',this.back,1500],['table-front',this.tableFront,3210],['counter-front',this.counterFront,2410],['tree-front',this.treeFront,2370],['props',this.props,3211],['keepsake',this.keepsake,2400]] as const){node.label=`tea-square-development-preview-${name}`;node.eventMode='none';node.zIndex=depth;parent.addChild(node)}
  this.background.rect(0,0,360,480).fill(0xe4ebcf).rect(0,216,360,264).fill(0xe6d8b5)
  for(const y of [240,294,348,402,456])this.background.moveTo(32,y).lineTo(328,y).stroke({color:0xb6aa8b,width:1,alpha:.4})
  this.tableFront.roundRect(96,252,168,42,10).fill(0xc99d6b).stroke({color:0x97734d,width:2})
  this.tableFront.rect(106,294,10,28).rect(244,294,10,28).fill(0x9f774f)
  this.back.roundRect(40,154,72,66,4).fill(0xb6a17c).rect(46,165,60,43).fill(0xe8d2a5)
  this.counterFront.rect(40,220,72,22).fill(0xa48c66)
  this.back.rect(284,165,10,65).fill(0xa68b64).ellipse(286,155,36,43).fill(0x8fae7b)
  this.treeFront.ellipse(290,232,25,6).fill(0xa5b081)
  if(this.artwork==='raster'){
   for(const node of [this.background,this.back,this.tableFront,this.counterFront,this.treeFront])node.visible=false
   const add=(key:string,x:number,y:number,width:number,height:number,depth:number)=>{const sprite=new Sprite(textures!.get(key)!);sprite.label=key;sprite.eventMode='none';sprite.position.set(x,y);sprite.width=width;sprite.height=height;sprite.zIndex=depth;this.sprites.set(key,sprite);parent.addChild(sprite)}
   add(teaSquareTextureKeys[0],0,0,360,480,-100)
   for(const furniture of teaSquareScene.furniture){const r=furniture.rect;add(`tea-square/${furniture.id}.png`,r.x,r.y,r.width,r.height,(r.y+r.height)*10-10)}
  }
 }
 paint(w:LivingWorld){
  this.props.clear();const e=w.teaSquare.active
  for(let i=0;i<3;i++){
   const x=126+i*54,item=e?.board[i]??-1
   this.props.circle(x,280,12).fill(item<0?0xe8cfa8:[0xc7dce0,0x91af7e,0xeac579][item]!).stroke({color:0x947951,width:1})
   if(this.artwork==='development-preview')this.props.roundRect(x-5,262,10,9,2).fill(0xfff4db)
   if(item===0)this.props.circle(x-3,281,3).circle(x+2,280,4).fill(0xffffff)
   if(item===1)this.props.ellipse(x,280,3,6).fill(0x587c51)
   if(item===2)this.props.star(x,280,5,6,3).fill(0xfff1bb)
  }
  this.keepsake.clear()
  if(w.teaSquare.memory&&w.teaSquare.keepsake==='message-tree'){
   this.keepsake.moveTo(304,164).lineTo(304,182).stroke({color:0x9b7e51,width:1})
   this.keepsake.roundRect(296,182,16,26,3).fill(0xf2dfab).stroke({color:0x9b7e51,width:1})
   for(const [x,y] of [[301,190],[307,190],[304,198]])this.keepsake.ellipse(x!,y!,2.5,4).fill(0x6d945d)
  }
 }
 destroy(){for(const sprite of this.sprites.values())sprite.destroy({texture:false,textureSource:false});this.sprites.clear();for(const node of [this.background,this.back,this.tableFront,this.counterFront,this.treeFront,this.props,this.keepsake])node.destroy()}
}

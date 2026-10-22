import { Texture, Sprite, Container, Rectangle } from 'pixi.js'
/** One additional 256×256 atmosphere texture. The real background reuses its original texture slot. */
export function cachedAtmosphere(image: HTMLImageElement) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256
  const ctx = canvas.getContext('2d')!; ctx.filter = 'blur(24px)'; ctx.drawImage(image, -48, -48, 352, 352)
  const fill = Texture.from(canvas),root=new Container(),parts=Array.from({length:4},()=>new Sprite(new Texture({source:fill.source,frame:new Rectangle(0,0,256,256)})))
  const regions=parts.map(p=>p.texture);root.addChild(...parts);let previous=''
  return { root, update(width:number,height:number,p:{x:number;y:number;scale:number},photo:boolean){
    const key=JSON.stringify([width,height,p,photo]);if(key===previous)return;previous=key
    const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v)),left=clamp(p.x+24,width),right=clamp(p.x+360*p.scale-24,width),top=clamp(p.y+24,height),bottom=clamp(p.y+480*p.scale-24,height)
    const rects=photo?[[0,0,width,height],[0,0,0,0],[0,0,0,0],[0,0,0,0]]:[[0,0,left,height],[right,0,width-right,height],[left,0,Math.max(0,right-left),top],[left,bottom,Math.max(0,right-left),height-bottom]]
    rects.forEach(([x=0,y=0,w=0,h=0],i)=>{const part=parts[i]!;part.visible=w>0&&h>0;if(!part.visible)return;const old=part.texture;part.texture=new Texture({source:fill.source,frame:new Rectangle(x/width*256,y/height*256,w/width*256,h/height*256)});regions[i]=part.texture;old.destroy();part.position.set(x,y);part.width=w;part.height=h})
  },destroy() { for(const texture of regions)texture.destroy();fill.destroy(true) } }
}
/** Cache edge alpha in the background source only when projection changes, avoiding a per-frame mask pass. */
export function backgroundSurface(image: HTMLImageElement) {
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
  const ctx=canvas.getContext('2d')!,texture=Texture.from(canvas);let previous=''
  return {texture,update(scale:number,photo:boolean){
    const key=photo?'photo':String(scale);if(key===previous)return;previous=key
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0)
    if(!photo){ctx.save();ctx.globalCompositeOperation='destination-in'
      for(const [vertical,edge] of [[false,Math.min(.49,24/(360*scale))],[true,Math.min(.49,24/(480*scale))]] as const){const gradient=ctx.createLinearGradient(0,0,vertical?0:w,vertical?h:0);gradient.addColorStop(0,'#ffffff00');gradient.addColorStop(edge,'#fff');gradient.addColorStop(1-edge,'#fff');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h)}ctx.restore()
    }
    texture.source.update()
  }}
}

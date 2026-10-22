export type EntranceRect = { x: number; y: number; width: number; height: number }
export interface EntranceArt {
  status: 'ART_REVIEW' | 'APPROVED'
  id?: string
  revision?: number
  designSize: { width: number; height: number }
  aperture: EntranceRect
  safeApertureRect: EntranceRect
  /** Convex normalized outline. No SVG/URL strings are accepted. */
  portalPolygon?: [number, number][]
  layers: { key: string; rect: EntranceRect; kind: 'far' | 'mid' | 'near' | 'frame' | 'left' | 'right'; pivot?: [number, number]; parallax?: number }[]
}
const rect = (r: EntranceRect) => r && [r.x,r.y,r.width,r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x+r.width <= 1+1e-9 && r.y+r.height <= 1+1e-9
export function validateEntranceTheme(value: unknown): EntranceArt | null {
  if (!value || typeof value !== 'object') return null
  const art=value as EntranceArt
  if (!['APPROVED','ART_REVIEW'].includes(art.status) || !art.designSize || ![art.designSize.width,art.designSize.height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=4096) || !rect(art.aperture) || !rect(art.safeApertureRect) || !Array.isArray(art.layers)) return null
  if(art.id!==undefined && !/^[a-z][a-z0-9-]{0,47}$/.test(art.id) || art.revision!==undefined && (!Number.isSafeInteger(art.revision)||art.revision<1)) return null
  const a=art.aperture,s=art.safeApertureRect
  if(s.x<a.x||s.y<a.y||s.x+s.width>a.x+a.width+1e-9||s.y+s.height>a.y+a.height+1e-9)return null
  if(art.layers.length>8 || art.layers.some(layer=>!layer || !/^entrance\/[a-z-]+\.png$/.test(layer.key)||!rect(layer.rect)||!['far','mid','near','frame','left','right'].includes(layer.kind)||layer.pivot!==undefined&&(!Array.isArray(layer.pivot)||layer.pivot.length!==2||!layer.pivot.every(n=>Number.isFinite(n)&&n>=0&&n<=1))||layer.parallax!==undefined&&(!Number.isFinite(layer.parallax)||layer.parallax<0||layer.parallax>1.15)))return null
  if(new Set(art.layers.map(l=>l.key)).size!==art.layers.length || !['far','frame','left','right'].every(kind=>art.layers.filter(l=>l.kind===kind).length===1)) return null
  if(art.layers.some(l=>['left','right'].includes(l.kind)&&!l.pivot))return null
  const p=art.portalPolygon
  if(p!==undefined){
    if(!Array.isArray(p)||p.length<3||p.length>512||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return null
    // Consistent winding and every vertex on the same side of every edge enforce convexity,
    // rejecting self intersections and proving the entire safe rectangle lies inside.
    let sign=0
    const corners:[[number,number],[number,number],[number,number],[number,number]]=[[s.x,s.y],[s.x+s.width,s.y],[s.x+s.width,s.y+s.height],[s.x,s.y+s.height]]
    for(let i=0;i<p.length;i++){
      const u=p[i]!,v=p[(i+1)%p.length]!
      for(const q of [...p,...corners]){
        const cross=(v[0]-u[0])*(q[1]-u[1])-(v[1]-u[1])*(q[0]-u[0])
        if(Math.abs(cross)<1e-9)continue
        if(!sign)sign=Math.sign(cross);else if(Math.sign(cross)!==sign)return null
      }
    }
    if(!sign)return null
  }
  return art
}
/** The production selection never opts review candidates in. */
export function validateEntranceArt(value: unknown): EntranceArt | null {
  const art=validateEntranceTheme(value);return art?.status==='APPROVED'?art:null
}
export function entranceKnockout(art: EntranceArt) {
  const a=art.aperture,p=art.portalPolygon??[[a.x,a.y],[a.x,a.y+a.height],[a.x+a.width,a.y+a.height],[a.x+a.width,a.y]]
  const points=[...p,p[0]!].map(([x,y])=>`${x!*100}% ${y!*100}%`).join(',')
  return `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${points})`
}
export const entranceTiming={approach:1100,fastApproach:180,open:650,fastOpen:350,cross:550,fastCross:300,reveal:220,simple:150,reduced:100} as const
export const doorAngle=(side:'left'|'right',progress:number)=>82*Math.max(0,Math.min(1,progress))*(side==='left'?1:-1)
export function crossTransform(width:number,height:number,safe:EntranceRect){
  const scale=Math.max((width+32)/(safe.width*width),(height+32)/(safe.height*height))
  return {scale,x:width/2-(safe.x+safe.width/2)*width*scale,y:height/2-(safe.y+safe.height/2)*height*scale}
}
export function entranceLayout(width:number,height:number,art:EntranceArt){
  const h=Math.max(1,height),w=h*art.designSize.width/art.designSize.height,left=(width-w)/2,top=0,s=art.safeApertureRect
  const scale=Math.max((width+32)/(s.width*w),(height+32)/(s.height*h))
  return {width:w,height:h,left,top,perspective:2100*h/art.designSize.height,parallax:5*h/art.designSize.height,far:'translate(0px,0px) scale(1)',near:`translate(${-w*.5*.12}px,${h*.5-h*.46875*1.12}px) scale(1.12)`,cross:`translate(${width/2-left-(s.x+s.width/2)*w*scale}px,${height/2-top-(s.y+s.height/2)*h*scale}px) scale(${scale})`}
}

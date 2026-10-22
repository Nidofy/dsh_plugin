import { entranceManifest } from '../entrance-manifest.ts'
export type EntranceRect = { x: number; y: number; width: number; height: number }
export interface EntranceArt {
  status: 'ART_REVIEW' | 'APPROVED'
  designSize: { width: number; height: number }
  /** Normalized coordinates, all opaque exterior layers use this same knockout. */
  aperture: EntranceRect
  safeApertureRect: EntranceRect
  layers: { key: string; rect: EntranceRect; kind: 'far' | 'mid' | 'near' | 'frame' | 'left' | 'right'; pivot?: [number, number] }[]
}
/** No approved layered master was supplied. Missing art must never block entry. */
export function validateEntranceArt(value: unknown): EntranceArt | null {
  const art = value as EntranceArt | null
  const rect = (r: EntranceRect) => r && [r.x,r.y,r.width,r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x+r.width <= 1 && r.y+r.height <= 1
  if (!art || art.status !== 'APPROVED' || !art.designSize || ![art.designSize.width,art.designSize.height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=4096) || !rect(art.aperture) || !rect(art.safeApertureRect) || !Array.isArray(art.layers)) return null
  const a=art.aperture,s=art.safeApertureRect
  if(s.x<a.x||s.y<a.y||s.x+s.width>a.x+a.width||s.y+s.height>a.y+a.height)return null
  if (!['far','frame','left','right'].every(kind=>art.layers.some(layer=>layer.kind===kind)) || art.layers.length>8 || art.layers.some(layer=>!/^entrance\/[a-z-]+\.png$/.test(layer.key)||!rect(layer.rect)||!['far','mid','near','frame','left','right'].includes(layer.kind)||layer.pivot&&(!Array.isArray(layer.pivot)||layer.pivot.length!==2||!layer.pivot.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))) return null
  return art
}
export const entranceArt: EntranceArt | null = validateEntranceArt(entranceManifest)
export const entranceArtStatus = entranceManifest.status
export function crossTransform(width: number, height: number, safe: EntranceRect) {
  const scale = Math.max((width + 32) / (safe.width * width), (height + 32) / (safe.height * height))
  return { scale, x: width / 2 - (safe.x + safe.width / 2) * width * scale, y: height / 2 - (safe.y + safe.height / 2) * height * scale }
}
export function entranceLayout(width: number, height: number, art: EntranceArt) {
  // Cover the viewport even at the far camera position; crop decoration, never stretch the master.
  const ratio=art.designSize.width/art.designSize.height, w=Math.max(width,height*ratio)*1.25,h=w/ratio
  const left=width*.5-w*.5,top=height*.46-h*.46,s=art.safeApertureRect
  const scale=Math.max((width+32)/(s.width*w),(height+32)/(s.height*h))
  return { width:w,height:h,left,top,far:`translate(${w*.5*.18}px,${h*.46*.18}px) scale(.82)`,cross:`translate(${width/2-left-(s.x+s.width/2)*w*scale}px,${height/2-top-(s.y+s.height/2)*h*scale}px) scale(${scale})` }
}

import { it, expect } from 'vitest'
import { EntranceCoordinator, portraitFill } from '../src/client/entrance-state.ts'
import { crossTransform, validateEntranceArt } from '../src/client/entrance-theme.ts'
import { entranceArt } from '../src/client/entrance-art.ts'
import { EntranceMotion } from '../src/client/entrance-motion.ts'

it('uses verified work only; time and skip do not finish loading', () => {
  const e = new EntranceCoordinator(); e.open(1)
  expect(e.progress(false)).toBe(0); e.skip(); expect(e.finish(false)).toBe(false)
  e.metadata = true; e.verified = .5
  expect(e.progress(false)).toBeCloseTo(.45)
  expect(Array.from({length:7},(_,i)=>portraitFill(e.progress(false),i))).toEqual([1,1,1,expect.closeTo(.15),0,0,0])
  e.verified = 1; e.decoded = 1
  expect(e.progress(false)).toBeCloseTo(.95); expect(e.blocking).toBe(true)
  expect(e.progress(true)).toBe(1)
})
it('fences current frame, attempt, assets and exact view, including hidden frame recreation', () => {
  const e = new EntranceCoordinator(); e.open(); e.bindFrame('a'); const attempt = e.attemptId
  e.expectFrame('a', 3, 10)
  for (const args of [['b',attempt,3,10],['a','old',3,10],['a',attempt,2,10],['a',attempt,3,9]] as const) expect(e.acknowledge(...args)).toBe(false)
  expect(e.acknowledge('a',attempt,3,10)).toBe(true)
  e.suspend(); e.bindFrame('b'); e.expectFrame('b',3,1)
  expect(e.acknowledge('a',attempt,3,10)).toBe(false); expect(e.firstFrame).toBe(false)
  expect(e.decode('b',e.attemptId,3,.5)).toBe(true); e.decode('b',e.attemptId,3,.2); expect(e.decoded).toBe(.5)
  expect(e.decode('b',e.attemptId,3,NaN)).toBe(false)
})
it('never repeats full intro on close, recovery or ordinary connection generation', () => {
  const e = new EntranceCoordinator(); e.beginBoot(); e.open(); expect(e.full).toBe(true)
  e.suspend(); e.open(); expect(e.full).toBe(false)
  e.beginBoot(); e.open(); expect(e.full).toBe(false); expect(e.progress(false)).toBe(0)
})
it.each([[320,360],[340,720],[580,720],[1080,760]])('covers all viewport corners plus 16px at %i×%i', (width,height) => {
  const safe={x:.35,y:.24,width:.3,height:.44}, t=crossTransform(width,height,safe)
  expect(t.x+safe.x*width*t.scale).toBeLessThanOrEqual(-16+1e-8)
  expect(t.y+safe.y*height*t.scale).toBeLessThanOrEqual(-16+1e-8)
  expect(t.x+(safe.x+safe.width)*width*t.scale).toBeGreaterThanOrEqual(width+16-1e-8)
  expect(t.y+(safe.y+safe.height)*height*t.scale).toBeGreaterThanOrEqual(height+16-1e-8)
})
it('ships no placeholder as approved art and refuses missing or untrusted layer metadata',()=>{
  expect(entranceArt).toBeNull();expect(validateEntranceArt({status:'ART_PENDING'})).toBeNull()
  expect(validateEntranceArt({status:'APPROVED',designSize:{width:1,height:1},aperture:{x:0,y:0,width:1,height:1},safeApertureRect:{x:0,y:0,width:1,height:1},layers:[]})).toBeNull()
})
it('cancels a running WAAPI operation and refuses subsequent stages after unmount',async()=>{
  let reject!:(reason?:unknown)=>void,cancelled=0
  const finished=new Promise<void>((_,r)=>{reject=r}),node={animate:()=>({finished,cancel:()=>{cancelled++;reject(Error('cancel'))}})} as unknown as Element
  const motion=new EntranceMotion(),pending=motion.animate(node,[{opacity:1},{opacity:0}],650)
  motion.cancel();expect(await pending).toBe(false);expect(cancelled).toBeGreaterThan(0);expect(await motion.animate(node,[],550)).toBe(false)
})

import { entranceManifest } from '../src/entrance-manifest.ts'
import { validateEntranceTheme, entranceLayout, entranceKnockout, doorAngle } from '../src/client/entrance-theme.ts'
it('accepts bounded review geometry while keeping the production approval gate closed',()=>{
  const art=validateEntranceTheme(entranceManifest)!
  expect(art).not.toBeNull();expect(art.status).toBe('ART_REVIEW');expect(validateEntranceArt(art)).toBeNull()
  expect(art.layers.findIndex(l=>l.kind==='frame')).toBeGreaterThan(art.layers.findIndex(l=>l.kind==='right'))
  expect(entranceKnockout(art)).toContain('polygon(evenodd,')
  for(const bad of [null,{}, {...art,layers:[null]}, {...art,portalPolygon:[[0,0],[1,1],[0,1],[1,0]]}, {...art,portalPolygon:[[0,0],[.1,0],[0,.1]]}, {...art,layers:art.layers.map(l=>({...l,parallax:100}))}])expect(validateEntranceTheme(bad)).toBeNull()
  expect(doorAngle('left',1)).toBe(82);expect(doorAngle('right',1)).toBe(-82)
})
it.each([[320,360],[340,720],[580,720],[1080,760]])('keeps portrait master and cross-safe corners at %i x %i',(width,height)=>{
  const art=validateEntranceTheme(entranceManifest)!,l=entranceLayout(width,height,art),s=art.safeApertureRect
  expect(l.height).toBe(height);expect(l.width/l.height).toBe(.75)
  const [x,y,scale]=l.cross.match(/-?\d+(?:\.\d+)?/g)!.map(Number) as [number,number,number]
  expect(l.left+x+s.x*l.width*scale).toBeLessThanOrEqual(-16+1e-6)
  expect(l.top+y+s.y*l.height*scale).toBeLessThanOrEqual(-16+1e-6)
  expect(l.left+x+(s.x+s.width)*l.width*scale).toBeGreaterThanOrEqual(width+16-1e-6)
  expect(l.top+y+(s.y+s.height)*l.height*scale).toBeGreaterThanOrEqual(height+16-1e-6)
})

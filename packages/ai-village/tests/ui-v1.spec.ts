import { expect, it } from 'vitest'
import { initialPresentation, presentationReducer } from '../src/client/ui-state.ts'
import { projectCamera, zoomCamera, clampCamera, defaultCamera } from '../src/core/camera.ts'
import { decodePreferences, validatePreferences, defaultPreferences, preferencesCodec } from '../src/core/preferences.ts'
import { deriveNotices } from '../src/core/notifications.ts'
import { createHomeWorld, furnitureIds, homeTemplates } from '../src/core/home-state.ts'
import { arrangementObjects } from '../src/core/arrangement.ts'
import { validUIInput } from '../src/core/frame-protocol.ts'
import { scene } from '../src/definitions.ts'
import { SaveStore } from '../src/host/save-store.ts'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
it('keeps one presentation model through tab, overlay, close and short-height transitions', () => {
  let p = initialPresentation(); expect(p.drawer).toBe('closed'); expect(p.tab).toBe('residents')
  p = presentationReducer(p, { type: 'tab', tab: 'residents' }); expect(p.drawer).toBe('half')
  p = presentationReducer(p, { type: 'tab', tab: 'journal' }); expect(p.drawer).toBe('half')
  p = presentationReducer(p, { type: 'overlay', overlay: 'notifications' }); expect(p.drawer).toBe('closed')
  p = presentationReducer(p, { type: 'tab', tab: 'decor', short: true }); expect(p.drawer).toBe('half'); expect(p.overlay).toBeNull()
  p = presentationReducer(p, { type: 'close' }); expect(p.drawer).toBe('closed'); expect(p.tab).toBe('decor')
})
it.each([[340,720],[580,720],[1080,760],[320,360],[800,600]])('round trips full world and seat points at %s × %s with camera clamping', (width,height) => {
  const w = {x:0,y:0,width,height}
  for (const zoom of [1,1.1,1.5]) {
    const c = clampCamera(w,{zoom,panX:9999,panY:-9999}), p = projectCamera(w,c)
    for (const point of [{x:0,y:0},{x:360,y:480},...scene.hotspots.map(h=>h.anchor)]) {
      expect(((point.x*p.scale+p.x)-p.x)/p.scale).toBeCloseTo(point.x,8)
      expect(((point.y*p.scale+p.y)-p.y)/p.scale).toBeCloseTo(point.y,8)
    }
    if (360*p.scale <= width) expect(c.panX).toBe(0)
    else { expect(p.x).toBeLessThanOrEqual(0); expect(p.x+360*p.scale).toBeGreaterThanOrEqual(width) }
  }
  const next=zoomCamera(w,defaultCamera,1.5); expect(next.zoom).toBe(1.5)
})
it('migrates only legacy preferences, rejects unknown or unbounded fields and writes only schema 3', () => {
  const old={schemaVersion:1,theme:'dark',language:'en',reducedMotion:true,bubbles:false}
  const before=JSON.stringify(old), p=decodePreferences(old)
  expect(p).toEqual({...defaultPreferences,...old,schemaVersion:3});expect(JSON.stringify(old)).toBe(before)
  expect(()=>validatePreferences(old)).toThrow()
  for(const patch of [{schemaVersion:4},{noticeReadIds:Array(65).fill('x')},{noticeReadIds:['中'.repeat(33)]},{noticeReadIds:['a','a']},{noticesInitialized:1},{reducedTransparency:0}]) expect(()=>decodePreferences({...p,...patch})).toThrow()
})
it.each([1,2])('protects schema %s original preference snapshot bytes through the existing migration codec', async schemaVersion => {
  const root=await mkdtemp(resolve('.build/ui-v1-prefs-')), old={schemaVersion,theme:'dark',language:'en',reducedMotion:true,bubbles:false,...(schemaVersion===2?{reducedTransparency:true,noticeReadIds:['first-memory'],noticesInitialized:true}:{})}
  const legacy=await SaveStore.open(root,scene,{decode:(v:unknown)=>v,validate:(v:unknown)=>v,needsUpgrade:()=>false})
  await legacy.save(0,old,randomUUID());const path=join(legacy.directory,'current.json'), pointer=await readFile(path,'utf8'), file=JSON.parse(pointer).snapshot, bytes=await readFile(join(legacy.directory,'snapshots',file))
  const next=await SaveStore.open(root,scene,preferencesCodec); expect((await next.read())!.world.theme).toBe('dark')
  await next.save(1,{...decodePreferences(old),noticesInitialized:true},randomUUID())
  expect(await readFile(join(legacy.directory,'snapshots',file))).toEqual(bytes); expect((await next.read())!.world.schemaVersion).toBe(3)
})
it('derives stable bounded first-fact notices independent of repeat counts and presentation', () => {
  const w=createHomeWorld(scene);expect(deriveNotices(w)).toEqual([])
  w.journal.push({id:randomUUID(),eventId:randomUUID(),templateId:'first-table',participants:['bluewhale','claude'],food:'tea',completedTick:20,count:1})
  const first=deriveNotices(w);w.journal[0]!.count=25
  expect(deriveNotices(w)[0]!.id).toBe(first[0]!.id);expect(deriveNotices(w)[0]!.count).toBe(25)
  expect(new TextEncoder().encode(first[0]!.id).length).toBeLessThanOrEqual(96)
})
it('derives only two anchors per furniture from each of the 48 existing layouts', () => {
  for(const layout of ['courtyard','reading','garden'] as const) for(let mask=0;mask<16;mask++) {
    const world=createHomeWorld(scene),home={...world.home,positions:{...homeTemplates[layout]}}
    furnitureIds.forEach((id,i)=>{home.positions[id]=((mask>>i)&1) as 0|1})
    const objects=arrangementObjects(scene,world,{home,layout});expect(objects.map(o=>o.id)).toEqual([...furnitureIds]);expect(objects.every(o=>o.anchors.length===2)).toBe(true)
  }
})
it('rejects untrusted camera and arrangement payloads',()=>{
  expect(validUIInput({kind:'camera',camera:{zoom:NaN,panX:0,panY:0}})).toBe(false)
  expect(validUIInput({kind:'camera',camera:{zoom:2,panX:0,panY:0}})).toBe(false)
  for(const patch of [{id:'unknown'},{index:2},{pointerId:-1},{phase:'save'}]) expect(validUIInput({kind:'arrange',phase:'up',id:'work',pointerId:1,index:1,...patch})).toBe(false)
  expect(validUIInput({kind:'arrange',phase:'up',id:'work',pointerId:1,index:1})).toBe(true)
})

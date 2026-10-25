import { expect, it } from 'vitest'
import { communityPlaces, communityConnections, communityTravelIssue } from '../src/core/community-map.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { scene } from '../src/definitions.ts'

it('rejects planned and unknown destinations in the authority, without changing world identity or bytes',()=>{
  const world=createLivingWorld(scene),before=JSON.stringify(world)
  for(const id of ['lakeside-garden','workshop'])expect(()=>switchRegion(world,scene,id)).toThrow('REGION_PLANNED')
  for(const id of ['__proto__','elsewhere',null,{}])expect(()=>switchRegion(world,scene,id)).toThrow('INVALID_REGION')
  expect(JSON.stringify(world)).toBe(before)
  const next=switchRegion(world,scene,'bookhouse')
  expect(next.worldId).toBe(world.worldId)
  expect(switchRegion(next,scene,'courtyard').region.active).toBe('courtyard')
})
it('only permits graph-adjacent open places; planning metadata never supplies a live scene',()=>{
  expect(new Set(communityPlaces.map(p=>p.id)).size).toBe(5)
  for(const [from,to] of communityConnections){expect(communityPlaces.some(p=>p.id===from)).toBe(true);expect(communityPlaces.some(p=>p.id===to)).toBe(true)}
  expect(communityTravelIssue('courtyard','bookhouse')).toBeNull()
  expect(communityTravelIssue('bookhouse','courtyard')).toBeNull()
  expect(communityTravelIssue('courtyard','tea-square')).toBeNull()
  expect(communityTravelIssue('tea-square','courtyard')).toBeNull()
  expect(communityTravelIssue('bookhouse','tea-square')).toBe('REGION_NOT_CONNECTED')
  expect(communityTravelIssue('tea-square','bookhouse')).toBe('REGION_NOT_CONNECTED')
  expect(communityTravelIssue('bookhouse','bookhouse')).toBe('REGION_UNCHANGED')
  expect(communityPlaces.filter(p=>p.status==='planned').every(p=>p.scene===null&&p.art.resource===null)).toBe(true)
})

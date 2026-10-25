import { expect,it } from 'vitest'
import { teaSquareScene as scene,teaSquareEntries as entries,teaSquareStorySeats as seats } from '../experiments/community-next/tea-square.ts'
import { walkable } from '../src/core/world.ts'
import { residentRoute,clearSegment } from '../src/core/navigation.ts'
import { communityPlace } from '../src/core/community-map.ts'

it('keeps seven arrival feet safe and routes three participants around the frozen table with bystanders',()=>{
  const feet=entries.map(p=>({...p}))
  for(let i=0;i<feet.length;i++){
    expect(walkable(scene,feet[i]!)).toBe(true)
    expect(clearSegment(scene,feet[i]!,feet[i]!,feet.filter((_,j)=>j!==i))).toBe(true)
  }
  // Arrival members take the existing bounded route planner, never a pixel-derived obstacle.
  for(const [index,target] of seats.entries()){
    const occupied=feet.filter((_,j)=>j!==index),route=residentRoute(scene,feet[index]!,target,occupied)
    expect(route).not.toBeNull()
    let last=feet[index]!
    for(const waypoint of route!){expect(clearSegment(scene,last,waypoint,occupied)).toBe(true);last=waypoint}
    feet[index]={...target}
  }
  for(const h of scene.hotspots){expect(walkable(scene,h.anchor)).toBe(true);expect(residentRoute(scene,scene.spawn,h.anchor,[])).not.toBeNull()}
  for(const [i,a] of scene.hotspots.entries())for(const b of scene.hotspots.slice(i+1)){
    expect(Math.hypot(a.anchor.x-b.anchor.x,a.anchor.y-b.anchor.y)).toBeGreaterThanOrEqual(24)
    const p=a.hit,q=b.hit
    expect(p.x<q.x+q.width&&p.x+p.width>q.x&&p.y<q.y+q.height&&p.y+p.height>q.y).toBe(false)
  }
})
it('opens the approved scene with the same frozen entry geometry',()=>{
  expect(communityPlace('tea-square')?.status).toBe('available')
  expect(communityPlace('tea-square')?.scene).toMatchObject({id:'tea-square',version:1,entries,returnPolicy:'saved-feet'})
  expect(communityPlace('tea-square')?.art).toEqual({status:'approved',resource:'tea-square/background.png'})
})

import { expect, it } from 'vitest'
import { residentAssets } from '../src/client/asset-selection.ts'
import { characterIds } from '../src/core/roster.ts'
it('bookhouse replaces courtyard environment with two approved atlases, preserving resident activity parts',()=>{
  const courtyard=residentAssets(characterIds),bookhouse=residentAssets(characterIds,'bookhouse')
  expect(courtyard.size).toBe(208);expect(bookhouse.size).toBe(203)
  expect([...courtyard].filter(key=>!bookhouse.has(key)).sort()).toEqual(['scene/background.png','scene/bowl.png','scene/cushion.png','scene/desk-back.png','scene/desk-front.png','scene/table-back.png','scene/table-front.png'].sort())
  for(const key of ['scene/rest-pose.png','scene/work-left.png','scene/work-right.png','scene/eat-left.png','scene/eat-right.png'])expect(bookhouse.has(key)).toBe(true)
  expect([...bookhouse].filter(key=>!courtyard.has(key)).sort()).toEqual(['bookhouse/bookhouse-activity-atlas.png','bookhouse/bookhouse-scene-atlas.png'])
})

it('tea loads exactly four approved scene images without another region or absent resident rigs',()=>{
  const keys=residentAssets(['bluewhale'],'tea-square')
  expect([...keys].filter(key=>key.startsWith('tea-square/')).sort()).toEqual(['tea-square/background.png','tea-square/message-tree.png','tea-square/tea-counter.png','tea-square/tea-table.png'])
  expect(keys.has('scene/background.png')).toBe(false)
  expect([...keys].some(key=>key.startsWith('bookhouse/')||key.startsWith('claude/'))).toBe(false)
  expect(keys.has('scene/rest-pose.png')).toBe(true)
})

it('keeps every legal seven-resident combination below the 128 image bridge budget',()=>{
  for(let mask=0;mask<(1<<characterIds.length);mask++){
    const ids=characterIds.filter((_,i)=>mask&(1<<i))
    if(ids.length!==7)continue
    for(const region of ['courtyard','bookhouse','tea-square'] as const)expect(residentAssets(ids,region).size).toBeLessThanOrEqual(128)
  }
})

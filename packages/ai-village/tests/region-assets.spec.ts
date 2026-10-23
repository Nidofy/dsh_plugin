import { expect, it } from 'vitest'
import { residentAssets } from '../src/client/asset-selection.ts'
import { characterIds } from '../src/core/roster.ts'
it('bookhouse releases only the seven courtyard environment textures, preserving all approved resident activity parts',()=>{
  const courtyard=residentAssets(characterIds),bookhouse=residentAssets(characterIds,'bookhouse')
  expect(courtyard.size).toBe(128);expect(bookhouse.size).toBe(121)
  expect([...courtyard].filter(key=>!bookhouse.has(key)).sort()).toEqual(['scene/background.png','scene/bowl.png','scene/cushion.png','scene/desk-back.png','scene/desk-front.png','scene/table-back.png','scene/table-front.png'].sort())
  for(const key of ['scene/rest-pose.png','scene/work-left.png','scene/work-right.png','scene/eat-left.png','scene/eat-right.png'])expect(bookhouse.has(key)).toBe(true)
  expect([...bookhouse].every(key=>courtyard.has(key))).toBe(true)
})

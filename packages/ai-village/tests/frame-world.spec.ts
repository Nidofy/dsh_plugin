import { expect, it } from 'vitest'
import { scene } from '../src/definitions.ts'
import { createLivingWorld, migrateLivingWorld } from '../src/core/living-state.ts'
import { createLivingWorld as createV7 } from '../src/core/living-state-v7.ts'
import { createLivingWorld as createV8 } from '../src/core/living-state-v8.ts'
import { createLivingWorld as createV9 } from '../src/core/living-state-v9.ts'
import { switchRegion } from '../src/core/region-engine.ts'
import { decodeFrameWorld } from '../src/core/frame-world.ts'
it('decodes the actual current owner snapshot for a first frame and upgrades previous play worlds',()=>{
  for(const world of [createLivingWorld(scene),createV7(scene),createV8(scene),createV9(scene),switchRegion(createLivingWorld(scene),scene,'bookhouse')]) {
    expect(decodeFrameWorld(JSON.parse(JSON.stringify(world)),scene)).toEqual(migrateLivingWorld(world,scene))
  }
  expect(()=>decodeFrameWorld({...createLivingWorld(scene),schemaVersion:13},scene)).toThrow()
  expect(()=>decodeFrameWorld({...createLivingWorld(scene),extra:true},scene)).toThrow()
})

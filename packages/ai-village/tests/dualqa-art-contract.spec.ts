import {it,expect} from 'vitest'
import {validateEntranceArt} from '../src/client/entrance-theme.ts'
it('DQ-ART-01: malformed layer metadata falls back instead of throwing during module initialization',()=>{
 // Synthetic validator input only: this does not change or approve any manifest.
 const rect={x:0,y:0,width:1,height:1}
 const input={status:'APPROVED',designSize:{width:720,height:960},aperture:rect,safeApertureRect:rect,
  layers:[null,...['far','frame','left','right'].map(kind=>({key:'entrance/test-'+kind+'.png',kind,rect}))]}
 expect(()=>validateEntranceArt(input)).not.toThrow()
 expect(validateEntranceArt(input)).toBeNull()
})

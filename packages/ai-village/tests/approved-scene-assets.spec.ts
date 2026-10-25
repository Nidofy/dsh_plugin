import { afterEach, expect, it } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { approvedSceneAssets } from '../../../scripts/ai-village-scene-assets.mjs'

const assets=resolve(import.meta.dirname,'../assets'), temporary:string[]=[]
afterEach(async()=>{for(const path of temporary.splice(0))await rm(path,{recursive:true,force:true})})
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'village-approved-scene-'));temporary.push(root)
  await cp(join(assets,'tea-square'),join(root,'tea-square'),{recursive:true})
  const path=join(root,'tea-square/manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'))
  return {root,path,manifest}
}
it('validates the independently approved scenes and exact immutable image closure',async()=>{
  expect((await approvedSceneAssets(assets,'tea-square')).length).toBe(4)
  expect((await approvedSceneAssets(assets,'bookhouse')).length).toBe(2)
})
it('rejects approval of a different scope, duplicate files and escaped resource keys',async()=>{
  const {root,path,manifest}=await fixture()
  for(const changed of [ {...manifest,scope:'community-map-only'}, {...manifest,approvedForRelease:false}, {...manifest,files:[manifest.files[0],manifest.files[0],...manifest.files.slice(2)]}, {...manifest,files:manifest.files.map((e:object,i:number)=>i===0?{...e,key:'../background.png'}:e)} ]){
    await writeFile(path,JSON.stringify(changed));await expect(approvedSceneAssets(root,'tea-square')).rejects.toThrow()
  }
})
it('rejects changed PNG bytes and dimension claims before publishing any resource',async()=>{
  const {root,path,manifest}=await fixture()
  manifest.files[0].size[0]++;await writeFile(path,JSON.stringify(manifest))
  await expect(approvedSceneAssets(root,'tea-square')).rejects.toThrow('integrity')
  manifest.files[0].size[0]--;await writeFile(path,JSON.stringify(manifest))
  const png=join(root,'tea-square/background.png'),bytes=await readFile(png);bytes[bytes.length-1]^=1;await writeFile(png,bytes)
  await expect(approvedSceneAssets(root,'tea-square')).rejects.toThrow('integrity')
})

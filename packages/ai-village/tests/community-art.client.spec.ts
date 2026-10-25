// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { resources } from '../src/definitions.ts'
import { residentAssets } from '../src/client/asset-selection.ts'
import { loadCommunityArt,mapAssetKeys } from '../src/client/community-art.ts'
afterEach(()=>vi.unstubAllGlobals())
function fixture(){
  const created:string[]=[],revoked:string[]=[]
  vi.stubGlobal('crypto',webcrypto)
  vi.stubGlobal('URL',{createObjectURL:()=>{const url='blob:map-'+created.length;created.push(url);return url},revokeObjectURL:(url:string)=>revoked.push(url)})
  vi.stubGlobal('Image',class {src='';naturalWidth=256;naturalHeight=256;decode=async()=>{}})
  const request=vi.fn(async(path:string)=>{
    const entry=resources.find(r=>path.endsWith('/assets/'+r.key))!
    return new Response(await readFile(resolve('packages/ai-village/assets',entry.file)),{headers:{'content-type':'image/png'}})
  })
  return {request,created,revoked}
}
it('loads only six approved map layers and releases them without adding resident textures',async()=>{
  const f=fixture(),art=await loadCommunityArt(f.request,new AbortController().signal)
  expect(f.request).toHaveBeenCalledTimes(6);expect(Object.keys(art.urls)).toEqual(expect.arrayContaining([...mapAssetKeys]))
  for(const region of ['courtyard','bookhouse'] as const)expect([...residentAssets(['bluewhale'],region)].some(k=>k.startsWith('map/'))).toBe(false)
  expect(f.created).toHaveLength(6);art.dispose();art.dispose();expect(f.revoked.sort()).toEqual(f.created.sort());expect(art.urls).toEqual({})
})
it('fails closed for a corrupt layer and revokes every partially created URL',async()=>{
  const f=fixture(),request=async(path:string)=>path.endsWith('terrain.png')?new Response(new Uint8Array([1,2,3])):f.request(path)
  await expect(loadCommunityArt(request,new AbortController().signal)).rejects.toThrow('MAP_ASSET_UNAVAILABLE')
  expect(f.revoked.sort()).toEqual(f.created.sort())
})
it('does not publish resources after its owning panel is aborted',async()=>{
  const f=fixture(),abort=new AbortController();abort.abort()
  await expect(loadCommunityArt(f.request,abort.signal)).rejects.toThrow('MAP_ASSET_UNAVAILABLE')
  expect(f.created).toHaveLength(0)
})
it('releases partial URLs promptly when closing a map during an unfinished decode',async()=>{
  const f=fixture(),abort=new AbortController(),images:{src:string}[]=[]
  vi.stubGlobal('Image',class {src='';naturalWidth=256;naturalHeight=256;constructor(){images.push(this)}decode=()=>new Promise<void>(()=>{})})
  const loading=loadCommunityArt(f.request,abort.signal),outcome=expect(loading).rejects.toThrow('MAP_ASSET_UNAVAILABLE')
  await vi.waitFor(()=>expect(f.created.length).toBeGreaterThan(0))
  abort.abort();await outcome
  expect(f.revoked.sort()).toEqual(f.created.sort());expect(images.every(i=>i.src==='')).toBe(true)
})

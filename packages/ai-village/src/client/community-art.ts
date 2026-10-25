import { resources } from '../definitions.ts'
import type { Request } from './runtime.ts'

export const mapAssetKeys = ['map/terrain.png','map/courtyard.png','map/bookhouse.png','map/tea-square.png','map/lakeside-garden.png','map/workshop.png'] as const
export interface CommunityArt { urls:Record<string,string>; dispose():void }
/** Separate from resident textures. The owning panel releases every decoded image URL on close. */
export async function loadCommunityArt(request:Request,signal:AbortSignal):Promise<CommunityArt> {
  const entries=mapAssetKeys.map(key=>resources.find(entry=>entry.key===key))
  if(entries.some(e=>!e)||entries.reduce((n,e)=>n+(e?.bytes??0),0)>2*1024*1024)throw Error('MAP_ASSET_UNAVAILABLE')
  const group=new AbortController(),combined=AbortSignal.any([signal,group.signal,AbortSignal.timeout(10000)])
  const urls:Record<string,string>={},dispose=()=>{for(const url of Object.values(urls))URL.revokeObjectURL(url);for(const key of Object.keys(urls))delete urls[key]}
  const results=await Promise.allSettled(entries.map(async entry=>{
    try{
      const response=await request('/api/nidofy-ai-village/assets/'+entry!.key,{credentials:'same-origin',redirect:'error',signal:combined})
      if(!response.ok||!response.body)throw Error('MAP_ASSET_UNAVAILABLE')
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
      try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.length;if(size>entry!.bytes)throw Error('MAP_ASSET_LIMIT');chunks.push(row.value)}}finally{await reader.cancel();reader.releaseLock()}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')
      if(size!==entry!.bytes||hash!==entry!.sha256)throw Error('MAP_ASSET_HASH_MISMATCH')
      combined.throwIfAborted()
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));urls[entry!.key]=url
      const image=new Image();image.src=url
      let cancelDecode:()=>void=()=>{}
      try{
        const cancelled=new Promise<never>((_,reject)=>{cancelDecode=()=>{image.src='';reject(Error('MAP_ASSET_ABORTED'))};combined.addEventListener('abort',cancelDecode,{once:true});if(combined.aborted)cancelDecode()})
        await Promise.race([image.decode(),cancelled]);combined.throwIfAborted()
        if(image.naturalWidth<1||image.naturalHeight<1||image.naturalWidth>1024||image.naturalHeight>768)throw Error('MAP_ASSET_DIMENSIONS')
      }finally{combined.removeEventListener('abort',cancelDecode);image.src=''}
    }catch(error){group.abort();throw error}
  }))
  if(combined.aborted||results.some(r=>r.status==='rejected')){dispose();throw Error('MAP_ASSET_UNAVAILABLE')}
  return {urls,dispose}
}

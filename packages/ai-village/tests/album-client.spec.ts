import { it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { AlbumClient } from '../src/client/album-client.ts'
import { residentAssets } from '../src/client/asset-selection.ts'
import { characterIds, approvedEntranceCharacterIds } from '../src/core/roster.ts'
import { png } from './helpers/png.ts'
import type { Saved } from '../src/host/save-store.ts'
import type { Album } from '../src/core/photo.ts'
it('loads only current resident assets; unused whole furniture textures never load',()=>{
 expect(residentAssets(['bluewhale']).size).toBe(32)
 expect(residentAssets(approvedEntranceCharacterIds).size).toBe(128)
 expect(residentAssets(characterIds).size).toBe(208)
 expect(residentAssets(['claude']).size).toBe(23)
 expect(residentAssets(characterIds).has('scene/table.png')).toBe(false)
 expect([...residentAssets(['claude'])].some(key=>key.startsWith('kimi/'))).toBe(false)
})
it('reconciles a lost upload and deletion acknowledgement without replay or duplicate photos',async()=>{
 const identity={profileId:crypto.randomUUID(),epoch:crypto.randomUUID(),lease:crypto.randomUUID()}
 let state:Saved<Album>|null=null,writes=0,unavailable=false
 const client=new AlbumClient(async(path,init)=>{
  if(path.endsWith('/album')){if(unavailable)throw Error('OFFLINE');return new Response(JSON.stringify({...identity,saved:state}))}
  writes++
  if(path.endsWith('/photo-upload')){
   const headers=new Headers(init!.headers),bytes=Buffer.from(init!.body as ArrayBuffer),id=headers.get('x-village-photo')!
   state={revision:1,operationId:id,world:{schemaVersion:1,photos:[{id,title:'Hello',tick:0,width:2,height:2,bytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex')}]}}
  }else{const data=JSON.parse(String(init!.body));state={revision:2,operationId:data.operationId,world:{schemaVersion:1,photos:[]}}}
  throw Error('ACK_LOST')
 },()=>identity,()=>{})
 const bytes=Uint8Array.from(png()).buffer
 unavailable=true;await client.add(bytes,'Hello',0)
 expect(writes).toBe(1);expect(client.pending?.kind).toBe('add');expect(client.error).toBe('PHOTO_UNCONFIRMED')
 await client.add(bytes,'Again',0);expect(writes).toBe(1)
 unavailable=false;await client.refresh();expect(client.pending).toBeNull();expect(client.state?.world.photos).toHaveLength(1)
 const id=client.state!.world.photos[0]!.id
 await client.remove(id);expect(writes).toBe(2);expect(client.pending).toBeNull();expect(client.state!.world.photos).toEqual([])
 await client.dispose()
})

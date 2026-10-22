import { it, expect } from 'vitest'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { png } from './helpers/png.ts'
import { randomUUID } from 'node:crypto'
import { PhotoStore } from '../src/host/photo-store.ts'
import { pngInfo, validateAlbum } from '../src/core/photo.ts'
import { scene } from '../src/definitions.ts'
import { SaveStore } from '../src/host/save-store.ts'
import { contentWorldCodec } from '../src/core/migrations.ts'
import { createContentWorld } from '../src/core/content-state.ts'
import { neighborhoodWorldCodec } from '../src/core/neighborhood-state.ts'
it('stores real PNG bytes outside world, deduplicates, bounds and cold restores the album',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'village-v05-photos-')),store=await PhotoStore.open(dir,scene),bytes=png(),id=randomUUID()
 expect(pngInfo(bytes)).toEqual({width:2,height:2})
 const saved=await store.add(0,id,'第一张',42,bytes,()=>true)
 expect(await store.get(id)).toEqual(bytes)
 expect(await store.add(0,id,'第一张',42,bytes,()=>true)).toEqual(saved)
 const cold=await PhotoStore.open(dir,scene);expect(await cold.list()).toEqual(saved)
 await expect(cold.add(0,randomUUID(),'stale',0,bytes,()=>true)).rejects.toThrow('REVISION_CONFLICT')
 await expect(cold.add(1,randomUUID(),'owner lost',0,bytes,()=>false)).rejects.toThrow('OWNER_LOST')
 const deletion=randomUUID(),removed=await cold.remove(1,id,deletion,()=>true)
 expect(removed.world.photos).toEqual([]);await expect(cold.get(id)).rejects.toThrow('PHOTO_NOT_FOUND')
 expect(await readFile(join(cold.directory,'managed-photo-v1-'+id+'.png'))).toEqual(bytes) // previous index remains recoverable
 expect(await cold.remove(1,id,deletion,()=>true)).toEqual(removed)
 await expect(cold.get('../secrets')).rejects.toThrow('PHOTO_NOT_FOUND')
 const corrupt=Buffer.from(bytes);corrupt[40]^=1;expect(()=>pngInfo(corrupt)).toThrow('INVALID_PHOTO')
 expect(()=>pngInfo(Buffer.concat([bytes,Buffer.from('trailing')]))).toThrow('INVALID_PHOTO')
 expect(()=>validateAlbum({...saved.world,photos:Array.from({length:21},()=>saved.world.photos[0])})).toThrow('INVALID_ALBUM')
 await writeFile(join(cold.index.directory,'current.json'),'broken');await expect(cold.list()).rejects.toThrow()
 expect(await readFile(join(cold.index.directory,'current.json'),'utf8')).toBe('broken')
})
it('protects exact schema4 bytes through schema5 writes and retention',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'village-v05-upgrade-')),old=await SaveStore.open(dir,scene,contentWorldCodec(scene))
 await old.save(0,createContentWorld(scene),randomUUID());const pointer=await readFile(join(old.directory,'current.json'),'utf8')
 const file=JSON.parse(pointer).snapshot,bytes=await readFile(join(old.directory,'snapshots',file))
 const current=await SaveStore.open(dir,scene,neighborhoodWorldCodec(scene));let saved=(await current.read())!
 expect(saved.world.schemaVersion).toBe(5)
 for(let i=0;i<42;i++)saved=await current.save(saved.revision,saved.world,randomUUID())
 expect(await readFile(join(old.directory,'snapshots',file))).toEqual(bytes)
 const protectedName=(await readdir(old.directory)).find(n=>n.startsWith('upgrade-v1-'))!
 expect(await readFile(join(old.directory,protectedName),'utf8')).toBe(pointer)
 expect((await current.readUpgrade(protectedName)).world.schemaVersion).toBe(5)
})

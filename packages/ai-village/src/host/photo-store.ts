import { inflateSync } from 'node:zlib'
import { readFile, lstat, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ensureDurableDirectory, publishSyncedFile } from '@nidofy/dsh-plugin-shared/durable-file'
import { SaveStore } from './save-store.ts'
import { validateAlbum, pngInfo, photoLimits, type Album, type Photo } from '../core/photo.ts'
import { uuid } from '../core/content-state.ts'
import type { Scene } from '../core/world.ts'
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
/** Called under the world's owner transaction lock; no arbitrary filesystem references. */
export class PhotoStore {
 private constructor(readonly directory:string, readonly index:SaveStore<Album>){}
 static async open(worldDirectory:string,scene:Scene){
  const dir=join(worldDirectory,'album');await ensureDurableDirectory(dir)
  const info=await lstat(dir);if(!info.isDirectory()||info.isSymbolicLink())throw Error('PHOTO_PATH_REFUSED')
  return new PhotoStore(dir,await SaveStore.open(dir,scene,{decode:validateAlbum,validate:validateAlbum,needsUpgrade:()=>false}))
 }
 async list(){return await this.index.read()}
 private async bytes(id:string){
  if(!uuid(id))throw Error('PHOTO_PATH_REFUSED')
  const path=join(this.directory,'managed-photo-v1-'+id+'.png'),info=await lstat(path)
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>photoLimits.bytes)throw Error('PHOTO_PATH_REFUSED')
  const data=await readFile(path);if(data.length>photoLimits.bytes)throw Error('PHOTO_TOO_LARGE');return data
 }
 async get(id:string){
  const state=await this.list(),photo=state?.world.photos.find(p=>p.id===id)
  if(!photo)throw Error('PHOTO_NOT_FOUND')
  const bytes=await this.bytes(id);if(bytes.length!==photo.bytes||digest(bytes)!==photo.hash)throw Error('PHOTO_HASH_MISMATCH');return bytes
 }
 async add(revision:number,id:string,title:string,tick:number,bytes:Uint8Array,valid:()=>boolean){
  if(!uuid(id))throw Error('INVALID_PHOTO')
  const dimensions=pngInfo(bytes)
  const data=Buffer.from(bytes),chunks:Buffer[]=[];for(let offset=8;offset<data.length;){const length=data.readUInt32BE(offset);if(data.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(data.subarray(offset+8,offset+8+length));offset+=length+12}
  const row=dimensions.width*(data[25]===6?4:3)+1,expected=row*dimensions.height
  let decoded:Buffer;try{decoded=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected})}catch{throw Error('INVALID_PHOTO')}
  if(decoded.length!==expected)throw Error('INVALID_PHOTO')
  for(let i=0;i<decoded.length;i+=row)if(decoded[i]!>4)throw Error('INVALID_PHOTO')
  const current=await this.list(),album=current?.world??{schemaVersion:1 as const,photos:[]}
  const photo:Photo={id,title,tick,...dimensions,bytes:bytes.length,hash:digest(bytes)},existing=album.photos.find(p=>p.id===id)
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(photo))throw Error('OPERATION_MISMATCH');return current!}
  if((current?.revision??0)!==revision)throw Error('REVISION_CONFLICT')
  if(album.photos.length>=photoLimits.count)throw Error('ALBUM_FULL')
  const candidate=validateAlbum({...album,photos:[...album.photos,photo]})
  await this.collect()
  let diskBytes=0
  for(const name of await readdir(this.directory))if(/^managed-photo-v1-[a-f0-9-]{36}\.png$/.test(name)){const info=await lstat(join(this.directory,name));diskBytes+=info.size}
  if(diskBytes+bytes.length>photoLimits.total+photoLimits.bytes)throw Error('ALBUM_FULL')
  try {const old=await this.bytes(id);if(digest(old)!==photo.hash)throw Error('OPERATION_MISMATCH')}
  catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;if(!valid())throw Error('OWNER_LOST');const temp=join(this.directory,id+'.'+randomUUID()+'.tmp');try{await writeFile(temp,bytes,{flag:'wx',mode:0o600,flush:true});await publishSyncedFile(temp,join(this.directory,'managed-photo-v1-'+id+'.png'),false)}finally{await unlink(temp).catch(()=>{})}}
  return this.index.save(revision,candidate,id,valid)
 }
 async remove(revision:number,id:string,operationId:string,valid:()=>boolean){
  if(!uuid(id)||!uuid(operationId))throw Error('INVALID_PHOTO')
  const current=await this.list();if(!current)throw Error('PHOTO_NOT_FOUND')
  if(current.operationId===operationId){if(current.world.photos.some(p=>p.id===id))throw Error('OPERATION_MISMATCH');return current}
  if(current.revision!==revision)throw Error('REVISION_CONFLICT')
  const saved=await this.index.save(revision,{...current.world,photos:current.world.photos.filter(p=>p.id!==id)},operationId,valid)
  // Keep previous references for durable recovery; cleanup failure cannot undo the committed index.
  await this.collect().catch(()=>{});return saved
 }
 private async collect(){
  const current=await this.index.read(),previous=await this.index.read('previous.json')
  const keep=new Set([...(current?.world.photos??[]),...(previous?.world.photos??[])].map(p=>p.id))
  for(const name of await readdir(this.directory))if(/^managed-photo-v1-[a-f0-9-]{36}\.png$/.test(name)&&!keep.has(name.slice('managed-photo-v1-'.length,-4))){
    const path=join(this.directory,name),info=await lstat(path)
    if(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1)await unlink(path)
  }
 }
}

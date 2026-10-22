import { validateAlbum, pngInfo, photoLimits, type Album, type Photo } from '../core/photo.ts'
import { uuid } from '../core/content-state.ts'
import { readJsonResponse } from './json-response.ts'
import type { Request } from './runtime.ts'
import type { Saved } from '../host/save-store.ts'
const prefix='/api/nidofy-ai-village/'
interface Identity { profileId:string;epoch:string;lease:string }
export class AlbumClient {
 state:Saved<Album>|null=null;busy=false;error='';pending:{id:string;operationId:string;kind:'add'|'delete';expectedRevision:number;hash?:string}|null=null
 private work:Promise<void>|null=null
 private readSequence=0
 constructor(private request:Request,private identity:()=>Identity,private changed:()=>void){}
 async refresh(){
  const sequence=++this.readSequence,identity=this.identity(),response=await this.request(prefix+'album',{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(10000)})
  const value=await readJsonResponse<{profileId:string;epoch:string;saved:Saved<Album>|null}>(response)
  if(value.profileId!==identity.profileId||value.epoch!==identity.epoch||this.identity().epoch!==identity.epoch)throw Error('HOST_CHANGED')
  if(sequence!==this.readSequence)return
  if(value.saved&&(!Number.isSafeInteger(value.saved.revision)||value.saved.revision<1||!uuid(value.saved.operationId)))throw Error('INVALID_ALBUM')
  this.state=value.saved?{...value.saved,world:validateAlbum(value.saved.world)}:null
  if(this.pending){const found=this.state?.world.photos.find(p=>p.id===this.pending!.id)
   if(this.pending.kind==='add'&&found?.hash===this.pending.hash||this.pending.kind==='delete'&&(this.state?.revision??0)>this.pending.expectedRevision&&!found)this.pending=null
  }
  this.error=this.pending?'PHOTO_UNCONFIRMED':'';this.changed()
 }
 async add(bytes:ArrayBuffer,title:string,tick:number){
  if(this.busy||this.pending)return
  pngInfo(new Uint8Array(bytes));const id=crypto.randomUUID(),identity=this.identity()
  this.pending={id,operationId:id,kind:'add',expectedRevision:this.state?.revision??0}
  await this.mutate(async()=>{
   let hash:string
   try{hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')}catch{throw Error('PHOTO_REFUSED')}
   if(this.identity().epoch!==identity.epoch)throw Error('PHOTO_REFUSED')
   this.pending!.hash=hash
   const response=await this.request(prefix+'photo-upload',{method:'POST',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{'content-type':'image/png','x-village-lease':identity.lease,'x-village-epoch':identity.epoch,'x-village-revision':String(this.state?.revision??0),'x-village-photo':id,'x-village-title':encodeURIComponent(title),'x-village-tick':String(tick)},body:bytes})
   if(!response.ok)throw Error('PHOTO_REFUSED')
   await readJsonResponse(response)
  })
 }
 async remove(id:string){
  if(this.busy||this.pending)return
  const identity=this.identity(),operationId=crypto.randomUUID();this.pending={id,operationId,kind:'delete',expectedRevision:this.state?.revision??0}
  await this.mutate(async()=>{
   const response=await this.request(prefix+'photo-delete',{method:'POST',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json'},
    body:JSON.stringify({...identity,id,operationId,expectedRevision:this.state?.revision??0})})
   if(!response.ok)throw Error('PHOTO_REFUSED');await readJsonResponse(response)
  })
 }
 private async mutate(write:()=>Promise<void>){
  this.busy=true;this.error='';this.changed()
  this.work=(async()=>{let rejected=false;try{await write()}catch(e){rejected=e instanceof Error&&e.message==='PHOTO_REFUSED'}
    try{await this.refresh();if(rejected&&this.pending){this.pending=null;this.error='PHOTO_REFUSED'}}catch{this.error='PHOTO_UNCONFIRMED'}
  })().finally(()=>{this.busy=false;this.work=null;this.changed()})
  await this.work
 }
 async image(photo:Photo):Promise<Blob>{
  const response=await this.request(prefix+'photos/'+photo.id,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(10000)})
  if(!response.ok||!response.body)throw Error('PHOTO_UNAVAILABLE')
  const chunks:Uint8Array[]=[];let size=0;const reader=response.body.getReader()
  try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.length;if(size>photoLimits.bytes)throw Error('PHOTO_TOO_LARGE');chunks.push(row.value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')
  if(hash!==photo.hash||size!==photo.bytes)throw Error('PHOTO_HASH_MISMATCH');pngInfo(bytes)
  return new Blob([bytes],{type:'image/png'})
 }
 async dispose(){await this.work}
}

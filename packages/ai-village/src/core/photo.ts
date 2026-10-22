import { uuid } from './content-state.ts'
export const photoLimits = { bytes: 4 * 1024 * 1024, count: 20, total: 40 * 1024 * 1024, width: 1440, height: 1920 } as const
export interface Photo { id: string; title: string; tick: number; width: number; height: number; bytes: number; hash: string }
export interface Album { schemaVersion: 1; photos: Photo[] }
export function validateAlbum(value: unknown): Album {
  const a=value as Album
  if(!a||a.schemaVersion!==1||Object.keys(a).sort().join(',')!=='photos,schemaVersion'||!Array.isArray(a.photos)||a.photos.length>photoLimits.count)throw Error('INVALID_ALBUM')
  const seen=new Set<string>();let total=0
  for(const p of a.photos){
    if(!p||Object.keys(p).sort().join(',')!=='bytes,hash,height,id,tick,title,width'||!uuid(p.id)||seen.has(p.id)||typeof p.title!=='string'||p.title.length>80||/[\u0000-\u001f]/.test(p.title)
      ||!Number.isSafeInteger(p.tick)||p.tick<0||!Number.isInteger(p.width)||p.width<1||p.width>photoLimits.width||!Number.isInteger(p.height)||p.height<1||p.height>photoLimits.height
      ||!Number.isInteger(p.bytes)||p.bytes<45||p.bytes>photoLimits.bytes||!/^[a-f0-9]{64}$/.test(p.hash))throw Error('INVALID_ALBUM')
    seen.add(p.id);total+=p.bytes
  }
  if(total>photoLimits.total)throw Error('ALBUM_FULL')
  return structuredClone(a)
}
/** Bounded PNG container/CRC validation; image bytes never enter world JSON. */
export function pngInfo(bytes: Uint8Array): { width: number; height: number } {
  const fail=():never=>{throw Error('INVALID_PHOTO')}
  if(bytes.length<45||bytes.length>photoLimits.bytes||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v))return fail()
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=8,width=0,height=0,data=false,ended=false,chunks=0
  while(offset<bytes.length){
    if(++chunks>1024||offset+12>bytes.length)return fail()
    const length=v.getUint32(offset),end=offset+12+length
    if(end>bytes.length)return fail()
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8))
    let crc=0xffffffff
    for(let i=offset+4;i<offset+8+length;i++){crc^=bytes[i]!;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
    if(((crc^0xffffffff)>>>0)!==v.getUint32(offset+8+length))return fail()
    if(offset===8){if(type!=='IHDR'||length!==13)return fail();width=v.getUint32(offset+8);height=v.getUint32(offset+12)
      if(width<1||width>photoLimits.width||height<1||height>photoLimits.height||bytes[offset+16]!==8||![2,6].includes(bytes[offset+17]!)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0)return fail()
    }else if(type==='IHDR')return fail()
    if(type==='IDAT')data=true
    if(type==='IEND'){if(length!==0||end!==bytes.length||!data)return fail();ended=true}
    if(!['IHDR','IDAT','IEND','sRGB','gAMA','cHRM','pHYs'].includes(type))return fail()
    offset=end
  }
  if(!ended)return fail()
  return{width,height}
}

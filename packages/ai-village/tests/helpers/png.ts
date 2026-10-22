import { deflateSync } from 'node:zlib'
export function png(){
 const chunk=(type:string,data:Buffer)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff
  for(let i=4;i<8+data.length;i++){crc^=b[i]!;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}b.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return b}
 const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(2,4);header[8]=8;header[9]=6
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(18,0))),chunk('IEND',Buffer.alloc(0))])
}

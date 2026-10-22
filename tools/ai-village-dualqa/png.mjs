import { inflateSync } from 'node:zlib'
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0})
export function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
export function validatePNG(b,{maxPixels=32_000_000}={}){
 if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG_SIGNATURE')
 let offset=8,ended=false,width,height,depth,color,interlace,previous='',idatEnded=false;const chunks=[],idat=[]
 while(offset<b.length){
  if(offset+12>b.length)throw Error('PNG_TRUNCATED')
  const length=b.readUInt32BE(offset),type=b.toString('ascii',offset+4,offset+8),end=offset+12+length
  if(end>b.length)throw Error('PNG_TRUNCATED')
  if(crc32(b.subarray(offset+4,end-4))!==b.readUInt32BE(end-4))throw Error('PNG_CRC:'+type)
  if(!chunks.length&&type!=='IHDR')throw Error('PNG_IHDR_ORDER')
  if(type==='IHDR'){
   if(chunks.length||length!==13)throw Error('PNG_IHDR')
   width=b.readUInt32BE(offset+8);height=b.readUInt32BE(offset+12);depth=b[offset+16];color=b[offset+17];interlace=b[offset+20]
   if(!width||!height||width*height>maxPixels)throw Error('PNG_PIXEL_LIMIT')
   if(b[offset+18]!==0||b[offset+19]!==0||interlace>1)throw Error('PNG_ENCODING')
  }
  if(type==='IDAT'){if(idatEnded)throw Error('PNG_IDAT_ORDER');idat.push(b.subarray(offset+8,end-4))}
  else if(previous==='IDAT')idatEnded=true
  chunks.push(type);previous=type;offset=end
  if(type==='IEND'){if(length||offset!==b.length)throw Error('PNG_TRAILING');ended=true;break}
 }
 if(!ended||!idat.length)throw Error('PNG_INCOMPLETE')
 const channels={0:1,2:3,3:1,4:2,6:4}[color]
 if(!channels)throw Error('PNG_COLOR_TYPE')
 const allowed={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}
 if(!allowed[color].includes(depth))throw Error('PNG_DEPTH')
 // Adam7 is decoded by sharp; enforce a conservative bounded inflation first.
 const expected=height*(1+Math.ceil(width*channels*depth/8))
 const raw=inflateSync(Buffer.concat(idat),{maxOutputLength:interlace?expected+height*8+width*8:expected})
 if(!interlace&&raw.length!==expected)throw Error('PNG_SCANLINE_LENGTH')
 if(!interlace)for(let y=0;y<height;y++)if(raw[y*(expected/height)]>4)throw Error('PNG_FILTER')
 return {width,height,depth,colorType:color,interlace,chunks,scanlineValidation:interlace?'DECODE_BACKEND':'PASS',colorSpace:chunks.includes('sRGB')?'sRGB':chunks.includes('iCCP')?'ICC':chunks.includes('gAMA')?'gamma-only':'UNSPECIFIED'}
}

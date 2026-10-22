import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deflateSync} from 'node:zlib'
import {crc32,validatePNG} from './png.mjs'
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b}
const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6
const signature=Buffer.from('89504e470d0a1a0a','hex')
const png=(h=header,raw=Buffer.from([0,1,2,3,255]))=>Buffer.concat([signature,chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
test('independent PNG validator accepts complete RGBA and rejects corrupted/truncated bytes',()=>{
 const b=png();assert.equal(validatePNG(b).width,1)
 assert.throws(()=>validatePNG(b.subarray(0,-1)),/TRUNCATED/)
 const bad=Buffer.from(b);bad[48]^=1;assert.throws(()=>validatePNG(bad),/CRC/)
 assert.throws(()=>validatePNG(Buffer.concat([b,Buffer.from([1])])),/TRAILING/)
})
test('bounded inflation rejects oversized dimensions, inconsistent scanlines and invalid filters',()=>{
 const h=Buffer.from(header);h.writeUInt32BE(100_000,0);h.writeUInt32BE(100_000,4)
 assert.throws(()=>validatePNG(png(h)),/PIXEL_LIMIT/)
 assert.throws(()=>validatePNG(png(header,Buffer.from([0]))),/SCANLINE_LENGTH/)
 assert.throws(()=>validatePNG(png(header,Buffer.from([5,1,2,3,4]))),/FILTER/)
})

import type { Point } from '../../src/core/world.ts'
import type { SceneArt } from '../../src/frame/furniture.ts'

/** Design fixture only. Not imported by the runtime, resource manifest or world codec. */
export const teaSquareScene: SceneArt = {
  schemaVersion:1,id:'tea-square',version:1,size:[360,480],
  walkable:{x:32,y:216,width:296,height:228},spawn:{x:180,y:414},
  obstacles:[{x:96,y:294,width:168,height:28},{x:40,y:220,width:72,height:22},{x:266,y:216,width:50,height:22}],
  hotspots:[
    {id:'tea-table',activity:'sit',seat:'left',anchor:{x:86,y:276},hit:{x:70,y:262,width:32,height:28}},
    {id:'tea-table',activity:'sit',seat:'middle',anchor:{x:180,y:268},hit:{x:164,y:254,width:32,height:28}},
    {id:'tea-table',activity:'sit',seat:'right',anchor:{x:274,y:276},hit:{x:258,y:262,width:32,height:28}},
    {id:'tea-counter',activity:'eat',seat:'main',anchor:{x:54,y:266},hit:{x:38,y:250,width:28,height:30}},
    {id:'message-tree',activity:'read',seat:'main',anchor:{x:304,y:258},hit:{x:292,y:242,width:28,height:30}},
  ],
  furniture:[
    {id:'tea-table',asset:'candidate/tea-table',rect:{x:96,y:252,width:168,height:70},split:.6},
    {id:'tea-counter',asset:'candidate/tea-counter',rect:{x:40,y:154,width:72,height:88},split:.8},
    {id:'message-tree',asset:'candidate/message-tree',rect:{x:254,y:112,width:70,height:126},split:.9},
  ],seatProps:[],
}
export const teaSquareEntries: readonly Point[]=Array.from({length:7},(_,i)=>({x:48+44*i,y:414}))
export const teaSquareStorySeats: readonly Point[]=teaSquareScene.hotspots.slice(0,3).map(h=>h.anchor)
export const teaSquareBudget={textures:12,decodedBytes:12*1024*1024,compressedBytes:5*1024*1024} as const

import type { SceneArt } from '../frame/furniture.ts'
import type { Point } from './world.ts'
/** Frozen contract v2 geometry, shared by approved artwork, travel, interaction and photographs. */
export const teaSquareScene: SceneArt = {
 schemaVersion:1,id:'tea-square',version:1,size:[360,480],walkable:{x:32,y:216,width:296,height:228},spawn:{x:180,y:414},
 obstacles:[{x:96,y:294,width:168,height:28},{x:40,y:220,width:72,height:22},{x:266,y:216,width:50,height:22}],
 hotspots:[
 {id:'tea-table',activity:'sit',seat:'left',anchor:{x:86,y:276},hit:{x:70,y:262,width:32,height:28}},
 {id:'tea-table',activity:'sit',seat:'middle',anchor:{x:180,y:268},hit:{x:164,y:254,width:32,height:28}},
 {id:'tea-table',activity:'sit',seat:'right',anchor:{x:274,y:276},hit:{x:258,y:262,width:32,height:28}},
 {id:'tea-counter',activity:'eat',seat:'main',anchor:{x:54,y:266},hit:{x:38,y:250,width:28,height:30}},
 {id:'message-tree',activity:'read',seat:'main',anchor:{x:304,y:258},hit:{x:292,y:242,width:28,height:30}}],
 furniture:[{id:'tea-table',asset:'tea-square/tea-table.png',rect:{x:96,y:252,width:168,height:70},split:.6},{id:'tea-counter',asset:'tea-square/tea-counter.png',rect:{x:40,y:154,width:72,height:88},split:.8},{id:'message-tree',asset:'tea-square/message-tree.png',rect:{x:254,y:112,width:70,height:126},split:.9}],seatProps:[]
}
export const teaSquareEntries:readonly Point[]=Array.from({length:7},(_,i)=>({x:48+44*i,y:414}))
export const teaSquareSeats:readonly Point[]=teaSquareScene.hotspots.slice(0,3).map(h=>h.anchor)
// Keep the original five first (old world14 targets remain valid). Extra fixed feet let four
// bystanders retain earlier closing positions while a different three-person cast finishes.
export const teaSquareClosing:readonly Point[]=[{x:54,y:348},{x:304,y:258},{x:262,y:380},{x:306,y:348},{x:98,y:380},
 {x:142,y:380},{x:186,y:380},{x:218,y:420},{x:54,y:420},{x:98,y:420},{x:142,y:420},{x:262,y:420},{x:306,y:420}]

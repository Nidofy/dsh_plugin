// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest'
import {routeInput} from '../src/frame/input-router.ts'
class TestPointer extends MouseEvent {pointerId:number;constructor(type:string,options:MouseEventInit & {pointerId?:number}={}){super(type,options);this.pointerId=options.pointerId??1}}
afterEach(()=>vi.unstubAllGlobals())
function setup(paused=false){vi.stubGlobal('PointerEvent',TestPointer);const canvas=document.createElement('canvas');document.body.append(canvas);canvas.setPointerCapture=vi.fn();canvas.hasPointerCapture=()=>true;canvas.releasePointerCapture=vi.fn();const send=vi.fn(),actor=vi.fn(),ghost=vi.fn(),state={camera:{zoom:1.5,panX:0,panY:0},workspace:{x:0,y:0,width:340,height:720},scale:1,local:(p:{x:number;y:number})=>p,actor:(p:{x:number;y:number})=>p.x>100?'bluewhale' as const:null,paused,photo:false,overlay:false,dismiss:false,objects:[],selected:'work'};const router=routeInput(canvas,()=>state,send,actor,ghost);const pointer=(type:string,x=110,y=150)=>canvas.dispatchEvent(new TestPointer(type,{clientX:x,clientY:y,button:0}));return{canvas,send,actor,state,router,pointer,dispose:()=>{router.dispose();canvas.remove()}}}
it('locks wheel/camera during actor capture, cancels on blur, and honors modifier-wheel',()=>{
 const f=setup();try{f.pointer('pointerdown');f.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-80,cancelable:true}));expect(f.send).not.toHaveBeenCalled();f.pointer('pointermove',190,160);expect(f.actor.mock.calls.map(c=>c[0])).toEqual(['down','move']);window.dispatchEvent(new Event('blur'));expect(f.actor).toHaveBeenLastCalledWith('cancel',expect.anything());f.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-80,ctrlKey:true,cancelable:true}));expect(f.send).not.toHaveBeenCalled();f.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:1,deltaMode:1,cancelable:true}));expect(f.send.mock.calls[0]![0].camera.zoom).toBeCloseTo(1.468)}finally{f.dispose()}
})
it('a paused resident selects on pointer-up only; overlays consume the click without actor interaction',()=>{
 const f=setup(true);try{f.pointer('pointerdown');f.pointer('pointermove',113,150);expect(f.send).not.toHaveBeenCalled();f.pointer('pointerup',113,150);expect(f.send).toHaveBeenLastCalledWith({kind:'resident',id:'bluewhale'});f.send.mockClear();f.state.overlay=true;f.pointer('pointerdown');f.pointer('pointerup');expect(f.send).toHaveBeenLastCalledWith({kind:'scene'});expect(f.actor).not.toHaveBeenCalled()}finally{f.dispose()}
})
it('blank drag clamps camera, ignores sub-threshold movement, and cancellation commits no world intent',()=>{
 const f=setup();try{f.pointer('pointerdown',10,150);f.pointer('pointermove',13,150);expect(f.send).not.toHaveBeenCalled();f.pointer('pointermove',200,150);expect(f.send.mock.calls.at(-1)![0].kind).toBe('camera');expect(f.send.mock.calls.at(-1)![0].camera.panX).toBeCloseTo(85,8);expect(f.send.mock.calls.at(-1)![0].camera.panY).toBe(0);f.router.cancel();expect(f.send).toHaveBeenLastCalledWith({kind:'camera',camera:{zoom:1.5,panX:0,panY:0}});f.pointer('pointerup',200,150);expect(f.send.mock.calls.every(c=>c[0].kind==='camera')).toBe(true)}finally{f.dispose()}
})

it.each([false,true])('drawer dismissal consumes a resident click before actor or selection when paused=%s',paused=>{const f=setup(paused);try{f.state.dismiss=true;f.pointer('pointerdown');f.pointer('pointerup');expect(f.send).toHaveBeenCalledExactlyOnceWith({kind:'scene'});expect(f.actor).not.toHaveBeenCalled();f.send.mockClear();f.pointer('pointerdown');f.pointer('pointermove',140,180);f.pointer('pointerup',140,180);expect(f.send).not.toHaveBeenCalled();expect(f.actor).not.toHaveBeenCalled()}finally{f.dispose()}})

it('game click is released once, is blocked by drawers/pauses, and cannot cross event generations',()=>{
 const f=setup(),state=f.state as typeof f.state & {playAt?:()=>string|null};let token=crypto.randomUUID()+':0';state.playAt=()=>token
 try{
  f.pointer('pointerdown',40,250);expect(f.send).not.toHaveBeenCalled();f.pointer('pointerup',40,250);expect(f.send).toHaveBeenCalledExactlyOnceWith({kind:'play-find',token,point:{x:40,y:250}})
  f.send.mockClear();f.pointer('pointerdown',40,250);token=crypto.randomUUID()+':0';f.pointer('pointerup',40,250);expect(f.send).not.toHaveBeenCalled()
  f.pointer('pointerdown',40,250);f.state.paused=true;f.pointer('pointerup',40,250);expect(f.send).not.toHaveBeenCalled()
  f.state.paused=false;f.state.dismiss=true;f.pointer('pointerdown',40,250);f.pointer('pointerup',40,250);expect(f.send).toHaveBeenCalledExactlyOnceWith({kind:'scene'})
 }finally{f.dispose()}
})

it('table hits precede actor dragging and retain the same cell and move revision until release',()=>{
 const f=setup(),state=f.state as typeof f.state & {tableAt?:()=>{token:string;cell:number}|null};let hit={token:crypto.randomUUID()+':0:0',cell:0};state.tableAt=()=>hit
 try{
  f.pointer('pointerdown');f.pointer('pointerup');expect(f.actor).not.toHaveBeenCalled();expect(f.send).toHaveBeenCalledExactlyOnceWith({kind:'table-move',...hit,point:{x:110,y:150}})
  f.send.mockClear();f.pointer('pointerdown');hit={...hit,token:hit.token.slice(0,-1)+'2'};f.pointer('pointerup');expect(f.send).not.toHaveBeenCalled()
  f.pointer('pointerdown');hit={...hit,cell:1};f.pointer('pointerup');expect(f.send).not.toHaveBeenCalled()
  f.pointer('pointerdown');f.state.paused=true;f.pointer('pointerup');expect(f.send).not.toHaveBeenCalled()
 }finally{f.dispose()}
})

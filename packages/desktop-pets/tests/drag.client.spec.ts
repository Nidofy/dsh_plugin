import {expect,it,vi} from 'vitest'
// @ts-expect-error Browser asset intentionally ships as JavaScript.
import {DragQueue} from '../assets/pet/drag.js'
it('does not send drag or position writes for a simple click',async()=>{
 const send=vi.fn(async()=>{}),queue=new DragQueue(send)
 queue.prepare({x:1,y:2});queue.finish();await Promise.resolve();expect(send).not.toHaveBeenCalled()
 queue.prepare({x:3,y:4});queue.start();queue.finish()
 await vi.waitFor(()=>expect(send).toHaveBeenCalledWith('drag-end'))
 expect(send).toHaveBeenCalledWith('drag',{x:3,y:4})
})

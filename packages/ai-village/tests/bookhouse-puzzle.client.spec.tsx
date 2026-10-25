// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {BookhouseStoryPanel} from '../src/client/BookhouseStoryPanel.tsx'
import {createLivingWorld} from '../src/core/living-state.ts'
import {LivingController} from '../src/core/living-controller.ts'
import {switchRegion} from '../src/core/region-engine.ts'
import {startBookhousePuzzle,bookhouseStoryAction} from '../src/core/bookhouse-engine.ts'
import {stepLiving} from '../src/core/living-engine.ts'
import {scene} from '../src/definitions.ts'
import type {VillageRuntime} from '../src/client/runtime.ts'
afterEach(cleanup)
it('offers keyboard rearrangement and reset for the puzzle, without offering reading themes or a bookmark reward',()=>{
 const c=new LivingController(createLivingWorld(scene),scene,()=>{});c.setCharacterPresent('claude',true)
 let w=startBookhousePuzzle(switchRegion(c.world,scene,'bookhouse'),scene,'claude',crypto.randomUUID())
 for(let i=0;i<1805&&w.bookhouse.active?.phase!=='ready';i++)stepLiving(w,scene)
 w=bookhouseStoryAction(w,scene,`${w.bookhouse.active!.id}:0`)
 for(let i=0;i<1805&&w.bookhouse.active?.phase!=='ready';i++)stepLiving(w,scene)
 expect(w.bookhouse.active?.phase).toBe('ready')
 const action=vi.fn(),r={controller:{world:w,pauseReasons:new Set()},bookhouseStoryAction:action,cancelBookhouseStory:vi.fn()} as unknown as VillageRuntime
 const ui=render(<BookhouseStoryPanel runtime={r} tab="wishes" locale="en" locked={false}/>)
 expect(screen.queryByRole('button',{name:'Remember the window light'})).toBeNull()
 expect(screen.queryByRole('button',{name:'Keep the little-light bookmark'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Flower',exact:true}));fireEvent.click(screen.getByRole('button',{name:'1 · Empty'}))
 expect(action).toHaveBeenLastCalledWith(`${w.bookhouse.active!.id}:1`,'2:0')
 fireEvent.click(screen.getByRole('button',{name:'Reset pages'}));expect(action).toHaveBeenLastCalledWith(`${w.bookhouse.active!.id}:1`,'reset')
 ui.rerender(<BookhouseStoryPanel runtime={r} tab="wishes" locale="en" locked={true}/>);expect((screen.getByRole('button',{name:'Seed',exact:true}) as HTMLButtonElement).disabled).toBe(true)
})

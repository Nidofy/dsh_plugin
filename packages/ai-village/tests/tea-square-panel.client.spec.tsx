// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {TeaSquarePanel,TeaSquareMemoryArticle} from '../src/client/TeaSquarePanel.tsx'
import {VillageRuntime} from '../src/client/runtime.ts'
import {LivingController} from '../src/core/living-controller.ts'
import {scene} from '../src/definitions.ts'
import {teaSquareFixture} from './tea-square.fixture.ts'
import {startTeaSquareStory,stepTeaSquare,actTeaSquareStory} from '../src/core/tea-square-engine.ts'
import {teaSquareToken} from '../src/core/tea-square-state.ts'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function fixture(){vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});const r=new VillageRuntime();r.controller=new LivingController(teaSquareFixture(),scene,()=>{});r.ready=true;r.open=true;r.connected=true;r.frameReady=true;r.entrance.blocking=false;r.reasons.clear();r.controller.pauseReasons.clear();return r}
it('invites three distinct residents without changing the world during selection',()=>{
 const r=fixture(),before=r.controller!.snapshot(),start=vi.spyOn(r,'startTeaSquareStory').mockResolvedValue()
 render(<TeaSquarePanel runtime={r} tab="wishes" locale="zh" locked={false}/>)
 const selects=screen.getAllByRole('combobox') as HTMLSelectElement[]
 expect(new Set(selects.map(s=>s.value)).size).toBe(3)
 expect(selects[0]!.options[1]!.disabled).toBe(true)
 expect(r.controller!.world).toEqual(before)
 fireEvent.click(screen.getByRole('button',{name:'开始茶会'}))
 expect(start).toHaveBeenCalledExactlyOnceWith(selects.map(s=>s.value))
})
it('uses the current serial token for coaster moves and disables advancement while paused',()=>{
 const r=fixture();let w=startTeaSquareStory(r.controller!.world,scene,['bluewhale','claude','gemini'],'713803c8-8f7b-4a9a-9000-000000000001')
 for(let n=0;n<2500&&w.teaSquare.active?.phase!=='ready';n++)stepTeaSquare(w)
 w=actTeaSquareStory(w,scene,teaSquareToken(w.teaSquare.active!),'continue')
 for(let n=0;n<2500&&w.teaSquare.active?.phase!=='ready';n++)stepTeaSquare(w)
 r.controller=new LivingController(w,scene,()=>{});r.controller.pauseReasons.clear()
 const act=vi.spyOn(r,'actTeaSquareStory').mockResolvedValue(),cancel=vi.spyOn(r,'cancelTeaSquareStory').mockResolvedValue()
 const view=render(<TeaSquarePanel runtime={r} tab="wishes" locale="zh" locked={false}/>)
 fireEvent.click(within(screen.getByRole('group',{name:'杯垫图案'})).getByRole('button',{name:'叶'}))
 fireEvent.click(within(screen.getByRole('group',{name:'杯垫位置'})).getByRole('button',{name:'1 · 空'}))
 expect(act).toHaveBeenCalledExactlyOnceWith(teaSquareToken(w.teaSquare.active!),'place','1:0')
 r.controller.pauseReasons.add('user');view.rerender(<TeaSquarePanel runtime={r} tab="wishes" locale="zh" locked={false}/>)
 expect((screen.getByRole('button',{name:'重排杯垫'}) as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'取消茶会'}));expect(cancel).toHaveBeenCalledOnce()
})
it('shows durable first gathering facts independently of the current region and decoration',()=>{
 render(<TeaSquareMemoryArticle locale="en" noticeId="tea-test" memory={{eventId:'713803c8-8f7b-4a9a-9000-000000000001',participants:['bluewhale','claude','gemini'],completedTick:700,day:1,count:3}}/>)
 expect(screen.getByText('Three cups, one afternoon')).toBeTruthy()
 expect(screen.getByText('Day 1 · ×3')).toBeTruthy()
 expect(document.querySelector('[data-notice-id="tea-test"]')?.getAttribute('tabindex')).toBe('-1')
})

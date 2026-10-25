// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { blankTeaSquare } from '../src/core/tea-square-state.ts'
import { PlayPanel } from '../src/client/PlayPanel.tsx'
import type { VillageRuntime } from '../src/client/runtime.ts'
import { playDefinitions, playDecorationIds, whalePlace, whalePlaceNames, snackReaction } from '../src/core/play-catalog.ts'

afterEach(cleanup)
function fixture(id = 'lost-rice', phase = 'ready') {
  const world = {
    teaSquare: blankTeaSquare(),
    bookhouse: {version:1,active:null,memory:null,lastEventId:null,keepsake:null},
    ticks: 100, actor: { id: 'claude' }, companions: [{ id: 'bluewhale' }, { id: 'kimi' }], activeEvent: null,
    region: { version: 1, active: 'courtyard', returns: { courtyard: null, bookhouse: null } },
    neighborhood: { event: null, memories: [] as { id: string; participants: string[]; completedTick: number; count: number }[] },
    play: { nextTick: 0, tableMode: 'dining' as 'dining' | 'game', lastEventId: null as string | null, decorations: Object.fromEntries(playDecorationIds.map(id => [id, null])), active: { id: 'test-event', definitionId: id, participants: ['bluewhale', 'claude'], stage: 0, phase, choices: [] as string[], board: [-1, -1, -1], target: 'bench' } },
  }
  const runtime = { controller: { world, pauseReasons: new Set<string>() }, arranging: false, actionError: '', startPlay: vi.fn().mockResolvedValue(undefined), playAction: vi.fn().mockResolvedValue(undefined), cancelPlay: vi.fn().mockResolvedValue(undefined), placePlayDecoration: vi.fn().mockResolvedValue(undefined) }
  const view = (tab = 'residents', locale: 'zh' | 'en' = 'zh', locked = false) => <PlayPanel runtime={runtime as unknown as VillageRuntime} tab={tab} locale={locale} locked={locked}/>
  return { world, runtime, view }
}
it('waits for arrival and observation, then submits a stage-bound action', () => {
  const { world, runtime, view } = fixture('lost-rice', 'approaching'), ui = render(view())
  const button = () => screen.getByRole('button', { name: '问问刚才发生了什么' }) as HTMLButtonElement
  expect(button().disabled).toBe(true); fireEvent.click(button()); expect(runtime.playAction).not.toHaveBeenCalled()
  world.play.active.phase = 'observing'; ui.rerender(view()); expect(button().disabled).toBe(true)
  world.play.active.phase = 'ready'; ui.rerender(view()); fireEvent.click(button())
  expect(runtime.playAction).toHaveBeenCalledWith('talk', undefined, 'test-event:0')
  ui.rerender(view('residents', 'zh', true)); expect(button().disabled).toBe(true)
  runtime.controller.pauseReasons.add('user'); ui.rerender(view('wishes')); expect(button().disabled).toBe(true)
  expect(screen.queryByRole('button', { name: '开始 · 安静的一页' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '取消这次活动' })); expect(runtime.cancelPlay).toHaveBeenCalledOnce()
})
it('uses authored fixed pairs even when the selected resident is another friend and offers no decoration for memory-only stories',()=>{
 const {world,runtime,view}=fixture();world.play.active=null as never
 world.actor.id='kimi';world.companions=[{id:'bluewhale'},{id:'claude'}]
 const ui=render(view('wishes','en'));fireEvent.click(screen.getByRole('button',{name:'Begin · A bookmark in the rice bowl'}))
 expect(runtime.startPlay).toHaveBeenCalledWith('pair-bluewhale-claude',['bluewhale','claude'])
 expect((screen.getByRole('button',{name:'Begin · Two answers'}) as HTMLButtonElement).disabled).toBe(true)
 ui.rerender(view('decor','en'));expect(screen.queryByText('A bookmark in the rice bowl')).toBeNull()
})
it('offers keyboard placement, drag placement and reset with the same bounded protocol', () => {
  const { runtime, view } = fixture('tidy-desk'); render(view('residents', 'en'))
  fireEvent.click(screen.getByRole('button', { name: 'Book' })); fireEvent.click(screen.getByRole('button', { name: 'Shelf · empty' }))
  expect(runtime.playAction).toHaveBeenLastCalledWith('place', '0:0', 'test-event:0')
  const dataTransfer = { getData: () => '1', setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  fireEvent.dragStart(screen.getByRole('button', { name: 'Pen' }), { dataTransfer })
  fireEvent.drop(screen.getByRole('button', { name: 'Pen cup · empty' }), { dataTransfer })
  expect(runtime.playAction).toHaveBeenLastCalledWith('place', '1:1', 'test-event:0')
  fireEvent.drop(screen.getByRole('button', { name: 'Paper tray · empty' }), { dataTransfer: { getData: () => 'untrusted' } })
  expect(runtime.playAction).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Reset desk' }))
  expect(runtime.playAction).toHaveBeenLastCalledWith('reset', undefined, 'test-event:0')
})
it('provides scene-search keyboard alternatives and two progressively useful hints', () => {
  const { world, runtime, view } = fixture('find-whale'), ui = render(view('residents', 'en'))
  fireEvent.click(screen.getByRole('button', { name: 'Search · By the bench' })); expect(runtime.playAction).toHaveBeenLastCalledWith('find', 'bench', 'test-event:0')
  fireEvent.click(screen.getByRole('button', { name: 'Hint (up to two)' })); expect(runtime.playAction).toHaveBeenLastCalledWith('hint', undefined, 'test-event:0')
  world.play.active.choices.push('hint', 'hint'); ui.rerender(view('residents', 'en'))
  expect((screen.getByRole('button', { name: 'Hint (up to two)' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(whalePlaceNames[whalePlace(world.play.active)].en)).toBeTruthy()
})
it('shows three distinct snack reactions and preserves the chosen serving sequence', () => {
  const { world, runtime, view } = fixture('snack-table'), ui = render(view())
  for (const name of ['米饭', '热茶', '水果']) fireEvent.click(screen.getByRole('button', { name }))
  expect(runtime.playAction.mock.calls).toEqual([['choose', 'rice', 'test-event:0'], ['choose', 'tea', 'test-event:0'], ['choose', 'fruit', 'test-event:0']])
  world.play.active.choices.push('rice', 'tea', 'fruit'); ui.rerender(view())
  expect(screen.getByText('已分享 3/3')).toBeTruthy()
  expect(screen.getAllByText(/像把阳光分给了朋友/)).toHaveLength(2)
  expect(screen.getAllByText(/故事可以慢慢说/)).toHaveLength(1)
  expect(screen.getByText(/米饭正是我最喜欢的/)).toBeTruthy()
  expect(snackReaction('kimi', 'tea', 'en')).not.toEqual(snackReaction('grok', 'tea', 'en'))
})
it('starts the rice story with Bluewhale first and needs three present residents for the group story', () => {
  const { world, runtime, view } = fixture()
  world.play.active = null as never
  render(view('wishes'))
  fireEvent.click(screen.getByRole('button', { name: '开始 · 蓝鲸丢失的白米饭' }))
  expect(runtime.startPlay).toHaveBeenLastCalledWith('lost-rice', ['bluewhale', 'claude'])
  fireEvent.click(screen.getByRole('button', { name: '开始 · 三个人的星空' }))
  expect(runtime.startPlay).toHaveBeenLastCalledWith('stargazing', ['claude', 'bluewhale', 'kimi'])
})
it('derives optional wishes from saved memories without counting replay totals', () => {
  const { world, view } = fixture(); world.play.active = null as never
  world.neighborhood.memories.push({ id: 'lost-rice', participants: ['bluewhale', 'claude'], completedTick: 80, count: 4 }, { id: 'stargazing', participants: ['bluewhale', 'claude', 'kimi'], completedTick: 90, count: 1 })
  world.play.lastEventId = 'completed-test-event'
  render(view('wishes', 'en'))
  expect(screen.getByText('○ Discover resident stories · 1/9')).toBeTruthy()
  expect(screen.getByText('○ Try all three little games · 0/3')).toBeTruthy()
  expect(screen.getByText('✓ Watch the stars with two friends · 1/1')).toBeTruthy()
})
it('keeps decoration placement as an explicit save and never grants a locked reward in the UI', () => {
  const { world, runtime, view } = fixture(); world.play.active = null as never
  world.neighborhood.memories.push({ id: 'lost-rice', participants: ['bluewhale', 'claude'], completedTick: 80, count: 1 })
  world.play.lastEventId = 'completed-test-event'
  render(view('decor', 'en'))
  expect(screen.getAllByRole('button', { name: 'Choose a place' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Choose a place' })); fireEvent.click(screen.getByRole('button', { name: 'Window' }))
  expect(runtime.placePlayDecoration).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save this place' })); expect(runtime.placePlayDecoration).toHaveBeenCalledWith('rice-bowl', 'window')
})
it('authors every scene and control in both languages with a pause before interaction', () => {
  expect(playDefinitions.filter(d => d.kind === 'story' && !d.introduction)).toHaveLength(9)
  expect(playDefinitions.filter(d => d.kind === 'game' && d.id !== 'table-game')).toHaveLength(3)
  for (const d of playDefinitions) {
    expect(d.name.zh).toBeTruthy(); expect(d.name.en).toBeTruthy(); expect(d.stages.length).toBeGreaterThan(1)
    for (const s of d.stages) { expect(s.text.zh).toBeTruthy(); expect(s.text.en).toBeTruthy(); expect(s.actionLabel.zh).toBeTruthy(); expect(s.actionLabel.en).toBeTruthy(); expect(s.observeTicks).toBeGreaterThan(0) }
  }
})
it('keeps the table preview behind the confirmed furniture mode and uses move-count tokens', () => {
  const { world, runtime, view } = fixture('table-game'), active = world.play.active
  active.board = Array(9).fill(-1)
  world.play.active = null as never
  const ui = render(view('wishes', 'en'))
  const start = () => screen.getByRole('button', { name: 'Begin · Three in a row at the table (development preview)' }) as HTMLButtonElement
  expect(start().disabled).toBe(true)
  world.play.tableMode = 'game'; ui.rerender(view('wishes', 'en')); fireEvent.click(start())
  expect(runtime.startPlay).toHaveBeenCalledWith('table-game', ['claude', 'bluewhale'])
  world.play.active = active; ui.rerender(view('wishes', 'en'))
  fireEvent.click(screen.getByRole('button', { name: 'Row 1, column 1 · empty' }))
  expect(runtime.playAction).toHaveBeenLastCalledWith('move', '0', 'test-event:0:0')
  active.board = [0, 1, -1, -1, -1, -1, -1, -1, -1]; active.choices = ['0', '1']; ui.rerender(view('wishes', 'en'))
  fireEvent.click(screen.getByRole('button', { name: 'Row 1, column 3 · empty' }))
  expect(runtime.playAction).toHaveBeenLastCalledWith('move', '2', 'test-event:0:2')
  active.board = [0, 0, 0, 1, 1, -1, -1, -1, -1]; active.choices = ['0', '3', '1', '4', '2']; active.stage = 1; ui.rerender(view('wishes', 'en'))
  expect(screen.getByText(/Three in a row! That was a lovely move/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remember this game' }))
  expect(runtime.playAction).toHaveBeenLastCalledWith('finish', undefined, 'test-event:1:5')
})

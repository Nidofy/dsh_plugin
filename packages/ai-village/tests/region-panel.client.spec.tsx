// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RegionPanel } from '../src/client/RegionPanel.tsx'
import { RegionTransitionOverlay } from '../src/client/RegionTransitionOverlay.tsx'
import { ManagementPanel } from '../src/client/ManagementPanel.tsx'
import { PlayPanel } from '../src/client/PlayPanel.tsx'
import { initialPresentation, presentationReducer, type UIAction } from '../src/client/ui-state.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { switchRegion, bookhouseActivity } from '../src/core/region-engine.ts'
import { scene } from '../src/definitions.ts'

afterEach(cleanup)
function fixture(inside = true) {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  controller.setCharacterPresent('claude', true)
  if (inside) controller.world = switchRegion(controller.world, scene, 'bookhouse')
  const runtime = {
    controller, ready: true, frameReady: true, arranging: false, photoMode: false, regionTransition: false,
    error: '', actionError: '', reasons: new Set<string>(), notices: [],
    presentation: { ...initialPresentation(), drawer: 'half' as const },
    album: { state: null, loaded: true, busy: false, pending: null, error: '', refresh: vi.fn().mockResolvedValue(undefined) },
    switchRegion: vi.fn().mockResolvedValue(undefined), bookhouseActivity: vi.fn().mockResolvedValue(undefined),
    cancelBookhouseActivity: vi.fn().mockResolvedValue(undefined), selectCharacter: vi.fn(), enterPhoto: vi.fn().mockResolvedValue(undefined),
    present: vi.fn((action: UIAction) => { runtime.presentation = presentationReducer(runtime.presentation, action) as typeof runtime.presentation }),
  }
  return { runtime, r: runtime as unknown as VillageRuntime, controller }
}

it('offers explicit travel in Furniture, with all residents and no new dock entry', () => {
  const { runtime, r } = fixture(false)
  runtime.presentation.tab = 'decor'
  const ui = render(<ManagementPanel runtime={r} cn={false} short />)
  fireEvent.click(screen.getByRole('button', { name: 'Furniture' }))
  ui.rerender(<ManagementPanel runtime={r} cn={false} short />)
  expect(screen.getByText('This scene is a development preview; final artwork is still in progress.')).toBeTruthy()
  expect(screen.getAllByRole('tab').map(b => b.textContent)).toEqual(['Residents', 'Wishes', 'Decor', 'Journal'])
  fireEvent.click(screen.getByRole('button', { name: 'Go to AI Bookhouse' }))
  expect(runtime.switchRegion).toHaveBeenCalledExactlyOnceWith('bookhouse')
})

it('uses only present residents and sends each bookhouse activity to the runtime', () => {
  const { runtime, r, controller } = fixture()
  const ui = render(<RegionPanel runtime={r} locale="en" locked={false} tab="residents" />)
  const select = screen.getByRole('combobox', { name: 'Current resident' })
  expect(within(select).getAllByRole('option').map(o => (o as HTMLOptionElement).value)).toEqual(['bluewhale', 'claude'])
  fireEvent.change(select, { target: { value: 'claude' } })
  expect(runtime.selectCharacter).toHaveBeenCalledExactlyOnceWith('claude')
  for (const label of ['Read at the bookcase', 'Write at the reading desk', 'Sit by the window']) fireEvent.click(screen.getByRole('button', { name: label }))
  expect(runtime.bookhouseActivity.mock.calls).toEqual([['bookcase'], ['reading-desk'], ['window-seat']])
  controller.world = bookhouseActivity(controller.world, scene, 'bookcase')
  ui.rerender(<RegionPanel runtime={r} locale="en" locked={false} tab="residents" />)
  fireEvent.click(screen.getByRole('button', { name: 'Stop current activity' }))
  expect(runtime.cancelBookhouseActivity).toHaveBeenCalledOnce()
})

it('blocks paused activities and pending travel while allowing a paused return', () => {
  const { runtime, r, controller } = fixture()
  controller.pause('user', true)
  const ui = render(<RegionPanel runtime={r} locale="zh" locked={false} tab="wishes" />)
  fireEvent.click(screen.getByRole('button', { name: '在书柜选书' }))
  expect(runtime.bookhouseActivity).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '返回小院' }))
  expect(runtime.switchRegion).toHaveBeenCalledExactlyOnceWith('courtyard')
  runtime.regionTransition = true
  ui.rerender(<RegionPanel runtime={r} locale="zh" locked={false} tab="wishes" />)
  expect((screen.getByRole('button', { name: '返回小院' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('region', { name: '慢慢积累的目标' })).toBeTruthy()
})

it('keeps four tabs on every bookhouse page and hides courtyard-only commands', () => {
  const { runtime, r } = fixture()
  const ui = render(<ManagementPanel runtime={r} cn={false} short />)
  for (const tab of ['residents', 'wishes', 'decor'] as const) {
    for (const page of ['quick', 'admissions', 'activities', 'furniture'] as const) {
      runtime.presentation.tab = tab; runtime.presentation.page = page
      ui.rerender(<ManagementPanel runtime={r} cn={false} short />)
      expect(screen.getAllByRole('tab')).toHaveLength(4)
      expect(screen.getByRole('button', { name: 'Return to courtyard' })).toBeTruthy()
      for (const name of ['Manage residents', 'Invite everyone', 'Invite to the table', 'Start arranging', 'Go to AI Bookhouse']) expect(screen.queryByRole('button', { name })).toBeNull()
      expect(screen.queryByRole('button', { name: /Begin ·/ })).toBeNull()
    }
  }
  runtime.presentation.tab = 'residents'; runtime.presentation.page = 'quick'; runtime.actionError = 'FURNITURE_OCCUPIED'
  ui.rerender(<ManagementPanel runtime={r} cn={false} short />)
  expect(screen.getByRole('alert').textContent).toContain('This spot is in use. Wait a moment or choose another place.')
})

it('keeps shared journal, loaded collection facts, album and photo actions accessible in bookhouse', async () => {
  const { runtime, r } = fixture()
  runtime.presentation.tab = 'journal'; runtime.presentation.page = 'memories'
  const ui = render(<ManagementPanel runtime={r} cn={false} short />)
  expect(screen.getByRole('region', { name: 'Collection categories' })).toBeTruthy()
  expect(screen.getByText('First completed activities become memories after saving.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Album' }))
  ui.rerender(<ManagementPanel runtime={r} cn={false} short />)
  await vi.waitFor(() => expect(screen.getByText('No photos yet. Capture a courtyard moment.')).toBeTruthy())
  expect(runtime.album.refresh).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }))
  expect(runtime.enterPhoto).toHaveBeenCalledOnce()
  expect(screen.getAllByRole('tab')).toHaveLength(4)
})

it('does not render courtyard play actions if mounted directly in bookhouse', () => {
  const { r } = fixture()
  const ui = render(<PlayPanel runtime={r} locale="en" tab="wishes" locked={false} />)
  expect(ui.container.childElementCount).toBe(0)
})

it('reveals only through verified entrance readiness and removes its subscription on unmount', () => {
  const { r } = fixture()
  let listener = () => {}, ready = false
  const unsubscribe = vi.fn(), finish = vi.fn(() => { ready = false }), close = vi.fn()
  Object.defineProperty(r, 'canRevealEntrance', { get: () => ready })
  r.finishEntrance = finish
  r.subscribe = vi.fn(fn => { listener = fn; return unsubscribe })
  const ui = render(<RegionTransitionOverlay runtime={r} cn={false} close={close} />)
  expect(screen.getByRole('status').textContent).toContain('Preparing AI Bookhouse…')
  act(() => listener()); expect(finish).not.toHaveBeenCalled()
  ready = true; act(() => listener()); expect(finish).toHaveBeenCalledOnce()
  act(() => listener()); expect(finish).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Close village' })); expect(close).toHaveBeenCalledOnce()
  ui.unmount(); expect(unsubscribe).toHaveBeenCalledOnce()
})

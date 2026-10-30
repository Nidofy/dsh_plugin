// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CommunityJournal } from '../src/client/CommunityJournal.tsx'
import { initialPresentation, presentationReducer } from '../src/client/ui-state.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { scene } from '../src/definitions.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
import type { UIAction } from '../src/client/ui-state.ts'
afterEach(cleanup)

function fixture() {
  const world = createLivingWorld(scene)
  const runtime = {
    controller: { world, pauseReasons: new Set(), drag: null },
    presentation: { ...initialPresentation(), tab: 'journal' as const, drawer: 'full' as const, page: 'memories' as const },
    notices: [], frameReady: true, arranging: false, photoMode: false, regionTransition: false,
    album: { loaded: false, state: null, pending: null, error: '', busy: false, refresh: vi.fn(async () => {}) },
    placeAfternoonKeepsake: vi.fn(async () => {}), enterPhoto: vi.fn(async () => {}),
    present: vi.fn((action: UIAction) => { runtime.presentation = presentationReducer(runtime.presentation, action) as typeof runtime.presentation }),
  }
  return { world, runtime, r: runtime as unknown as VillageRuntime }
}
function memory(world: ReturnType<typeof createLivingWorld>) {
  const eventId = crypto.randomUUID()
  world.afternoon.memories.push({ storyId: 'tea-bookmark', eventId, participants: ['bluewhale', 'claude'], completedTick: 120, day: 1, count: 1, selection: 'leaf' })
  return eventId
}

it('navigates four journal views through presentation history without changing world facts', () => {
  const { world, runtime, r } = fixture(), before = structuredClone(world)
  const ui = render(<CommunityJournal runtime={r} locale="zh" busy={false}/>)
  expect(within(screen.getByRole('navigation', { name: '手账分类' })).getAllByRole('button')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: '居民关系', exact: true }))
  ui.rerender(<CommunityJournal runtime={r} locale="zh" busy={false}/>)
  expect(screen.getByRole('heading', { name: '共同回忆册' })).toBeTruthy()
  expect(runtime.presentation.history).toHaveLength(1)
  runtime.present({ type: 'back' })
  ui.rerender(<CommunityJournal runtime={r} locale="zh" busy={false}/>)
  expect(screen.getByText('社区故事目录')).toBeTruthy()
  expect(world).toEqual(before)
})

it('shows completed provenance only for saved memories and keeps notification anchors', () => {
  const { world, r } = fixture(), eventId = memory(world), before = structuredClone(world)
  const ui = render(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  fireEvent.change(screen.getByRole('combobox', { name: 'Story location' }), { target: { value: 'all' } })
  const entry = ui.container.querySelector('[data-journal-story="tea-bookmark"]')!
  expect(entry.getAttribute('data-story-status')).toBe('completed')
  expect(entry.getAttribute('data-source-event-id')).toBe(eventId)
  expect(entry.textContent).toContain('Tea Square')
  expect(ui.container.querySelector('[data-notice-id="afternoon:tea-bookmark"]')).toBeTruthy()
  const lead = ui.container.querySelector('[data-journal-story="reflection-shapes"]')!
  expect(lead.getAttribute('data-story-status')).toBe('discoverable')
  expect(lead.hasAttribute('data-source-event-id')).toBe(false)
  expect(world).toEqual(before)
})

it('keeps stored keepsakes visible, blocks placement from another region, then delegates legal placement', () => {
  const { world, runtime, r } = fixture(), eventId = memory(world)
  runtime.presentation.subpages.journal = 'collection'
  const ui = render(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  let entry = ui.container.querySelector('[data-journal-keepsake="tea-bookmark"]')! as HTMLElement
  expect(entry.getAttribute('data-source-event-id')).toBe(eventId)
  expect(entry.getAttribute('data-placed-region')).toBe('stored')
  expect(within(entry).getByText('Put away; still unlocked')).toBeTruthy()
  expect((within(entry).getByRole('button', { name: 'Display' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(within(entry).getByRole('button', { name: 'Display' }))
  expect(runtime.placeAfternoonKeepsake).not.toHaveBeenCalled()
  world.region.active = 'tea-square'
  ui.rerender(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  entry = ui.container.querySelector('[data-journal-keepsake="tea-bookmark"]')! as HTMLElement
  fireEvent.click(within(entry).getByRole('button', { name: 'Display' }))
  expect(runtime.placeAfternoonKeepsake).toHaveBeenCalledExactlyOnceWith('tea-bookmark', 'message-tree')
  expect(world.afternoon.keepsakes['tea-bookmark']).toBeNull()
})

it('does not permit keepsake writes while a save or pause is pending', () => {
  const { world, runtime, r } = fixture(); memory(world)
  world.region.active = 'tea-square'; runtime.presentation.subpages.journal = 'collection'
  const ui = render(<CommunityJournal runtime={r} locale="zh" busy/>)
  expect((screen.getByRole('button', { name: '摆放', exact: true }) as HTMLButtonElement).disabled).toBe(true)
  runtime.controller.pauseReasons.add('user')
  ui.rerender(<CommunityJournal runtime={r} locale="zh" busy={false}/>)
  expect((screen.getByRole('button', { name: '摆放', exact: true }) as HTMLButtonElement).disabled).toBe(true)
  expect(runtime.placeAfternoonKeepsake).not.toHaveBeenCalled()
})

it('offers all twelve residents with bounded pair pages and resets pagination on resident change', () => {
  const { runtime, r } = fixture(); runtime.presentation.subpages.journal = 'relationships'
  const ui = render(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  const selector = screen.getByRole('combobox')
  expect(within(selector).getAllByRole('option')).toHaveLength(12)
  expect(ui.container.querySelectorAll('[data-relationship]')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }))
  expect(ui.container.querySelectorAll('[data-relationship]')).toHaveLength(3)
  fireEvent.change(selector, { target: { value: 'llama' } })
  expect(screen.getByText('1/3')).toBeTruthy()
  expect(ui.container.querySelectorAll('[data-relationship]')).toHaveLength(4)
  expect(ui.container.querySelectorAll('[data-relationship] article')).toHaveLength(0)
})

it('loads the existing album only when opening its page and does not invent photo history', async () => {
  const { runtime, r } = fixture()
  const ui = render(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  expect(runtime.album.refresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Album', exact: true }))
  ui.rerender(<CommunityJournal runtime={r} locale="en" busy={false}/>)
  expect(await screen.findByText('No photos yet. Capture a courtyard moment.')).toBeTruthy()
  expect(runtime.album.refresh).toHaveBeenCalledOnce()
})

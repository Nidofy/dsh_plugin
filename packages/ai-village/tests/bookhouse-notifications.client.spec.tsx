// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ManagementPanel } from '../src/client/ManagementPanel.tsx'
import { Notifications } from '../src/client/Notifications.tsx'
import { initialPresentation, presentationReducer, type UIAction } from '../src/client/ui-state.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
import { defaultPreferences } from '../src/core/preferences.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { deriveNotices } from '../src/core/notifications.ts'
import { scene } from '../src/definitions.ts'

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})
function fixture() {
  const world = createLivingWorld(scene)
  world.ticks = 1200
  const id = '9c00cdb4-52d5-4f56-a12f-31af3cf5e591'
  world.bookhouse = { version: 1, active: null, lastEventId: id, keepsake: 'courtyard', memory: { eventId: id, participants: ['bluewhale', 'seedance'], completedTick: 900, count: 2, theme: 'wind' } }
  const runtime = {
    controller: new LivingController(world, scene, () => {}), ready: true, frameReady: true,
    arranging: false, photoMode: false, regionTransition: false, error: '', actionError: '', reasons: new Set<string>(),
    notices: deriveNotices(world), saveReceipt: { status: 'committed' }, preferencesSaving: false,
    preferences: { ...defaultPreferences, noticesInitialized: true, noticeReadIds: [] as string[] },
    presentation: { ...initialPresentation(), drawer: 'half' as const, tab: 'journal' as const },
    album: { state: null, loaded: true, busy: false, pending: null, error: '', refresh: vi.fn().mockResolvedValue(undefined) },
    markNoticesRead: vi.fn(async (ids: string[]) => { runtime.preferences.noticeReadIds.push(...ids) }),
    present: vi.fn((action: UIAction) => { runtime.presentation = presentationReducer(runtime.presentation, action) as typeof runtime.presentation }),
  }
  return { runtime, r: runtime as unknown as VillageRuntime }
}

it.each([true, false])('opens the bookhouse notification as one titled, focused, read journal row (Chinese=%s)', async cn => {
  const { runtime, r } = fixture(), title = cn ? '夹在书里的微光' : 'A little light between the pages'
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  // jsdom omits CSS.escape; encode punctuation in this DOM-only environment.
  vi.stubGlobal('CSS', { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch.codePointAt(0)!.toString(16)} `) })
  const content = () => <><Notifications runtime={r} cn={cn}/><ManagementPanel runtime={r} cn={cn} short/></>
  const ui = render(content())
  expect(screen.getByText(title)).toBeTruthy() // Latest-memory quick view must not be blank.
  expect(ui.container.querySelectorAll('[data-notice-id]')).toHaveLength(0)
  runtime.present({ type: 'overlay', overlay: 'notifications' }); ui.rerender(content())
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
  ui.rerender(content())
  const rows = ui.container.querySelectorAll<HTMLElement>('[data-notice-id]')
  expect(rows).toHaveLength(1)
  expect(rows[0]!.dataset.noticeId).toBe(runtime.notices[0]!.id)
  expect(within(rows[0]!).getByRole('heading', { name: title })).toBeTruthy()
  expect(rows[0]!.textContent).toContain('Seedance')
  expect(rows[0]!.textContent).toContain('×2')
  expect(rows[0]!.textContent).toContain(cn ? '翻页的一阵风' : 'page-turning breeze')
  expect(document.activeElement).toBe(rows[0])
  expect(scroll).toHaveBeenCalledOnce()
  expect(runtime.markNoticesRead).toHaveBeenCalledExactlyOnceWith([runtime.notices[0]!.id])
  expect(runtime.presentation.noticeTarget).toBeNull()
  runtime.present({ type: 'patch', patch: { page: 'album', subpages: { ...runtime.presentation.subpages, journal: 'album' } } })
  await act(async () => { ui.rerender(content()) })
  expect(ui.container.querySelectorAll('[data-notice-id]')).toHaveLength(0)
})

it('routes a settled completion toast to the same durable journal entry', () => {
  vi.useFakeTimers()
  const { runtime, r } = fixture(), id = runtime.notices[0]!.id
  runtime.presentation.toastIds = [id]
  const ui = render(<Notifications runtime={r} cn={false}/>)
  expect(screen.queryByRole('button', { name: 'View' })).toBeNull()
  act(() => { vi.advanceTimersByTime(3000) })
  fireEvent.click(screen.getByRole('button', { name: 'View' }))
  expect(runtime.presentation).toMatchObject({ tab: 'journal', page: 'memories', drawer: 'full', noticeTarget: id })
  ui.unmount()
})

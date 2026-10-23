// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlayPanel } from '../src/client/PlayPanel.tsx'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { currentEncounter, encounterWindow, dismissEncounter } from '../src/core/encounter.ts'
import { scene } from '../src/definitions.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
afterEach(cleanup)
function fixture() {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  controller.setCharacterPresent('claude', true)
  const runtime = { controller, arranging: false, actionError: '', album: { state: null }, startPlay: vi.fn().mockResolvedValue(undefined), dismissEncounter: vi.fn(async (token: string) => { controller.world = dismissEncounter(controller.world, scene, token) }) }
  const view = () => <PlayPanel runtime={runtime as unknown as VillageRuntime} tab="wishes" locale="en" locked={false}/>
  return { runtime, controller, view }
}
it('offers an encounter only in its real window and passes its token with two actual participants', () => {
  const { runtime, controller, view } = fixture(), ui = render(view())
  expect(screen.queryByRole('article', { name: 'A chance encounter now' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Begin · A runaway message/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Begin · A letter from the leaves/ })).toBeNull()
  controller.world.ticks = encounterWindow(0).startsTick; ui.rerender(view())
  const offer = currentEncounter(controller.world)!
  expect(screen.getByRole('article', { name: 'A chance encounter now' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Lend a hand' }))
  expect(runtime.startPlay).toHaveBeenCalledExactlyOnceWith(offer.definitionId, ['bluewhale', 'claude'], offer.token)
})
it('refuses a stale accept or dismiss button even if ticks changed before React rerendered', () => {
  const { runtime, controller, view } = fixture()
  controller.world.ticks = encounterWindow(0).startsTick
  const offer = currentEncounter(controller.world)!, ui = render(view())
  controller.world.ticks = offer.expiresTick
  fireEvent.click(screen.getByRole('button', { name: 'Lend a hand' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pass this time' }))
  expect(runtime.startPlay).not.toHaveBeenCalled(); expect(runtime.dismissEncounter).not.toHaveBeenCalled()
  ui.rerender(view()); expect(screen.queryByRole('article', { name: 'A chance encounter now' })).toBeNull()
})
it('passes the current dismiss token and does not list a consumed encounter as a permanent activity', async () => {
  const { runtime, controller, view } = fixture()
  controller.world.ticks = encounterWindow(0).startsTick
  const offer = currentEncounter(controller.world)!, ui = render(view())
  fireEvent.click(screen.getByRole('button', { name: 'Pass this time' }))
  await vi.waitFor(() => expect(runtime.dismissEncounter).toHaveBeenCalledExactlyOnceWith(offer.token))
  ui.rerender(view()); expect(screen.queryByRole('button', { name: 'Lend a hand' })).toBeNull()
  expect(controller.world.neighborhood.memories).toEqual([])
})

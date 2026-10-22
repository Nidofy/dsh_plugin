// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TableGamePanel, TableModePanel } from '../src/client/TableGamePanel.tsx'
import type { VillageRuntime } from '../src/client/runtime.ts'
import type { PlayEvent } from '../src/core/living-state.ts'
afterEach(cleanup)
const active = (board = Array(9).fill(-1), choices: string[] = []) => ({ board, choices, participants: ['bluewhale', 'claude'], stage: 0 } as Pick<PlayEvent, 'board' | 'choices' | 'participants' | 'stage'>)
it('renders a keyboard board, skipping occupied squares without allowing occupied or paused moves', () => {
  const onMove = vi.fn(), game = active([0, 1, -1, -1, -1, -1, -1, -1, -1], ['0', '1'])
  const ui = render(<TableGamePanel active={game} locale="en" ready onMove={onMove}/>)
  expect(screen.getAllByRole('button')).toHaveLength(9)
  const empty = screen.getByRole('button', { name: 'Row 1, column 3 · empty' })
  empty.focus(); fireEvent.keyDown(empty, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Row 2, column 3 · empty' }))
  fireEvent.click(document.activeElement!); expect(onMove).toHaveBeenCalledWith(5)
  fireEvent.click(screen.getByRole('button', { name: 'Row 1, column 1 · you, circle' })); expect(onMove).toHaveBeenCalledTimes(1)
  ui.rerender(<TableGamePanel active={game} locale="en" ready={false} onMove={onMove}/>); fireEvent.click(empty)
  expect(onMove).toHaveBeenCalledTimes(1)
})
it.each([
  [[0, 0, 0, 1, 1, -1, -1, -1, -1], '你先连成了三颗'],
  [[0, 0, -1, 1, 1, 1, 0, -1, -1], '这次让我先连成了'],
  [[0, 1, 0, 0, 1, 1, 1, 0, 0], '平局也很有趣'],
] as const)('shows the final board and a warm result without any more moves', (board, reaction) => {
  const onMove = vi.fn(), game = active([...board], board.flatMap((value, index) => value === -1 ? [] : [String(index)])); game.stage = 1
  render(<TableGamePanel active={game} locale="zh" ready onMove={onMove}/>)
  expect(screen.getByText(new RegExp(reaction))).toBeTruthy()
  for (const button of screen.getAllByRole('button')) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button) }
  expect(onMove).not.toHaveBeenCalled()
})
it('changes the furniture mode only after explicit confirmation and allows cancellation without a write', async () => {
  const runtime = { controller: { world: { activeEvent: null, neighborhood: { event: null }, play: { active: null, tableMode: 'dining' } } }, arranging: false, actionError: '', setTableMode: vi.fn().mockResolvedValue(undefined) }
  const ui = render(<TableModePanel runtime={runtime as unknown as VillageRuntime} locale="en" locked={false}/>)
  fireEvent.click(screen.getByRole('button', { name: 'Game surface' })); expect(runtime.setTableMode).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel change' })); expect(runtime.setTableMode).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Game surface' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm table use' }))
  expect(runtime.setTableMode).toHaveBeenCalledExactlyOnceWith('game')
  await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel change' })).toBeNull())
  runtime.controller.world.play.active = {} as never
  ui.rerender(<TableModePanel runtime={runtime as unknown as VillageRuntime} locale="en" locked={false}/>)
  expect((screen.getByRole('button', { name: 'Game surface' }) as HTMLButtonElement).disabled).toBe(false)
  // Fieldset semantics disable descendants without setting each button's own disabled property.
  expect(screen.getByRole('button', { name: 'Game surface' }).closest('fieldset')!.disabled).toBe(true)
})

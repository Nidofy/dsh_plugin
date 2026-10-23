// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ManagementPanel } from '../src/client/ManagementPanel.tsx'
import { initialPresentation } from '../src/client/ui-state.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'
import { createLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import type { CharacterId } from '../src/core/roster.ts'
import { scene } from '../src/definitions.ts'

afterEach(cleanup)
it.each([true, false])('lists twelve residents and explains the seven-person capacity (Chinese: %s)', cn => {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  for (const id of ['claude', 'seedance', 'glm', 'minimax', 'llama', 'mistral'] as const) controller.setCharacterPresent(id, true)
  const setCharacterPresent = vi.fn((id: CharacterId, present: boolean) => controller.setCharacterPresent(id, present))
  const runtime = {
    controller, ready: true, arranging: false, photoMode: false, regionTransition: false,
    error: '', actionError: '', reasons: new Set<string>(), notices: [],
    presentation: { ...initialPresentation(), drawer: 'full', tab: 'residents', page: 'admissions' },
    setCharacterPresent, setAllCharacters: vi.fn(), present: vi.fn(),
  } as unknown as VillageRuntime
  const ui = render(<ManagementPanel runtime={runtime} cn={cn} short={false} />)
  const label = (name: string) => (cn ? '入住 ' : 'Resident ') + name
  expect(screen.getAllByRole('checkbox')).toHaveLength(12)
  expect(screen.getByText(cn ? /最多七位同时在场/ : /up to seven present/)).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: label('Kimi') }) as HTMLInputElement).disabled).toBe(true)
  const glm = screen.getByRole('checkbox', { name: label('GLM') }) as HTMLInputElement
  expect(glm.checked).toBe(true); expect(glm.disabled).toBe(false)
  fireEvent.click(glm)
  expect(setCharacterPresent).toHaveBeenCalledWith('glm', false)
  ui.rerender(<ManagementPanel runtime={runtime} cn={cn} short={false} />)
  expect((screen.getByRole('checkbox', { name: label('Kimi') }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.queryByRole('button', { name: cn ? '全员入住' : 'Invite everyone' })).toBeNull()
})

// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RelationshipPanel } from '../src/client/relationship-panel.tsx'
import { createLivingWorld } from '../src/core/living-state.ts'
import { scene } from '../src/definitions.ts'
afterEach(cleanup)

it('offers twelve residents, eleven collapsed pairs and bilingual optional titles', () => {
  const world = createLivingWorld(scene), ui = render(<RelationshipPanel world={world} locale="en"/>)
  expect(screen.getByRole('heading', { name: 'Shared memory book' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'View a resident’s shared memories' })).toBeTruthy()
  expect(screen.getAllByRole('option')).toHaveLength(12)
  expect(ui.container.querySelectorAll('details[data-relationship]')).toHaveLength(11)
  expect(ui.container.querySelectorAll('details[open]')).toHaveLength(0)
  expect(screen.getByText(/no need to collect every pair/)).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'glm' } })
  expect(screen.getByRole('status').textContent).toBe('GLM · 0 pairs with saved records')
  ui.rerender(<RelationshipPanel world={world} locale="zh"/>)
  expect(screen.getByRole('heading', { name: '共同回忆册' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: '查看居民的共同回忆' })).toBeTruthy()
  expect(screen.getByText(/称号随真实回忆点亮/)).toBeTruthy()
})

it('shows precise bond-only limitations and the genuine bookhouse source without a claim action', () => {
  const world = createLivingWorld(scene)
  world.bookhouse.memory = { eventId: crypto.randomUUID(), participants: ['bluewhale', 'claude'], completedTick: 40, count: 99, theme: 'light' }
  world.bookhouse.keepsake = 'bookhouse'
  world.neighborhood.bonds.push({ pair: ['bluewhale', 'gemini'], count: 2, lastTick: 50 })
  const ui = render(<RelationshipPanel world={world} locale="en"/>)
  expect(screen.getByText('Source: the first saved bookhouse reading')).toBeTruthy()
  expect(screen.getByText(/Related keepsake.*Little-light bookmark.*Bookhouse/)).toBeTruthy()
  expect(screen.getByText(/no specific activity details for this pair/)).toBeTruthy()
  expect(screen.getByText(/2 recorded shared activities/)).toBeTruthy()
  expect(ui.container.textContent).not.toContain('99')
  expect(screen.queryByRole('button')).toBeNull()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gemini' } })
  expect(screen.queryByText('Source: the first saved bookhouse reading')).toBeNull()
})

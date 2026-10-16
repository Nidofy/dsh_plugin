// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Settings } from '../src/client/registration.tsx'
import { en } from '../src/client/locales.ts'
vi.mock('../src/client/Enhancement.tsx', () => ({ Enhancement: () => null }))
vi.mock('../src/client/NotebookPanel.tsx', () => ({ NotebookPanel: ({ sessionId }: { sessionId: string }) => <div data-testid="note-session">{sessionId}</div> }))
afterEach(cleanup)
it('uses original session-list props for explicit selection and closes the old panel on reconnection', () => {
  let generation = { id: 'first' }
  const props = {
    useSessions: (select: (value: unknown) => unknown) => select({ ids: ['a', 'b'], byId: { a: { title: 'First' }, b: { title: 'Second' } } }),
    useGeneration: (select: (value: unknown) => unknown) => select(generation),
    useStore: (select: (value: unknown) => unknown) => select({ drafts: {}, uncertain: {} }),
    t: (key: keyof typeof en) => en[key], actions: { edit: vi.fn(), markUncertain: vi.fn() },
    using: vi.fn(), citeSource: vi.fn(), refreshFacts: vi.fn(),
  } as unknown as Parameters<typeof Settings>[0]
  const view = render(<Settings {...props} />)
  expect((screen.getByRole('button', { name: en.openNotebook }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
  fireEvent.click(screen.getByRole('button', { name: en.openNotebook }))
  expect(screen.getByTestId('note-session').textContent).toBe('b')
  generation = { id: 'second' }; view.rerender(<Settings {...props} />)
  expect(screen.queryByTestId('note-session')).toBeNull()
})

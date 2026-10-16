// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StandardPanel, standardEn } from '../src/client/StandardPanel.tsx'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('saves an explicit note with exact evidence and keeps an uncertain draft until refresh', async () => {
  const calls: { method: string; input: Record<string, unknown> }[] = []
  let fail = true
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const method = url.split('/').at(-1)!, input = JSON.parse(String(init.body)); calls.push({ method, input })
    if (method === 'sessions') return Response.json([{ id: 'session', cwd: '/project' }])
    if (method === 'status') return Response.json({ notebook: { schemaVersion: 1, sessionId: 'session', revision: 0, sourceThrough: -1, entries: [] } })
    if (method === 'events') return Response.json([{ seq: 2, type: 'user/message', text: 'Keep the original source' }])
    if (method === 'update' && fail) throw Error('CONNECTION_LOST')
    return Response.json({ schemaVersion: 1, sessionId: 'session', revision: 1, sourceThrough: 2, entries: [] })
  })
  const t = ((key: keyof typeof standardEn) => standardEn[key]) as PropsLocale<'nidofy.notebook-standard'>['t']
  render(<StandardPanel t={t} />)
  await screen.findByText('/project · session')
  fireEvent.change(screen.getByLabelText('Conversation'), { target: { value: 'session' } })
  await screen.findByText('No notes yet.')
  fireEvent.change(screen.getByLabelText('Original evidence'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Working note'), { target: { value: 'Preserve source' } })
  fireEvent.click(screen.getByText('Save note'))
  await screen.findByText(/The result is unconfirmed/)
  expect((screen.getByLabelText('Working note') as HTMLTextAreaElement).value).toBe('Preserve source')
  expect((screen.getByText('Save note') as HTMLButtonElement).disabled).toBe(true)
  const writes = calls.filter(call => call.method === 'update')
  expect(writes).toHaveLength(1)
  expect(writes[0]?.input.delta).toMatchObject({ baseRevision: 0, sourceThrough: 2, operations: [{ action: 'ADD', seq: 2, quote: 'Keep the original source', text: 'Preserve source' }] })
  fail = false; fireEvent.click(screen.getByText('Refresh'))
  await waitFor(() => expect((screen.getByText('Save note') as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByText('Save note'))
  await waitFor(() => expect((screen.getByLabelText('Working note') as HTMLTextAreaElement).value).toBe(''))
})

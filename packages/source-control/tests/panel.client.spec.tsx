// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RepositoryPanel, type Request } from '../src/client/Panel.tsx'
import type { Snapshot } from '../src/shared.ts'
afterEach(cleanup)
const snapshot: Snapshot = { id: 'repo', name: 'demo', root: '/workspace/demo', vcs: 'git', branch: 'main', head: 'abc', revision: 'revision-one', branches: [{ name: 'main', node: 'abc', current: true }, { name: 'feature', node: 'def', current: false }], changes: [{ path: 'file.txt', index: ' ', worktree: 'M' }], remotes: ['origin'], added: 2, removed: 1, stagedAdded: 0, stagedRemoved: 0, conflict: false }
function fixture(mutate: (input: object) => Promise<unknown> = async () => ({ ...snapshot, revision: 'revision-two' })) {
  const calls: { route: string; input: object; signal: AbortSignal }[] = []
  const api: Request = async (route, input, signal) => {
    calls.push({ route, input, signal })
    return (route === 'repositories' ? { repositories: [snapshot], warnings: [] } : route === 'status' ? snapshot : route === 'mutate' ? await mutate(input) : route === 'diff' ? '+<script>alert(1)</script>\n-text' : []) as never
  }
  return { api, calls }
}
it('requires an explicit review and confirm, retains reviewed revision, and never renders diff HTML', async () => {
  const { api, calls } = fixture(); render(<RepositoryPanel projectRoot="/workspace/demo" api={api} locale="zh" />)
  await screen.findByRole('button', { name: /^变更/ })
  await waitFor(() => expect(screen.getByRole('button', { name: /^变更/ }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: /^变更/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'file.txt' }))
  fireEvent.click(screen.getByRole('button', { name: 'file.txt' }))
  await screen.findByText('+<script>alert(1)</script>')
  expect(document.querySelector('script')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '暂存选中项' }))
  expect(calls.some(c => c.route === 'mutate')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '确认执行' }))
  await screen.findByText('操作已完成')
  expect(calls.find(c => c.route === 'mutate')!.input).toMatchObject({ id: 'repo', revision: 'revision-one', paths: ['file.txt'], action: 'stage' })
})
it('does not retry uncertain writes, refreshes state, and preserves commit drafts', async () => {
  const mutate = vi.fn(async () => { throw Error('REVISION_CONFLICT') }), { api, calls } = fixture(mutate)
  render(<RepositoryPanel projectRoot="/workspace/demo" api={api} locale="en" />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Commit.*changed files/ }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: /Commit.*changed files/ }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Commit message' }), { target: { value: 'keep my draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review operation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await screen.findByRole('alert')
  await waitFor(() => expect(calls.filter(c => c.route === 'status').length).toBe(2))
  expect(mutate).toHaveBeenCalledTimes(1)
  await waitFor(() => expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLTextAreaElement).value).toBe('keep my draft'))
})
it('aborts requests when a panel unmounts', async () => {
  let signal: AbortSignal | undefined
  const api: Request = async (_route, _input, value) => { signal = value; return await new Promise(() => {}) }
  const view = render(<RepositoryPanel projectRoot="/workspace/demo" api={api} />); view.unmount(); expect(signal!.aborted).toBe(true)
})

it('shows only the current project and discards reviewed operations when projects change', async () => {
  const other = { ...snapshot, id: 'other', name: 'other-project', root: '/workspace/other' }
  const calls: { route: string; input: Record<string, unknown>; signal: AbortSignal }[] = []
  const api: Request = async (route, input, signal) => {
    calls.push({ route, input: input as Record<string, unknown>, signal })
    return (route === 'repositories' ? { repositories: [snapshot, other], warnings: [] } : (input as { id: string }).id === 'other' ? other : snapshot) as never
  }
  const view = render(<RepositoryPanel projectRoot={snapshot.root} api={api} locale="en" />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Commit.*changed files/ }).hasAttribute('disabled')).toBe(false))
  expect(screen.queryByRole('article', { name: 'other-project' })).toBeNull()
  expect(calls.filter(c => c.route === 'status').map(c => c.input.id)).toEqual(['repo'])
  fireEvent.click(screen.getByRole('button', { name: /^Changes/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'file.txt' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stage selected' }))
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined()
  const previous = [...calls]
  view.rerender(<RepositoryPanel projectRoot={other.root} api={api} locale="en" />)
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
  expect(screen.queryByRole('article', { name: 'demo' })).toBeNull()
  await screen.findByRole('article', { name: 'other-project' })
  expect(previous.every(c => c.signal.aborted)).toBe(true)
  expect(calls.some(c => c.route === 'mutate')).toBe(false)
})

it('does not enumerate repositories with no selected project', async () => {
  const { api, calls } = fixture()
  render(<RepositoryPanel projectRoot={null} api={api} locale="zh" />)
  await screen.findByText('请先选择项目或会话，再查看对应仓库。')
  expect(calls).toEqual([])
})

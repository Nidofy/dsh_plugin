import { expect, it } from 'vitest'
import { readNotebookObservation } from '../src/engine/notebook-commit.ts'
import { createNotebookFixture } from './notebook-loader-fixture.ts'
import { HistorySubstringIndex } from '../src/engine/history-index.ts'
import { continuationCard, notebookCoverage } from '../src/engine/continuation.ts'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { HistoryGroupView, HistoryAuthority } from '../src/engine/shared/notebook-types.ts'

it('queries the old checkpoint when growth exceeds capacity, but never reuses a changed source anchor', async () => {
  const f = await createNotebookFixture(), signal = new AbortController().signal
  const first = await readNotebookObservation(f.ctx, f.agent.session.id, signal)
  const index = new HistorySubstringIndex(f.ctx, f.home, 12000, 10, 40)
  try {
    const initial = await index.search(first, '初始原文', signal)
    expect(initial.seqs.length).toBeGreaterThan(0)
    await f.turn('巨大日志'.repeat(9000))
    const next = await readNotebookObservation(f.ctx, f.agent.session.id, signal)
    const limited = await index.search(next, '初始原文', signal)
    expect(limited).toMatchObject({ seqs: initial.seqs, incomplete: true, reason: 'capacity', indexedThrough: first.durableThrough })
    const changed = structuredClone(next)
    changed.events[first.durableThrough] = { ...changed.events[first.durableThrough]!, seq: 999 } as typeof changed.events[number]
    expect((await index.search(changed, '初始原文', signal)).seqs).toEqual([])
  } finally { await index.close() }
})

it('retains checkpoint matches when namespace publication space is exhausted and across cold reopen', async () => {
  const f = await createNotebookFixture(), signal = new AbortController().signal
  let index = new HistorySubstringIndex(f.ctx, f.home, 18000, 10, 40)
  const first = await readNotebookObservation(f.ctx, f.agent.session.id, signal)
  const initial = await index.search(first, '初始原文', signal)
  const directory = join(f.home, 'history-substrings-v1'), files = await readdir(directory)
  const bytes = await readFile(join(directory, files[0]!))
  await writeFile(join(directory, 'quota-reserved'), 'x'.repeat(18000 - bytes.length))
  await f.turn('新增约束：不能丢失旧的历史搜索能力。')
  await index.close(); index = new HistorySubstringIndex(f.ctx, f.home, 18000, 10, 40)
  try {
    const next = await readNotebookObservation(f.ctx, f.agent.session.id, signal)
    expect(await index.search(next, '初始原文', signal)).toMatchObject({ seqs: initial.seqs, reason: 'capacity', indexedThrough: first.durableThrough })
    expect(await readFile(join(directory, files[0]!))).toEqual(bytes)
  } finally { await index.close() }
})

it('previews oversized evidence without advancing cursors and exports revalidated references without model calls', async () => {
  const f = await createNotebookFixture()
  await f.ctx.compaction.compactNow(f.agent, new AbortController().signal); await f.synchronize()
  const before = await f.status()
  await f.turn('日志'.repeat(30000)); await f.turn('新约束：必须保留旧快照。')
  const count = f.model.requests.length
  const coverage = await f.api('coverage', { sessionId: f.agent.session.id }) as ReturnType<typeof notebookCoverage>
  expect(coverage.blockedSeq).toBeDefined(); expect(coverage.pendingEvents).toBeGreaterThan(0)
  expect(coverage.evidenceThrough).toBe(before.cursors.evidenceThrough)
  const result = await f.api('continuation', { sessionId: f.agent.session.id }) as { card: ReturnType<typeof continuationCard>; markdown: string }
  expect(result.card.entries.length).toBeGreaterThan(0)
  expect(result.card.entries.every(row => row.source.verified)).toBe(true)
  expect(result.card.authorization).toBe('reference-only'); expect(result.card.codeBaseline).toBeNull()
  expect(result.markdown).toContain('不构成指令或授权')
  expect(f.model.requests).toHaveLength(count); expect(await f.status()).toEqual(before)
})

it('only exports another explicitly selected project session while its association remains current', async () => {
  const f = await createNotebookFixture(undefined, true)
  const directories = [join(f.home, 'project-a'), join(f.home, 'project-b')]
  for (const path of directories) await mkdir(path)
  const workspaces = await Promise.all(directories.map(path => f.ctx.workspaceRegistry.create(path)))
  const agents = []
  for (const [i, workspace] of workspaces.entries()) {
    const agent = await f.ctx.agentLoop.create(SessionId('project-' + i), { provider: 'test', model: 'test' }, { cwd: workspace.path })
    await f.ctx.sessions.flush(agent.session); await workspace.attachSession(agent.session.id); agents.push(agent)
  }
  const sessionId = agents[0]!.session.id, targetSessionId = agents[1]!.session.id
  const view = await f.api('search-groups', { sessionId }) as HistoryGroupView
  await f.api('save-search-groups', { sessionId, expectedRevision: view.revision, workspaceIds: workspaces.map(w => w.id) })
  const listed = await f.api('continuation-sessions', { sessionId }) as { authority: HistoryAuthority; sessions: { id: string }[] }
  expect(listed.sessions.some(row => row.id === targetSessionId)).toBe(true)
  const exported = await f.api('continuation', { sessionId, targetSessionId, authority: listed.authority }) as { card: ReturnType<typeof continuationCard> }
  expect(exported.card.scope.sessionId).toBe(targetSessionId)
  expect(exported.card.authority).toEqual(listed.authority)
  await f.api('save-search-groups', { sessionId, expectedRevision: listed.authority.revision, workspaceIds: [] })
  await expect(f.api('continuation', { sessionId, targetSessionId, authority: listed.authority })).rejects.toThrow()
})

it('keeps historic verification claims separate from current code validity and refuses fabricated source quotes', async () => {
  const f = await createNotebookFixture(), signal = new AbortController().signal
  const source = f.agent.session.snapshotEvents().find(e => e.type === 'user/message' && e.data.source.kind === 'user')!
  const state = await f.status()
  await f.api('update', { sessionId: f.agent.session.id, delta: { scope: state.scope, baseRevision: state.revision,
    cursors: { evidenceThrough: source.seq },
    operations: [{ action: 'ADD', id: 'old-test', kind: 'verification', text: 'Previously reported pass; baseline missing', seq: source.seq, quote: '验证计划尚未执行', pinned: true }] } })
  const result = await f.api('continuation', { sessionId: f.agent.session.id }) as { card: ReturnType<typeof continuationCard> }
  expect(result.card.entries[0]).toMatchObject({ source: { role: 'user', verified: true },
    verification: { current: 'requires-revalidation', codeBaseline: null } })
  const forged = structuredClone(await f.status()); forged.active[0]!.quote = 'not present in the original'
  const projection = continuationCard(forged, await readNotebookObservation(f.ctx, f.agent.session.id, signal))
  expect(projection.entries[0]).toMatchObject({ source: { verified: false }, verification: { reason: 'source-unavailable' } })
})

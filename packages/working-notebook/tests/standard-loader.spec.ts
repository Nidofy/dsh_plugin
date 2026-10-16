/** Same production plugin exercised against both original and desktop DSH source APIs. */
import { expect, it, onTestFinished, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteQuery from '@deepseek-ai/dsh-session-query-sqlite'
import { SessionId } from '@deepseek-ai/dsh-session'
import { LlmAdapter, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Notebook from '../src/standard.ts'
import * as Pets from '../../desktop-pets/src/index.ts'
const paths = vi.hoisted(() => ({ home: '' }))
vi.mock('@deepseek-ai/dsh-home-paths', () => ({ resolveDshHome: () => paths.home }))
class Transport extends Service { constructor(ctx: Context) { super(ctx, 'connection') } }
class Model extends LlmAdapter {
  requests: GenerateOptions[] = []
  override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model, context: { contextWindow: 100000, maxOutputTokens: 4096 } } }
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options); yield { type: 'text-delta', index: 0, text: 'Synthetic response.' }; yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
it('uses original services for notes, evidence, prompt logging and independent pet disposal', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-standard-notebook-')), ctx = new Context()
  paths.home = home
  onTestFinished(async () => { await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
  await ctx.plugin({ name: 'dependencies', apply: mountAgentLoopTestDependencies })
  await ctx.plugin(Transport)
  await ctx.plugin(JsonlSessionPersistence, { root: join(home, 'sessions') })
  await ctx.plugin(SqliteQuery, { path: ':memory:', openAt: 'first-search' })
  const notebook = await ctx.plugin(Notebook, Notebook.Config({})), pets = await ctx.plugin(Pets)
  await ctx.plugin(AgentLoop, { agents: [] })
  const model = new Model(); ctx.llm.registerAdapter(['test'], model)
  const agent = await ctx.agentLoop.create(SessionId('standard-notebook'), { provider: 'test', model: 'test' })
  const turn = async (text: string) => { agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle() }
  await turn('Original source: preserve this constraint.')
  expect(model.requests[0]?.tools?.map(tool => tool.name)).toContain('notebook_read')
  expect(model.requests[0]?.tools?.map(tool => tool.name)).toContain('notebook_update')
  const server = createServer((request, response) => { void ctx.waterfall('connection/request', request, response, () => { response.writeHead(404); response.end('{}'); return Promise.resolve() }) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  onTestFinished(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const post = async (method: string, input: object = {}) => {
    const response = await fetch(base + '/api/nidofy-notebook/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    return { status: response.status, value: await response.json() }
  }
  const sessionId = agent.session.id, source = agent.session.snapshotEvents().find(event => event.type === 'user/message')!
  expect((await post('settings')).value).toMatchObject({ mode: 'standard', autoOrganizeSupported: false })
  expect((await post('sessions')).value).toContainEqual(expect.objectContaining({ id: sessionId }))
  expect((await post('status', { sessionId })).value.notebook.revision).toBe(0)
  const delta = { baseRevision: 0, sourceThrough: source.seq, operations: [{ action: 'ADD', id: '', kind: 'constraint', text: 'Preserve this constraint.', seq: source.seq, quote: 'preserve this constraint', pinned: true }] }
  expect((await post('update', { sessionId, delta })).status).toBe(200)
  expect((await post('update', { sessionId, delta })).status).toBe(409)
  await turn('Continue.')
  const input = JSON.stringify(model.requests.at(-1)!.messages)
  expect(input).toContain('Working notes at this turn boundary.')
  expect(input).toContain('Preserve this constraint.')
  await ctx.sessions.flush(agent.session)
  const handle = await ctx.sessionPersistence.open(sessionId, 'read')
  try { expect(JSON.stringify((await handle.read()).events)).toContain('Working notes at this turn boundary.') } finally { await handle.close() }
  const petStatus = () => fetch(base + '/api/nidofy-pets/status', { method: 'POST', body: '{}' })
  expect((await petStatus()).status).toBe(200)
  await pets.dispose(); expect((await petStatus()).status).toBe(404)
  expect((await post('status', { sessionId })).status).toBe(200)
  await notebook.dispose(); expect((await post('settings')).status).toBe(404)
  const reload = await ctx.plugin(Notebook, Notebook.Config({}))
  expect((await post('status', { sessionId })).value.notebook.entries[0].pinned).toBe(true)
  const current = join(home, 'nidofy-extras/notebooks', createHash('sha256').update(sessionId).digest('hex'), 'v2/current.json')
  await mkdir(join(current, '..'), { recursive: true }); await writeFile(current, '{"preserve":"enhanced"}')
  expect((await post('status', { sessionId })).value.error).toBe('NOTEBOOK_ENHANCED_RUNTIME_REQUIRED')
  expect(await readFile(current, 'utf8')).toBe('{"preserve":"enhanced"}')
  await reload.dispose()
})

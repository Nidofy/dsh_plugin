/** Real Cordis lifetimes and HTTP routes with isolated user data. */
import { expect, it, onTestFinished, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Pets from '../src/index.ts'
import * as Notebook from '../../working-notebook/src/enhanced.ts'
import JsonlSessionPersistence from '@nidofy/dsh-runtime-adapter/jsonl'
import SqliteQuery from '@deepseek-ai/dsh-session-query-sqlite'

const paths = vi.hoisted(() => ({ home: '' }))
vi.mock('@deepseek-ai/dsh-home-paths', () => ({ resolveDshHome: () => paths.home }))
class Transport extends Service { constructor(ctx: Context) { super(ctx, 'connection') } }

it('mounts pets and notebook independently, preserves preferences and withdraws routes on disposal', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-independent-pets-')), ctx = new Context()
  paths.home = home
  onTestFinished(async () => { await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
  await ctx.plugin({ name: 'dependencies', apply: mountAgentLoopTestDependencies })
  await ctx.plugin(Transport)
  await ctx.plugin(JsonlSessionPersistence, { root: join(home, 'sessions') })
  await ctx.plugin(SqliteQuery, { path: ':memory:', openAt: 'first-search' })
  const notebook = await ctx.plugin(Notebook, Notebook.Config({}))
  let pets = await ctx.plugin(Pets)
  const server = createServer((request, response) => {
    void ctx.waterfall('connection/request', request, response, () => { response.writeHead(404); response.end('{}'); return Promise.resolve() })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  onTestFinished(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const post = async (path: string, input: object = {}) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    return { status: response.status, value: await response.json() }
  }
  const state = await post('/api/nidofy-pets/status')
  expect(state.status).toBe(200)
  expect(state.value.features.pets).toBe('DISABLED')
  const initial = state.value.preferences
  const saved = await post('/api/nidofy-pets/preferences', { ...initial, pets: true, diagnostics: true })
  expect(saved.value).toMatchObject({ revision: 1, pets: true, diagnostics: false })
  expect((await post('/api/nidofy-pets/status')).value.features.pets).toBe('ENABLED')
  expect((await post('/api/nidofy-pets/preferences', initial)).status).toBe(409)
  expect((await post('/api/nidofy-pets/pet/snapshot', { id: 'absent' })).status).toBe(400)
  const resources = await post('/api/nidofy-pets/pet/packages', { action: 'list' })
  expect(resources.value.items.some((row: { id: string }) => row.id === 'xiaojing')).toBe(true)
  const page = await fetch(base + '/api/nidofy-pets/ui?locale=zh-CN')
  expect(await page.text()).toContain('桌宠')
  const atlas = await fetch(base + '/api/nidofy-pets/assets/pet/assets/xiaojing/spritesheet.webp')
  expect(atlas.status).toBe(200)
  expect(atlas.headers.get('content-type')).toBe('image/webp')
  expect((await fetch(base + '/api/nidofy-pets/assets/%2e%2e%2fpackage.json')).status).toBe(400)
  expect((await post('/api/nidofy-pets/diagnostics')).status).toBe(400)
  expect((await post('/api/nidofy-notebook/settings')).status).toBe(200)
  await pets.dispose()
  expect((await post('/api/nidofy-pets/status')).status).toBe(404)
  expect((await post('/api/nidofy-notebook/settings')).status).toBe(200)
  pets = await ctx.plugin(Pets)
  expect((await post('/api/nidofy-pets/status')).value.preferences.revision).toBe(1)
  await notebook.dispose()
  expect((await post('/api/nidofy-notebook/settings')).status).toBe(404)
  expect((await post('/api/nidofy-pets/status')).status).toBe(200)
  await pets.dispose()
  expect(JSON.parse(await readFile(join(home, 'nidofy-extras/preferences.json'), 'utf8')).pets).toBe(true)
})

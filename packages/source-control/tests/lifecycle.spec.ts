import { expect, it, onTestFinished } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as Plugin from '../src/index.ts'

class Transport extends Service { constructor(ctx: Context) { super(ctx, 'connection') } }
it('withdraws routes on unload, cancels incomplete bodies and can be enabled again', async () => {
  const ctx = new Context(); await ctx.plugin(Transport)
  const server = createServer((req, res) => { void ctx.waterfall('connection/request', req, res, async () => { res.statusCode = 404; res.end('{}') }) })
  onTestFinished(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await ctx.fiber.dispose() })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/nidofy-vcs/repositories`
  const post = () => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  let fiber = await ctx.plugin(Plugin, Plugin.Config({ includeWorkspaces: false }))
  expect(await (await post()).json()).toEqual({ repositories: [], warnings: [] })
  const upload = request(base, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '100' } })
  const ended = new Promise<void>(resolve => { upload.on('error', () => resolve()); upload.on('close', () => resolve()) })
  upload.write('{')
  // Wait for server admission, not a fixed delay.
  await new Promise<void>(resolve => server.once('request', () => resolve()))
  await fiber.dispose(); await ended
  expect((await post()).status).toBe(404)
  fiber = await ctx.plugin(Plugin, Plugin.Config({ includeWorkspaces: false }))
  expect((await post()).status).toBe(200)
  await fiber.dispose(); expect((await post()).status).toBe(404)
})

import { expect, it, onTestFinished } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as Plugin from '../src/index.ts'

class Transport extends Service { constructor(ctx: Context) { super(ctx, 'connection') } }
it('withdraws its asset route on every unload, delegates other routes, and reenables without extras', async () => {
  const ctx = new Context(); await ctx.plugin(Transport)
  const server = createServer((req, res) => { void ctx.waterfall('connection/request', req, res, async () => { res.statusCode = 418; res.end() }) })
  onTestFinished(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await ctx.fiber.dispose() })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  for (let i = 0; i < 3; i++) {
    const plugin = await ctx.plugin(Plugin)
    const asset = await fetch(base + '/api/nidofy-live2d/assets/upperbody.png')
    expect(asset.status).toBe(200); await asset.arrayBuffer()
    expect((await fetch(base + '/api/unrelated')).status).toBe(418)
    await plugin.dispose()
    expect((await fetch(base + '/api/nidofy-live2d/assets/upperbody.png')).status).toBe(418)
  }
})
it('terminates aborted asset responses instead of leaving an open request', async () => {
  const abort = new AbortController(); abort.abort()
  const server = createServer((req, res) => void Plugin.handleRequest(req, res, abort.signal))
  onTestFinished(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  await expect(fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/nidofy-live2d/assets/upperbody.png`)).rejects.toThrow()
})

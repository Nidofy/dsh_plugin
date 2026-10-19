import { it, expect } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.ts'

async function host(run: (url: string) => Promise<void>) {
  let handler!: (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => Promise<void>
  let dispose!: () => Promise<void>
  const ctx = {
    on(name: string, listener: typeof handler) { if (name === 'connection/request') handler = listener },
    effect(factory: () => () => Promise<void>) { dispose = factory() },
  } as unknown as Context
  apply(ctx, { roots: [], maxEntries: 10 })
  const server = createServer((req, res) => { void handler(req, res, async () => { res.statusCode = 404; res.end() }) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/windows-sandbox-enhanced/`) }
  finally { await dispose(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}
it('reports unprotected status and rejects paths not selected in trusted config', async () => host(async url => {
  const post = (route: string, body: unknown) => fetch(url + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  expect(await (await post('status', {})).json()).toMatchObject({ protected: false, mode: 'diagnostics-only', roots: [] })
  expect(await (await post('scan', { root: 'C:\\Users' })).json()).toEqual({ error: 'ROOT_NOT_REGISTERED' })
  expect(await (await post('scan', { root: 0 })).json()).toEqual({ error: 'ROOT_NOT_REGISTERED' })
  expect(await (await post('restore', {})).json()).toEqual({ error: 'NOT_FOUND' })
}))
it('rejects simple forms and cross-origin inspection requests', async () => host(async url => {
  expect((await fetch(url + 'status')).status).toBe(400)
  expect((await fetch(url + 'status', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(400)
  const response = await fetch(url + 'status', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://untrusted.invalid' }, body: '{}' })
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'ORIGIN_REFUSED' })
}))

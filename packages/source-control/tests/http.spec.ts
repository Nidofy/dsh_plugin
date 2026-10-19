import { afterEach, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { handleRequest } from '../src/index.ts'
import { SourceControl } from '../src/service.ts'

let server: Server | undefined, service: SourceControl | undefined
afterEach(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()); await service?.close() })
async function start() {
  service = new SourceControl(() => [])
  server = createServer((req, res) => { void handleRequest(service!, req, res, new AbortController().signal) })
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/nidofy-vcs/`
}
it('requires JSON same-origin requests and does not expose arbitrary paths or commands', async () => {
  const base = await start()
  expect((await fetch(base + 'repositories')).status).toBe(400)
  const headers = { 'content-type': 'application/json' }
  const post = (route: string, body: object, extra = {}) => fetch(base + route, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) })
  expect((await post('repositories', {}, { origin: 'https://evil.example' })).status).toBe(403)
  expect(await (await post('repositories', {})).json()).toEqual({ repositories: [], warnings: [] })
  expect((await post('execute', { command: 'git reset --hard' })).status).toBe(404)
  expect(await (await post('status', { id: 'C:/' })).json()).toEqual({ error: 'REPOSITORY_UNAVAILABLE' })
  expect((await post('repositories', { huge: 'x'.repeat(66000) })).status).toBe(400)
})

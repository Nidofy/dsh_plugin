import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { apply } from '../src/index.ts'

type RequestHandler = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> | void

class FakeContext {
  listeners = new Map<string, Set<RequestHandler>>()
  disposers: Array<() => Promise<void> | void> = []
  private services = new Map<string, unknown>()
  logger = { warn() {} }

  constructor(profileDir: string) {
    this.services.set('profileContext', { dir: profileDir })
  }

  get(name: string): any {
    return this.services.get(name)
  }

  on(event: string, fn: RequestHandler): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn)
    const dispose = () => {
      set?.delete(fn)
    }
    this.disposers.push(dispose)
    return dispose
  }

  effect(factory: () => () => Promise<void> | void): void {
    const cleanup = factory()
    this.disposers.push(cleanup)
  }

  async disposeAll(): Promise<void> {
    const items = [...this.disposers].reverse()
    this.disposers.length = 0
    for (const fn of items) await fn()
  }
}

describe('Host RPC guards and repeated mount/dispose lifecycle', () => {
  it('enforces Origin / POST / JSON guards and leaves zero leaked listeners or locks across restarts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-infra-host-'))
    const ctx = new FakeContext(dir)
    const server = createServer(async (req, res) => {
      const handlers = [...(ctx.listeners.get('connection/request') ?? [])]
      let idx = 0
      const next = () => {
        const h = handlers[idx++]
        if (h) void h(req, res, next)
        else {
          res.statusCode = 404
          res.end('not found')
        }
      }
      next()
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address() as { port: number }
    const rpcUrl = `http://127.0.0.1:${addr.port}/api/ai-infra-lab/rpc`

    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        await apply(ctx as any, { image: 'dsh-ai-infra-lab-cpu:0.1' })
        assert.equal(ctx.listeners.get('connection/request')?.size, 1)

        // Cross-site request must be refused
        const crossSite = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
          body: JSON.stringify({ method: 'overview', args: [] }),
        })
        assert.equal(crossSite.status, 400)

        // Valid same-origin overview call
        const ok = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method: 'overview', args: [] }),
        })
        assert.equal(ok.status, 200)
        const body = (await ok.json()) as { catalog: { id: string } }
        assert.equal(body.catalog.id, 'ai-infra-lab')

        await ctx.disposeAll()
        assert.equal(ctx.listeners.get('connection/request')?.size ?? 0, 0)
      }
    } finally {
      await ctx.disposeAll()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await rm(dir, { recursive: true, force: true })
    }
  })
})
